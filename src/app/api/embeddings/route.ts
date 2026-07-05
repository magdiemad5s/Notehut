import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { chunkText } from '@/lib/rag/chunk'
import { embedTexts } from '@/lib/ai/embeddings'
import type { ByokConfig } from '@/lib/store/byok-store'

/**
 * POST /api/embeddings
 *
 * Reads an ocr_queue row by queueId, validates that OCR has completed
 * (status='completed' with extracted_text), chunks the text, embeds each
 * chunk via BYOK Ollama (1024-dim), and bulk-inserts document_chunks.
 *
 * Auth: required (authenticated user).
 * Body: { queueId: string } + BYOK config via headers (byokToHeaders).
 *
 * Returns: { chunkCount: number }
 */

const requestBodySchema = z.object({
  queueId: z.string().uuid('queueId must be a valid UUID'),
})

/** Batch size for document_chunks inserts to avoid payload limits. */
const INSERT_BATCH_SIZE = 50

/** Extract BYOK config from request headers (set by byokToHeaders). */
function readByokFromHeaders(request: NextRequest): ByokConfig {
  const h = (name: string) => request.headers.get(name) ?? ''
  return {
    llmProvider: (h('x-byok-provider') as ByokConfig['llmProvider']) || 'custom',
    llmBaseURL: h('x-byok-base-url'),
    llmApiKey: h('x-byok-api-key'),
    llmModelName: h('x-byok-model'),
    embeddingsBaseURL: h('x-byok-embeddings-base-url'),
    embeddingsModel: h('x-byok-embeddings-model') || 'qwen3-embedding:0.6b',
  }
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth gate ---------------------------------------------------------
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    // --- Parse + validate body --------------------------------------------
    let body: z.infer<typeof requestBodySchema>
    try {
      const raw = await request.json()
      const result = requestBodySchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error.issues[0]?.message || 'Invalid request body' },
          { status: 400 },
        )
      }
      body = result.data
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      )
    }

    // --- Read BYOK config from headers ------------------------------------
    const byok = readByokFromHeaders(request)
    if (!byok.embeddingsBaseURL) {
      return NextResponse.json(
        { error: 'Embeddings base URL is required (configure in Settings)' },
        { status: 400 },
      )
    }

    // --- Fetch ocr_queue row (ownership-filtered via RLS) -----------------
    const { data: queueItem, error: queueError } = await supabase
      .from('ocr_queue')
      .select('id, document_id, status, extracted_text')
      .eq('id', body.queueId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (queueError || !queueItem) {
      return NextResponse.json(
        { error: 'OCR queue item not found' },
        { status: 404 },
      )
    }

    if (queueItem.status !== 'completed') {
      return NextResponse.json(
        {
          error: `OCR not completed yet (current status: ${queueItem.status})`,
        },
        { status: 409 },
      )
    }

    const extractedText = queueItem.extracted_text
    if (!extractedText || !extractedText.trim()) {
      return NextResponse.json(
        { error: 'OCR completed but extracted text is empty' },
        { status: 422 },
      )
    }

    // --- Chunk the text ----------------------------------------------------
    const chunks = chunkText(extractedText)
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Chunking produced no chunks from extracted text' },
        { status: 422 },
      )
    }

    // --- Embed all chunks via BYOK Ollama (1024-dim) ----------------------
    let embeddings: number[][]
    try {
      embeddings = await embedTexts(chunks, byok)
    } catch (error) {
      console.error('Embeddings error:', error)
      return NextResponse.json(
        { error: 'Failed to generate embeddings. Check your embeddings base URL and model in Settings.' },
        { status: 502 },
      )
    }

    if (embeddings.length !== chunks.length) {
      console.error(
        `Embedding count mismatch: ${embeddings.length} vs ${chunks.length} chunks`,
      )
      return NextResponse.json(
        { error: 'Embedding count mismatch — upstream returned unexpected number of vectors' },
        { status: 500 },
      )
    }

    // --- Validate embedding dimension (must be 1024 for pgvector column) --
    const dim = embeddings[0]?.length
    if (dim !== 1024) {
      return NextResponse.json(
        {
          error: `Embedding dimension mismatch: got ${dim}, expected 1024. Check your embeddings model in Settings.`,
        },
        { status: 422 },
      )
    }

    // --- Delete existing chunks for idempotency ---------------------------
    // If this route is retried (transient failure, manual re-run), prior
    // partial inserts would create duplicate chunks. Delete-before-insert
    // makes the operation idempotent.
    const { error: deleteError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', queueItem.document_id)

    if (deleteError) {
      console.error('document_chunks delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to clear existing chunks before re-embedding' },
        { status: 500 },
      )
    }

    // --- Bulk-insert document_chunks in batches ---------------------------
    // NaN/Infinity from a pathological upstream would corrupt the pgvector
    // string; coerce non-finite values to 0 as a defensive guard.
    const rows = chunks.map((content, i) => ({
      document_id: queueItem.document_id,
      content,
      embedding: `[${embeddings[i]
        .map((n) => (Number.isFinite(n) ? n : 0))
        .join(',')}]`,
    }))

    let insertedCount = 0
    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + INSERT_BATCH_SIZE)
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(batch)

      if (insertError) {
        console.error('document_chunks insert error:', insertError)
        return NextResponse.json(
          {
            error: `Failed to insert document chunks (inserted ${insertedCount} of ${rows.length})`,
            chunkCount: insertedCount,
          },
          { status: 500 },
        )
      }
      insertedCount += batch.length
    }

    return NextResponse.json(
      { chunkCount: insertedCount },
      { status: 200 },
    )
  } catch (error) {
    console.error('Embeddings route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
