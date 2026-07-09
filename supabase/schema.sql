-- ============================================================================
-- Notehut Database Schema
-- Generated from project.md (Database Schema section)
-- ============================================================================

-- Extensions
create extension if not exists vector;            -- pgvector for embeddings
create extension if not exists "uuid-ossp";       -- UUID generation

-- ============================================================================
-- TABLES
-- ============================================================================

-- profiles: maps to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- topics: groups files (like NotebookLM notebooks)
create table if not exists public.topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- documents: uploaded PDFs
create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  filename text not null,
  storage_path text,
  created_at timestamptz default now()
);

-- document_chunks: text chunks with embeddings
create table if not exists public.document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  embedding vector(1024)  -- CRITICAL: 1024 dimensions for Qwen3-Embedding-0.6b
);

-- HNSW cosine index on document_chunks.embedding
create index if not exists idx_document_chunks_embedding
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ocr_queue: OCR processing queue
create table if not exists public.ocr_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  file_url text not null,
  status text default 'pending'
    constraint ocr_queue_status_check check (status in ('pending', 'processing', 'completed', 'failed')),
  extracted_text text,   -- written by external Python worker
  error text,            -- written by external Python worker on failure
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- user_weaknesses: adaptive learning tracking
create table if not exists public.user_weaknesses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  topic_name text not null,
  error_count integer default 1,
  last_failed_at timestamptz default now(),
  unique (user_id, topic_name)  -- for UPSERT operations
);

-- shared_exams: public exam sharing
create table if not exists public.shared_exams (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid references topics(id) on delete cascade,
  creator_id uuid references auth.users(id) on delete cascade,
  title text not null,
  questions_json jsonb not null,
  is_public boolean default false,
  created_at timestamptz default now()
);

-- app_settings: admin toggles
create table if not exists public.app_settings (
  key text primary key,
  value boolean not null
);

-- app_secrets: admin fallback API keys (NO RLS — service-role only)
create table if not exists public.app_secrets (
  key text primary key,
  value jsonb not null
);

-- ============================================================================
-- TRIGGER: auto-create profile on new user signup
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (
    new.id,
    new.email,
    false
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- TRIGGER: auto-update updated_at on ocr_queue row update
-- ============================================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_ocr_queue_updated_at
  before update on public.ocr_queue
  for each row
  execute function public.update_updated_at();

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================

create or replace function public.match_chunks(
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
  from public.document_chunks dc
  join public.documents d on dc.document_id = d.id
  where d.topic_id = match_topic_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables except app_secrets
alter table if exists public.profiles enable row level security;
alter table if exists public.topics enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.document_chunks enable row level security;
alter table if exists public.ocr_queue enable row level security;
alter table if exists public.user_weaknesses enable row level security;
alter table if exists public.shared_exams enable row level security;
alter table if exists public.app_settings enable row level security;
-- app_secrets: NO RLS — service-role-only access

-- profiles: user can read/update own row. is_admin users can read all.
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- topics: owner-only (select, insert, update, delete where auth.uid() = user_id)
create policy "Users can select own topics"
  on public.topics for select
  using (auth.uid() = user_id);

create policy "Users can insert own topics"
  on public.topics for insert
  with check (auth.uid() = user_id);

create policy "Users can update own topics"
  on public.topics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own topics"
  on public.topics for delete
  using (auth.uid() = user_id);

-- documents: owner-only (filter by user_id)
create policy "Users can select own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- document_chunks: owner-only (filter via document ownership join)
create policy "Users can select own document chunks"
  on public.document_chunks for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  );

create policy "Users can insert document chunks for own documents"
  on public.document_chunks for insert
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  );

create policy "Users can update own document chunks"
  on public.document_chunks for update
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  );

create policy "Users can delete own document chunks"
  on public.document_chunks for delete
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  );

-- ocr_queue: owner-only for select/insert. Admin (is_admin=true) can read all rows.
create policy "Users can select own ocr queue items"
  on public.ocr_queue for select
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Users can insert own ocr queue items"
  on public.ocr_queue for insert
  with check (auth.uid() = user_id);

create policy "Only admins can update ocr queue"
  on public.ocr_queue for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Only admins can delete ocr queue"
  on public.ocr_queue for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- user_weaknesses: owner-only
create policy "Users can select own weaknesses"
  on public.user_weaknesses for select
  using (auth.uid() = user_id);

create policy "Users can insert own weaknesses"
  on public.user_weaknesses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own weaknesses"
  on public.user_weaknesses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own weaknesses"
  on public.user_weaknesses for delete
  using (auth.uid() = user_id);

-- shared_exams: anyone can read if is_public=true. Owner can insert/update/delete.
create policy "Anyone can read public exams"
  on public.shared_exams for select
  using (is_public = true);

create policy "Owner can select own exams"
  on public.shared_exams for select
  using (auth.uid() = creator_id);

create policy "Owner can insert exams"
  on public.shared_exams for insert
  with check (auth.uid() = creator_id);

create policy "Owner can update own exams"
  on public.shared_exams for update
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Owner can delete own exams"
  on public.shared_exams for delete
  using (auth.uid() = creator_id);

-- app_settings: any authenticated user can read. Only is_admin can update.
create policy "Authenticated users can read app settings"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy "Only admins can update app settings"
  on public.app_settings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- app_secrets: NO RLS policies — service-role-only access (intentionally omitted)

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed app_settings
insert into public.app_settings (key, value) values
  ('accelerated_ocr_online', false),
  ('worker_online', false)
on conflict (key) do nothing;

-- Seed app_secrets
insert into public.app_secrets (key, value) values
  ('fallback_llm', '{}'::jsonb),
  ('fallback_embeddings', '{}'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table public.ocr_queue;

-- ============================================================================
-- STORAGE
-- ============================================================================
-- Storage: 'pdfs' bucket (private)
-- Files stored at pdfs/{user_id}/{uuid}.pdf
-- The API route enforces user folder isolation; RLS just checks authentication.
-- ============================================================================

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdfs', 'pdfs', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies first (safe to run repeatedly)
DROP POLICY IF EXISTS "Users can upload their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow read from pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from pdfs" ON storage.objects;

-- RLS: any authenticated user can operate on the pdfs bucket
-- (the API route restricts paths to {user_id}/ so users can't touch others' files)
CREATE POLICY "Allow upload to pdfs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "Allow read from pdfs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "Allow delete from pdfs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pdfs' AND auth.role() = 'authenticated');
