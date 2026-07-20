"""Notebook-friendly runtime planner and process supervisor for NoteHut.

This module deliberately keeps orchestration out of the .ipynb JSON so Colab,
Kaggle, local Jupyter, and persistent GPU VMs all run the same tested logic.
"""

from __future__ import annotations

import hashlib
import os
import platform
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

RUNTIME_DIR = Path(
    os.environ.get(
        "NOTEHUT_RUNTIME_DIR",
        str(Path(tempfile.gettempdir()) / "notehut-runtime"),
    )
)
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

ROLE_CHOICES = ("ocr", "embeddings", "llm", "ai", "full")
TUNNEL_CHOICES = ("none", "ngrok", "cloudflare_named")
DEFAULT_EMBEDDINGS_MODEL = "qwen3-embedding:0.6b"
DEFAULT_OLLAMA_VERSION = "0.32.1"
DEFAULT_OLLAMA_INSTALLER_SHA256 = "25f64b810b947145095956533e1bdf56eacea2673c55a7e586be4515fc882c9f"
DEFAULT_CLOUDFLARED_VERSION = "2026.7.2"
CLOUDFLARED_SHA256 = {
    "x86_64": "ec905ea7b7e327ff8abdde8cb64697a2152de74dbcdbf6aec9db8364eb3886cd",
    "aarch64": "405df476437e027fc6d18729a5a77155c0a33a6082aeee60a799a688f3052e66",
}


@dataclass(frozen=True)
class GPUInfo:
    index: int
    uuid: str
    name: str
    memory_mb: int
    compute_capability: Optional[float] = None

    @property
    def memory_gb(self) -> float:
        return round(self.memory_mb / 1024, 1)

    @property
    def supports_bf16(self) -> bool:
        return bool(self.compute_capability and self.compute_capability >= 8.0)


@dataclass(frozen=True)
class RuntimePlan:
    role: str
    runtime: str
    summary: str
    ocr_gpu_uuid: Optional[str]
    ai_gpu_uuid: Optional[str]
    llm_model: Optional[str]
    embeddings_model: Optional[str]
    ocr_engine: Optional[str]
    warnings: tuple[str, ...]


def detect_runtime() -> str:
    if "google.colab" in sys.modules or os.environ.get("COLAB_RELEASE_TAG"):
        return "colab"
    if os.environ.get("KAGGLE_KERNEL_RUN_TYPE") or Path("/kaggle").exists():
        return "kaggle"
    return "jupyter"


def _query_compute_capabilities() -> dict[int, float]:
    try:
        import torch

        return {
            index: float(f"{torch.cuda.get_device_capability(index)[0]}.{torch.cuda.get_device_capability(index)[1]}")
            for index in range(torch.cuda.device_count())
        }
    except Exception:
        return {}


def detect_gpus() -> list[GPUInfo]:
    """Detect NVIDIA GPUs with stable UUIDs and physical VRAM sizes."""
    command = [
        "nvidia-smi",
        "--query-gpu=index,uuid,name,memory.total",
        "--format=csv,noheader,nounits",
    ]
    try:
        output = subprocess.check_output(command, text=True, stderr=subprocess.STDOUT)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return []

    capabilities = _query_compute_capabilities()
    gpus = []
    for line in output.splitlines():
        if not line.strip():
            continue
        index_raw, uuid_raw, name_raw, memory_raw = [part.strip() for part in line.split(",", 3)]
        index = int(index_raw)
        gpus.append(
            GPUInfo(
                index=index,
                uuid=uuid_raw,
                name=name_raw,
                memory_mb=int(memory_raw),
                compute_capability=capabilities.get(index),
            )
        )
    return gpus


def refresh_compute_capabilities(gpus: list[GPUInfo]) -> list[GPUInfo]:
    """Refresh capability values after the pinned Torch stack is installed."""
    capabilities = _query_compute_capabilities()
    if not capabilities:
        return gpus
    return [
        GPUInfo(
            index=gpu.index,
            uuid=gpu.uuid,
            name=gpu.name,
            memory_mb=gpu.memory_mb,
            compute_capability=capabilities.get(gpu.index),
        )
        for gpu in gpus
    ]


def recommend_plan(gpus: list[GPUInfo], requested_role: str = "auto") -> RuntimePlan:
    runtime = detect_runtime()
    if requested_role != "auto" and requested_role not in ROLE_CHOICES:
        raise ValueError(f"Unknown role: {requested_role}")

    warnings: list[str] = []
    if runtime == "colab":
        warnings.append(
            "Managed Colab is for interactive validation only. Public tunnels and remote application hosting are disabled."
        )

    python_version = (sys.version_info.major, sys.version_info.minor)
    if python_version < (3, 10) or python_version > (3, 13):
        raise RuntimeError(
            f"Unsupported Python {sys.version_info.major}.{sys.version_info.minor}; use Python 3.10-3.13."
        )

    if not gpus:
        role = "ocr" if requested_role == "auto" else requested_role
        includes_ai_without_gpu = role in {"embeddings", "llm", "ai", "full"}
        if includes_ai_without_gpu:
            raise RuntimeError(
                f"Role {role!r} requires an NVIDIA GPU. Select 'ocr' for CPU/native/Tesseract processing."
            )
        return RuntimePlan(
            role=role,
            runtime=runtime,
            summary="CPU runtime: native PDF extraction and Tesseract OCR only.",
            ocr_gpu_uuid=None,
            ai_gpu_uuid=None,
            llm_model=None,
            embeddings_model=None,
            ocr_engine="tesseract" if role in {"ocr", "full"} else None,
            warnings=tuple(warnings),
        )

    strongest = max(gpus, key=lambda gpu: gpu.memory_mb)
    if strongest.memory_gb < 8 and requested_role in {"auto", "embeddings", "llm", "ai", "full"}:
        raise RuntimeError("Detected GPU has less than 8 GB VRAM; select the OCR role or use a larger AI GPU.")
    bf16_gpus = [gpu for gpu in gpus if gpu.supports_bf16]
    role = requested_role

    if role == "auto":
        if len(gpus) >= 2:
            role = "full"
        else:
            role = "ai"
            warnings.append("Use a separate runtime for OCR; full mode requires two GPUs.")

    includes_ocr = role in {"ocr", "full"}
    includes_ai = role in {"embeddings", "llm", "ai", "full"}
    ai_gpu = strongest if includes_ai else None
    ocr_gpu = None
    if includes_ocr:
        candidates = [gpu for gpu in bf16_gpus if not ai_gpu or gpu.uuid != ai_gpu.uuid]
        if not candidates and role == "ocr":
            candidates = bf16_gpus
        if candidates:
            ocr_gpu = max(candidates, key=lambda gpu: gpu.memory_mb)
        elif len(gpus) >= 2 and role == "full":
            # T4 x2: dedicate one card to CPU-Tesseract/native extraction and
            # one to Ollama. Unlimited-OCR remains disabled because T4 has no BF16.
            ocr_gpu = min(gpus, key=lambda gpu: gpu.memory_mb)

    if role == "full" and len(gpus) >= 2:
        # Give accelerated OCR a BF16-capable device whenever one exists, then
        # allocate the strongest remaining device to Ollama. Stable indices
        # break ties for equivalent cards.
        ocr_gpu = max(bf16_gpus, key=lambda gpu: (gpu.memory_mb, -gpu.index)) if bf16_gpus else gpus[0]
        remaining = [gpu for gpu in gpus if gpu.uuid != ocr_gpu.uuid]
        ai_gpu = max(remaining, key=lambda gpu: (gpu.memory_mb, gpu.index))
    if role == "full" and len(gpus) < 2:
        raise RuntimeError(
            "Full mode requires two GPUs so OCR and AI cannot contend for VRAM. "
            "Use separate OCR and AI runtimes on a single-GPU host."
        )

    llm_model = None
    if role in {"llm", "ai", "full"}:
        llm_model = "qwen3.5:9b" if ai_gpu and ai_gpu.memory_gb >= 15 else "qwen3.5:4b"
    embeddings_model = DEFAULT_EMBEDDINGS_MODEL if role in {"embeddings", "ai", "full"} else None
    ocr_engine = None
    if includes_ocr:
        ocr_engine = "unlimited-ocr" if ocr_gpu and ocr_gpu.supports_bf16 else "tesseract"
        if ocr_engine == "tesseract":
            warnings.append(
                "This GPU uses Tesseract for scanned PDFs because the pinned Unlimited-OCR implementation requires BF16. "
                "For accelerated OCR, run the OCR role on an Ampere-or-newer GPU."
            )

    if len(gpus) >= 2 and role == "full":
        summary = "Multi-GPU plan: isolate OCR and Ollama on separate GPUs."
        if ocr_engine == "tesseract":
            summary = "Dual-T4 plan: Ollama on one T4; native/Tesseract OCR on the worker runtime."
    else:
        summary = f"{role.upper()} plan on {strongest.name} ({strongest.memory_gb} GB)."

    return RuntimePlan(
        role=role,
        runtime=runtime,
        summary=summary,
        ocr_gpu_uuid=ocr_gpu.uuid if ocr_gpu else None,
        ai_gpu_uuid=ai_gpu.uuid if ai_gpu else None,
        llm_model=llm_model,
        embeddings_model=embeddings_model,
        ocr_engine=ocr_engine,
        warnings=tuple(warnings),
    )


def plan_as_markdown(plan: RuntimePlan, gpus: list[GPUInfo]) -> str:
    gpu_rows = "\n".join(
        f"| {gpu.index} | {gpu.name} | {gpu.memory_gb} GB | {gpu.uuid} | {'yes' if gpu.supports_bf16 else 'no'} |"
        for gpu in gpus
    ) or "| — | No NVIDIA GPU | — | — | no |"
    warnings = "\n".join(f"- {warning}" for warning in plan.warnings) or "- None"
    return f"""
### Hardware
| GPU | Name | VRAM | Stable ID | Native BF16 |
|---:|---|---:|---|---|
{gpu_rows}

### Recommended workload: `{plan.role}`
{plan.summary}

| Component | Selection |
|---|---|
| OCR engine | {plan.ocr_engine or 'disabled'} |
| LLM | {plan.llm_model or 'disabled'} |
| Embeddings | {plan.embeddings_model or 'disabled'} |
| OCR GPU | {plan.ocr_gpu_uuid or 'CPU / none'} |
| AI GPU | {plan.ai_gpu_uuid or 'none'} |

### Warnings
{warnings}
""".strip()


def load_secret(name: str, required: bool = False) -> str:
    """Load a secret without putting it in notebook source or output."""
    value = os.environ.get(name, "")
    if value:
        return value

    runtime = detect_runtime()
    try:
        if runtime == "colab":
            from google.colab import userdata

            value = userdata.get(name) or ""
        elif runtime == "kaggle":
            from kaggle_secrets import UserSecretsClient

            value = UserSecretsClient().get_secret(name) or ""
    except Exception:
        value = ""

    if required and not value:
        raise RuntimeError(
            f"Missing secret {name}. Add it to Colab Secrets, Kaggle Add-ons > Secrets, or the process environment."
        )
    return value


def ensure_worker_key() -> str:
    key = load_secret("WORKER_API_KEY")
    generated = False
    if not key:
        key = secrets.token_urlsafe(32)
        generated = True
    os.environ["WORKER_API_KEY"] = key
    if generated:
        key_path = RUNTIME_DIR / "worker_api_key.txt"
        descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as key_file:
            key_file.write(key)
        try:
            key_path.chmod(0o600)
        except OSError:
            pass
    else:
        (RUNTIME_DIR / "worker_api_key.txt").unlink(missing_ok=True)
    return key


def _wait_for_url(url: str, headers: Optional[dict[str, str]] = None, timeout: int = 90) -> None:
    deadline = time.monotonic() + timeout
    last_error: Optional[Exception] = None
    while time.monotonic() < deadline:
        try:
            response = httpx.get(url, headers=headers, timeout=5)
            if 200 <= response.status_code < 400:
                return
        except Exception as error:
            last_error = error
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error or 'not ready'}")


def _wait_for_process_url(
    name: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
    timeout: int = 90,
) -> None:
    deadline = time.monotonic() + timeout
    last_error: Optional[Exception] = None
    while time.monotonic() < deadline:
        pid = _read_pid(name)
        if not _is_alive(pid):
            raise RuntimeError(f"{name} exited before readiness:\n{tail_log(name, 80)}")
        try:
            response = httpx.get(url, headers=headers, timeout=5)
            if 200 <= response.status_code < 400:
                return
        except Exception as error:
            last_error = error
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {name} at {url}: {last_error or 'not ready'}")


def _pid_path(name: str) -> Path:
    return RUNTIME_DIR / f"{name}.pid"


def _read_pid(name: str) -> Optional[int]:
    try:
        return int(_pid_path(name).read_text().strip())
    except (OSError, ValueError):
        return None


def _is_alive(pid: Optional[int]) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def stop_process(name: str) -> None:
    pid = _read_pid(name)
    if _is_alive(pid):
        try:
            if os.name == "posix":
                os.killpg(pid, signal.SIGTERM)
            else:
                os.kill(pid, signal.SIGTERM)
            deadline = time.monotonic() + 10
            while _is_alive(pid) and time.monotonic() < deadline:
                time.sleep(0.2)
            if _is_alive(pid):
                if os.name == "posix":
                    os.killpg(pid, signal.SIGKILL)
                else:
                    os.kill(pid, signal.SIGKILL)
        except OSError:
            pass
    _pid_path(name).unlink(missing_ok=True)
    if name == "cloudflared":
        (RUNTIME_DIR / "cloudflare_tunnel_token.txt").unlink(missing_ok=True)


def _start_process(name: str, command: list[str], env: dict[str, str]) -> int:
    stop_process(name)
    log_path = RUNTIME_DIR / f"{name}.log"
    log_handle = log_path.open("w", encoding="utf-8")
    process = subprocess.Popen(
        command,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        env=env,
        start_new_session=True,
    )
    log_handle.close()
    _pid_path(name).write_text(str(process.pid))
    return process.pid


def install_ollama() -> None:
    expected_version = os.environ.get("OLLAMA_VERSION", DEFAULT_OLLAMA_VERSION)
    existing = shutil.which("ollama")
    if existing:
        try:
            installed_version = subprocess.check_output(
                [existing, "--version"], text=True, stderr=subprocess.STDOUT
            )
            if expected_version in installed_version:
                return
        except subprocess.CalledProcessError:
            pass
    installer = RUNTIME_DIR / "install-ollama.sh"
    with httpx.stream("GET", "https://ollama.com/install.sh", timeout=60) as response:
        response.raise_for_status()
        installer.write_bytes(response.read())
    installer_digest = hashlib.sha256(installer.read_bytes()).hexdigest()
    expected_installer_digest = os.environ.get(
        "OLLAMA_INSTALLER_SHA256",
        DEFAULT_OLLAMA_INSTALLER_SHA256,
    )
    if installer_digest != expected_installer_digest:
        installer.unlink(missing_ok=True)
        raise RuntimeError("Ollama installer checksum verification failed")
    env = os.environ.copy()
    env["OLLAMA_VERSION"] = expected_version
    subprocess.run(["sh", str(installer)], check=True, env=env)


def install_cloudflared() -> str:
    """Install a pinned Cloudflare Tunnel binary with digest verification."""
    architecture = platform.machine().lower()
    normalized = "x86_64" if architecture in {"x86_64", "amd64"} else architecture
    expected_digest = CLOUDFLARED_SHA256.get(normalized)
    if not expected_digest:
        raise RuntimeError(f"Unsupported cloudflared architecture: {architecture}")

    asset_arch = "amd64" if normalized == "x86_64" else "arm64"
    version = os.environ.get("CLOUDFLARED_VERSION", DEFAULT_CLOUDFLARED_VERSION)
    url = (
        f"https://github.com/cloudflare/cloudflared/releases/download/{version}/"
        f"cloudflared-linux-{asset_arch}"
    )
    binary = RUNTIME_DIR / "cloudflared"
    if binary.is_file() and hashlib.sha256(binary.read_bytes()).hexdigest() == expected_digest:
        binary.chmod(0o755)
        return str(binary)
    with httpx.stream("GET", url, follow_redirects=True, timeout=120) as response:
        response.raise_for_status()
        digest = hashlib.sha256()
        with binary.open("wb") as output:
            for chunk in response.iter_bytes():
                digest.update(chunk)
                output.write(chunk)
    if digest.hexdigest() != expected_digest:
        binary.unlink(missing_ok=True)
        raise RuntimeError("cloudflared checksum verification failed")
    binary.chmod(0o755)
    return str(binary)


def start_ollama(plan: RuntimePlan) -> None:
    if plan.role not in {"embeddings", "llm", "ai", "full"}:
        return
    install_ollama()
    if not plan.ai_gpu_uuid:
        raise RuntimeError("AI role requires a planned NVIDIA GPU")
    env = os.environ.copy()
    if plan.ai_gpu_uuid:
        env["CUDA_VISIBLE_DEVICES"] = plan.ai_gpu_uuid
    env.update(
        {
            "OLLAMA_HOST": "127.0.0.1:11434",
            "OLLAMA_MAX_LOADED_MODELS": "1",
            "OLLAMA_NUM_PARALLEL": "1",
            "OLLAMA_MAX_QUEUE": "8",
            "OLLAMA_CONTEXT_LENGTH": "8192",
            "OLLAMA_KEEP_ALIVE": "2m",
            "OLLAMA_NO_CLOUD": "1",
        }
    )
    if plan.role in {"ocr", "full"} and plan.ocr_engine not in {"tesseract", "unlimited-ocr"}:
        raise RuntimeError("OCR role has no configured OCR engine")
    if plan.role in {"embeddings", "ai", "full"} and not plan.embeddings_model:
        raise RuntimeError("Embeddings role has no configured model")
    if plan.role in {"llm", "ai", "full"} and not plan.llm_model:
        raise RuntimeError("LLM role has no configured model")
    _start_process("ollama", ["ollama", "serve"], env)
    try:
        _wait_for_process_url("ollama", "http://127.0.0.1:11434/api/version", timeout=120)

        models = [model for model in (plan.embeddings_model, plan.llm_model) if model]
        for model in models:
            subprocess.run(["ollama", "pull", model], env=env, check=True)

        if plan.llm_model:
            model_definition = RUNTIME_DIR / "NoteHut.Modelfile"
            model_definition.write_text(
                f"FROM {plan.llm_model}\nPARAMETER num_ctx 8192\n",
                encoding="utf-8",
            )
            subprocess.run(
                ["ollama", "create", "notehut-llm", "-f", str(model_definition)],
                env=env,
                check=True,
            )

        ps_output = subprocess.check_output(["ollama", "list"], env=env, text=True)
        for expected in ([plan.embeddings_model] if plan.embeddings_model else []) + (["notehut-llm"] if plan.llm_model else []):
            if expected not in ps_output:
                raise RuntimeError(f"Ollama model {expected} was not installed successfully")
        if plan.ai_gpu_uuid:
            visible_gpu = next(
                (gpu for gpu in detect_gpus() if gpu.uuid == plan.ai_gpu_uuid),
                None,
            )
            if not visible_gpu:
                raise RuntimeError("Planned Ollama GPU is no longer visible")
    except Exception as error:
        stop_process("ollama")
        raise RuntimeError(f"Ollama startup failed:\n{tail_log('ollama', 80)}") from error


def start_worker(worker_dir: Path, plan: RuntimePlan) -> None:
    worker_key = ensure_worker_key()
    env = os.environ.copy()
    env.update(
        {
            "NOTEHUT_ROLE": plan.role,
            "WORKER_API_KEY": worker_key,
            "OLLAMA_URL": "http://127.0.0.1:11434",
            "OCR_TESSERACT_FALLBACK": "true",
        }
    )
    if plan.role in {"ocr", "full"}:
        env["SUPABASE_URL"] = load_secret("SUPABASE_URL", required=True)
        env["SUPABASE_SERVICE_KEY"] = load_secret("SUPABASE_SERVICE_KEY", required=True)
        env["OCR_FORCE_TESSERACT"] = "true" if plan.ocr_engine == "tesseract" else "false"
    else:
        env.pop("SUPABASE_URL", None)
        env.pop("SUPABASE_SERVICE_KEY", None)
    if plan.ocr_gpu_uuid:
        env["CUDA_VISIBLE_DEVICES"] = plan.ocr_gpu_uuid

    _start_process("worker", [sys.executable, str(worker_dir / "ocr_worker.py")], env)
    try:
        _wait_for_process_url(
            "worker",
            "http://127.0.0.1:8000/health",
            headers={"Authorization": f"Bearer {worker_key}"},
            timeout=120,
        )
    except Exception as error:
        stop_process("worker")
        raise RuntimeError(f"Worker failed readiness:\n{tail_log('worker', 80)}") from error


def start_tunnel(
    provider: str,
    port: int = 8000,
    allow_ephemeral_public_tunnel: bool = False,
) -> Optional[str]:
    if provider == "none":
        return None
    if provider not in TUNNEL_CHOICES:
        raise ValueError(f"Unsupported tunnel provider: {provider}")
    if detect_runtime() == "colab":
        raise RuntimeError(
            "Public tunnels are disabled on managed Colab. Use local interactive checks there, "
            "or deploy this role on Kaggle where permitted or a persistent GPU VM."
        )

    if provider == "ngrok":
        if not allow_ephemeral_public_tunnel:
            raise RuntimeError(
                "ngrok is an ephemeral public demo tunnel. Explicitly enable the risk acknowledgement before starting it."
            )
        token = load_secret("NGROK_AUTHTOKEN", required=True)
        from pyngrok import conf, ngrok

        ngrok.kill()
        conf.get_default().auth_token = token
        tunnel = ngrok.connect(addr=port, proto="http", bind_tls=True)
        return tunnel.public_url.replace("http://", "https://")

    token = load_secret("CLOUDFLARE_TUNNEL_TOKEN", required=True)
    cloudflared = install_cloudflared()
    env = os.environ.copy()
    token_path = RUNTIME_DIR / "cloudflare_tunnel_token.txt"
    descriptor = os.open(token_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as token_file:
        token_file.write(token)
    _start_process(
        "cloudflared",
        [cloudflared, "tunnel", "--no-autoupdate", "run", "--token-file", str(token_path)],
        env,
    )
    public_url = load_secret("CLOUDFLARE_PUBLIC_URL", required=True).rstrip("/")
    try:
        _wait_for_process_url(
            "cloudflared",
            f"{public_url}/health",
            headers={"Authorization": f"Bearer {ensure_worker_key()}"},
            timeout=120,
        )
    except Exception:
        stop_process("cloudflared")
        raise
    return public_url


def validate_gateway(public_url: str, plan: RuntimePlan) -> None:
    key = ensure_worker_key()
    headers = {"Authorization": f"Bearer {key}"}
    response = httpx.get(f"{public_url.rstrip('/')}/health", headers=headers, timeout=20)
    response.raise_for_status()

    if plan.embeddings_model:
        response = httpx.post(
            f"{public_url.rstrip('/')}/ollama/v1/embeddings",
            headers={**headers, "Content-Type": "application/json"},
            json={"model": plan.embeddings_model, "input": "NoteHut readiness test"},
            timeout=120,
        )
        response.raise_for_status()
        dimension = len(response.json()["data"][0]["embedding"])
        if dimension != 1024:
            raise RuntimeError(f"Embedding dimension is {dimension}; NoteHut requires 1024")

    if plan.llm_model:
        with httpx.stream(
            "POST",
            f"{public_url.rstrip('/')}/ollama/v1/chat/completions",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "model": "notehut-llm",
                "messages": [{"role": "user", "content": "Reply with ready"}],
                "max_tokens": 8,
                "stream": True,
            },
            timeout=120,
        ) as response:
            response.raise_for_status()
            first_chunk = next((chunk for chunk in response.iter_bytes() if chunk), b"")
            if not first_chunk:
                raise RuntimeError("The tunnel did not deliver a streamed LLM response")


def deployment_config(public_url: Optional[str], plan: RuntimePlan) -> dict[str, object]:
    if not public_url and plan.role in {"embeddings", "llm", "ai", "full"}:
        raise RuntimeError(
            "AI gateway roles need a public HTTPS URL before they can be configured in a remote NoteHut deployment."
        )
    base = f"{public_url.rstrip('/')}/ollama/v1" if public_url else "http://127.0.0.1:8000/ollama/v1"
    key = ensure_worker_key()
    return {
        "role": plan.role,
        "worker": {
            "url": public_url or "http://127.0.0.1:8000",
            "apiKey": key,
        },
        "fallbackLlm": (
            {
                "llmProvider": "custom",
                "llmBaseURL": base,
                "llmApiKey": key,
                "llmModelName": "notehut-llm",
            }
            if plan.llm_model
            else None
        ),
        "fallbackEmbeddings": (
            {
                "embeddingsBaseURL": base,
                "embeddingsApiKey": key,
                "embeddingsModel": plan.embeddings_model,
            }
            if plan.embeddings_model
            else None
        ),
    }


def redact_config(config: dict[str, object]) -> dict[str, object]:
    sensitive_names = {"apikey", "llmapikey", "embeddingsapikey"}

    def redact(value: object) -> object:
        if isinstance(value, dict):
            return {
                key: "<WORKER_API_KEY>" if key.lower() in sensitive_names else redact(child)
                for key, child in value.items()
            }
        if isinstance(value, list):
            return [redact(child) for child in value]
        return value

    return redact(config)  # type: ignore[return-value]


def status() -> dict[str, object]:
    return {
        name: {
            "pid": _read_pid(name),
            "running": _is_alive(_read_pid(name)),
            "log": str(RUNTIME_DIR / f"{name}.log"),
        }
        for name in ("ollama", "worker", "cloudflared")
    }


def tail_log(name: str, lines: int = 40) -> str:
    path = RUNTIME_DIR / f"{name}.log"
    if not path.exists():
        return f"No {name} log exists."
    return "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:])


def stop_all() -> None:
    try:
        from pyngrok import ngrok

        ngrok.kill()
    except Exception:
        pass
    for name in ("cloudflared", "worker", "ollama"):
        stop_process(name)
