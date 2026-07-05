import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Card } from '@/components/ui/card'
import { AdminQueueTable } from '@/components/admin-queue-table'
import { redirect } from 'next/navigation'

/** Mask an API key for safe display (shows first 4 + last 4 chars). */
function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '•••••••' + key.slice(-4)
}

/** Mask sensitive fields in a secrets value object before rendering. */
function maskSecretValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const obj = value as Record<string, unknown>
  const masked: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase().includes('key') && typeof v === 'string') {
      masked[k] = maskKey(v)
    } else {
      masked[k] = v
    }
  }
  return masked
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) redirect('/')

  const svc = createServiceClient()
  const { data: queue } = await svc.from('ocr_queue').select('id, document_id, status, created_at, updated_at').order('created_at', { ascending: false })
  const { data: settings } = await svc.from('app_settings').select('key, value')
  const { data: secrets } = await svc.from('app_secrets').select('key, value').in('key', ['fallback_llm', 'fallback_embeddings'])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">OCR Queue</h2>
        <AdminQueueTable items={queue || []} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">App Settings</h2>
        <Card className="p-4 space-y-1">
          {settings?.map((s) => (
            <div key={s.key} className="flex justify-between text-sm">
              <span>{s.key}</span>
              <span className={s.value ? 'text-green-600' : 'text-gray-500'}>
                {s.value ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </Card>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Fallback Keys (masked)</h2>
        <Card className="p-4 space-y-2">
          {secrets?.map((s) => (
            <div key={s.key}>
              <p className="text-sm font-medium">{s.key}</p>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                {JSON.stringify(maskSecretValue(s.value), null, 2)}
              </pre>
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
