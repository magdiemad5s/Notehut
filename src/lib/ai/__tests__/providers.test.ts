import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createOpenAI: vi.fn(),
  createGoogleGenerativeAI: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({ createOpenAI: mocks.createOpenAI }))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: mocks.createGoogleGenerativeAI }))
vi.mock('@/lib/security/outbound-url', () => ({ safeServerFetch: vi.fn() }))

import { resolveChatProvider, resolveEmbeddingsModel } from '@/lib/ai/providers'

const config = {
  llmProvider: 'custom' as const,
  llmBaseURL: 'https://llm.example.com/v1',
  llmApiKey: 'llm-secret',
  llmModelName: 'chat-model',
  embeddingsBaseURL: 'https://embeddings.example.com/v1',
  embeddingsApiKey: 'embeddings-secret',
  embeddingsModel: 'embedding-model',
}

describe('provider credential isolation', () => {
  beforeEach(() => {
    mocks.createOpenAI.mockReset()
    mocks.createOpenAI.mockImplementation(() => {
      const provider = vi.fn()
      return Object.assign(provider, {
        chat: vi.fn(),
        embedding: vi.fn(() => ({ specificationVersion: 'v2' })),
      })
    })
  })

  it('sends only the LLM credential to the chat upstream', () => {
    resolveChatProvider(config)

    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: config.llmBaseURL,
        apiKey: config.llmApiKey,
      }),
    )
  })

  it('sends only the embeddings credential to the embeddings upstream', () => {
    resolveEmbeddingsModel(config)

    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: config.embeddingsBaseURL,
        apiKey: config.embeddingsApiKey,
      }),
    )
  })
})
