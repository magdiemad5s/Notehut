import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/admin/queue
 *
 * Returns all OCR queue items (admin only).
 * Uses the service-role client to bypass RLS so admins can see
 * every user's queue items in a single view.
 *
 * Auth: admin role required.
 * Response: { items: QueueItem[] }
 */

export async function GET() {
  try {
    // --- Auth gate ---------------------------------------------------------
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    // --- Admin check -------------------------------------------------------
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json(
        { error: 'Forbidden — admin access required' },
        { status: 403 },
      )
    }

    // --- Fetch queue items (bypass RLS via service client) -----------------
    const serviceClient = createServiceClient()
    const { data } = await serviceClient
      .from('ocr_queue')
      .select('id, document_id, status, created_at, updated_at')
      .order('created_at', { ascending: false })

    return NextResponse.json(
      { items: data ?? [] },
      { status: 200 },
    )
  } catch (error) {
    console.error('Admin queue route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
