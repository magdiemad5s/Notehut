import { createClient } from '@/lib/supabase/server'
import { embedSingle } from '@/lib/ai/embeddings'
import type { ByokConfig } from '@/lib/store/byok-store'

export type RetrievedChunk = {
  id: string
  document_id: string
  content: string
  similarity: number
}

/**
 * RAG retrieval: embed query via BYOK Ollama (1024-dim), call match_chunks RPC
 * with topic_id filter, return top-k chunks
 */
export async function retrieveChunks(params: {
  topicId: string
  query: string
  byok: ByokConfig
  k?: number
}): Promise<RetrievedChunk[]> {
  const { topicId, query, byok, k = 5 } = params

  if (!query.trim()) throw new Error('Query cannot be empty')

  const queryEmbedding = await embedSingle(query, byok)
  if (queryEmbedding.length !== 1024) {
    throw new Error(
      `Embedding dimension mismatch: got ${queryEmbedding.length}, expected 1024`,
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_topic_id: topicId,
    match_count: k,
  })

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`)
  }

  return data as RetrievedChunk[]
}
