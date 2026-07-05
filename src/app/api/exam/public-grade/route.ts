import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { generateObject } from 'ai'
import { GradeSchema, type GradeResult } from '@/lib/ai/schemas'
import { resolveChatModel, type FallbackConfig } from '@/lib/ai/providers'
import { gradeExamSystemPrompt, gradeExamUserPrompt, type GradeQuestion } from '@/lib/ai/prompts'

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

/** In-memory rate limiter (per-IP, sliding window). */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (entry && entry.resetAt > now) {
    if (entry.count >= RATE_LIMIT) return false
    entry.count++
    return true
  }
  rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
  return true
}

function gradeMcq(
  question: GradeQuestion,
  studentAnswer: string | undefined,
): GradeResult {
  if (studentAnswer === undefined) {
    return { score: 0, feedback: 'No answer provided', isCorrect: false }
  }

  const selected = parseInt(studentAnswer, 10)
  const isCorrect = !isNaN(selected) && selected === question.correctAnswer

  return {
    score: isCorrect ? 100 : 0,
    feedback: isCorrect
      ? 'Correct'
      : `Incorrect. Expected option ${question.correctAnswer}`,
    isCorrect,
  }
}

function gradeCheckbox(
  question: GradeQuestion,
  studentAnswer: string | undefined,
): GradeResult {
  if (studentAnswer === undefined) {
    return { score: 0, feedback: 'No answer provided', isCorrect: false }
  }

  const selected = studentAnswer
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))

  const expected = question.correctAnswers ?? []
  const isCorrect =
    selected.length === expected.length &&
    selected.every((i) => expected.includes(i))

  return {
    score: isCorrect ? 100 : 0,
    feedback: isCorrect
      ? 'Correct'
      : `Incorrect. Expected options ${expected.join(', ')}`,
    isCorrect,
  }
}

async function gradeEssay(
  question: GradeQuestion,
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
    // --- Rate limit (public endpoint — prevent LLM cost DoS) -------------
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 },
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

    // --- Parse questions ---------------------------------------------------
    let questions: GradeQuestion[]
    try {
      questions = JSON.parse(exam.questions_json) as GradeQuestion[]
    } catch {
      return NextResponse.json(
        { error: 'Invalid exam data' },
        { status: 500 },
      )
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Exam has no questions' },
        { status: 500 },
      )
    }

    // --- Read fallback LLM credentials from app_secrets --------------------
    const { data: secrets } = await serviceClient
      .from('app_secrets')
      .select('key, value')
      .in('key', ['fallback_llm', 'fallback_embeddings'])

    const secretsMap = new Map<string, string>(
      (secrets ?? []).map((s) => [s.key, s.value]),
    )

    const fallbackLlmRaw = secretsMap.get('fallback_llm')
    if (!fallbackLlmRaw) {
      return NextResponse.json(
        { error: 'Fallback LLM not configured' },
        { status: 502 },
      )
    }

    let fallbackConfig: FallbackConfig
    try {
      fallbackConfig = JSON.parse(fallbackLlmRaw) as FallbackConfig
    } catch {
      return NextResponse.json(
        { error: 'Invalid fallback LLM configuration' },
        { status: 502 },
      )
    }

    // Validate required fields
    if (!fallbackConfig.llmApiKey || !fallbackConfig.llmModelName) {
      return NextResponse.json(
        { error: 'Incomplete fallback LLM configuration' },
        { status: 502 },
      )
    }

    // Override embeddings config if a separate fallback_embeddings key exists
    const fallbackEmbeddingsRaw = secretsMap.get('fallback_embeddings')
    if (fallbackEmbeddingsRaw) {
      try {
        const embeddingsConfig = JSON.parse(fallbackEmbeddingsRaw)
        if (embeddingsConfig.embeddingsBaseURL) {
          fallbackConfig.embeddingsBaseURL = embeddingsConfig.embeddingsBaseURL
        }
        if (embeddingsConfig.embeddingsModel) {
          fallbackConfig.embeddingsModel = embeddingsConfig.embeddingsModel
        }
      } catch {
        // Silently ignore malformed fallback_embeddings — the LLM config is sufficient
      }
    }

    // --- Grade each question -----------------------------------------------
    const model = resolveChatModel(fallbackConfig)
    const results: GradeResult[] = []

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const studentAnswer = body.answers[String(i)]

      switch (question.type) {
        case 'mcq':
          results.push(gradeMcq(question, studentAnswer))
          break

        case 'checkbox':
          results.push(gradeCheckbox(question, studentAnswer))
          break

        case 'essay': {
          // Essay grading uses AI — wrap in try/catch per question so a
          // single failure doesn't lose all results.
          try {
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

        default:
          results.push({
            score: 0,
            feedback: `Unknown question type: ${question.type}`,
            isCorrect: false,
          })
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
