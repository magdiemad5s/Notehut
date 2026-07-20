# NoteHut — Adaptive AI Document Analysis & Exam Builder

NoteHut is a next-generation, adaptive AI-powered study platform built with **Next.js 15**, **React 19**, **Tailwind CSS v4**, and **Supabase**. It features a **Bring Your Own Key (BYOK)** architecture, allowing users to connect their own local Ollama instance or cloud AI API keys for complete control over privacy, data, and costs.

---

## 🚀 Key Features

- **Adaptive Exam Generation**: Generate custom exams featuring multiple-choice, checkbox, and essay questions. The system automatically tracks incorrect answers and biases future exams toward your weak areas to maximize study efficiency.
- **Bring Your Own Key (BYOK)**: Connect your own Ollama or OpenAI-compatible API endpoint. Keys persist only in browser storage and are attached to transient NoteHut API requests; they are not stored by the server.
- **Interactive AI Tutor**: Chat with an AI tutor that has full semantic access to your uploaded documents. Ask questions, request summaries, or get step-by-step explanations of complex concepts.
- **Multi-File Topics**: Organize your study materials into unified Topics. Upload multiple PDFs, DOCX, or TXT files per topic and run comprehensive RAG queries across all of them simultaneously.
- **Public Exam Sharing**: Share your custom-generated exams with classmates or students via a public link. Guests can take the exam and get graded instantly with built-in rate limiting protection.
- **Secure Admin Controls**: System administrators can monitor the background OCR queue, configure fallback API keys, and manage global application settings through a secure, masked dashboard.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS v4, Zustand (State Management with Persist Middleware), Lucide React (Icons).
- **Backend**: Supabase (Authentication, PostgreSQL Database, Storage, Realtime Listeners).
- **Vector Search**: PostgreSQL `pgvector` extension with HNSW cosine index on document chunk embeddings.
- **AI Integration**: Vercel AI SDK v7 (Unified AI Streaming, Structured Object Generation).

---

## 📦 Local Setup Guide

### Prerequisites

- **Node.js**: Version 18.x or higher.
- **Supabase Account**: A free Supabase project or a local Supabase CLI instance.
- **Ollama (Optional for Local AI)**: Installed locally with the `qwen3-embedding:0.6b` model pulled.

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/notehut.git
cd notehut
npm install --legacy-peer-deps
```

*Note: `--legacy-peer-deps` is recommended due to React 19 peer dependency mismatches in some packages.*

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Set true only for trusted local/self-hosted Ollama or LAN endpoints.
ALLOW_PRIVATE_AI_UPSTREAMS=false
```

### 3. Set Up Supabase Database

1. Go to your Supabase Project Dashboard.
2. Open the **SQL Editor**.
3. Copy the contents of `supabase/schema.sql` and run it. This will:
   - Enable the `pgvector` extension.
   - Create all necessary tables (`profiles`, `topics`, `documents`, `document_chunks`, `ocr_queue`, `exams`, `user_weaknesses`, `shared_exams`, `app_settings`, `app_secrets`).
   - Set up Row Level Security (RLS) policies.
   - Create the `match_chunks` RPC function for semantic search.
   - Create the HNSW cosine index on document chunk embeddings.
   - Seed default application settings.

### 4. Set Up Local Ollama (For Local Embeddings)

To use local embeddings (highly recommended for zero-cost development):

1. Install [Ollama](https://ollama.com/).
2. Pull the default embedding model:
   ```bash
   ollama pull qwen3-embedding:0.6b
   ```
3. Ensure Ollama is running locally (usually at `http://localhost:11434`).

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the landing page.

---

## 🔑 BYOK Configuration

NoteHut uses a client-side Zustand store (`notehut-byok`) to persist your AI configuration. Keys are attached to transient requests to NoteHut's AI routes, which forward requests to the selected provider; the server does not persist BYOK credentials.

1. Sign in to NoteHut.
2. Navigate to the **Settings** panel.
3. Configure your preferred providers:
   - **Ollama**: Set your local endpoint (default: `http://localhost:11434`) and select your embedding model (default: `qwen3-embedding:0.6b`).
    - **OpenAI / Anthropic / Google Gemini**: Input your API keys. These keys are stored locally in your browser and are only sent directly to the AI providers from your client or via secure, transient API routes.

### Modular Colab / Kaggle runtime

`worker/notehut_colab.ipynb` provides a hardware-aware deployment console for
interactive notebook runtimes and persistent GPU VMs. It supports separate
`ocr`, `embeddings`, `llm`, `ai`, and `full` roles, recommends a workload from
the detected GPU count/VRAM/BF16 capability, loads secrets from the notebook
secret manager, performs readiness tests, and prints the exact NoteHut admin
configuration.

For predictable production latency, run OCR and AI inference on separate nodes.
Managed notebook sessions are ephemeral. Colab is restricted to interactive,
local validation in the notebook and public tunnels are disabled there. Use
Kaggle only within its current policies. Quick `trycloudflare.com` tunnels are
not used for AI roles because they do not support Server-Sent Events. For a
stable deployment, use a named Cloudflare Tunnel or normal HTTPS reverse proxy
on a persistent GPU VM.

Recommended hardware plans:

- Single T4 (16 GB): `ai` role; use a separate OCR runtime.
- Dual T4: `full` is supported, with Ollama isolated to one GPU and
  native/Tesseract OCR on the worker side.
- Ampere/Hopper OCR node: `ocr` enables pinned Unlimited-OCR through BF16.
- Single high-memory GPU: use one role at a time or separate runtimes; `full`
  intentionally requires two GPUs to prevent OCR/AI VRAM contention.

---

## 🔒 Security & Robustness Features

- **Fallback Keys**: Administrators can configure fallback API keys in the database (`app_secrets` table) to allow guest grading or fallback processing when users don't have their own keys. These keys are strictly masked and never exposed to the browser.
- **Rate Limiting**: The unauthenticated public guest grading endpoint (`/api/exam/public-grade`) uses a shared PostgreSQL rate limiter (5 requests/minute per IP).
- **Race-Free Weakness Tracking**: Weakness counters are incremented atomically through a database RPC.
- **Strict Schema Validation**: All incoming payloads and shared exam configurations are strictly validated using Zod schemas to prevent malformed data from crashing the application.

---

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.
