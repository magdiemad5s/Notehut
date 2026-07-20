import { z } from 'zod'

const mcqSchema = z.object({
  type: z.literal('mcq'),
  question: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(2000)).min(2).max(20),
  correctAnswer: z.number().int().min(0),
  topicTags: z.array(z.string().trim().min(1).max(200)).max(10),
}).superRefine((question, ctx) => {
  if (question.correctAnswer >= question.options.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctAnswer'],
      message: 'Correct answer must reference an existing option',
    })
  }
})

const checkboxSchema = z.object({
  type: z.literal('checkbox'),
  question: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(2000)).min(2).max(20),
  correctAnswers: z.array(z.number().int().min(0)).min(1),
  topicTags: z.array(z.string().trim().min(1).max(200)).max(10),
}).superRefine((question, ctx) => {
  if (new Set(question.correctAnswers).size !== question.correctAnswers.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctAnswers'],
      message: 'Correct answers must not contain duplicates',
    })
  }
  if (question.correctAnswers.some((answer) => answer >= question.options.length)) {
    ctx.addIssue({
      code: 'custom',
      path: ['correctAnswers'],
      message: 'Correct answers must reference existing options',
    })
  }
})

const essaySchema = z.object({
  type: z.literal('essay'),
  question: z.string().trim().min(1).max(4000),
  expectedAnswer: z.string().trim().min(1).max(12000),
  topicTags: z.array(z.string().trim().min(1).max(200)).max(10),
})

export const QuestionSchema = z.discriminatedUnion('type', [
  mcqSchema,
  checkboxSchema,
  essaySchema,
])

export const ExamSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(50),
})

export const GradeSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  isCorrect: z.boolean(),
})

export type Question = z.infer<typeof QuestionSchema>
export type Exam = z.infer<typeof ExamSchema>
export type GradeResult = z.infer<typeof GradeSchema>
