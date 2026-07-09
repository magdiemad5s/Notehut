"""
NoteHut OCR Worker — FastAPI server for PDF text extraction.
Runs on Google Colab with Tesla T4 GPU.

Polls ocr_queue from Supabase, downloads PDFs from storage, extracts text
using PyMuPDF (text PDFs) or baidu/Unlimited-OCR (scanned PDFs), and
writes results back. Also provides a reverse proxy to local Ollama server
for embeddings and LLM inference.
"""

import asyncio
import gc
import logging
import os
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
import httpx
import torch
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# =============================================================================
# Configuration — read from env vars only
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
WORKER_API_KEY = os.environ.get("WORKER_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
STALE_TIMEOUT_MINUTES = int(os.environ.get("STALE_TIMEOUT_MINUTES", "30"))
OCR_TEXT_THRESHOLD = int(os.environ.get("OCR_TEXT_THRESHOLD", "50"))
OCR_DPI = int(os.environ.get("OCR_DPI", "300"))
PORT = int(os.environ.get("PORT", "8000"))

# =============================================================================
# Logging
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("notehut-ocr-worker")

# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(title="NoteHut OCR Worker")

# CORS — allow the browser (admin panel) to call the worker directly.
# The "Test Worker" button makes a cross-origin fetch from notehut.vercel.app
# to the Cloudflare tunnel URL; without these headers the browser blocks it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tunnel URLs change every Colab session
    allow_credentials=False,      # no cookies; Bearer token goes in Authorization header
    allow_methods=["*"],          # includes OPTIONS preflight
    allow_headers=["*"],          # allows Authorization
)

# =============================================================================
# OCR Engine — lazy-loaded globals
# =============================================================================

_ocr_model = None
_ocr_tokenizer = None
_poll_task: Optional[asyncio.Task] = None


def get_ocr_model():
    """Lazy-load Unlimited-OCR model onto GPU. Caches in globals."""
    global _ocr_model, _ocr_tokenizer
    if _ocr_model is not None:
        return _ocr_model, _ocr_tokenizer

    logger.info("Loading Unlimited-OCR model (may take a minute)...")
    from transformers import AutoModel, AutoTokenizer

    _ocr_tokenizer = AutoTokenizer.from_pretrained(
        "baidu/Unlimited-OCR", trust_remote_code=True
    )
    _ocr_model = AutoModel.from_pretrained(
        "baidu/Unlimited-OCR",
        trust_remote_code=True,
        use_safetensors=True,
        torch_dtype=torch.bfloat16,
    )
    _ocr_model = _ocr_model.eval().cuda()
    logger.info("Unlimited-OCR loaded on GPU")
    return _ocr_model, _ocr_tokenizer


def unload_ocr_model():
    """Free Unlimited-OCR model from GPU memory."""
    global _ocr_model, _ocr_tokenizer
    _ocr_model = None
    _ocr_tokenizer = None
    torch.cuda.empty_cache()
    gc.collect()
    logger.info("Unlimited-OCR unloaded, GPU memory freed")


def pdf_to_images(pdf_path: str, dpi: int = 300):
    """Render each PDF page as PNG. Returns list of image paths."""
    doc = fitz.open(pdf_path)
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    tmpdir = tempfile.mkdtemp()
    paths = []
    try:
        for i, page in enumerate(doc):
            out = os.path.join(tmpdir, f"page_{i:04d}.png")
            page.get_pixmap(matrix=mat).save(out)
            paths.append(out)
    finally:
        doc.close()
    return paths


def _read_ocr_results(output_path: str) -> str:
    """Read all .txt files from output_path and join them."""
    parts = []
    for f in sorted(Path(output_path).glob("*.txt")):
        parts.append(f.read_text(encoding="utf-8"))
    return "\n".join(parts)


def _cleanup_temp_files(images, output_path):
    """Remove temporary image and output files."""
    for img in images:
        try:
            os.remove(img)
        except OSError:
            pass
    parent = os.path.dirname(images[0]) if images else None
    if parent and os.path.isdir(parent):
        try:
            shutil.rmtree(parent)
        except OSError:
            pass
    if output_path and os.path.isdir(output_path):
        try:
            shutil.rmtree(output_path)
        except OSError:
            pass


def run_unlimited_ocr(pdf_path: str) -> str:
    """Run Unlimited-OCR on PDF, return extracted text. Frees GPU when done."""
    model, tokenizer = get_ocr_model()
    images = pdf_to_images(pdf_path, dpi=OCR_DPI)
    output_path = tempfile.mkdtemp()
    try:
        model.infer_multi(
            tokenizer,
            prompt="<image>Multi page parsing.",
            image_files=images,
            output_path=output_path,
            image_size=1024,
            max_length=32768,
            no_repeat_ngram_size=35,
            ngram_window=1024,
            save_results=True,
        )
        return _read_ocr_results(output_path)
    finally:
        unload_ocr_model()
        _cleanup_temp_files(images, output_path)


def extract_text(pdf_path: str, accelerated_ocr_online: bool) -> str:
    """Extract text from PDF. Uses PyMuPDF first, falls back to OCR if sparse."""
    doc = fitz.open(pdf_path)
    text = "".join(page.get_text() for page in doc)
    doc.close()

    if len(text.strip()) >= OCR_TEXT_THRESHOLD:
        logger.info("Text-based PDF: %d chars extracted", len(text.strip()))
        return text

    if not accelerated_ocr_online:
        raise ValueError(
            "PDF appears scanned but accelerated OCR is disabled. "
            "Enable it in admin settings to process scanned documents."
        )

    logger.info("Text sparse (%d chars), running OCR...", len(text.strip()))
    return run_unlimited_ocr(pdf_path)


# =============================================================================
# Supabase Helpers
# =============================================================================


def create_supabase_client():
    """Create a Supabase client using service role key (bypasses RLS)."""
    from supabase import create_client

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def fetch_pending_queue(supabase, limit: int = 5):
    """Fetch next pending OCR items, oldest first."""
    result = (
        supabase.table("ocr_queue")
        .select("id, file_url")
        .eq("status", "pending")
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return result.data if result.data else []


def claim_queue_item(supabase, item_id: str) -> bool:
    """Atomically claim an item: update only if still 'pending'."""
    result = (
        supabase.table("ocr_queue")
        .update({"status": "processing"})
        .eq("id", item_id)
        .eq("status", "pending")
        .execute()
    )
    return len(result.data) > 0


def complete_queue_item(supabase, item_id: str, extracted_text: str):
    """Mark item as completed with extracted text."""
    supabase.table("ocr_queue").update(
        {"status": "completed", "extracted_text": extracted_text}
    ).eq("id", item_id).execute()


def fail_queue_item(supabase, item_id: str, error: str):
    """Mark item as failed with error message."""
    supabase.table("ocr_queue").update(
        {"status": "failed", "error": str(error)[:1000]}
    ).eq("id", item_id).execute()


def recover_stale_items(supabase):
    """Re-claim items stuck in 'processing' for longer than STALE_TIMEOUT_MINUTES."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=STALE_TIMEOUT_MINUTES)).isoformat()
    result = (
        supabase.table("ocr_queue")
        .update({"status": "pending", "error": None})
        .eq("status", "processing")
        .lt("updated_at", cutoff)
        .execute()
    )
    if result.data:
        logger.info("Recovered %d stale items", len(result.data))


def get_accelerated_ocr_setting(supabase) -> bool:
    """Read 'accelerated_ocr_online' from app_settings (jsonb)."""
    result = (
        supabase.table("app_settings")
        .select("value")
        .eq("key", "accelerated_ocr_online")
        .execute()
    )
    if not result.data:
        return False
    value = result.data[0]["value"]
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() == "true"
    return False


def download_pdf(supabase, file_url: str) -> str:
    """Download PDF from Supabase storage. Returns temp file path."""
    data = supabase.storage.from_("pdfs").download(file_url)
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.write(data)
    tmp.close()
    return tmp.name


# =============================================================================
# Polling Loop
# =============================================================================


async def process_single_item(supabase, item: dict, accelerated: bool):
    """Claim, process, and complete/fail a single queue item."""
    item_id = item["id"]
    if not claim_queue_item(supabase, item_id):
        return

    logger.info("Claimed item %s", item_id)
    tmp_path = None
    try:
        tmp_path = download_pdf(supabase, item["file_url"])
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(None, extract_text, tmp_path, accelerated)
        complete_queue_item(supabase, item_id, text)
        logger.info("Completed item %s (%d chars)", item_id, len(text))
    except Exception as e:
        logger.error("Failed item %s: %s", item_id, e)
        fail_queue_item(supabase, item_id, str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


async def process_pending_items(supabase):
    """One poll cycle: recover stale, fetch pending, process each."""
    try:
        recover_stale_items(supabase)
    except Exception as e:
        logger.error("Stale recovery error: %s", e)

    items = fetch_pending_queue(supabase)
    if not items:
        return

    accelerated = get_accelerated_ocr_setting(supabase)
    logger.info("Processing %d items (accelerated_ocr=%s)", len(items), accelerated)

    for item in items:
        try:
            await process_single_item(supabase, item, accelerated)
        except Exception as e:
            logger.error("Unhandled error processing item %s: %s", item.get("id"), e)


async def poll_loop():
    """Background task: poll ocr_queue every POLL_INTERVAL seconds."""
    supabase = create_supabase_client()
    logger.info("Polling loop started (interval=%ds)", POLL_INTERVAL)
    while True:
        try:
            await process_pending_items(supabase)
        except Exception as e:
            logger.error("Poll cycle error: %s", e)
        await asyncio.sleep(POLL_INTERVAL)


# =============================================================================
# FastAPI Endpoints
# =============================================================================


def _validate_api_key(request: Request) -> Optional[Response]:
    """Return 401 response if API key is configured and doesn't match."""
    if not WORKER_API_KEY:
        return None
    auth = request.headers.get("Authorization", "")
    if auth == f"Bearer {WORKER_API_KEY}":
        return None
    return Response(
        content='{"detail":"Unauthorized"}',
        status_code=401,
        media_type="application/json",
        headers={"WWW-Authenticate": "Bearer"},
    )


@app.get("/health")
async def health(request: Request):
    """Health check endpoint. Validates API key if configured."""
    unauthorized = _validate_api_key(request)
    if unauthorized:
        return unauthorized
    return {"status": "ok", "engine": "unlimited-ocr", "gpu": "T4"}


@app.get("/status")
async def status():
    """Return worker status, GPU info, and pending queue count."""
    gpu_available = torch.cuda.is_available()
    gpu_memory_used_mb = 0
    gpu_memory_total_mb = 0
    if gpu_available:
        gpu_memory_used_mb = torch.cuda.memory_allocated(0) // 1024 // 1024
        gpu_memory_total_mb = (
            torch.cuda.get_device_properties(0).total_memory // 1024 // 1024
        )

    pending_count = 0
    try:
        supabase = create_supabase_client()
        result = (
            supabase.table("ocr_queue")
            .select("id", count="exact")
            .eq("status", "pending")
            .execute()
        )
        pending_count = result.count if hasattr(result, "count") else len(result.data)
    except Exception as e:
        logger.warning("Failed to count pending items: %s", e)

    return {
        "status": "ok",
        "engine": "unlimited-ocr",
        "gpu_available": gpu_available,
        "gpu_memory_used_mb": gpu_memory_used_mb,
        "gpu_memory_total_mb": gpu_memory_total_mb,
        "pending_count": pending_count,
        "ocr_model_loaded": _ocr_model is not None,
    }


def _filter_headers(headers: dict) -> dict:
    """Remove hop-by-hop headers that must not be forwarded."""
    hop_by_hop = {
        "host", "connection", "transfer-encoding", "te",
        "keep-alive", "proxy-authorization", "proxy-authenticate",
        "upgrade",
    }
    return {k: v for k, v in headers.items() if k.lower() not in hop_by_hop}


@app.api_route("/ollama", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
@app.api_route("/ollama/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_ollama(request: Request, path: str = ""):
    """Reverse proxy all requests to local Ollama server.

    Handles streaming SSE responses (chat completions) and regular responses.
    """
    url = f"{OLLAMA_URL}/{path}"
    client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    try:
        body = await request.body() if request.method in ("POST", "PUT", "PATCH") else None
        req = client.build_request(
            request.method,
            url,
            params=request.query_params,
            headers=_filter_headers(dict(request.headers)),
            content=body,
        )
        resp = await client.send(req, stream=True)

        async def _iter():
            try:
                async for chunk in resp.aiter_bytes():
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            _iter(),
            status_code=resp.status_code,
            headers=dict(resp.headers),
            media_type=resp.headers.get("content-type"),
        )
    except Exception:
        await client.aclose()
        raise


# =============================================================================
# App Lifecycle
# =============================================================================


@app.on_event("startup")
async def startup():
    """Start the background polling task if Supabase is configured."""
    global _poll_task
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase not configured — polling disabled")
        return
    _poll_task = asyncio.create_task(poll_loop())
    logger.info("Polling task started")


@app.on_event("shutdown")
async def shutdown():
    """Cancel the background polling task on shutdown."""
    global _poll_task
    if _poll_task and not _poll_task.done():
        _poll_task.cancel()
        try:
            await _poll_task
        except asyncio.CancelledError:
            pass
        logger.info("Polling task cancelled")


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
