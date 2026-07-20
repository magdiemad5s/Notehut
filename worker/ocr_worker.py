"""
NoteHut modular OCR/AI gateway worker.
Runs on notebook runtimes or persistent Linux GPU hosts.

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
import uuid
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
import httpx
import torch
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# =============================================================================
# Configuration — read from env vars only
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
WORKER_API_KEY = os.environ.get("WORKER_API_KEY", "")
NOTEHUT_ROLE = os.environ.get("NOTEHUT_ROLE", "full").strip().lower()
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
STALE_TIMEOUT_MINUTES = int(os.environ.get("STALE_TIMEOUT_MINUTES", "30"))
OCR_TEXT_THRESHOLD = int(os.environ.get("OCR_TEXT_THRESHOLD", "50"))
OCR_DPI = int(os.environ.get("OCR_DPI", "300"))
PORT = int(os.environ.get("PORT", "8000"))
OCR_MODEL_ID = os.environ.get("OCR_MODEL_ID", "baidu/Unlimited-OCR")
OCR_MODEL_REVISION = os.environ.get(
    "OCR_MODEL_REVISION",
    "ee63731b6461c8afcdcc7b15352e7d2ffecc2ead",
)
OCR_MAX_PAGES = int(os.environ.get("OCR_MAX_PAGES", "40"))
OCR_MAX_PIXELS = int(os.environ.get("OCR_MAX_PIXELS", "500000000"))
OCR_BATCH_PAGES = int(os.environ.get("OCR_BATCH_PAGES", "4"))
OCR_MAX_DOWNLOAD_BYTES = int(os.environ.get("OCR_MAX_DOWNLOAD_BYTES", str(25 * 1024 * 1024)))
OCR_TESSERACT_FALLBACK = os.environ.get("OCR_TESSERACT_FALLBACK", "true").lower() == "true"
OCR_FORCE_TESSERACT = os.environ.get("OCR_FORCE_TESSERACT", "false").lower() == "true"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

VALID_ROLES = {"ocr", "embeddings", "llm", "ai", "full"}
if NOTEHUT_ROLE not in VALID_ROLES:
    raise ValueError(f"Invalid NOTEHUT_ROLE {NOTEHUT_ROLE!r}; expected one of {sorted(VALID_ROLES)}")

OCR_ENABLED = NOTEHUT_ROLE in {"ocr", "full"}
EMBEDDINGS_ENABLED = NOTEHUT_ROLE in {"embeddings", "ai", "full"}
LLM_ENABLED = NOTEHUT_ROLE in {"llm", "ai", "full"}

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

app = FastAPI(title="NoteHut Modular Worker")

# Browser-to-worker CORS is opt-in. Server-side NoteHut routes and notebook
# readiness checks do not need it. Configure a comma-separated allowlist only
# if an administrator intentionally tests the worker directly from a browser.
if ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Authorization"],
    )

# =============================================================================
# OCR Engine — lazy-loaded globals
# =============================================================================

_ocr_model = None
_ocr_tokenizer = None
_poll_task: Optional[asyncio.Task] = None
_ocr_lock = threading.Lock()


def get_ocr_model():
    """Lazy-load Unlimited-OCR model onto GPU. Caches in globals."""
    global _ocr_model, _ocr_tokenizer
    if _ocr_model is not None:
        return _ocr_model, _ocr_tokenizer

    logger.info("Loading Unlimited-OCR model (may take a minute)...")
    from transformers import AutoModel, AutoTokenizer

    if not torch.cuda.is_available():
        raise RuntimeError("Unlimited-OCR requires a CUDA GPU")
    if not torch.cuda.is_bf16_supported():
        raise RuntimeError(
            "Unlimited-OCR's pinned Transformers implementation requires BF16. "
            "Use an Ampere-or-newer GPU, or enable the Tesseract fallback for T4."
        )

    _ocr_tokenizer = AutoTokenizer.from_pretrained(
        OCR_MODEL_ID,
        revision=OCR_MODEL_REVISION,
        trust_remote_code=True,
    )
    _ocr_model = AutoModel.from_pretrained(
        OCR_MODEL_ID,
        revision=OCR_MODEL_REVISION,
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
        if len(doc) > OCR_MAX_PAGES:
            raise ValueError(
                f"PDF has {len(doc)} pages; maximum scanned-PDF limit is {OCR_MAX_PAGES}"
            )
        total_pixels = 0
        for i, page in enumerate(doc):
            rendered_width = max(1, int(page.rect.width * dpi / 72))
            rendered_height = max(1, int(page.rect.height * dpi / 72))
            total_pixels += rendered_width * rendered_height
            if total_pixels > OCR_MAX_PIXELS:
                raise ValueError("PDF exceeds the configured rendered-pixel budget")
            out = os.path.join(tmpdir, f"page_{i:04d}.png")
            page.get_pixmap(matrix=mat).save(out)
            paths.append(out)
    except Exception:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise
    finally:
        doc.close()
    return paths


def _read_ocr_results(output_path: str) -> str:
    """Read output formats used by pinned and legacy OCR revisions."""
    result_md = Path(output_path) / "result.md"
    if result_md.is_file():
        return result_md.read_text(encoding="utf-8")
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
    """Run Unlimited-OCR on PDF, keeping the cached model for later jobs."""
    model, tokenizer = get_ocr_model()
    images = pdf_to_images(pdf_path, dpi=OCR_DPI)
    output_path = tempfile.mkdtemp()
    try:
        page_texts = []
        for start in range(0, len(images), max(1, OCR_BATCH_PAGES)):
            batch = images[start:start + max(1, OCR_BATCH_PAGES)]
            batch_output = os.path.join(output_path, f"batch_{start:04d}")
            result = model.infer_multi(
                tokenizer,
                prompt="<image>Multi page parsing.",
                image_files=batch,
                output_path=batch_output,
                image_size=1024,
                max_length=32768,
                no_repeat_ngram_size=35,
                ngram_window=1024,
                save_results=True,
            )
            text = result[0] if isinstance(result, tuple) else result
            if not isinstance(text, str) or not text.strip():
                text = _read_ocr_results(batch_output)
            if text.strip():
                page_texts.append(text.strip())
        return "\n\n".join(page_texts)
    finally:
        _cleanup_temp_files(images, output_path)


def run_tesseract_ocr(pdf_path: str) -> str:
    """CPU fallback for T4/CPU runtimes where Unlimited-OCR BF16 is unavailable."""
    import pytesseract
    from PIL import Image

    images = pdf_to_images(pdf_path, dpi=min(OCR_DPI, 220))
    try:
        parts = []
        for image_path in images:
            with Image.open(image_path) as image:
                parts.append(pytesseract.image_to_string(image))
        return "\n\n".join(part.strip() for part in parts if part.strip())
    finally:
        _cleanup_temp_files(images, None)


def extract_text(pdf_path: str, accelerated_ocr_online: bool) -> str:
    """Extract text from PDF. Uses PyMuPDF first, falls back to OCR if sparse."""
    doc = fitz.open(pdf_path)
    text = "".join(page.get_text() for page in doc)
    doc.close()

    if len(text.strip()) >= OCR_TEXT_THRESHOLD:
        logger.info("Text-based PDF: %d chars extracted", len(text.strip()))
        return text

    can_use_unlimited = (
        accelerated_ocr_online
        and not OCR_FORCE_TESSERACT
        and torch.cuda.is_available()
        and torch.cuda.is_bf16_supported()
    )
    if not can_use_unlimited and not OCR_TESSERACT_FALLBACK:
        raise ValueError(
            "PDF appears scanned but no compatible OCR engine is enabled. "
            "Enable accelerated OCR on a BF16 GPU or configure the Tesseract fallback."
        )

    logger.info("Text sparse (%d chars), running OCR...", len(text.strip()))
    with _ocr_lock:
        if can_use_unlimited:
            result = run_unlimited_ocr(pdf_path)
        elif OCR_TESSERACT_FALLBACK:
            logger.warning("BF16 OCR unavailable; using the CPU Tesseract fallback")
            result = run_tesseract_ocr(pdf_path)
        else:
            raise RuntimeError("No compatible scanned-PDF OCR engine is available")
    if not result.strip():
        raise ValueError("OCR completed without extracting readable text")
    return result


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


def claim_queue_item(supabase, item_id: str) -> Optional[str]:
    """Atomically claim an item: update only if still 'pending'."""
    claim_token = str(uuid.uuid4())
    result = (
        supabase.table("ocr_queue")
        .update({"status": "processing", "claim_token": claim_token, "error": None})
        .eq("id", item_id)
        .eq("status", "pending")
        .execute()
    )
    return claim_token if len(result.data) > 0 else None


def complete_queue_item(supabase, item_id: str, claim_token: str, extracted_text: str) -> bool:
    """Complete only the lease owned by this worker invocation."""
    result = (
        supabase.table("ocr_queue")
        .update({
            "status": "completed",
            "extracted_text": extracted_text,
            "claim_token": None,
        })
        .eq("id", item_id)
        .eq("status", "processing")
        .eq("claim_token", claim_token)
        .execute()
    )
    return len(result.data) > 0


def fail_queue_item(supabase, item_id: str, claim_token: str, error: str) -> bool:
    """Fail only the lease owned by this worker invocation."""
    result = (
        supabase.table("ocr_queue")
        .update({
            "status": "failed",
            "error": str(error)[:1000],
            "claim_token": None,
        })
        .eq("id", item_id)
        .eq("status", "processing")
        .eq("claim_token", claim_token)
        .execute()
    )
    return len(result.data) > 0


def recover_stale_items(supabase):
    """Re-claim items stuck in 'processing' for longer than STALE_TIMEOUT_MINUTES."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=STALE_TIMEOUT_MINUTES)).isoformat()
    result = (
        supabase.table("ocr_queue")
        .update({"status": "pending", "error": None, "claim_token": None})
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
    if len(data) > OCR_MAX_DOWNLOAD_BYTES:
        raise ValueError("Stored PDF exceeds the worker download-size limit")
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
    claim_token = claim_queue_item(supabase, item_id)
    if not claim_token:
        return

    logger.info("Claimed item %s", item_id)
    tmp_path = None
    heartbeat_stop = asyncio.Event()

    async def heartbeat():
        """Keep the current lease fresh while a long OCR task is running."""
        interval = max(10, min(60, STALE_TIMEOUT_MINUTES * 60 // 3))
        while not heartbeat_stop.is_set():
            try:
                await asyncio.wait_for(heartbeat_stop.wait(), timeout=interval)
                break
            except asyncio.TimeoutError:
                try:
                    result = (
                        supabase.table("ocr_queue")
                        .update({"updated_at": datetime.now(timezone.utc).isoformat()})
                        .eq("id", item_id)
                        .eq("status", "processing")
                        .eq("claim_token", claim_token)
                        .execute()
                    )
                    if not result.data:
                        logger.warning("Lease heartbeat lost for item %s", item_id)
                        break
                except Exception as heartbeat_error:
                    logger.warning("Heartbeat failed for item %s: %s", item_id, heartbeat_error)

    heartbeat_task = asyncio.create_task(heartbeat())
    try:
        tmp_path = download_pdf(supabase, item["file_url"])
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(None, extract_text, tmp_path, accelerated)
        if complete_queue_item(supabase, item_id, claim_token, text):
            logger.info("Completed item %s (%d chars)", item_id, len(text))
        else:
            logger.warning("Discarded stale result for item %s", item_id)
    except Exception as e:
        logger.error("Failed item %s: %s", item_id, e)
        if not fail_queue_item(supabase, item_id, claim_token, str(e)):
            logger.warning("Did not overwrite newer lease for failed item %s", item_id)
    finally:
        heartbeat_stop.set()
        await heartbeat_task
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
    """Require the configured bearer token on every public endpoint."""
    if not WORKER_API_KEY:
        return Response(
            content='{"detail":"Worker API key is not configured"}',
            status_code=503,
            media_type="application/json",
        )
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
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    ollama_online = None
    if EMBEDDINGS_ENABLED or LLM_ENABLED:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{OLLAMA_URL.rstrip('/')}/api/version")
                response.raise_for_status()
            ollama_online = True
        except Exception as error:
            logger.warning("Ollama health check failed: %s", error)
            ollama_online = False

    payload = {
        "status": "ok",
        "role": NOTEHUT_ROLE,
        "capabilities": {
            "ocr": OCR_ENABLED,
            "embeddings": EMBEDDINGS_ENABLED,
            "llm": LLM_ENABLED,
        },
        "ocr_engine": (
            "unlimited-ocr"
            if not OCR_FORCE_TESSERACT and torch.cuda.is_available() and torch.cuda.is_bf16_supported()
            else "tesseract"
        ) if OCR_ENABLED else None,
        "gpu": gpu_name,
        "ollama_online": ollama_online,
    }
    if ollama_online is False:
        payload["status"] = "degraded"
        return JSONResponse(payload, status_code=503)
    return payload


@app.get("/status")
async def status(request: Request):
    """Return worker status, GPU info, and pending queue count."""
    unauthorized = _validate_api_key(request)
    if unauthorized:
        return unauthorized
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
        "role": NOTEHUT_ROLE,
        "engine": (
            "unlimited-ocr"
            if OCR_ENABLED and not OCR_FORCE_TESSERACT and gpu_available and torch.cuda.is_bf16_supported()
            else "tesseract" if OCR_ENABLED else None
        ),
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
        "upgrade", "authorization",
    }
    return {k: v for k, v in headers.items() if k.lower() not in hop_by_hop}


@app.api_route("/ollama", methods=["GET", "POST"])
@app.api_route("/ollama/{path:path}", methods=["GET", "POST"])
async def proxy_ollama(request: Request, path: str = ""):
    """Reverse proxy all requests to local Ollama server.

    Handles streaming SSE responses (chat completions) and regular responses.
    """
    unauthorized = _validate_api_key(request)
    if unauthorized:
        return unauthorized

    normalized_path = path.strip("/")
    allowed_get_paths = {"v1/models"}
    allowed_post_paths = set()
    if EMBEDDINGS_ENABLED:
        allowed_post_paths.update({"v1/embeddings", "api/embed"})
    if LLM_ENABLED:
        allowed_post_paths.update({"v1/chat/completions", "v1/responses", "api/chat", "api/generate"})

    if request.method == "GET" and normalized_path not in allowed_get_paths:
        return Response(content='{"detail":"Route not enabled for this role"}', status_code=404, media_type="application/json")
    if request.method == "POST" and normalized_path not in allowed_post_paths:
        return Response(content='{"detail":"Route not enabled for this role"}', status_code=404, media_type="application/json")
    if request.method not in {"GET", "POST"}:
        return Response(content='{"detail":"Method not allowed"}', status_code=405, media_type="application/json")

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
            headers=_filter_headers(dict(resp.headers)),
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
    if not WORKER_API_KEY:
        logger.error("WORKER_API_KEY is required; public endpoints will remain unavailable")
        return
    if not OCR_ENABLED:
        logger.info("OCR polling disabled for role %s", NOTEHUT_ROLE)
        return
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
    unload_ocr_model()


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
