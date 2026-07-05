'use client'

import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Exam, Question } from '@/lib/ai/schemas'

interface ExamRunnerProps {
  exam: Exam
  onSubmit: (answers: Record<number, string>) => void
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
        {question.options.map((option, optIndex) => (
          <label
            key={optIndex}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
          >
            <input
              type="radio"
              name={`q-${index}`}
              checked={answers[index] === String(optIndex)}
              onChange={() =>
                setAnswers((prev) => ({ ...prev, [index]: String(optIndex) }))
              }
              className="accent-primary"
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
        {question.options.map((option, optIndex) => {
          const selected = parseCheckboxAnswer(answers[index])
          return (
            <label
              key={optIndex}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
            >
              <input
                type="checkbox"
                checked={selected.includes(optIndex)}
                onChange={() => toggleCheckbox(index, optIndex, setAnswers)}
                className="accent-primary"
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
      className="w-full rounded-md border border-input px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
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

export default function ExamRunner({ exam, onSubmit }: ExamRunnerProps) {
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
      <div className="flex items-center justify-between">
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
      <div className="flex items-center justify-end gap-4 pt-2">
        <span className="text-sm text-muted-foreground">
          Answered {answeredCount} of {totalQuestions}
        </span>
        <Button onClick={handleSubmit} disabled={!allAnswered}>
          Submit Exam
        </Button>
      </div>
    </div>
  )
}
