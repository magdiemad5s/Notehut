import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { QuestionSchema } from '@/lib/ai/schemas'

/**
 * POST /api/exam/share
 *
 * Creates a publicly-shareable exam from an existing topic's questions.
 * Inserts a row into `shared_exams` and returns its public id.
 *
 * Auth: required (authenticated user).
 * Body: { topicId: string, title: string, questions: unknown[] }
 *
 * Returns: { id: string }
 */

const requestBodySchema = z.object({
  topicId: z.string().uuid(),
  title: z.string().min(1).max(200),
  questions: z.array(QuestionSchema).min(1),
})

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

    // --- Verify topic ownership -------------------------------------------
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', body.topicId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found or not owned by user' },
        { status: 404 },
      )
    }

    // --- Insert into shared_exams -----------------------------------------
    const { data, error } = await supabase
      .from('shared_exams')
      .insert({
        topic_id: body.topicId,
        creator_id: user.id,
        title: body.title,
        questions_json: JSON.stringify(body.questions),
        is_public: true,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('shared_exams insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create shared exam' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { id: data.id },
      { status: 200 },
    )
  } catch (error) {
    console.error('Share exam route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
