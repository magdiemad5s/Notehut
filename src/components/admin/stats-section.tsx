'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, BookOpen, FileText, Clock, Server, Zap, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type StatsData = {
  totalUsers: number
  totalDocuments: number
  totalTopics: number
  pending: number
  processing: number
  failed: number
  workerOnline: boolean
  acceleratedOcrOnline: boolean
  workerUrl: string
}

type StatCardProps = {
  icon: ReactNode
  label: string
  value: ReactNode
  subText?: string
}

/* -------------------------------------------------------------------------- */
/*  StatCard — single metric card                                             */
/* -------------------------------------------------------------------------- */

function StatCard({ icon, label, value, subText }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold leading-tight">{value}</p>
          {subText && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {subText}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  StatusIndicator — green dot + On/Off label                                */
/* -------------------------------------------------------------------------- */

function StatusIndicator({
  online,
  onlineLabel = 'Online',
  offlineLabel = 'Offline',
}: {
  online: boolean
  onlineLabel?: string
  offlineLabel?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        online ? 'text-green-600' : 'text-gray-500'
      }`}
    >
      <span
        className={`size-2 rounded-full ${
          online ? 'bg-green-500' : 'bg-gray-400'
        }`}
      />
      {online ? onlineLabel : offlineLabel}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  StatsSection — client component                                           */
/* -------------------------------------------------------------------------- */

export function StatsSection() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) {
          throw new Error(`Failed to load stats (${res.status})`)
        }
        const stats: StatsData = await res.json()
        setData(stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load stats: {error || 'No data'}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Users className="size-5" />}
        label="Total Users"
        value={data.totalUsers}
      />
      <StatCard
        icon={<BookOpen className="size-5" />}
        label="Total Topics"
        value={data.totalTopics}
      />
      <StatCard
        icon={<FileText className="size-5" />}
        label="Total Documents"
        value={data.totalDocuments}
      />
      <StatCard
        icon={<Clock className="size-5" />}
        label="Queue Pending"
        value={data.pending}
        subText={`${data.processing} processing, ${data.failed} failed`}
      />
      <StatCard
        icon={<Server className="size-5" />}
        label="Worker Status"
        value={<StatusIndicator online={data.workerOnline} />}
        subText={data.workerUrl || undefined}
      />
      <StatCard
        icon={<Zap className="size-5" />}
        label="Unlimited-OCR"
        value={
          <StatusIndicator
            online={data.acceleratedOcrOnline}
            onlineLabel="Enabled"
            offlineLabel="Disabled"
          />
        }
      />
    </div>
  )
}
