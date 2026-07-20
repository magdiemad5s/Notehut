import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { resolveChatModel } from '@/lib/ai/providers'
import { retrieveChunks } from '@/lib/rag/retrieve'
import { tutorSystemPrompt } from '@/lib/ai/prompts'
import type { ByokConfig } from '@/lib/store/byok-store'
import { resolveServerAiConfig } from '@/lib/ai/server-config'

// ─── Body schema ───────────────────────────────────────────────────────

const requestBodySchema = z.object({
  topicName: z.string().min(1),
  topicId: z.string().uuid(),
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    parts: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })),
  })).min(1),
})

// ─── BYOK header extraction (provider-aware) ───────────────────────────

/**
 * Extract BYOK config from request headers (set by byokToHeaders).
 *
 * Provider-aware: Gemini needs only `apiKey`; other providers
 * (custom / deepseek) require both `baseURL` and `apiKey`.
 */
function readByokFromHeaders(request: NextRequest): ByokConfig {
  const h = (name: string) => request.headers.get(name) ?? ''
  return {
    llmProvider: (h('x-byok-provider') as ByokConfig['llmProvider']) || 'custom',
    llmBaseURL: h('x-byok-base-url'),
    llmApiKey: h('x-byok-api-key'),
    llmModelName: h('x-byok-model'),
    embeddingsBaseURL: h('x-byok-embeddings-base-url'),
    embeddingsApiKey: h('x-byok-embeddings-api-key'),
    embeddingsModel: h('x-byok-embeddings-model') || 'qwen3-embedding:0.6b',
  }
}

// ─── Route ─────────────────────────────────────────────────────────────

/**
 * POST /api/ai/tutor
 *
 * Generates a targeted study guide for a weak topic using RAG + streamText.
 *
 * Auth: required (authenticated user).
 * Body: { topicName: string, topicId: uuid } + BYOK config via headers.
 *
 * Returns: Streaming response (UIMessageStreamResponse) or JSON error.
 */
export async function POST(request: NextRequest) {
  try {
    // --- Auth gate -------------------------------------------------------
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

    // --- Parse + validate body -------------------------------------------
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

    // --- Read BYOK config from headers -----------------------------------
    let byok: ByokConfig
    try {
      byok = await resolveServerAiConfig(
        readByokFromHeaders(request),
        'tutor_model',
      )
    } catch (configError) {
      console.error('Tutor configuration error:', configError)
      return NextResponse.json(
        { error: 'Complete LLM and embeddings configuration is required' },
        { status: 400 },
      )
    }

    // --- Retrieve relevant chunks via RAG --------------------------------
    let chunks: Awaited<ReturnType<typeof retrieveChunks>>
    try {
      chunks = await retrieveChunks({
        topicId: body.topicId,
        query: body.topicName,
        byok,
        k: 5,
      })
    } catch (error) {
      console.error('Retrieval error:', error)
      return NextResponse.json(
        { error: 'Failed to retrieve study material. Check your embeddings configuration in Settings.' },
        { status: 502 },
      )
    }

    // --- Build context from retrieved chunks -----------------------------
    const context = chunks.map((c) => c.content).join('\n\n')

    // --- Stream the tutor response ---------------------------------------
    const messages = await convertToModelMessages(body.messages as UIMessage[])
    const result = streamText({
      model: resolveChatModel(byok),
      system: tutorSystemPrompt(body.topicName, context),
      messages,
      temperature: 0.4,
      maxOutputTokens: 2048,
      onError: ({ error }) => console.error('Tutor streamText error:', error),
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error('Tutor stream error:', error)
        return 'The tutor encountered an error.'
      },
    })
  } catch (error) {
    console.error('Tutor route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
