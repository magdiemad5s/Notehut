# NoteHut — Project Specification

## Project Overview
NoteHut is an adaptive AI-powered document analysis and exam-generation Next.js (App Router) full-stack application. Users upload PDFs, extract text via an external OCR worker, chat with documents (RAG), generate structured exams using the Vercel AI SDK, and the system tracks topic weaknesses dynamically to bias future exams toward concepts the user struggles with. The app supports Topics (grouping files like NotebookLM notebooks), Exam Sharing (public links for guests), and a dedicated Admin Panel.

## Tech Stack
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (CSS-first config)
- Shadcn UI (via shadcn CLI)
- Supabase (Email/Password Auth, PostgreSQL, Storage, pgvector)
- Vercel AI SDK (ai, @ai-sdk/openai, @ai-sdk/google)
- Zod (structured outputs)
- Zustand with persist middleware (BYOK settings in localStorage)
- lucide-react (icons)

No PDF parsing dependency — OCR runs in an external Python worker. Chunking is a lightweight in-house recursive text splitter.

## Confirmed Architecture Decisions

| Area | Decision |
|---|---|
| Embeddings | BYOK Ollama running qwen3-embedding:0.6b → vector(1024) via OpenAI-compatible /v1/embeddings endpoint. No hardcoded OpenAI key. |
| BYOK store | Zustand + persist middleware (localStorage only). Adds embeddingsBaseURL + embeddingsModel (default 'qwen3-embedding:0.6b'). |
| Auth | Supabase email/password only. |
| UI | Tailwind v4 + shadcn CLI on create-next-app. |
| OCR worker | Out of scope for Next.js build — external Python (Colab/Kaggle) worker. Next.js handles upload, queue insert, Realtime listener, and post-extraction chunking/embedding. |
| Fallback keys | app_secrets jsonb table, service-role-only access (no RLS policies). Used for guest public-grading and no-BYOK users. |
| Vector index | HNSW cosine index on document_chunks.embedding. |
| BYOK LLM providers | 'deepseek', 'gemini', 'custom' — all use createOpenAI with custom baseURL except gemini which uses createGoogleGenerativeAI. |

## Dependencies (full list)
```
next@15, react@19, typescript, tailwindcss@4, @tailwindcss/postcss
ai, @ai-sdk/openai, @ai-sdk/google, zod
@supabase/ssr, @supabase/supabase-js
zustand
shadcn components: button, input, label, form, dialog, card, tabs, table, switch, select, badge, sonner, separator, scroll-area, skeleton
lucide-react, next-themes (optional dark mode)
```

## Project Structure
```
app/
  (auth)/login, (auth)/signup
  (app)/layout.tsx               # auth guard + sidebar
  (app)/topics/page, new, [topicId]/page, [topicId]/exam/page
  (app)/settings/page            # BYOK config
  (app)/weaknesses/page          # tutor + chart
  admin/layout.tsx + page.tsx    # is_admin guard
  exam/[id]/page.tsx             # public guest exam
  api/
    upload/route.ts
    embeddings/route.ts          # chunk + embed via BYOK Ollama
    exam/share/route.ts, exam/public-grade/route.ts
    ai/generate-exam, ai/grade-exam, ai/tutor (stream), ai/chat (stream)
    admin/queue, admin/settings, admin/fallback-keys
components/
  ui/ (shadcn), upload-pdf.tsx, realtime-ocr-status.tsx, chat.tsx,
  exam-runner.tsx, weaknesses-chart.tsx, admin-queue-table.tsx, exam-config-dialog.tsx
lib/
  supabase/{client,server,service}.ts
  ai/{providers,schemas,prompts,embeddings}.ts
  rag/{chunk,retrieve}.ts
  auth.ts, utils.ts
stores/byok.ts
types/db.ts
middleware.ts
supabase/schema.sql
.env.example
```

## Database Schema (supabase/schema.sql)

The SQL script must include:

### Extensions
- `create extension if not exists vector;` (pgvector)
- `create extension if not exists "uuid-ossp";`

### Tables

**profiles** — maps to auth.users
- id uuid primary key references auth.users(id) on delete cascade
- email text
- is_admin boolean default false
- created_at timestamptz default now()
- Trigger: auto-create profile on new user signup (handle_new_user function + trigger on auth.users)

**topics** — groups files (like NotebookLM notebooks)
- id uuid primary key default uuid_generate_v4()
- user_id uuid references auth.users(id) on delete cascade
- name text not null
- created_at timestamptz default now()

**documents** — uploaded PDFs
- id uuid primary key default uuid_generate_v4()
- user_id uuid references auth.users(id) on delete cascade
- topic_id uuid references topics(id) on delete cascade
- filename text not null
- storage_path text
- created_at timestamptz default now()

**document_chunks** — text chunks with embeddings
- id uuid primary key default uuid_generate_v4()
- document_id uuid references documents(id) on delete cascade
- content text not null
- embedding vector(1024)  -- CRITICAL: 1024 dimensions for Qwen3-Embedding-0.6b
- Index: HNSW cosine on embedding column

**ocr_queue** — OCR processing queue
- id uuid primary key default uuid_generate_v4()
- user_id uuid references auth.users(id) on delete cascade
- document_id uuid references documents(id) on delete cascade
- file_url text not null
- status text check (status in ('pending','processing','completed','failed')) default 'pending'
- extracted_text text  -- written by external Python worker
- error text  -- written by external Python worker on failure
- created_at timestamptz default now()
- updated_at timestamptz default now()
- Trigger: auto-update updated_at on row update

**user_weaknesses** — adaptive learning tracking
- id uuid primary key default uuid_generate_v4()
- user_id uuid references auth.users(id) on delete cascade
- topic_name text not null
- error_count integer default 1
- last_failed_at timestamptz default now()
- Unique constraint: (user_id, topic_name) — for UPSERT operations

**shared_exams** — public exam sharing
- id uuid primary key default uuid_generate_v4()
- topic_id uuid references topics(id) on delete cascade
- creator_id uuid references auth.users(id) on delete cascade
- title text not null
- questions_json jsonb not null
- is_public boolean default false
- created_at timestamptz default now()

**app_settings** — admin toggles
- key text primary key
- value boolean not null
- Seed: ('accelerated_ocr_online', false). Worker availability is measured from authenticated `/health` checks rather than a manual flag.

**app_secrets** — admin fallback API keys (NO RLS — service-role only)
- key text primary key
- value jsonb not null
- Seed: ('fallback_llm', '{}'::jsonb), ('fallback_embeddings', '{}'::jsonb)

### Vector Similarity Search Function
```sql
create or replace function match_chunks(
  query_embedding vector(1024),
  match_topic_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select dc.id, dc.document_id, dc.content,
         1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on dc.document_id = d.id
  where d.topic_id = match_topic_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
```
This filters by topic_id so the AI queries all files within a specific topic simultaneously (multi-file RAG, mimicking NotebookLM).

### Row Level Security (RLS)
Enable RLS on all tables except app_secrets.

- **profiles**: user can read/update own row. is_admin users can read all.
- **topics**: owner-only (select, insert, update, delete where auth.uid() = user_id).
- **documents**: owner-only (filter by user_id).
- **document_chunks**: owner-only (filter via document ownership join).
- **ocr_queue**: owner-only for select/insert. Admin (is_admin=true) can read all rows.
- **user_weaknesses**: owner-only.
- **shared_exams**: anyone can read if is_public=true. Owner can insert/update/delete.
- **app_settings**: any authenticated user can read. Only is_admin can update.
- **app_secrets**: NO RLS policies — service-role-only access.

### Realtime
```sql
alter publication supabase_realtime add table ocr_queue;
```

### Storage
- Bucket: 'pdfs' (private)
- Path policy: files stored at `pdfs/{user_id}/{uuid}.pdf`
- RLS: users can upload/read only their own path prefix

## BYOK Store (stores/byok.ts)

Zustand store with persist middleware to localStorage:

```typescript
type LlmProvider = 'custom' | 'gemini' | 'deepseek';

interface ByokConfig {
  // Chat/Exam LLM
  llmProvider: LlmProvider;
  llmBaseURL: string;
  llmApiKey: string;
  llmModelName: string;
  // Embeddings (Ollama/Colab)
  embeddingsBaseURL: string;
  embeddingsModel: string; // default: 'qwen3-embedding:0.6b'
}
```

- persist({ key: 'notehut-byok', storage: createJSONStorage(() => localStorage) })
- Settings UI has two sections: "Chat/Exam LLM" and "Embeddings (Ollama)"
- A byokToHeaders() helper serializes config for all AI API calls
- All API routes accept BYOK config via request body or headers

## AI Provider Logic (lib/ai/providers.ts)

- resolveChatProvider(cfg):
  - gemini → createGoogleGenerativeAI({ apiKey })
  - deepseek/custom → createOpenAI({ baseURL, apiKey })
- resolveEmbeddingsModel(cfg):
  - createOpenAI({ baseURL: embeddingsBaseURL, apiKey: apiKey || 'ollama' }).embedding(embeddingsModel || 'qwen3-embedding:0.6b')
  - Ollama provides OpenAI-compatible /v1/embeddings endpoint
- Fallback path: if no BYOK config, service-role route reads app_secrets 'fallback_llm' / 'fallback_embeddings' and builds the same provider shapes

## Zod Schemas (lib/ai/schemas.ts)

- QuestionSchema = z.discriminatedUnion('type', [mcq, checkbox, essay])
  - Every variant MUST include: topicTags: z.array(z.string())
  - MCQ: type, question, options (array), correctAnswer, topicTags
  - Checkbox: type, question, options (array), correctAnswers (array), topicTags
  - Essay: type, question, expectedAnswer, topicTags
- ExamSchema = z.object({ questions: z.array(QuestionSchema) })
- GradeSchema = z.object({ score: z.number(), feedback: z.string(), isCorrect: z.boolean() })

## RAG Pipeline (lib/rag/)

- chunk.ts: recursive text splitter (~800 chars, 120 overlap)
- retrieve.ts: retrieveChunks(topicId, query, byok, k=5)
  1. Embed query via BYOK Ollama (1024-dim)
  2. Call match_chunks RPC with topic_id filter
  3. Return top-k chunks

## API Routes (complete list)

| Route | Auth | Method | Responsibility |
|---|---|---|---|
| /api/upload | user | POST | Upload PDF to Storage pdfs/{user_id}/{uuid}.pdf, insert documents (with topic_id), insert ocr_queue (pending). Return {documentId, queueId}. |
| /api/embeddings | user | POST | Body: {queueId, byok}. Read ocr_queue.extracted_text, chunk, embedMany via BYOK Ollama (1024-dim), insert document_chunks. |
| /api/ai/generate-exam | user | POST | Body: {topicId, config, byok}. Retrieve chunks (topic-filtered), fetch user_weaknesses, inject bias prompt, generateObject(ExamSchema). Optionally save shared_exams. |
| /api/ai/grade-exam | user | POST | Body: {exam, answers, byok}. MCQ/checkbox graded deterministically; essay via generateObject(GradeSchema). For each isCorrect=false, UPSERT user_weaknesses (increment error_count, last_failed_at=now()). Return results + weakness deltas. |
| /api/ai/tutor | user | POST (stream) | Body: {topicName, topicId, byok}. Retrieve chunks for weak topic, streamText targeted study guide. |
| /api/ai/chat | user | POST (stream) | Body: {messages, topicId, byok}. RAG chat with useChat. |
| /api/exam/share | user | POST | Insert shared_exams. Return public id. |
| /api/exam/public-grade | none | POST | Body: {sharedExamId, answers}. Fetch public exam, grade using admin fallback keys from app_secrets. No weakness tracking for guests. |
| /api/admin/queue | admin | GET | List all ocr_queue rows. |
| /api/admin/settings | admin | GET/PUT | Configure accelerated OCR, worker endpoint/key, and feature models. |
| /api/admin/fallback-keys | admin | GET/PUT | Manage app_secrets fallback_llm / fallback_embeddings (jsonb). Service-role only. |

## Frontend Components

- (app)/topics/[topicId]: file list, UploadPdf (upload → returns queueId → RealtimeOcrStatus subscribes to ocr_queue row; on completed calls /api/embeddings), Chat, Generate Exam dialog (types, count, difficulty, share toggle) → ExamRunner
- (app)/weaknesses: bar chart of user_weaknesses.error_count; click topic → streaming tutor panel
- /exam/[id]: public, fetches shared_exams (is_public), renders ExamRunner in guest mode → public-grade
- /admin: AdminQueueTable, accelerated_ocr_online Switch, fallback-keys form
- /settings: BYOK form (Chat/Exam LLM section + Embeddings section with embeddingsBaseURL + embeddingsModel='qwen3-embedding:0.6b')

## Middleware & Auth (middleware.ts)

- Refresh Supabase session on every request (@supabase/ssr)
- Guard (app)/** → redirect to /login if no session
- Guard /admin/** → read profiles.is_admin; redirect / if false
- Public routes: /, /login, /signup, /exam/[id]

## OCR Worker Contract (external Python — documented, not built this phase)

The Python (Colab/Kaggle) worker must follow this lifecycle using its own service-role key:
1. SELECT * FROM ocr_queue WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
2. UPDATE ocr_queue SET status='processing', updated_at=now() WHERE id=?;
3. Run OCR (pdf2image + pytesseract/easyocr/surya; consult app_settings.accelerated_ocr_online)
4. UPDATE ocr_queue SET status='completed', extracted_text=?, updated_at=now() WHERE id=?;
Frontend is notified via Supabase Realtime (postgres_changes on the row) and triggers chunking/embedding.

## Environment Variables (.env.example)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
No OPENAI_API_KEY — embeddings are BYOK via Ollama; fallback keys live in app_secrets.

## Deployment Guide (Vercel)

1. Create Supabase project, run schema.sql in SQL Editor, create 'pdfs' storage bucket
2. Copy Project URL, anon key, service_role key
3. Push code to GitHub
4. Import to Vercel, add env vars:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
5. Deploy — runs practically free since users provide their own keys

## Agent Dispatch Strategy

This section documents how AI agents should be dispatched for implementation and quality assurance.

### Coding Agent: deepseek-v4-flash
- **Agent type**: CoderAgent
- **Model**: deepseek-v4-flash (configured via opencode.json)
- **Role**: Implements code for each phase — writes files, creates components, builds API routes
- **Dispatch method**: `task(subagent_type="CoderAgent", description="Phase N: ...", prompt="...")`
- **Instructions per dispatch**: Include phase number, specific files to create/edit, relevant context from project.md, and verification steps (lint, typecheck, build)

### Quality Assurance Agent: minimax-m3
- **Agent type**: CodeReviewer
- **Model**: minimax-m3 (configured via opencode.json)
- **Role**: Reviews code after each phase — checks for bugs, security issues, type safety, pattern adherence
- **Dispatch method**: `task(subagent_type="CodeReviewer", description="QA Phase N", prompt="...")`
- **Instructions per dispatch**: Include phase number, files to review, standards to check against, and specific concerns (security, types, edge cases)

### Dispatch Workflow Per Phase
```
1. Read PROGRESS.md → determine current phase and what needs to be done
2. Dispatch CoderAgent (deepseek-v4-flash) with detailed phase prompt
3. CoderAgent implements the phase, runs lint/typecheck/build
4. Dispatch CodeReviewer (minimax-m3) to review the implementation
5. If bugs found → dispatch CoderAgent again with fix instructions
6. Once approved → update PROGRESS.md (mark phase complete) and changelog.md (add entry)
7. Move to next phase
```

### opencode.json Configuration (to enforce model assignments)
To assign specific models to agents, create or update opencode.json at the project root:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "coder": {
      "model": "deepseek/deepseek-v4-flash",
      "prompt": "You are a coding agent for the NoteHut project. Always read PROGRESS.md first to determine current state. Follow patterns in project.md."
    },
    "reviewer": {
      "model": "minimax/minimax-m3",
      "prompt": "You are a quality assurance agent for NoteHut. Review code for bugs, security, type safety. Check against project.md standards."
    }
  }
}
```
Note: The exact model provider prefix (e.g., "deepseek/" vs other) depends on the user's opencode provider configuration. Adjust accordingly.

## Chat-Clear Resilience Mechanism

The project uses a PROGRESS.md file as a persistent state tracker. This file survives chat clears because it lives on disk, not in chat context.

### How It Works
1. **PROGRESS.md** tracks the status of all 13 implementation phases
2. After each phase completes, PROGRESS.md is updated with:
   - Phase status (pending → in_progress → completed)
   - Files created/modified in that phase
   - Any issues or blockers
   - Next phase to execute
3. **changelog.md** documents every change made (like a git log in markdown)
4. **project.md** contains the full spec (never changes unless scope changes)

### After Chat Clear — Recovery Protocol
When a new chat session starts (after chat clear), the AI should:
1. Read PROGRESS.md first — this tells it exactly where the project stands
2. Read changelog.md to see what was done recently
3. Read project.md if full spec context is needed
4. Determine the next step from PROGRESS.md
5. Continue execution from that point

This means no context is lost when chat is cleared. The AI can always figure out the next step by reading PROGRESS.md.

## Execution Phases (13 phases)

### Phase 1: Scaffold
- create-next-app (TS, Tailwind v4, App Router)
- shadcn init + install components
- Install all dependencies
- Create .env.example
- Set up Supabase clients (client/server/service)
- Create middleware + auth helpers
- Create root + (app) + (auth) layouts
- Status: PENDING

### Phase 2: SQL Schema
- Write supabase/schema.sql (consolidated, all tables, RLS, triggers, functions, Realtime, Storage)
- Status: PENDING

### Phase 3: BYOK Store
- Create stores/byok.ts (Zustand + persist)
- Create Settings page UI with LLM + Embeddings sections
- Status: PENDING

### Phase 4: AI Lib
- Create lib/ai/providers.ts (resolveChatProvider, resolveEmbeddingsModel, fallback path)
- Create lib/ai/schemas.ts (QuestionSchema with topicTags, ExamSchema, GradeSchema)
- Create lib/ai/prompts.ts (weakness injection system prompt)
- Create lib/ai/embeddings.ts (embedMany wrapper)
- Create lib/rag/chunk.ts (recursive splitter)
- Create lib/rag/retrieve.ts (retrieveChunks with topic filter)
- Status: PENDING

### Phase 5: Upload Pipeline
- Create /api/upload route
- Create /api/embeddings route
- Create UploadPdf component
- Create RealtimeOcrStatus component (Supabase Realtime listener)
- Status: PENDING

### Phase 6: Exam Generation
- Create /api/ai/generate-exam route
- Create exam config dialog component
- Create ExamRunner component
- Status: PENDING

### Phase 7: Chat
- Create /api/ai/chat route (streaming)
- Create Chat component (useChat)
- Status: PENDING

### Phase 8: Grading + Weaknesses
- Create /api/ai/grade-exam route (with UPSERT to user_weaknesses)
- Create exam results UI
- Create weaknesses page
- Status: PENDING

### Phase 9: Tutor
- Create /api/ai/tutor route (streaming)
- Create tutor panel component
- Status: PENDING

### Phase 10: Topics CRUD + Multi-file RAG
- Topics CRUD UI and routes
- Multi-file RAG (topic-filtered match_chunks already in SQL)
- Status: PENDING

### Phase 11: Exam Sharing
- Create /api/exam/share route
- Create /exam/[id] public page
- Create /api/exam/public-grade route (uses fallback keys)
- Status: PENDING

### Phase 12: Admin Panel
- Create profiles.is_admin guard in middleware
- Create /admin layout + page
- Create AdminQueueTable component
- Create accelerated_ocr_online toggle
- Create /api/admin/queue, /api/admin/settings, /api/admin/fallback-keys routes
- Status: PENDING

### Phase 13: Polish
- Landing page
- README with deploy steps
- Final lint, typecheck, build
- Status: PENDING
