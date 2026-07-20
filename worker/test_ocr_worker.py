import os
import tempfile
import unittest
import asyncio
import importlib.util
import sys
from types import ModuleType, SimpleNamespace
from pathlib import Path
from unittest.mock import patch

# The module requires a valid role at import time.
os.environ.setdefault("NOTEHUT_ROLE", "ocr")

if importlib.util.find_spec("fastapi") is None:
    fastapi = ModuleType("fastapi")

    class FastAPI:
        def __init__(self, *args, **kwargs):
            pass

        def _decorator(self, *args, **kwargs):
            return lambda function: function

        get = api_route = on_event = _decorator

        def add_middleware(self, *args, **kwargs):
            pass

    class Response:
        def __init__(self, content=None, status_code=200, media_type=None, **kwargs):
            self.content = content
            self.status_code = status_code
            self.media_type = media_type

    fastapi.FastAPI = FastAPI
    fastapi.Request = object
    fastapi.Response = Response
    cors = ModuleType("fastapi.middleware.cors")
    cors.CORSMiddleware = object
    responses = ModuleType("fastapi.responses")
    responses.StreamingResponse = Response
    responses.JSONResponse = Response
    sys.modules.update({
        "fastapi": fastapi,
        "fastapi.middleware": ModuleType("fastapi.middleware"),
        "fastapi.middleware.cors": cors,
        "fastapi.responses": responses,
    })

if importlib.util.find_spec("fitz") is None:
    fitz = ModuleType("fitz")
    fitz.open = lambda *args, **kwargs: None
    fitz.Matrix = lambda *args, **kwargs: None
    sys.modules["fitz"] = fitz

if importlib.util.find_spec("torch") is None:
    torch = ModuleType("torch")
    torch.cuda = SimpleNamespace(
        is_available=lambda: False,
        is_bf16_supported=lambda: False,
        empty_cache=lambda: None,
    )
    torch.bfloat16 = object()
    sys.modules["torch"] = torch

import ocr_worker


class OcrWorkerContractTests(unittest.TestCase):
    def test_reads_pinned_model_markdown_output(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "result.md").write_text("extracted text", encoding="utf-8")
            self.assertEqual(ocr_worker._read_ocr_results(directory), "extracted text")

    @patch("ocr_worker.run_tesseract_ocr", return_value="fallback text")
    @patch("ocr_worker.torch.cuda.is_available", return_value=True)
    @patch("ocr_worker.torch.cuda.is_bf16_supported", return_value=False)
    @patch("ocr_worker.fitz.open")
    def test_t4_uses_tesseract_fallback(
        self,
        fitz_open,
        _bf16_supported,
        _cuda_available,
        run_tesseract,
    ):
        document = fitz_open.return_value
        document.__iter__.return_value = iter([])

        result = ocr_worker.extract_text("scan.pdf", accelerated_ocr_online=False)

        self.assertEqual(result, "fallback text")
        run_tesseract.assert_called_once_with("scan.pdf")

    def test_worker_requires_api_key(self):
        class Request:
            headers = {}

        with patch.object(ocr_worker, "WORKER_API_KEY", ""):
            response = ocr_worker._validate_api_key(Request())
        self.assertEqual(response.status_code, 503)

    def test_ai_health_degrades_when_ollama_is_unavailable(self):
        class Request:
            headers = {"Authorization": "Bearer test-key"}

        with (
            patch.object(ocr_worker, "WORKER_API_KEY", "test-key"),
            patch.object(ocr_worker, "EMBEDDINGS_ENABLED", True),
            patch.object(ocr_worker, "LLM_ENABLED", False),
            patch("ocr_worker.httpx.AsyncClient", side_effect=RuntimeError("offline")),
        ):
            response = asyncio.run(ocr_worker.health(Request()))

        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
