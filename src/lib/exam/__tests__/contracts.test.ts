import { describe, expect, it } from 'vitest'
import { QuestionSchema } from '@/lib/ai/schemas'
import { decodeJsonb, parseFallbackEmbeddings, parseFallbackLlm } from '@/lib/ai/fallback-config'
import { gradeObjectiveQuestion } from '@/lib/exam/grading'
import { parseStoredExam } from '@/lib/exam/stored-exam'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const question = {
  type: 'mcq' as const,
  question: 'Which option is correct?',
  options: ['A', 'B'],
  correctAnswer: 0,
  topicTags: ['test'],
}

describe('shared exam storage contract', () => {
  it.each([
    { questions: [question] },
    [question],
    JSON.stringify([question]),
    JSON.stringify({ questions: [question] }),
  ])('accepts canonical and legacy values', (storedValue) => {
    expect(parseStoredExam(storedValue)?.questions).toEqual([question])
  })

  it('rejects malformed stored questions', () => {
    expect(parseStoredExam([{ ...question, correctAnswer: 4 }])).toBeNull()
  })
})

describe('fallback jsonb contract', () => {
  const fallback = {
    llmProvider: 'custom' as const,
    llmBaseURL: 'https://example.com/v1',
    llmApiKey: 'secret',
    llmModelName: 'model',
  }

  it('accepts native Supabase jsonb objects', () => {
    expect(parseFallbackLlm(fallback).success).toBe(true)
  })

  it('accepts legacy JSON strings', () => {
    expect(decodeJsonb(JSON.stringify(fallback))).toEqual(fallback)
  })

  it('keeps a dedicated authenticated embeddings credential', () => {
    const result = parseFallbackEmbeddings({
      embeddingsBaseURL: 'https://worker.example.com/ollama/v1',
      embeddingsApiKey: 'worker-secret',
      embeddingsModel: 'qwen3-embedding:0.6b',
    })

    expect(result.success && result.data.embeddingsApiKey).toBe('worker-secret')
  })
})

describe('OCR queue ownership contract', () => {
  it('requires queue documents and storage paths to belong to the caller', () => {
    const schema = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8')

    expect(schema).toMatch(/documents\.id = ocr_queue\.document_id/)
    expect(schema).toMatch(/documents\.user_id = auth\.uid\(\)/)
    expect(schema).toMatch(/documents\.storage_path = ocr_queue\.file_url/)
  })
})

describe('objective grading', () => {
  it('does not let duplicate checkbox selections count as extra answers', () => {
    const checkbox = QuestionSchema.parse({
      type: 'checkbox',
      question: 'Choose both',
      options: ['A', 'B', 'C'],
      correctAnswers: [0, 1],
      topicTags: [],
    })
    if (checkbox.type !== 'checkbox') throw new Error('Unexpected question type')

    expect(gradeObjectiveQuestion(checkbox, '0,0,1').isCorrect).toBe(true)
    expect(gradeObjectiveQuestion(checkbox, '0,0').isCorrect).toBe(false)
  })

  it('rejects out-of-range answer keys at the schema boundary', () => {
    expect(QuestionSchema.safeParse({ ...question, correctAnswer: 2 }).success).toBe(false)
  })
})
