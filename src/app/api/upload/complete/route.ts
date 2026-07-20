import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * POST /api/upload/complete
 *
 * Completes a direct-to-storage upload by creating the `documents` and
 * `ocr_queue` rows. The browser uploads the PDF directly to Supabase
 * Storage (bypassing Vercel's 4.5 MB serverless body limit), then calls
 * this route with just the storage path + filename + topicId (tiny JSON).
 *
 * Auth: required (authenticated user).
 * Body: { storagePath: string, filename: string, topicId: string }
 *
 * Security: storagePath MUST start with `${user.id}/` — this prevents a
 * user from referencing a file uploaded to another user's folder. The
 * route rejects any path that doesn't match the caller's user id.
 *
 * Returns: { documentId, queueId }
 */
const bodySchema = z.object({
  storagePath: z
    .string()
    .min(1, 'storagePath is required')
    .max(512, 'storagePath too long')
    .regex(/^[a-zA-Z0-9\-/]+\.pdf$/, 'storagePath must be a .pdf path'),
  filename: z
    .string()
    .min(1, 'filename is required')
    .max(255, 'filename too long'),
  topicId: z.string().uuid('topicId must be a valid UUID'),
})

export async function POST(request: NextRequest) {
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

    // --- Parse + validate body --------------------------------------------
    let body: z.infer<typeof bodySchema>
    try {
      const raw = await request.json()
      const result = bodySchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error.issues[0]?.message || 'Invalid request body' },
          { status: 400 },
        )
      }
      body = result.data
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      )
    }

    // --- Security: storagePath must belong to this user -------------------
    // Path format enforced by client: "{user_id}/{uuid}.pdf". Reject any
    // path that doesn't start with the caller's own user id, so a user
    // can't create a documents row pointing at someone else's file.
    const expectedPrefix = `${user.id}/`
    if (!body.storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: 'Storage path does not belong to the authenticated user' },
        { status: 403 },
      )
    }

    // --- Verify topic ownership -------------------------------------------
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id')
      .eq('id', body.topicId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (topicError || !topic) {
      return NextResponse.json(
        {
          error: 'Topic not found or not owned by user',
        },
        { status: 404 },
      )
    }

    // --- Verify the file actually exists in storage -----------------------
    // Defensive: if the client lied about uploading, we'd create a documents
    // row pointing at nothing. Head the object to confirm it's there.
    const { data: fileExists, error: headError } = await supabase.storage
      .from('pdfs')
      .exists(body.storagePath)
    if (headError || !fileExists) {
      return NextResponse.json(
        {
          error: 'File not found in storage. Did the upload complete?',
        },
        { status: 404 },
      )
    }

    // --- Insert documents row ---------------------------------------------
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        topic_id: body.topicId,
        filename: body.filename,
        storage_path: body.storagePath,
      })
      .select('id')
      .single()

    if (docError || !document) {
      console.error('documents insert error:', docError)
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 },
      )
    }

    // --- Insert ocr_queue row ---------------------------------------------
    const { data: queueItem, error: queueError } = await supabase
      .from('ocr_queue')
      .insert({
        user_id: user.id,
        document_id: document.id,
        file_url: body.storagePath,
        status: 'pending',
      })
      .select('id')
      .single()

    if (queueError || !queueItem) {
      console.error('ocr_queue insert error:', queueError)
      // Best-effort cleanup: remove the documents row (the storage file
      // remains — it's orphaned but harmless, and we avoid masking the
      // original error with a delete failure).
      try {
        await supabase.from('documents').delete().eq('id', document.id)
      } catch (e) {
        console.error('Cleanup: document delete failed:', e)
      }
      return NextResponse.json(
        { error: 'Failed to create OCR queue entry' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { documentId: document.id, queueId: queueItem.id },
      { status: 200 },
    )
  } catch (error) {
    console.error('Upload complete route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
