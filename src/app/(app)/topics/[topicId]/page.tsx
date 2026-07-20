'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { UploadPdf } from '@/components/upload-pdf'
import { Chat } from '@/components/chat'
import { ExamConfigDialog } from '@/components/exam-config-dialog'
import ExamRunner from '@/components/exam-runner'
import ExamResults from '@/components/exam-results'
import { TutorPanel } from '@/components/tutor-panel'
import { ArrowLeft, FileText, Loader2, Share2 } from 'lucide-react'
import type { Exam, GradeResult } from '@/lib/ai/schemas'
import { byokToHeaders, useByokConfig } from '@/lib/store/byok-store'
import { toast } from 'sonner'

interface TopicData {
  id: string
  name: string
}

interface DocumentData {
  id: string
  filename: string
  created_at: string
}

export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ topicId: string }>
}) {
  const { topicId } = use(params)
  const router = useRouter()
  const [topic, setTopic] = useState<TopicData | null>(null)
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: topicData } = await supabase
        .from('topics')
        .select('id, name')
        .eq('id', topicId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!topicData) {
        setNotFound(true)
        setIsLoading(false)
        return
      }

      setTopic(topicData)

      const { data: docsData } = await supabase
        .from('documents')
        .select('id, filename, created_at')
        .eq('topic_id', topicId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setDocuments(docsData ?? [])
      setIsLoading(false)
    }

    load()
  }, [topicId, router])

  /* ── Loading state ─────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading topic">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-[36rem]" />
        </div>
      </div>
    )
  }

  /* ── Not found state ───────────────────── */
  if (notFound || !topic) {
    return (
      <div className="space-y-6">
        <Link
          href="/topics"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Topics
        </Link>
        <Card className="p-8 text-center text-muted-foreground">
          Topic not found
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/topics"
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Topics
      </Link>

      {/* Topic title */}
      <div className="space-y-1">
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">{topic.name}</h1>
        <p className="text-sm text-muted-foreground">{documents.length} document{documents.length === 1 ? '' : 's'} in this topic</p>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: PDF uploader + document list */}
        <div className="space-y-6">
          <UploadPdf topicId={topic.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents uploaded yet.
                </p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="flex min-h-12 items-center gap-3 py-3 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{doc.filename}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Chat interface */}
        <div className="space-y-6">
          <Chat topicId={topic.id} />
          <TutorPanel topicId={topic.id} topicName={topic.name} />
        </div>
      </div>

      {/* Bottom: Exam configuration and runner */}
      <TopicExamSection topicId={topic.id} topicName={topic.name} />
    </div>
  )
}

/* ───────────────────────────────────────────────
 * Client component for exam config + runner
 * Managed locally so ExamConfigDialog's
 * onExamGenerated callback works within the
 * client boundary.
 * ─────────────────────────────────────────────── */
function TopicExamSection({
  topicId,
  topicName,
}: {
  topicId: string
  topicName: string
}) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [results, setResults] = useState<GradeResult[] | null>(null)
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<number, string>>({})
  const [isGrading, setIsGrading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const byok = useByokConfig()

  const handleGenerated = (nextExam: Exam) => {
    setExam(nextExam)
    setResults(null)
    setSubmittedAnswers({})
    setShareUrl(null)
  }

  const handleSubmit = async (answers: Record<number, string>) => {
    if (!exam || isGrading) return
    setIsGrading(true)
    try {
      const response = await fetch('/api/ai/grade-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...byokToHeaders(byok),
        },
        body: JSON.stringify({ exam, answers }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Grading failed (${response.status})`)
      }
      const data = (await response.json()) as { results: GradeResult[] }
      setSubmittedAnswers(answers)
      setResults(data.results)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Grading failed')
    } finally {
      setIsGrading(false)
    }
  }

  const handleShare = async () => {
    if (!exam || isSharing) return
    setIsSharing(true)
    try {
      const response = await fetch('/api/exam/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          title: `${topicName} Exam`,
          questions: exam.questions,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Sharing failed (${response.status})`)
      }
      const { id } = (await response.json()) as { id: string }
      const url = `${window.location.origin}/exam/${id}`
      setShareUrl(url)
      await navigator.clipboard?.writeText(url).catch(() => undefined)
      toast.success('Public exam link copied')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sharing failed')
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ExamConfigDialog topicId={topicId} onExamGenerated={handleGenerated} />
        {exam && (
          <Button variant="outline" onClick={handleShare} disabled={isSharing}>
            {isSharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            {isSharing ? 'Sharing…' : 'Share Exam'}
          </Button>
        )}
      </div>
      {shareUrl && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center">
          <span className="font-medium">Public link</span>
          <a className="min-w-0 flex-1 truncate text-muted-foreground underline underline-offset-4" href={shareUrl}>{shareUrl}</a>
        </div>
      )}
      {exam && results ? (
        <div className="space-y-4">
          <ExamResults exam={exam} results={results} answers={submittedAnswers} />
          <Button
            variant="outline"
            onClick={() => {
              setResults(null)
              setSubmittedAnswers({})
            }}
          >
            Take Again
          </Button>
        </div>
      ) : exam ? (
        <ExamRunner
          exam={exam}
          onSubmit={handleSubmit}
          submitting={isGrading}
        />
      ) : null}
    </div>
  )
}
