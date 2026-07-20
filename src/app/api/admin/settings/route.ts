import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const putSchema = z.object({
  key: z.enum([
    'accelerated_ocr_online',
    'ocr_worker_url',
    'ocr_worker_api_key',
    'exam_model',
    'chat_model',
    'grading_model',
    'tutor_model',
  ]),
  value: z.union([z.boolean(), z.string().max(2000)]),
})

const MASKED_VALUE = '••••••••'

function maskSetting(key: string, value: unknown): unknown {
  if (key !== 'ocr_worker_api_key' || typeof value !== 'string' || !value) {
    return value
  }
  return MASKED_VALUE
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })

    const serviceClient = createServiceClient()
    const { data } = await serviceClient.from('app_settings').select('key, value')
    const settings = (data ?? []).map((setting) => ({
      ...setting,
      value: maskSetting(setting.key, setting.value),
    }))
    return NextResponse.json({ settings }, { status: 200 })
  } catch (error) {
    console.error('GET /api/admin/settings error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })

    let body: z.infer<typeof putSchema>
    try {
      const raw = await req.json()
      const result = putSchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
      }
      body = result.data
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    if (
      body.key === 'ocr_worker_api_key' &&
      typeof body.value === 'string' &&
      body.value.includes('•')
    ) {
      return NextResponse.json({ success: true }, { status: 200 })
    }
    const { data: updated, error: updateError } = await serviceClient
      .from('app_settings').update({ value: body.value }).eq('key', body.key).select('key').maybeSingle()

    if (updateError) {
      console.error('app_settings update error:', updateError)
      return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'Setting not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
