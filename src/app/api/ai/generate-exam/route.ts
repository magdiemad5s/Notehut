import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateObject } from 'ai'
import { ExamSchema } from '@/lib/ai/schemas'
import { resolveChatModel } from '@/lib/ai/providers'
import { retrieveChunks } from '@/lib/rag/retrieve'
import { generateExamSystemPrompt, generateExamUserPrompt, type Weakness } from '@/lib/ai/prompts'
import type { ByokConfig } from '@/lib/store/byok-store'
import { resolveServerAiConfig } from '@/lib/ai/server-config'

/**
 * POST /api/ai/generate-exam
 *
 * Generates a structured exam using RAG + AI SDK generateObject with ExamSchema.
 * Retrieves document chunks for the given topic, fetches user weakness data
 * to bias questions, and returns generated exam questions.
 *
 * Auth: required (authenticated user).
 * Body: { topicId: string, config: { questionTypes, count, difficulty } }
 *       + BYOK config via headers (byokToHeaders).
 *
 * Returns: { questions: Question[] }
 */

const requestBodySchema = z.object({
  topicId: z.string().uuid(),
  config: z.object({
    questionTypes: z.array(z.enum(['mcq', 'checkbox', 'essay'])).min(1),
    count: z.number().int().min(1).max(20),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  }),
})

/** Extract BYOK config from request headers (set by byokToHeaders). */
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

    let byok: ByokConfig
    try {
      byok = await resolveServerAiConfig(
        readByokFromHeaders(request),
        'exam_model',
      )
    } catch (configError) {
      console.error('Generate exam configuration error:', configError)
      return NextResponse.json(
        { error: 'Complete LLM and embeddings configuration is required' },
        { status: 400 },
      )
    }

    // --- Retrieve chunks via RAG ------------------------------------------
    const chunks = await retrieveChunks({
      topicId: body.topicId,
      query: 'Generate exam questions covering all key topics in the material',
      byok,
      k: 10,
    })

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'No document chunks found for this topic. Upload and process documents first.' },
        { status: 422 },
      )
    }

    // Cap context length to avoid overwhelming small local models
    const MAX_CONTEXT_CHARS = 24_000
    const context = chunks.map((c) => c.content).join('\n\n').slice(0, MAX_CONTEXT_CHARS)

    // --- Fetch user weaknesses --------------------------------------------
    const { data: weaknessesData, error: weaknessesError } = await supabase
      .from('user_weaknesses')
      .select('topic_name, error_count')
      .eq('user_id', user.id)

    if (weaknessesError) {
      console.error('user_weaknesses fetch error:', weaknessesError)
    }

    // DB column is error_count, not weakness_score — map accordingly
    const weaknesses: Weakness[] = (weaknessesData ?? []).map((w) => ({
      topic_name: w.topic_name,
      weakness_score: w.error_count,
    }))

    // --- Generate exam via AI SDK -----------------------------------------
    let result
    try {
      result = await generateObject({
        model: resolveChatModel(byok),
        schema: ExamSchema,
        system: generateExamSystemPrompt(weaknesses),
        prompt: generateExamUserPrompt(context, body.config),
        temperature: 0.5,
      })
    } catch (error) {
      console.error('generateObject error:', error)
      return NextResponse.json(
        { error: 'Failed to generate exam. Check your LLM configuration in Settings.' },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { questions: result.object.questions },
      { status: 200 },
    )
  } catch (error) {
    console.error('Generate exam route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
