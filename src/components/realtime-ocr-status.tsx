'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import type { OcrStatus } from '@/lib/types'

interface RealtimeOcrStatusProps {
  queueId: string
  onCompleted: () => void  // called once when status becomes 'completed'
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
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  processing: {
    icon: <Loader2 className="size-4 animate-spin" />,
    label: 'OCR in progress\u2026',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  completed: {
    icon: <CheckCircle2 className="size-4" />,
    label: 'OCR complete \u2014 chunking & embedding\u2026',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  failed: {
    icon: <XCircle className="size-4" />,
    label: 'OCR failed',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
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
          completedCalledRef.current = true
          onCompleted()
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
            completedCalledRef.current = true
            onCompleted()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queueId, onCompleted])

  const badge = STATUS_BADGE[status]

  return (
    <Card className="p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">OCR Pipeline Status</p>

      <div
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${badge.bgColor} ${badge.borderColor} ${badge.textColor}`}
      >
        {badge.icon}
        <span>{badge.label}</span>
      </div>

      {status === 'failed' && (
        <p className="text-xs text-red-500">
          Upload failed. Please try uploading the file again.
        </p>
      )}
    </Card>
  )
}
