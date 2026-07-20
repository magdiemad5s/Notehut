import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useMemo } from 'react'

export type LlmProvider = 'custom' | 'gemini' | 'deepseek'

export interface ByokConfig {
  llmProvider: LlmProvider
  llmBaseURL: string
  llmApiKey: string
  llmModelName: string
  embeddingsBaseURL: string
  embeddingsApiKey: string
  embeddingsModel: string
}

export interface ByokStore extends ByokConfig {
  setLlmProvider: (value: LlmProvider) => void
  setLlmBaseURL: (value: string) => void
  setLlmApiKey: (value: string) => void
  setLlmModelName: (value: string) => void
  setEmbeddingsBaseURL: (value: string) => void
  setEmbeddingsApiKey: (value: string) => void
  setEmbeddingsModel: (value: string) => void
  reset: () => void
}

const defaultConfig: ByokConfig = {
  llmProvider: 'custom',
  llmBaseURL: '',
  llmApiKey: '',
  llmModelName: '',
  embeddingsBaseURL: '',
  embeddingsApiKey: '',
  embeddingsModel: 'qwen3-embedding:0.6b',
}

export const useByokStore = create<ByokStore>()(
  persist(
    (set) => ({
      ...defaultConfig,

      setLlmProvider: (value) => set({ llmProvider: value }),
      setLlmBaseURL: (value) => set({ llmBaseURL: value }),
      setLlmApiKey: (value) => set({ llmApiKey: value }),
      setLlmModelName: (value) => set({ llmModelName: value }),
      setEmbeddingsBaseURL: (value) => set({ embeddingsBaseURL: value }),
      setEmbeddingsApiKey: (value) => set({ embeddingsApiKey: value }),
      setEmbeddingsModel: (value) => set({ embeddingsModel: value }),
      reset: () => set({ ...defaultConfig }),
    }),
    {
      name: 'notehut-byok',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** Select only persisted config values, excluding action functions. */
export function useByokConfig(): ByokConfig {
  const llmProvider = useByokStore((state) => state.llmProvider)
  const llmBaseURL = useByokStore((state) => state.llmBaseURL)
  const llmApiKey = useByokStore((state) => state.llmApiKey)
  const llmModelName = useByokStore((state) => state.llmModelName)
  const embeddingsBaseURL = useByokStore((state) => state.embeddingsBaseURL)
  const embeddingsApiKey = useByokStore((state) => state.embeddingsApiKey)
  const embeddingsModel = useByokStore((state) => state.embeddingsModel)

  return useMemo(
    () => ({
      llmProvider,
      llmBaseURL,
      llmApiKey,
      llmModelName,
      embeddingsBaseURL,
      embeddingsApiKey,
      embeddingsModel,
    }),
    [
      llmProvider,
      llmBaseURL,
      llmApiKey,
      llmModelName,
      embeddingsBaseURL,
      embeddingsApiKey,
      embeddingsModel,
    ],
  )
}

/** Convert BYOK config to HTTP headers for API requests. */
export function byokToHeaders(config: ByokConfig): Record<string, string> {
  const headers: Record<string, string> = {}

  if (config.llmProvider) headers['x-byok-provider'] = config.llmProvider
  if (config.llmBaseURL) headers['x-byok-base-url'] = config.llmBaseURL
  if (config.llmApiKey) headers['x-byok-api-key'] = config.llmApiKey
  if (config.llmModelName) headers['x-byok-model'] = config.llmModelName
  if (config.embeddingsBaseURL) headers['x-byok-embeddings-base-url'] = config.embeddingsBaseURL
  if (config.embeddingsApiKey) headers['x-byok-embeddings-api-key'] = config.embeddingsApiKey
  if (config.embeddingsModel) headers['x-byok-embeddings-model'] = config.embeddingsModel

  return headers
}
