import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const serviceClient = createServiceClient()
    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id, email, is_admin, created_at')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('profiles list error:', profilesError)
      return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
    }

    const { data: docCounts } = await serviceClient
      .from('documents')
      .select('user_id')

    const countMap = new Map<string, number>()
    for (const doc of docCounts || []) {
      countMap.set(doc.user_id, (countMap.get(doc.user_id) || 0) + 1)
    }

    const users = (profiles || []).map((p) => ({
      ...p,
      document_count: countMap.get(p.id) || 0,
    }))

    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

const putSchema = z.object({
  userId: z.string().uuid(),
  isAdmin: z.boolean(),
})

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: z.infer<typeof putSchema>
    try {
      const raw = await req.json()
      const result = putSchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
      }
      body = result.data
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body.userId === user.id && !body.isAdmin) {
      return NextResponse.json({ error: 'You cannot demote yourself' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ is_admin: body.isAdmin })
      .eq('id', body.userId)

    if (updateError) {
      console.error('profiles admin update error:', updateError)
      return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('PUT /api/admin/users error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
