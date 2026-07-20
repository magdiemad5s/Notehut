import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { safeServerFetch } from '@/lib/security/outbound-url'

/**
 * GET /api/admin/stats
 * Returns dashboard stats (admin only).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
          .in('key', ['accelerated_ocr_online', 'ocr_worker_url', 'ocr_worker_api_key']),
      ])

    if (settingsRes.error) {
      throw new Error('Failed to load worker settings')
    }

    const totalUsers = usersRes.count ?? 0
    const totalDocuments = docsRes.count ?? 0
    const totalTopics = topicsRes.count ?? 0

    const queueItems = queueRes.data ?? []
    const pending = queueItems.filter((q) => q.status === 'pending').length
    const processing = queueItems.filter((q) => q.status === 'processing').length
    const failed = queueItems.filter((q) => q.status === 'failed').length

    const settings = settingsRes.data ?? []
    const getSetting = (key: string) => settings.find((s) => s.key === key)?.value

    const acceleratedOcrOnline =
      getSetting('accelerated_ocr_online') === 'true' || getSetting('accelerated_ocr_online') === true
    const workerUrl =
      typeof getSetting('ocr_worker_url') === 'string'
        ? (getSetting('ocr_worker_url') as string)
        : ''
    const workerApiKey =
      typeof getSetting('ocr_worker_api_key') === 'string'
        ? (getSetting('ocr_worker_api_key') as string)
        : ''
    let workerOnline = false
    if (workerUrl && workerApiKey) {
      try {
        const response = await safeServerFetch(
          `${workerUrl.replace(/\/+$/, '')}/health`,
          {
            headers: { Authorization: `Bearer ${workerApiKey}` },
            signal: AbortSignal.timeout(3000),
          },
        )
        workerOnline = response.ok
      } catch {
        workerOnline = false
      }
    }

    return NextResponse.json({
      totalUsers,
      totalDocuments,
      totalTopics,
      pending,
      processing,
      failed,
      workerOnline,
      acceleratedOcrOnline,
      workerUrl,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
