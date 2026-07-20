'use client'

import { CheckCircle2, XCircle, Award } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { Exam, GradeResult } from '@/lib/ai/schemas'

interface ExamResultsProps {
  exam: Exam
  results: GradeResult[]
  answers: Record<number, string>
}

/** Parse a stored checkbox answer string into indices, handling empty/unanswered. */
function parseCheckboxAnswer(value: string | undefined): number[] {
  if (!value || value === '') return []
  return value.split(',').map(Number)
}

/** Look up the option text for an MCQ index string, or return the raw value. */
function formatMcqAnswer(value: string | undefined, options: string[]): string {
  if (value === undefined || value === '') return '(No answer)'
  const idx = Number(value)
  if (Number.isNaN(idx) || idx < 0 || idx >= options.length) return value
  return options[idx]
}

/** Format checkbox answer indices into a readable list of option texts. */
function formatCheckboxAnswer(
  value: string | undefined,
  options: string[],
): string[] {
  const indices = parseCheckboxAnswer(value)
  if (indices.length === 0) return ['(No answer)']
  return indices.map((i) =>
    i >= 0 && i < options.length ? options[i] : `Option ${i}`,
  )
}

/** Determine the colour class for the overall score. */
function scoreColorClass(percentage: number): string {
  if (percentage >= 70) return 'text-emerald-700 dark:text-emerald-400'
  if (percentage >= 50) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}

/** Determine the background class for the overall score card. */
function scoreBgClass(percentage: number): string {
  if (percentage >= 70) return 'bg-emerald-50 border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/40'
  if (percentage >= 50) return 'bg-amber-50 border-amber-200 dark:border-amber-900 dark:bg-amber-950/40'
  return 'bg-red-50 border-red-200 dark:border-red-900 dark:bg-red-950/40'
}

export default function ExamResults({
  exam,
  results,
  answers,
}: ExamResultsProps) {
  const totalQuestions = exam.questions.length
  const percentage =
    totalQuestions > 0
      ? Math.round(
          results.reduce((sum, result) => sum + result.score, 0) /
            totalQuestions,
        )
      : 0

  return (
    <div className="space-y-6">
      {/* Score summary card */}
      <Card className={`border-2 ${scoreBgClass(percentage)}`}>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8">
          <Award className={`h-12 w-12 ${scoreColorClass(percentage)}`} />
          <span
            className={`text-5xl font-bold ${scoreColorClass(percentage)}`}
          >
            {percentage}%
          </span>
          <p className="text-sm text-muted-foreground">
            Average score across {totalQuestions} question{totalQuestions === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>

      {/* Per-question results */}
      {exam.questions.map((question, index) => {
        const result = results[index]
        if (!result) return null

        return (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base">
                  <span className="mr-2 text-muted-foreground">
                    Q{index + 1}.
                  </span>
                  {question.question}
                </CardTitle>
                {/* Correct / Incorrect icon */}
                {result.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Student's answer */}
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Your answer:
                </span>
                <div className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">
                  {question.type === 'mcq' && (
                    <p>{formatMcqAnswer(answers[index], question.options)}</p>
                  )}
                  {question.type === 'checkbox' && (
                    <ul className="list-inside list-disc space-y-0.5">
                      {formatCheckboxAnswer(answers[index], question.options).map(
                        (text, i) => (
                          <li key={i}>{text}</li>
                        ),
                      )}
                    </ul>
                  )}
                  {question.type === 'essay' && (
                    <p className="whitespace-pre-wrap">
                      {answers[index] || '(No answer)'}
                    </p>
                  )}
                </div>
              </div>

              {/* Correct answer(s) for MCQ / checkbox */}
              {question.type === 'mcq' && !result.isCorrect && (
                <div>
                  <span className="text-xs font-medium text-green-600">
                    Correct answer:
                  </span>
                  <p className="mt-1 text-sm">
                    {question.options[question.correctAnswer]}
                  </p>
                </div>
              )}
              {question.type === 'checkbox' && !result.isCorrect && (
                <div>
                  <span className="text-xs font-medium text-green-600">
                    Correct answers:
                  </span>
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {question.correctAnswers.map((i) => (
                      <li key={i}>{question.options[i]}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feedback */}
              {question.type === 'essay' && result.feedback && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Feedback:
                  </span>
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
                    {result.feedback}
                  </p>
                </div>
              )}
              {question.type !== 'essay' && (
                <p
                  className={`text-sm font-medium ${
                    result.isCorrect ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {result.isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
