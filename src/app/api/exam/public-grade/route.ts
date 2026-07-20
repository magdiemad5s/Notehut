import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { generateObject } from 'ai'
import { GradeSchema, type GradeResult, type Question } from '@/lib/ai/schemas'
import { resolveChatModel } from '@/lib/ai/providers'
import { gradeExamSystemPrompt, gradeExamUserPrompt } from '@/lib/ai/prompts'
import { gradeObjectiveQuestion } from '@/lib/exam/grading'
import { parseStoredExam } from '@/lib/exam/stored-exam'
import { resolveServerAiConfig } from '@/lib/ai/server-config'
import type { ByokConfig } from '@/lib/store/byok-store'

/**
 * POST /api/exam/public-grade
 *
 * Grades a public (shared) exam submission without requiring authentication.
 * Intended for guest users who take a shared exam link.
 *
 * - MCQ / checkbox → deterministic (no AI cost)
 * - Essay → graded via AI SDK `generateObject` using fallback LLM credentials
 *   from `app_secrets` (no per-user BYOK).
 *
 * Auth: none (public endpoint — uses service-role client to bypass RLS).
 * Body: { sharedExamId: string, answers: Record<string, string> }
 *
 * Returns: { results: GradeResult[] }
 */

const requestBodySchema = z.object({
  sharedExamId: z.string().uuid(),
  answers: z.record(z.string(), z.string()),
})

const RATE_LIMIT = 5
const RATE_WINDOW = 60_000

async function gradeEssay(
  question: Extract<Question, { type: 'essay' }>,
  studentAnswer: string | undefined,
  model: ReturnType<typeof resolveChatModel>,
): Promise<GradeResult> {
  if (studentAnswer === undefined || studentAnswer.trim() === '') {
    return { score: 0, feedback: 'No answer provided', isCorrect: false }
  }

  const result = await generateObject({
    model,
    schema: GradeSchema,
    system: gradeExamSystemPrompt(),
    prompt: gradeExamUserPrompt(question, studentAnswer),
    temperature: 0.3,
  })

  return result.object
}

export async function POST(request: NextRequest) {
  try {
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

    // --- Service-role client (bypasses RLS) --------------------------------
    const serviceClient = createServiceClient()

    // --- Fetch shared exam -------------------------------------------------
    const { data: exam, error: examError } = await serviceClient
      .from('shared_exams')
      .select('title, questions_json')
      .eq('id', body.sharedExamId)
      .eq('is_public', true)
      .maybeSingle()

    if (examError || !exam) {
      return NextResponse.json(
        { error: 'Shared exam not found' },
        { status: 404 },
      )
    }

    // Keep the counter in Postgres so it is shared by every serverless
    // instance. Invalid exam IDs do not consume a legitimate user's quota.
    const ip = process.env.VERCEL
      ? request.headers.get('x-real-ip')?.trim() || 'unknown'
      : request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { data: rateAllowed, error: rateError } = await serviceClient.rpc(
      'check_public_grade_rate_limit',
      {
        p_rate_key: ip,
        p_rate_limit: RATE_LIMIT,
        p_window_seconds: Math.floor(RATE_WINDOW / 1000),
      },
    )
    if (rateError) {
      console.error('Public-grade rate limiter error:', rateError)
      return NextResponse.json({ error: 'Grading is temporarily unavailable' }, { status: 503 })
    }
    if (!rateAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 },
      )
    }

    // --- Parse questions ---------------------------------------------------
    const parsedExam = parseStoredExam(exam.questions_json)
    if (!parsedExam) {
      return NextResponse.json(
        { error: 'Invalid exam data' },
        { status: 500 },
      )
    }
    const questions = parsedExam.questions

    // --- Grade each question -----------------------------------------------
    const hasEssay = questions.some((question) => question.type === 'essay')
    let model: ReturnType<typeof resolveChatModel> | null = null
    if (hasEssay) {
      try {
        const emptyConfig: ByokConfig = {
          llmProvider: 'custom',
          llmBaseURL: '',
          llmApiKey: '',
          llmModelName: '',
          embeddingsBaseURL: '',
          embeddingsApiKey: '',
          embeddingsModel: 'qwen3-embedding:0.6b',
        }
        model = resolveChatModel(
          await resolveServerAiConfig(emptyConfig, 'grading_model'),
        )
      } catch (configError) {
        console.error('Public grading fallback configuration error:', configError)
        return NextResponse.json(
          { error: 'Fallback LLM not configured for essay grading' },
          { status: 502 },
        )
      }
    }
    const results: GradeResult[] = []

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const studentAnswer = body.answers[String(i)]

      switch (question.type) {
        case 'mcq':
          results.push(gradeObjectiveQuestion(question, studentAnswer))
          break

        case 'checkbox':
          results.push(gradeObjectiveQuestion(question, studentAnswer))
          break

        case 'essay': {
          // Essay grading uses AI — wrap in try/catch per question so a
          // single failure doesn't lose all results.
          try {
            if (!model) throw new Error('Essay grading model is unavailable')
            const result = await gradeEssay(question, studentAnswer, model)
            results.push(result)
          } catch (aiError) {
            console.error(`Essay grading error for question ${i}:`, aiError)
            results.push({
              score: 0,
              feedback: 'Grading failed',
              isCorrect: false,
            })
          }
          break
        }
      }
    }

    return NextResponse.json(
      { results },
      { status: 200 },
    )
  } catch (error) {
    console.error('Public-grade route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
