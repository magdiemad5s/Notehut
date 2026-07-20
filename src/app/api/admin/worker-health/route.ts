import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { safeServerFetch } from '@/lib/security/outbound-url'

const requestSchema = z.object({
  workerUrl: z.string().url().max(2048).optional(),
  workerApiKey: z.string().min(1).max(2048).optional(),
  useSavedConfiguration: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (!value.useSavedConfiguration && (!value.workerUrl || !value.workerApiKey)) {
    ctx.addIssue({ code: 'custom', message: 'Worker URL and API key are required' })
  }
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: z.infer<typeof requestSchema>
  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid worker configuration' },
        { status: 400 },
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    let workerUrl = body.workerUrl ?? ''
    let workerApiKey = body.workerApiKey ?? ''
    if (body.useSavedConfiguration) {
      const serviceClient = createServiceClient()
      const { data, error } = await serviceClient
        .from('app_settings')
        .select('key, value')
        .in('key', ['ocr_worker_url', 'ocr_worker_api_key'])
      if (error) throw new Error('Failed to load saved worker configuration')
      const settings = new Map((data ?? []).map((item) => [item.key, item.value]))
      workerUrl = typeof settings.get('ocr_worker_url') === 'string'
        ? settings.get('ocr_worker_url') as string
        : ''
      workerApiKey = typeof settings.get('ocr_worker_api_key') === 'string'
        ? settings.get('ocr_worker_api_key') as string
        : ''
    }
    if (!workerUrl || !workerApiKey) {
      return NextResponse.json({ error: 'Worker URL and API key are required' }, { status: 400 })
    }
    const response = await safeServerFetch(
      `${workerUrl.replace(/\/+$/, '')}/health`,
      {
        headers: { Authorization: `Bearer ${workerApiKey}` },
        signal: AbortSignal.timeout(5000),
      },
    )
    const health = await response.json().catch(() => null)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Worker returned status ${response.status}`, health },
        { status: 502 },
      )
    }
    return NextResponse.json({ success: true, health })
  } catch (error) {
    console.error('Worker health test failed:', error)
    return NextResponse.json({ error: 'Failed to reach worker' }, { status: 502 })
  }
}
