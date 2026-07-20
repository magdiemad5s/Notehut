import { embed, embedMany } from 'ai'
import { resolveEmbeddingsModel } from '@/lib/ai/providers'
import { type ByokConfig } from '@/lib/store/byok-store'

/**
 * Embeddings use BYOK Ollama with qwen3-embedding:0.6b (1024 dimensions)
 * via OpenAI-compatible /v1/embeddings endpoint
 */

export async function embedTexts(
  texts: string[],
  cfg: ByokConfig,
): Promise<number[][]> {
  if (!texts.length) throw new Error('texts cannot be empty')

  const model = resolveEmbeddingsModel(cfg)
  const { embeddings } = await embedMany({
    model,
    values: texts,
    abortSignal: AbortSignal.timeout(120_000), // 2 min budget for batch embedding
  })
  return embeddings
}

export async function embedSingle(
  text: string,
  cfg: ByokConfig,
): Promise<number[]> {
  if (!text.trim()) throw new Error('text cannot be empty')

  const model = resolveEmbeddingsModel(cfg)
  const { embedding } = await embed({
    model,
    value: text,
    abortSignal: AbortSignal.timeout(120_000),
  })
  return embedding
}
