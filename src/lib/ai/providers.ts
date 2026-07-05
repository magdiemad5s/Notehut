import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { type LanguageModel, type EmbeddingModel } from 'ai'
import type { ByokConfig } from '@/lib/store/byok-store'

/**
 * Same shape as ByokConfig for service-role routes that read fallback credentials
 * from app_secrets when no per-user BYOK config is available.
 *
 * Fallback path: if no BYOK config, service-role route reads app_secrets
 * 'fallback_llm' / 'fallback_embeddings' and builds the same provider shapes.
 */
export interface FallbackConfig {
  llmProvider: 'custom' | 'gemini' | 'deepseek'
  llmBaseURL: string
  llmApiKey: string
  llmModelName: string
  embeddingsBaseURL: string
  embeddingsModel: string
}

/** Callable provider shape — accepts a model id and returns an AI SDK LanguageModel. */
type ChatProvider = (modelId: string) => LanguageModel

/**
 * Resolve a chat provider from BYOK config.
 *
 * - `'gemini'` → uses `createGoogleGenerativeAI` with the provided API key
 * - `'custom'` / `'deepseek'` → uses `createOpenAI` with baseURL and API key
 *
 * The returned provider is callable: `provider(llmModelName)` returns a
 * `LanguageModel` that can be passed to `generateText`, `streamText`, etc.
 */
export function resolveChatProvider(cfg: ByokConfig | FallbackConfig): ChatProvider {
  if (cfg.llmProvider === 'gemini') {
    return createGoogleGenerativeAI({ apiKey: cfg.llmApiKey }) as unknown as ChatProvider
  }
  return createOpenAI({ baseURL: cfg.llmBaseURL, apiKey: cfg.llmApiKey }) as unknown as ChatProvider
}

/**
 * Convenience wrapper around {@link resolveChatProvider}.
 * Resolves a callable chat model directly from BYOK config.
 *
 * @example
 *   const model = resolveChatModel(byokConfig)
 *   const result = await generateText({ model, prompt: '...' })
 */
export function resolveChatModel(cfg: ByokConfig | FallbackConfig): LanguageModel {
  const provider = resolveChatProvider(cfg)
  return provider(cfg.llmModelName)
}

/**
 * Resolve an embeddings model from BYOK config.
 *
 * Uses OpenAI-compatible HTTP client — Ollama provides a `/v1/embeddings`
 * endpoint that is wire-compatible with the OpenAI SDK, so `createOpenAI`
 * works for local embeddings without running a separate OpenAI service.
 */
export function resolveEmbeddingsModel(cfg: ByokConfig | FallbackConfig): EmbeddingModel {
  const provider = createOpenAI({
    baseURL: cfg.embeddingsBaseURL,
    apiKey: cfg.llmApiKey || 'ollama',
  })
  return provider.embedding(cfg.embeddingsModel || 'qwen3-embedding:0.6b')
}
