import { z } from 'zod'

const mcqSchema = z.object({
  type: z.literal('mcq'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctAnswer: z.number().int().min(0),
  topicTags: z.array(z.string()).max(10),
})

const checkboxSchema = z.object({
  type: z.literal('checkbox'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctAnswers: z.array(z.number().int().min(0)).min(1),
  topicTags: z.array(z.string()).max(10),
})

const essaySchema = z.object({
  type: z.literal('essay'),
  question: z.string().min(1),
  expectedAnswer: z.string().min(1),
  topicTags: z.array(z.string()).max(10),
})

export const QuestionSchema = z.discriminatedUnion('type', [
  mcqSchema,
  checkboxSchema,
  essaySchema,
])

export const ExamSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
})

export const GradeSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  isCorrect: z.boolean(),
})

export type Question = z.infer<typeof QuestionSchema>
export type Exam = z.infer<typeof ExamSchema>
export type GradeResult = z.infer<typeof GradeSchema>
