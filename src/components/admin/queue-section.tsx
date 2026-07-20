'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, RotateCcw, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { byokToHeaders, useByokConfig } from '@/lib/store/byok-store'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type QueueItem = {
  id: string
  document_id: string
  document_filename: string
  user_email: string
  status: string
  created_at: string
  updated_at: string
  user_id: string
  error?: string | null
}

type QueueResponse = {
  items: QueueItem[]
}

/* -------------------------------------------------------------------------- */
/*  Status badge helpers                                                      */
/* -------------------------------------------------------------------------- */

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  completed:  { label: 'Completed',  className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  embedded:   { label: 'Embedded',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  failed:     { label: 'Failed',     className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Date formatting                                                           */
/* -------------------------------------------------------------------------- */

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/* -------------------------------------------------------------------------- */
/*  AdminQueueSection                                                         */
/* -------------------------------------------------------------------------- */

export function AdminQueueSection() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const byok = useByokConfig()

  /* ------ Fetch queue ------ */

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/queue')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to fetch queue (${res.status})`)
      }
      const data: QueueResponse = await res.json()
      setItems(data.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  /* ------ Single-item actions ------ */

  const handleAction = useCallback(
    async (action: 'process' | 'retry' | 'delete', queueId: string) => {
      setActionLoading(queueId)
      try {
        const endpoint = action === 'process' ? '/api/embeddings' : '/api/admin/queue'
        const requestBody = action === 'process'
          ? { queueId }
          : { action, queueId }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...byokToHeaders(byok) },
          body: JSON.stringify(requestBody),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Action failed (${res.status})`)
        }

        const actionLabels: Record<string, string> = {
          process: 'Item processing started',
          retry: 'Item queued for retry',
          delete: 'Item deleted',
        }
        toast.success(actionLabels[action])
        await fetchQueue()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Action failed')
      } finally {
        setActionLoading(null)
      }
    },
    [fetchQueue, byok],
  )

  /* ------ Embed all completed OCR items ------ */

  const handleProcessAll = useCallback(async () => {
    const completedItems = items.filter((item) => item.status === 'completed')
    if (completedItems.length === 0) {
      toast.error('No completed OCR items to embed')
      return
    }

    let processed = 0
    let failed = 0

    for (const item of completedItems) {
      setActionLoading(item.id)
      try {
        const res = await fetch('/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...byokToHeaders(byok) },
          body: JSON.stringify({ queueId: item.id }),
        })
        if (res.ok) {
          processed++
        } else {
          const data = await res.json().catch(() => ({}))
          toast.error(
            `Failed to embed "${item.document_filename}": ${data.error || res.statusText}`,
          )
          failed++
        }
      } catch (error) {
        toast.error(
          `Error embedding "${item.document_filename}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        failed++
      }
    }

    setActionLoading(null)

    if (processed > 0) {
      toast.success(`Embedded ${processed} item${processed !== 1 ? 's' : ''}`)
    }
    if (failed > 0) {
      toast.error(`${failed} item${failed !== 1 ? 's' : ''} failed`)
    }

    await fetchQueue()
  }, [items, fetchQueue, byok])

  /* ------ Derived counts ------ */

  const pendingCount = items.filter((i) => i.status === 'pending').length
  const processingCount = items.filter((i) => i.status === 'processing').length
  const completedCount = items.filter((i) => i.status === 'completed').length
  const embeddedCount = items.filter((i) => i.status === 'embedded').length
  const failedCount = items.filter((i) => i.status === 'failed').length

  /* ------ Render ------ */

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR Queue</CardTitle>
        <p className="text-sm text-muted-foreground">
          {pendingCount} pending &middot; {processingCount} processing &middot;{' '}
          {completedCount} OCR complete &middot; {embeddedCount} embedded &middot; {failedCount} failed
        </p>
      </CardHeader>

      <CardContent>
        {/* Toolbar */}
        <div className="mb-4 flex items-center gap-2">
          <Button
            onClick={handleProcessAll}
            disabled={completedCount === 0 || actionLoading !== null}
            size="sm"
          >
            {actionLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Embed All Completed
          </Button>

          <Button
            onClick={fetchQueue}
            disabled={loading || actionLoading !== null}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading queue&hellip;
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="py-8 text-center text-muted-foreground">
            No items in queue
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td
                      className="max-w-[200px] truncate px-4 py-3"
                      title={item.document_filename}
                    >
                      {item.document_filename}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-4 py-3"
                      title={item.user_email}
                    >
                      {item.user_email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        title={
                          item.status === 'failed' && item.error
                            ? item.error
                            : undefined
                        }
                      >
                        <StatusBadge status={item.status} />
                      </span>
                      {item.status === 'failed' && item.error && (
                        <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                          {item.error}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(item.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {item.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAction('process', item.id)}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Play className="size-3.5" />
                            )}
                            Embed
                          </Button>
                        )}

                        {item.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction('retry', item.id)}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3.5" />
                            )}
                            Retry
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction('delete', item.id)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
