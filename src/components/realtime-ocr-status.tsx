'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { OcrStatus } from '@/lib/types'

interface RealtimeOcrStatusProps {
  queueId: string
  onCompleted: () => Promise<boolean>
}

type BadgeConfig = {
  icon: React.ReactNode
  label: string
  textColor: string
  bgColor: string
  borderColor: string
}

const STATUS_BADGE: Record<OcrStatus, BadgeConfig> = {
  pending: {
    icon: <Clock className="size-4" />,
    label: 'Queued for OCR',
    textColor: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-900',
  },
  processing: {
    icon: <Loader2 className="size-4 animate-spin" />,
    label: 'OCR in progress\u2026',
    textColor: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-900',
  },
  completed: {
    icon: <CheckCircle2 className="size-4" />,
    label: 'OCR complete \u2014 chunking & embedding\u2026',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-900',
  },
  embedded: {
    icon: <CheckCircle2 className="size-4" />,
    label: 'Ready for chat and exams',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-300 dark:border-emerald-800',
  },
  failed: {
    icon: <XCircle className="size-4" />,
    label: 'OCR failed',
    textColor: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-red-200 dark:border-red-900',
  },
}

/**
 * RealtimeOcrStatus — subscribes to an ocr_queue row via Supabase Realtime
 * and renders a color-coded pipeline status badge inside a Card.
 *
 * Calls `onCompleted` exactly once when the row status transitions to
 * `'completed'`, then continues displaying the badge for reference.
 */
export function RealtimeOcrStatus({ queueId, onCompleted }: RealtimeOcrStatusProps) {
  const [status, setStatus] = useState<OcrStatus>('pending')
  const completedCalledRef = useRef(false)
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted
  const [embeddingFailed, setEmbeddingFailed] = useState(false)
  const [embeddingInProgress, setEmbeddingInProgress] = useState(false)

  const triggerEmbeddings = useCallback(async () => {
    if (completedCalledRef.current) return
    completedCalledRef.current = true
    setEmbeddingFailed(false)
    setEmbeddingInProgress(true)
    try {
      const succeeded = await onCompletedRef.current()
      if (!succeeded) {
        completedCalledRef.current = false
        setEmbeddingFailed(true)
      }
    } catch (error) {
      console.error('Embedding callback failed:', error)
      completedCalledRef.current = false
      setEmbeddingFailed(true)
    } finally {
      setEmbeddingInProgress(false)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Fetch current row status on mount (.maybeSingle avoids PGRST116 throw
    // when the row is missing — e.g. admin deleted it or stale queueId).
    supabase
      .from('ocr_queue')
      .select('status')
      .eq('id', queueId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Initial OCR status fetch failed:', error)
          return
        }
        if (!data) {
          setStatus('failed')
          return
        }
        const currentStatus = data.status as OcrStatus
        setStatus(currentStatus)

        if (currentStatus === 'completed' && !completedCalledRef.current) {
          void triggerEmbeddings()
        }
      })

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`ocr_queue:${queueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ocr_queue',
          filter: `id=eq.${queueId}`,
        },
        (payload) => {
          // DELETE events have payload.new === null; guard to avoid crash.
          if (payload.eventType === 'DELETE') return
          const newStatus = (payload.new as { status: OcrStatus } | null)?.status
          if (!newStatus) return
          setStatus(newStatus)
          if (newStatus === 'completed' && !completedCalledRef.current) {
            void triggerEmbeddings()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queueId, triggerEmbeddings])

  const badge = STATUS_BADGE[status]
  const badgeLabel =
    status === 'completed' && embeddingFailed
      ? 'OCR complete — embedding needs attention'
      : badge.label

  return (
    <Card className="space-y-2 bg-muted/20 p-4">
      <p className="text-sm font-medium text-muted-foreground">OCR Pipeline Status</p>

      <div
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${badge.bgColor} ${badge.borderColor} ${badge.textColor}`}
      >
        {badge.icon}
        <span>{badgeLabel}</span>
      </div>

      {status === 'failed' && (
        <p className="text-xs text-red-500">
          Upload failed. Please try uploading the file again.
        </p>
      )}
      {status === 'completed' && embeddingFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="text-xs">Embedding failed. Your OCR text is safe and can be retried.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void triggerEmbeddings()}
            disabled={embeddingInProgress}
          >
            {embeddingInProgress && <Loader2 className="size-3.5 animate-spin" />}
            Retry embedding
          </Button>
        </div>
      )}
    </Card>
  )
}
