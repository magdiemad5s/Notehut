import { z } from 'zod'

export const fallbackLlmSchema = z.object({
  llmProvider: z.enum(['custom', 'gemini', 'deepseek']).default('custom'),
  llmBaseURL: z.string().url().max(2048).or(z.literal('')).default(''),
  llmApiKey: z.string().max(2048).default(''),
  llmModelName: z.string().trim().min(1).max(256),
}).superRefine((config, ctx) => {
  if (!config.llmApiKey) {
    ctx.addIssue({
      code: 'custom',
      path: ['llmApiKey'],
      message: 'API key is required for this provider',
    })
  }
  if (config.llmProvider !== 'gemini' && !config.llmBaseURL) {
    ctx.addIssue({
      code: 'custom',
      path: ['llmBaseURL'],
      message: 'Base URL is required for this provider',
    })
  }
})

export const fallbackEmbeddingsSchema = z.object({
  embeddingsBaseURL: z.string().url().max(2048),
  embeddingsApiKey: z.string().max(2048).default(''),
  embeddingsModel: z.string().trim().min(1).max(256),
})

/** Parse either a native jsonb value or a legacy JSON-encoded string. */
export function decodeJsonb(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function parseFallbackLlm(value: unknown) {
  return fallbackLlmSchema.safeParse(decodeJsonb(value))
}

export function parseFallbackEmbeddings(value: unknown) {
  return fallbackEmbeddingsSchema.safeParse(decodeJsonb(value))
}
