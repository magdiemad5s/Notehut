import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateObject } from 'ai'
import { ExamSchema, GradeSchema, type GradeResult } from '@/lib/ai/schemas'
import { resolveChatModel } from '@/lib/ai/providers'
import { gradeExamSystemPrompt, gradeExamUserPrompt, type GradeQuestion } from '@/lib/ai/prompts'
import type { ByokConfig } from '@/lib/store/byok-store'
import { gradeObjectiveQuestion } from '@/lib/exam/grading'
import { resolveServerAiConfig } from '@/lib/ai/server-config'

/**
 * POST /api/ai/grade-exam
 *
 * Grades a submitted exam. MCQ and checkbox questions are scored
 * deterministically by comparing answers. Essay questions are graded
 * via AI SDK generateObject with GradeSchema.
 *
 * For each wrong answer, user_weaknesses is UPSERTed per topic tag
 * to track the student's weak areas.
 *
 * Auth: required (authenticated user).
 * Body: { exam: { questions: any[] }, answers: Record<string, string> }
 *       + BYOK config via headers (byokToHeaders).
 *
 * Returns: { results: GradeResult[], weaknessDeltas: { topic_name, delta }[] }
 */

const requestBodySchema = z.object({
  exam: ExamSchema,
  answers: z.record(z.string(), z.string()),
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

    // Resolve the service fallback only when an essay actually needs an LLM.
    const byok = readByokFromHeaders(request)
    let aiConfig = byok
    if (body.exam.questions.some((question) => question.type === 'essay')) {
      try {
        aiConfig = await resolveServerAiConfig(byok, 'grading_model')
      } catch (configError) {
        console.error('Grade exam configuration error:', configError)
        return NextResponse.json(
          { error: 'LLM configuration is required for essay grading' },
          { status: 400 },
        )
      }
    }

    // --- Grade each question ----------------------------------------------
    const questions = body.exam.questions
    const { answers } = body
    const results: GradeResult[] = []
    const weaknessDeltaMap = new Map<string, number>()

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const answer = answers[String(i)] ?? ''
      const tags = question.topicTags

      let result: GradeResult

      switch (question.type) {
        case 'mcq':
        case 'checkbox':
          result = gradeObjectiveQuestion(question, answer)
          break
        case 'essay':
          // Essay: AI-graded via generateObject with GradeSchema
          try {
            const { object } = await generateObject({
              model: resolveChatModel(aiConfig),
              schema: GradeSchema,
              system: gradeExamSystemPrompt(),
              prompt: gradeExamUserPrompt(question as GradeQuestion, answer || ''),
            })
            result = object
          } catch (error) {
            console.error('Essay grading generateObject error:', error)
            return NextResponse.json(
              { error: 'Failed to grade essay. Check your LLM configuration in Settings.' },
              { status: 502 },
            )
          }
          break
      }

      results.push(result)

      // --- Track wrong-answer tags for batch UPSERT -----------------------
      if (!result.isCorrect) {
        for (const tag of tags) {
          const currentDelta = weaknessDeltaMap.get(tag) ?? 0
          weaknessDeltaMap.set(tag, currentDelta + 1)
        }
      }
    }

    // --- Batch UPSERT user_weaknesses (eliminates race condition) ---------
    const uniqueTags = Array.from(weaknessDeltaMap.keys())
    if (uniqueTags.length > 0) {
      const deltas = Object.fromEntries(weaknessDeltaMap)
      const { error: weaknessError } = await supabase.rpc(
        'increment_user_weaknesses',
        { p_deltas: deltas },
      )
      if (weaknessError) {
        console.error('Weakness increment error:', weaknessError)
        return NextResponse.json(
          { error: 'Exam was graded but weakness tracking failed' },
          { status: 500 },
        )
      }
    }

    // --- Build weakness deltas response -----------------------------------
    const weaknessDeltas = Array.from(weaknessDeltaMap.entries()).map(
      ([topic_name, delta]) => ({ topic_name, delta }),
    )

    return NextResponse.json(
      { results, weaknessDeltas },
      { status: 200 },
    )
  } catch (error) {
    console.error('Grade exam route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
