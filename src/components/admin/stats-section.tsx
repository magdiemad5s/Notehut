import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent } from '@/components/ui/card'
import { Users, BookOpen, FileText, Clock, Server, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

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
/*  StatsSection — server component                                           */
/* -------------------------------------------------------------------------- */

export async function StatsSection() {
  const svc = createServiceClient()

  const [usersRes, docsRes, topicsRes, queueRes, settingsRes] =
    await Promise.all([
      svc.from('profiles').select('*', { count: 'exact', head: true }),
      svc.from('documents').select('*', { count: 'exact', head: true }),
      svc.from('topics').select('*', { count: 'exact', head: true }),
      svc.from('ocr_queue').select('status'),
      svc
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'worker_online',
          'accelerated_ocr_online',
          'ocr_worker_url',
        ]),
    ])

  /* ------ Counts ------ */

  const totalUsers = usersRes.count ?? 0
  const totalDocuments = docsRes.count ?? 0
  const totalTopics = topicsRes.count ?? 0

  /* ------ Queue breakdown ------ */

  const queueItems = queueRes.data ?? []
  const pending = queueItems.filter((q) => q.status === 'pending').length
  const processing = queueItems.filter((q) => q.status === 'processing').length
  const failed = queueItems.filter((q) => q.status === 'failed').length

  /* ------ Worker settings ------ */

  const settings = settingsRes.data ?? []
  const getSetting = (key: string) =>
    settings.find((s) => s.key === key)?.value

  const workerOnline = getSetting('worker_online') === 'true'
  const acceleratedOcrOnline =
    getSetting('accelerated_ocr_online') === 'true'
  const workerUrl = getSetting('ocr_worker_url') ?? ''

  /* ------ Render ------ */

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Users className="size-5" />}
        label="Total Users"
        value={totalUsers}
      />
      <StatCard
        icon={<BookOpen className="size-5" />}
        label="Total Topics"
        value={totalTopics}
      />
      <StatCard
        icon={<FileText className="size-5" />}
        label="Total Documents"
        value={totalDocuments}
      />
      <StatCard
        icon={<Clock className="size-5" />}
        label="Queue Pending"
        value={pending}
        subText={`${processing} processing, ${failed} failed`}
      />
      <StatCard
        icon={<Server className="size-5" />}
        label="Worker Status"
        value={<StatusIndicator online={workerOnline} />}
        subText={workerUrl || undefined}
      />
      <StatCard
        icon={<Zap className="size-5" />}
        label="Accelerated OCR"
        value={
          <StatusIndicator
            online={acceleratedOcrOnline}
            onlineLabel="Enabled"
            offlineLabel="Disabled"
          />
        }
      />
    </div>
  )
}
