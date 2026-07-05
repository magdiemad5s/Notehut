import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const putSchema = z.object({
  key: z.enum(['fallback_llm', 'fallback_embeddings']),
  value: z.object({
    llmProvider: z.enum(['custom', 'gemini', 'deepseek']).optional(),
    llmBaseURL: z.string().max(2048).optional().or(z.literal('')),
    llmApiKey: z.string().min(1).max(500),
    llmModelName: z.string().min(1).max(200),
    embeddingsBaseURL: z.string().max(2048).optional().or(z.literal('')),
    embeddingsModel: z.string().max(200).optional(),
  }),
})

/** Mask an API key for safe display (shows first 4 + last 4 chars). */
function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '•••••••' + key.slice(-4)
}

/** Mask sensitive fields in a secrets value object before sending to client. */
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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })

    const serviceClient = createServiceClient()
    const { data } = await serviceClient
      .from('app_secrets').select('key, value').in('key', ['fallback_llm', 'fallback_embeddings'])

    // Mask API keys before sending to client
    const maskedSecrets = (data || []).map((s) => ({
      key: s.key,
      value: maskSecretValue(s.value),
    }))

    return NextResponse.json({ secrets: maskedSecrets }, { status: 200 })
  } catch (error) {
    console.error('GET /api/admin/fallback-keys error:', error)
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
    const { data: updated } = await serviceClient
      .from('app_secrets').update({ value: body.value }).eq('key', body.key).select('key').maybeSingle()

    if (!updated) {
      return NextResponse.json({ error: 'Secret not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('PUT /api/admin/fallback-keys error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
