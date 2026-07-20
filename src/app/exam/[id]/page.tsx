'use client'

import { useEffect, useState, use } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ExamRunner from '@/components/exam-runner'
import ExamResults from '@/components/exam-results'
import type { Exam, GradeResult } from '@/lib/ai/schemas'
import { parseStoredExam } from '@/lib/exam/stored-exam'

export default function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [exam, setExam] = useState<Exam | null>(null)
  const [title, setTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Submission state
  const [results, setResults] = useState<GradeResult[] | null>(null)
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<number, string> | null>(null)
  const [isGrading, setIsGrading] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      try {
        const { data: sharedExam, error: fetchError } = await supabase
          .from('shared_exams')
          .select('id, title, questions_json')
          .eq('id', id)
          .eq('is_public', true)
          .maybeSingle()

        if (fetchError) {
          console.error('shared_exams fetch error:', fetchError)
          setError('Failed to load exam. Please try again later.')
          setIsLoading(false)
          return
        }

        if (!sharedExam) {
          setNotFound(true)
          setIsLoading(false)
          return
        }

        setTitle(sharedExam.title)

        const parsedExam = parseStoredExam(sharedExam.questions_json)
        if (!parsedExam) {
          setError('This exam has malformed questions and cannot be loaded.')
          setIsLoading(false)
          return
        }
        setExam(parsedExam)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exam')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [id])

  const handleSubmit = async (answers: Record<number, string>) => {
    setIsGrading(true)
    setGradeError(null)

    try {
      const res = await fetch('/api/exam/public-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedExamId: id,
          answers,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Grading failed (${res.status})`)
      }

      const data = await res.json()
      setResults(data.results as GradeResult[])
      setSubmittedAnswers(answers)
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : 'Grading failed')
    } finally {
      setIsGrading(false)
    }
  }

  const handleRetry = () => {
    setResults(null)
    setSubmittedAnswers(null)
    setGradeError(null)
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // --- Not found state ---
  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-heading font-bold">Exam Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This exam does not exist or is no longer publicly available.
          </p>
        </Card>
      </div>
    )
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h1 className="text-xl font-heading font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    )
  }

  // --- Results view (after submission) ---
  if (results && exam) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <h1 className="text-2xl font-heading font-bold">{title}</h1>
        <Card className="border-2 border-muted bg-muted/30 p-4">
          <p className="text-center text-sm text-muted-foreground">
            Guest Mode — these results are for reference only and are not saved.
          </p>
        </Card>
        <ExamResults
          exam={exam}
          results={results}
          answers={submittedAnswers ?? {}}
        />
        <div className="flex justify-center">
          <button
            onClick={handleRetry}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Take the exam again
          </button>
        </div>
      </div>
    )
  }

  // --- Exam view ---
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <h1 className="text-2xl font-heading font-bold">{title}</h1>

      <Card className="border-2 border-muted bg-muted/30 p-4">
        <p className="text-center text-sm text-muted-foreground">
          Guest Mode — your answers will be graded but not saved.
        </p>
      </Card>

      {gradeError && (
        <Card className="border-destructive p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{gradeError}</p>
          </div>
        </Card>
      )}

      {exam && (
        <ExamRunner
          exam={exam}
          onSubmit={handleSubmit}
          submitting={isGrading}
        />
      )}

      {isGrading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Grading your answers…</span>
        </div>
      )}
    </div>
  )
}
