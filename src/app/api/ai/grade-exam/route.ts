import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateObject } from 'ai'
import { GradeSchema, type GradeResult } from '@/lib/ai/schemas'
import { resolveChatModel } from '@/lib/ai/providers'
import { gradeExamSystemPrompt, gradeExamUserPrompt, type GradeQuestion } from '@/lib/ai/prompts'
import type { ByokConfig } from '@/lib/store/byok-store'

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
  exam: z.object({
    questions: z.array(z.any()).min(1, 'Exam must have at least one question'),
  }),
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

    // --- Read BYOK config from headers ------------------------------------
    const byok = readByokFromHeaders(request)
    // Gemini doesn't need a base URL (uses createGoogleGenerativeAI with apiKey only)
    const needsBaseURL = byok.llmProvider !== 'gemini'
    if (needsBaseURL && !byok.llmBaseURL) {
      return NextResponse.json(
        { error: 'LLM base URL is required for non-Gemini providers (configure in Settings)' },
        { status: 400 },
      )
    }
    if (!byok.llmApiKey) {
      return NextResponse.json(
        { error: 'LLM API key is required (configure in Settings)' },
        { status: 400 },
      )
    }

    // --- Grade each question ----------------------------------------------
    const questions = body.exam.questions as Array<{
      type: string
      question: string
      options?: string[]
      correctAnswer?: number
      correctAnswers?: number[]
      expectedAnswer?: string
      topicTags?: string[]
    }>
    const { answers } = body
    const results: GradeResult[] = []
    const weaknessDeltaMap = new Map<string, number>()

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const answer = answers[String(i)] ?? ''
      const tags: string[] = question.topicTags ?? []

      let result: GradeResult

      if (question.type === 'mcq') {
        // MCQ: deterministic comparison of selected option index
        const isCorrect = Number(answer) === question.correctAnswer
        result = {
          score: isCorrect ? 100 : 0,
          feedback: isCorrect ? 'Correct' : 'Incorrect',
          isCorrect,
        }
      } else if (question.type === 'checkbox') {
        // Checkbox: compare selected options as unordered sets
        const selectedSet = new Set(
          answer
            .split(',')
            .map(Number)
            .filter((n) => !isNaN(n)),
        )
        const correctSet = new Set<number>(question.correctAnswers)
        const setsEqual =
          selectedSet.size === correctSet.size &&
          [...selectedSet].every((n) => correctSet.has(n))
        result = {
          score: setsEqual ? 100 : 0,
          feedback: setsEqual ? 'Correct' : 'Incorrect',
          isCorrect: setsEqual,
        }
      } else if (question.type === 'essay') {
        // Essay: AI-graded via generateObject with GradeSchema
        try {
          const { object } = await generateObject({
            model: resolveChatModel(byok),
            schema: GradeSchema,
            system: gradeExamSystemPrompt(),
            prompt: gradeExamUserPrompt(question as GradeQuestion, answer || ''),
          })
          result = object
        } catch (error) {
          console.error('Essay grading generateObject error:', error)
          const detail = error instanceof Error ? error.message : 'Unknown error'
          return NextResponse.json(
            { error: `Failed to grade essay: ${detail}. Check your LLM configuration in Settings.` },
            { status: 502 },
          )
        }
      } else {
        // Unknown question type — skip with a default incorrect result
        result = {
          score: 0,
          feedback: `Unsupported question type: ${question.type}`,
          isCorrect: false,
        }
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
      // Fetch existing error counts in a single query
      const { data: existingRows } = await supabase
        .from('user_weaknesses')
        .select('topic_name, error_count')
        .eq('user_id', user.id)
        .in('topic_name', uniqueTags)

      const existingMap = new Map<string, number>()
      for (const row of existingRows ?? []) {
        existingMap.set(row.topic_name, row.error_count)
      }

      // Build upsert rows with incremented counts
      const upsertRows = uniqueTags.map((tag) => ({
        user_id: user.id,
        topic_name: tag,
        error_count: (existingMap.get(tag) ?? 0) + (weaknessDeltaMap.get(tag) ?? 1),
        last_failed_at: new Date().toISOString(),
      }))

      await supabase
        .from('user_weaknesses')
        .upsert(upsertRows, { onConflict: 'user_id,topic_name' })
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
