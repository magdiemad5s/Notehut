import { ExamSchema, type Exam } from '@/lib/ai/schemas'

/**
 * Decode the shapes historically written to shared_exams.questions_json.
 *
 * Supabase returns jsonb values as JavaScript values, while older NoteHut
 * versions stored a JSON string containing a raw question array. New rows use
 * the canonical `{ questions: [...] }` object. Supporting both keeps existing
 * public links valid while enforcing the same runtime schema for every reader.
 */
export function parseStoredExam(value: unknown): Exam | null {
  let decoded = value

  for (let depth = 0; depth < 2 && typeof decoded === 'string'; depth++) {
    try {
      decoded = JSON.parse(decoded)
    } catch {
      return null
    }
  }

  if (Array.isArray(decoded)) {
    decoded = { questions: decoded }
  }

  const result = ExamSchema.safeParse(decoded)
  return result.success ? result.data : null
}
