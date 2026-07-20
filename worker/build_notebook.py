"""Generate the checked-in Colab/Kaggle deployment notebook."""

import base64
import hashlib
import json
from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "notehut_colab.ipynb"
BUNDLE_NAMES = ("ocr_worker.py", "runtime_manager.py", "requirements.txt")
BUNDLE = {
    name: base64.b64encode((ROOT / name).read_bytes()).decode("ascii")
    for name in BUNDLE_NAMES
}
BUNDLE_HASHES = {
    name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    for name in BUNDLE_NAMES
}

BOOTSTRAP_SOURCE = """
from pathlib import Path
import base64, hashlib

BUNDLE = __BUNDLE__
EXPECTED_HASHES = __HASHES__

if Path("/kaggle/working").exists():
    worker_dir = Path("/kaggle/working/notehut-worker")
elif Path("/content").exists():
    worker_dir = Path("/content/notehut-worker")
else:
    worker_dir = Path.cwd() / ".notehut-worker"
worker_dir.mkdir(parents=True, exist_ok=True)

for name, payload in BUNDLE.items():
    content = base64.b64decode(payload)
    digest = hashlib.sha256(content).hexdigest()
    if digest != EXPECTED_HASHES[name]:
        raise RuntimeError(f"Embedded support bundle failed integrity validation for {name}")
    (worker_dir / name).write_bytes(content)

print(f"Materialized reviewed support bundle in {worker_dir}")
for name, digest in EXPECTED_HASHES.items():
    print(f"  {name}: {digest[:12]}")
""".replace("__BUNDLE__", json.dumps(BUNDLE, indent=2)).replace(
    "__HASHES__", json.dumps(BUNDLE_HASHES, indent=2)
)


def markdown(source: str):
    return nbf.v4.new_markdown_cell(source.strip())


def code(source: str):
    return nbf.v4.new_code_cell(source.strip())


notebook = nbf.v4.new_notebook()
notebook.metadata = {
    "accelerator": "GPU",
    "colab": {
        "name": "NoteHut Modular GPU Runtime",
        "provenance": [],
        "toc_visible": True,
    },
    "kernelspec": {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3",
    },
    "language_info": {"name": "python", "version": "3"},
}

notebook.cells = [
    markdown(
        """
# NoteHut Modular GPU Runtime

<div style="padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,#312e81,#2563eb);color:white;margin:8px 0 18px">
  <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">Colab · Kaggle · Jupyter · GPU VM</div>
  <div style="font-size:28px;font-weight:700;margin-top:4px">Deploy only the workload this machine can safely run</div>
  <div style="margin-top:8px;opacity:.9">Hardware-aware planning, secure secrets, authenticated AI routes, readiness tests, logs, and cleanup.</div>
</div>

This notebook supports five composable roles:

| Role | Purpose | Inbound tunnel |
|---|---|---|
| `ocr` | Poll Supabase, extract native PDF text, and process scans | Not required |
| `embeddings` | Qwen3 embeddings gateway | Required for NoteHut cloud app |
| `llm` | Streaming chat/exam/tutor inference | Required |
| `ai` | Embeddings + LLM on one AI GPU | Required |
| `full` | OCR worker + AI gateway | Requires two GPUs |

> **Platform notice:** managed Colab is limited to interactive/local validation in this notebook; public tunnels are disabled there. Use Kaggle only within its current policies. Use a persistent GPU VM for production.

### Secret labels
Create these in **Colab Secrets** or **Kaggle Add-ons → Secrets**. Do not paste them into cells.

- OCR/full: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Any role: `WORKER_API_KEY` (recommended; a temporary key is generated if absent)
- Notebook demo tunnel: `NGROK_AUTHTOKEN`
- Persistent named Cloudflare tunnel: `CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARE_PUBLIC_URL`

For a named Cloudflare Tunnel, configure the public hostname in Zero Trust to
forward to `http://127.0.0.1:8000`. Kaggle also requires Internet access to be
enabled before installing packages or downloading models.
"""
    ),
    markdown("## 1. Materialize the reviewed support bundle"),
    code(BOOTSTRAP_SOURCE),
    markdown("## 2. Install the reproducible worker stack"),
    code(
        """
import subprocess, sys

if sys.platform.startswith("linux"):
    subprocess.run(["apt-get", "update", "-qq"], check=True)
    subprocess.run(["apt-get", "install", "-y", "-qq", "tesseract-ocr", "zstd"], check=True)
else:
    print("Non-Linux host detected: install Tesseract manually if you need scanned-PDF fallback.")
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(worker_dir / "requirements.txt")], check=True)

print("Dependencies installed from worker/requirements.txt")
print("If this cell replaced the preinstalled Torch stack, restart the runtime once, rerun cell 1, then continue from cell 3.")
"""
    ),
    markdown("## 3. Detect hardware and recommend a workload"),
    code(
        """
import sys
from pathlib import Path
if Path("/kaggle/working").exists():
    worker_dir = Path("/kaggle/working/notehut-worker")
elif Path("/content").exists():
    worker_dir = Path("/content/notehut-worker")
else:
    worker_dir = Path.cwd() / ".notehut-worker"
if not (worker_dir / "runtime_manager.py").is_file():
    raise RuntimeError("Support bundle is missing. Rerun cell 1 after restarting the runtime.")
sys.path.insert(0, str(worker_dir))

from IPython.display import HTML, Markdown, display
from runtime_manager import detect_gpus, detect_runtime, plan_as_markdown, recommend_plan, refresh_compute_capabilities

gpus = refresh_compute_capabilities(detect_gpus())
recommended_plan = recommend_plan(gpus)

display(HTML(
    "<style>.notehut-note{padding:12px 14px;border:1px solid #c7d2fe;border-radius:12px;background:#f8faff;margin:8px 0}</style>"
    + "<div class='notehut-note'><b>Runtime detected:</b> "
    + detect_runtime().title()
    + " · <b>Planner:</b> "
    + recommended_plan.role.upper()
    + "</div>"
))
display(Markdown(plan_as_markdown(recommended_plan, gpus)))
"""
    ),
    markdown("## 4. Choose this VM's role and tunnel"),
    code(
        """
from runtime_manager import ROLE_CHOICES, TUNNEL_CHOICES, detect_runtime, recommend_plan

try:
    import ipywidgets as widgets
    from IPython.display import display

    role_widget = widgets.Dropdown(
        options=[("Use hardware recommendation", "auto")] + [(role.title(), role) for role in ROLE_CHOICES],
        value="auto",
        description="Workload",
        style={"description_width": "90px"},
        layout=widgets.Layout(width="430px"),
    )
    tunnel_options = [("No tunnel (OCR-only/local)", "none")]
    if detect_runtime() != "colab":
        tunnel_options += [("ngrok HTTPS (short demo)", "ngrok"), ("Named Cloudflare Tunnel", "cloudflare_named")]
    tunnel_widget = widgets.Dropdown(
        options=tunnel_options,
        value="none" if detect_runtime() == "colab" or recommended_plan.role == "ocr" else "ngrok",
        description="Tunnel",
        style={"description_width": "90px"},
        layout=widgets.Layout(width="430px"),
    )
    public_ack_widget = widgets.Checkbox(
        value=False,
        description="I understand notebook tunnels are public and ephemeral",
        indent=False,
        layout=widgets.Layout(width="520px"),
    )
    display(widgets.VBox([role_widget, tunnel_widget, public_ack_widget]))
except Exception:
    role_widget = None
    tunnel_widget = None
    public_ack_widget = None

# Text fallbacks can be edited when widgets are unavailable.
ROLE = "auto"
TUNNEL = "none" if detect_runtime() == "colab" or recommended_plan.role == "ocr" else "ngrok"
ALLOW_EPHEMERAL_PUBLIC_TUNNEL = False

print("Choose controls above, then run the next cell. OCR-only nodes should use no tunnel.")
"""
    ),
    markdown("## 5. Validate secrets and show the selected deployment plan"),
    code(
        """
from runtime_manager import ensure_worker_key, load_secret, plan_as_markdown, recommend_plan

selected_role = role_widget.value if role_widget is not None else ROLE
selected_tunnel = tunnel_widget.value if tunnel_widget is not None else TUNNEL
allow_ephemeral_public_tunnel = public_ack_widget.value if public_ack_widget is not None else ALLOW_EPHEMERAL_PUBLIC_TUNNEL
plan = recommend_plan(gpus, selected_role)

if detect_runtime() == "colab" and selected_tunnel != "none":
    raise RuntimeError("Public tunnels are disabled on managed Colab; select No tunnel.")
if selected_tunnel == "ngrok" and not allow_ephemeral_public_tunnel:
    raise RuntimeError("Acknowledge the public/ephemeral tunnel warning before using ngrok.")

if plan.role in {"ocr", "full"}:
    load_secret("SUPABASE_URL", required=True)
    load_secret("SUPABASE_SERVICE_KEY", required=True)
if selected_tunnel == "ngrok":
    load_secret("NGROK_AUTHTOKEN", required=True)
elif selected_tunnel == "cloudflare_named":
    load_secret("CLOUDFLARE_TUNNEL_TOKEN", required=True)
    load_secret("CLOUDFLARE_PUBLIC_URL", required=True)

ensure_worker_key()
display(Markdown(plan_as_markdown(plan, gpus)))
print("Secrets validated without printing their values.")
"""
    ),
    markdown("## 6. Start Ollama and pull only this role's models"),
    code(
        """
from runtime_manager import start_ollama

start_ollama(plan)
if plan.role in {"embeddings", "llm", "ai", "full"}:
    print("Ollama is ready and required models are present.")
else:
    print("OCR role selected; Ollama is intentionally disabled on this VM.")
"""
    ),
    markdown("## 7. Start the authenticated NoteHut worker/gateway"),
    code(
        """
from runtime_manager import start_worker, status

start_worker(worker_dir, plan)
display(status())
print("Worker health check passed.")
"""
    ),
    markdown("## 8. Create an optional streaming-capable tunnel and test it"),
    code(
        """
from runtime_manager import start_tunnel, validate_gateway

public_url = start_tunnel(
    selected_tunnel,
    allow_ephemeral_public_tunnel=allow_ephemeral_public_tunnel,
)
if public_url:
    validate_gateway(public_url, plan)
    print(f"Public gateway ready: {public_url}")
    print("Embedding dimension and streamed LLM transport were validated for enabled capabilities.")
else:
    print("No public tunnel started. OCR polling still works directly through Supabase.")
"""
    ),
    markdown("## 9. Copy the generated NoteHut configuration"),
    code(
        """
import json
import runtime_manager
from runtime_manager import deployment_config, redact_config

if not public_url and plan.role in {"embeddings", "llm", "ai", "full"}:
    print("Local AI validation passed, but no remote NoteHut configuration is emitted without a public HTTPS URL.")
    config = None
else:
    config = deployment_config(public_url, plan)
    print(json.dumps(redact_config(config), indent=2))

if config:
    print("Admin mapping:\\n"
          "  Worker panel        <- worker.url and worker.apiKey\\n"
          "  Fallback LLM        <- fallbackLlm (when present)\\n"
          "  Fallback Embeddings <- fallbackEmbeddings (when present)\\n\\n"
          f"The displayed JSON redacts the key. Prefer a WORKER_API_KEY notebook secret. If one was generated, inspect {runtime_manager.RUNTIME_DIR / 'worker_api_key.txt'} privately.")
"""
    ),
    markdown("## 10. Operations: status, logs, and cleanup"),
    code(
        """
from runtime_manager import status, tail_log

display(status())
print("\\n--- worker.log ---")
print(tail_log("worker", 30))
print("\\n--- ollama.log ---")
print(tail_log("ollama", 20))
"""
    ),
    code(
        """
# Run this cell before switching roles or ending the session.
from runtime_manager import stop_all, status

stop_all()
display(status())
print("NoteHut processes and tunnels stopped cleanly.")
"""
    ),
    markdown(
        """
## Multi-VM recipes

### Kaggle with two T4s in one VM
- Select `full` when one notebook must provide every capability.
- The planner isolates Ollama to one stable GPU UUID.
- T4 does not natively support BF16, so scanned OCR uses the safe Tesseract fallback; native PDF extraction remains fast.
- For **accelerated** Unlimited-OCR, use a separate Ampere-or-newer OCR node; a second T4 cannot enable that model's BF16 path.

### Two notebook/VM sessions
1. **OCR node:** select `ocr`, no tunnel, provide Supabase secrets.
2. **AI node:** select `ai`, use ngrok for a demo or a named Cloudflare tunnel on a persistent VM.
3. Put the AI node's generated LLM and embeddings values into the NoteHut Admin fallback configuration.

### Ampere/Hopper OCR node + T4 AI node
- Ampere/Hopper node: `ocr` uses pinned Unlimited-OCR with native BF16.
- T4 node: `ai` runs `qwen3.5:9b` and `qwen3-embedding:0.6b` without OCR VRAM contention.

### Production
Notebook runtimes are ephemeral. Move the same `runtime_manager.py` roles to persistent GPU VMs and use a stable named tunnel or normal HTTPS reverse proxy.
"""
    ),
]

nbf.validator.normalize(notebook)
nbf.validate(notebook)
nbf.write(notebook, OUTPUT)
print(f"Wrote {OUTPUT}")
