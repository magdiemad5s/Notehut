'use client'

import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Exam, Question } from '@/lib/ai/schemas'

interface ExamRunnerProps {
  exam: Exam
  onSubmit: (answers: Record<number, string>) => void
  submitting?: boolean
}

/** Parse a stored checkbox answer string back into an array of indices. */
function parseCheckboxAnswer(value: string | undefined): number[] {
  if (!value || value === '') return []
  return value.split(',').map(Number)
}

/** Toggle an option index within a comma-separated checkbox answer string. */
const toggleCheckbox = (
  qIndex: number,
  optionIndex: number,
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>,
) => {
  setAnswers((prev) => {
    const current = parseCheckboxAnswer(prev[qIndex])
    const next = current.includes(optionIndex)
      ? current.filter((i) => i !== optionIndex)
      : [...current, optionIndex]
    return { ...prev, [qIndex]: next.join(',') }
  })
}

/** Render a single question's input area based on its type. */
function QuestionInput({
  question,
  index,
  answers,
  setAnswers,
}: {
  question: Question
  index: number
  answers: Record<number, string>
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>
}) {
  if (question.type === 'mcq') {
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">Question {index + 1} answer choices</legend>
        {question.options.map((option, optIndex) => (
          <label
            key={optIndex}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-5 transition-colors hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              name={`q-${index}`}
              checked={answers[index] === String(optIndex)}
              onChange={() =>
                setAnswers((prev) => ({ ...prev, [index]: String(optIndex) }))
              }
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            {option}
          </label>
        ))}
      </fieldset>
    )
  }

  if (question.type === 'checkbox') {
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">Question {index + 1} answer choices</legend>
        {question.options.map((option, optIndex) => {
          const selected = parseCheckboxAnswer(answers[index])
          return (
            <label
              key={optIndex}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-5 transition-colors hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="checkbox"
                checked={selected.includes(optIndex)}
                onChange={() => toggleCheckbox(index, optIndex, setAnswers)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              {option}
            </label>
          )
        })}
      </fieldset>
    )
  }

  // essay
  return (
    <textarea
      value={answers[index] ?? ''}
      onChange={(e) =>
        setAnswers((prev) => ({ ...prev, [index]: e.target.value }))
      }
      placeholder="Type your answer here…"
      className="min-h-32 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  )
}

/** Check if a question has a meaningful (non-empty) answer. */
function isAnswered(question: Question, answer: string | undefined): boolean {
  if (answer === undefined) return false
  if (question.type === 'essay') return answer.trim().length > 0
  if (question.type === 'checkbox') return parseCheckboxAnswer(answer).length > 0
  // mcq
  return answer !== ''
}

export default function ExamRunner({ exam, onSubmit, submitting = false }: ExamRunnerProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const totalQuestions = exam.questions.length
  const answeredCount = exam.questions.filter((q, i) => isAnswered(q, answers[i])).length
  const allAnswered = answeredCount >= totalQuestions

  const handleSubmit = useCallback(() => {
    onSubmit(answers)
  }, [answers, onSubmit])

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-xs">
        <h2 className="text-lg font-semibold">Exam</h2>
        <p className="text-sm text-muted-foreground">
          Answered {answeredCount} of {totalQuestions}
        </p>
      </div>

      {/* Question cards */}
      {exam.questions.map((question, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle>
              <span className="mr-2 text-muted-foreground">Q{index + 1}.</span>
              {question.question}
            </CardTitle>
            {question.topicTags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {question.topicTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <QuestionInput
              question={question}
              index={index}
              answers={answers}
              setAnswers={setAnswers}
            />
          </CardContent>
        </Card>
      ))}

      {/* Submit */}
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{answeredCount}</span> of {totalQuestions} answered
        </span>
        <Button onClick={handleSubmit} disabled={!allAnswered || submitting}>
          {submitting ? 'Grading…' : 'Submit Exam'}
        </Button>
      </div>
    </div>
  )
}
