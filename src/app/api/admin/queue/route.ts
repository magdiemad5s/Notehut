import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

/**
 * GET /api/admin/queue
 * Returns all OCR queue items with document filename and user email (admin only).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const serviceClient = createServiceClient()
    const { data: queue } = await serviceClient
      .from('ocr_queue')
      .select('id, document_id, status, created_at, updated_at, user_id, error')
      .order('created_at', { ascending: false })

    const documentIds = (queue || []).map((q) => q.document_id).filter(Boolean)
    const userIds = (queue || []).map((q) => q.user_id).filter(Boolean)

    const [docsResult, profilesResult] = await Promise.all([
      documentIds.length
        ? serviceClient.from('documents').select('id, filename').in('id', documentIds)
        : { data: [] },
      userIds.length
        ? serviceClient.from('profiles').select('id, email').in('id', userIds)
        : { data: [] },
    ])

    const docMap = new Map((docsResult.data || []).map((d: { id: string; filename: string }) => [d.id, d.filename]))
    const profileMap = new Map((profilesResult.data || []).map((p: { id: string; email: string }) => [p.id, p.email]))

    const items = (queue || []).map((q) => ({
      ...q,
      document_filename: docMap.get(q.document_id) || 'Unknown',
      user_email: profileMap.get(q.user_id) || 'Unknown',
    }))

    return NextResponse.json({ items }, { status: 200 })
  } catch (error) {
    console.error('GET /api/admin/queue error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

const postSchema = z.object({
  action: z.enum(['process', 'retry', 'delete']),
  queueId: z.string().uuid(),
})

/**
 * POST /api/admin/queue
 * Actions:
 *   - process: triggers the embeddings pipeline for a pending queue item
 *   - retry: resets a failed item to pending
 *   - delete: removes the queue item and associated document
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: z.infer<typeof postSchema>
    try {
      const raw = await req.json()
      const result = postSchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
      }
      body = result.data
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    if (body.action === 'delete') {
      const { data: queueItem } = await serviceClient
        .from('ocr_queue').select('document_id').eq('id', body.queueId).maybeSingle()

      const { error: deleteError } = await serviceClient
        .from('ocr_queue').delete().eq('id', body.queueId)

      if (deleteError) {
        return NextResponse.json({ error: `Failed to delete: ${deleteError.message}` }, { status: 500 })
      }

      if (queueItem?.document_id) {
        await serviceClient.from('documents').delete().eq('id', queueItem.document_id)
      }

      return NextResponse.json({ success: true, action: 'deleted' }, { status: 200 })
    }

    if (body.action === 'retry') {
      const { error: updateError } = await serviceClient
        .from('ocr_queue')
        .update({ status: 'pending', error: null })
        .eq('id', body.queueId)

      if (updateError) {
        return NextResponse.json({ error: `Failed to retry: ${updateError.message}` }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: 'retried' }, { status: 200 })
    }

    if (body.action === 'process') {
      await serviceClient
        .from('ocr_queue')
        .update({ status: 'processing' })
        .eq('id', body.queueId)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const embeddingsRes = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: body.queueId }),
      })

      if (!embeddingsRes.ok) {
        const errData = await embeddingsRes.json().catch(() => ({}))
        await serviceClient
          .from('ocr_queue')
          .update({ status: 'failed', error: errData.error || 'Embeddings failed' })
          .eq('id', body.queueId)

        return NextResponse.json(
          { error: `Processing failed: ${errData.error || embeddingsRes.statusText}` },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, action: 'processed' }, { status: 200 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/admin/queue error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
