import 'server-only'

import type { ByokConfig } from '@/lib/store/byok-store'
import type { FallbackConfig } from '@/lib/ai/providers'
import {
  parseFallbackEmbeddings,
  parseFallbackLlm,
} from '@/lib/ai/fallback-config'
import { createServiceClient } from '@/lib/supabase/service'
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url'

export type AiFeature = 'exam_model' | 'chat_model' | 'grading_model' | 'tutor_model'

async function validateOutboundConfig(
  config: FallbackConfig,
  requireEmbeddings: boolean,
): Promise<FallbackConfig> {
  if (config.llmProvider !== 'gemini') {
    await assertSafeOutboundUrl(config.llmBaseURL)
  }
  if (requireEmbeddings) await assertSafeOutboundUrl(config.embeddingsBaseURL)
  return config
}

function hasLlmConfig(config: ByokConfig): boolean {
  const providerCredentialsPresent = Boolean(config.llmApiKey)
  return Boolean(
    providerCredentialsPresent &&
      config.llmModelName &&
      (config.llmProvider === 'gemini' || config.llmBaseURL),
  )
}

/**
 * Fill missing user BYOK values from service-role-only fallback settings.
 * Per-feature model overrides are global administrator policy and therefore
 * apply to either an explicit BYOK model or the fallback model.
 */
export async function resolveServerAiConfig(
  userConfig: ByokConfig,
  feature: AiFeature,
): Promise<FallbackConfig> {
  const requireEmbeddings = feature !== 'grading_model'
  const needsFallbackLlm = !hasLlmConfig(userConfig)
  const needsFallbackEmbeddings = requireEmbeddings && !userConfig.embeddingsBaseURL

  const serviceClient = createServiceClient()
  const [secretsResult, settingResult] = await Promise.all([
    serviceClient
      .from('app_secrets')
      .select('key, value')
      .in('key', ['fallback_llm', 'fallback_embeddings']),
    serviceClient
      .from('app_settings')
      .select('value')
      .eq('key', feature)
      .maybeSingle(),
  ])

  if (secretsResult.error) {
    throw new Error('Failed to load fallback AI configuration')
  }
  if (settingResult.error) {
    throw new Error('Failed to load feature model configuration')
  }

  const secrets = new Map(
    (secretsResult.data ?? []).map((secret) => [secret.key, secret.value]),
  )

  let llmConfig = {
    llmProvider: userConfig.llmProvider,
    llmBaseURL: userConfig.llmBaseURL,
    llmApiKey: userConfig.llmApiKey,
    llmModelName: userConfig.llmModelName,
  }

  if (needsFallbackLlm) {
    const parsed = parseFallbackLlm(secrets.get('fallback_llm'))
    if (!parsed.success) throw new Error('Fallback LLM is not configured')
    llmConfig = parsed.data

  }

  const override = settingResult.data?.value
  if (typeof override === 'string' && override.trim()) {
    llmConfig.llmModelName = override.trim()
  }

  let embeddingsConfig = {
    embeddingsBaseURL: userConfig.embeddingsBaseURL,
    embeddingsApiKey: userConfig.embeddingsApiKey,
    embeddingsModel: userConfig.embeddingsModel,
  }

  if (needsFallbackEmbeddings) {
    const parsed = parseFallbackEmbeddings(secrets.get('fallback_embeddings'))
    if (!parsed.success) throw new Error('Fallback embeddings are not configured')
    embeddingsConfig = parsed.data
  }

  return validateOutboundConfig(
    { ...llmConfig, ...embeddingsConfig },
    requireEmbeddings,
  )
}

/** Resolve and validate only embeddings configuration for the indexing route. */
export async function resolveServerEmbeddingsConfig(
  userConfig: ByokConfig,
): Promise<FallbackConfig> {
  let embeddingsBaseURL = userConfig.embeddingsBaseURL
  let embeddingsApiKey = userConfig.embeddingsApiKey
  let embeddingsModel = userConfig.embeddingsModel

  if (!embeddingsBaseURL) {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('app_secrets')
      .select('value')
      .eq('key', 'fallback_embeddings')
      .maybeSingle()
    if (error) throw new Error('Failed to load fallback embeddings configuration')
    const parsed = parseFallbackEmbeddings(data?.value)
    if (!parsed.success) throw new Error('Fallback embeddings are not configured')
    embeddingsBaseURL = parsed.data.embeddingsBaseURL
    embeddingsApiKey = parsed.data.embeddingsApiKey
    embeddingsModel = parsed.data.embeddingsModel
  }

  await assertSafeOutboundUrl(embeddingsBaseURL)
  return {
    ...userConfig,
    embeddingsBaseURL,
    embeddingsApiKey,
    embeddingsModel,
  }
}
