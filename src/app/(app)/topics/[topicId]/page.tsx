'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { UploadPdf } from '@/components/upload-pdf'
import { Chat } from '@/components/chat'
import { ExamConfigDialog } from '@/components/exam-config-dialog'
import ExamRunner from '@/components/exam-runner'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
import type { Exam } from '@/lib/ai/schemas'

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
  params: { topicId: string }
}) {
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
        .eq('id', params.topicId)
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
        .eq('topic_id', params.topicId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setDocuments(docsData ?? [])
      setIsLoading(false)
    }

    load()
  }, [params.topicId, router])

  /* ── Loading state ─────────────────────── */
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <h1 className="text-2xl font-heading font-bold">{topic.name}</h1>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: PDF uploader + document list */}
        <div className="space-y-6">
          <UploadPdf topicId={topic.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents uploaded yet.
                </p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 text-sm">
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
        <Chat topicId={topic.id} />
      </div>

      {/* Bottom: Exam configuration and runner */}
      <TopicExamSection topicId={topic.id} />
    </div>
  )
}

/* ───────────────────────────────────────────────
 * Client component for exam config + runner
 * Managed locally so ExamConfigDialog's
 * onExamGenerated callback works within the
 * client boundary.
 * ─────────────────────────────────────────────── */
function TopicExamSection({ topicId }: { topicId: string }) {
  const [exam, setExam] = useState<Exam | null>(null)

  return (
    <div className="space-y-4">
      <ExamConfigDialog topicId={topicId} onExamGenerated={setExam} />
      {exam && (
        <ExamRunner
          exam={exam}
          onSubmit={() => {
            /* Grading wiring — Phase 8 */
          }}
        />
      )}
    </div>
  )
}
