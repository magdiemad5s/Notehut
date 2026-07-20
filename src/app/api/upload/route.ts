import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * POST /api/upload
 *
 * Uploads a PDF to Supabase Storage and inserts a documents row + an
 * ocr_queue row (status='pending'). The external Python OCR worker polls
 * ocr_queue for pending rows, downloads the file, runs OCR, and writes
 * extracted_text back to the row. The frontend is notified via Realtime.
 *
 * Auth: required (authenticated user).
 * Body: multipart/form-data with fields:
 *   - file: PDF file (max 25 MB)
 *   - topicId: uuid of the topic to attach the document to
 *
 * Returns: { documentId, queueId }
 */
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

    // --- Content-length preflight (DoS guard before buffering body) -------
    const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 25 MB limit' },
        { status: 413 },
      )
    }

    // --- Parse multipart form ---------------------------------------------
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Invalid multipart form data' },
        { status: 400 },
      )
    }
    const file = formData.get('file')
    const topicIdRaw = formData.get('topicId')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing or invalid "file" field' },
        { status: 400 },
      )
    }

    const topicIdParse = z
      .string()
      .uuid('topicId must be a valid UUID')
      .safeParse(topicIdRaw)
    if (!topicIdParse.success) {
      return NextResponse.json(
        { error: topicIdParse.error.issues[0]?.message || 'Invalid topicId' },
        { status: 400 },
      )
    }
    const topicId = topicIdParse.data

    // --- Validate file -----------------------------------------------------
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 },
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 25 MB limit' },
        { status: 413 },
      )
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 415 },
      )
    }

    // --- Magic-number check (defense against spoofed Content-Type) --------
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    const isPdf =
      header[0] === 0x25 && // %
      header[1] === 0x50 && // P
      header[2] === 0x44 && // D
      header[3] === 0x46 && // F
      header[4] === 0x2d   // -
    if (!isPdf) {
      return NextResponse.json(
        { error: 'File is not a valid PDF' },
        { status: 415 },
      )
    }

    // --- Verify topic ownership -------------------------------------------
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id')
      .eq('id', topicId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (topicError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found or not owned by user' },
        { status: 404 },
      )
    }

    // --- Upload to Storage -------------------------------------------------
    const fileExt = 'pdf'
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: "Storage upload failed. Ensure the 'pdfs' bucket exists in Supabase Storage." },
        { status: 500 },
      )
    }

    // --- Insert documents row ---------------------------------------------
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        topic_id: topicId,
        filename: file.name,
        storage_path: filePath,
      })
      .select('id')
      .single()

    if (docError || !document) {
      console.error('documents insert error:', docError)
      // Best-effort cleanup of the uploaded file (guarded so cleanup errors
      // don't mask the original failure).
      await supabase.storage
        .from('pdfs')
        .remove([filePath])
        .catch((e) => console.error('Cleanup: storage remove failed:', e))
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
        file_url: filePath,
        status: 'pending',
      })
      .select('id')
      .single()

    if (queueError || !queueItem) {
      console.error('ocr_queue insert error:', queueError)
      // Best-effort cleanup (guarded so cleanup errors don't mask the
      // original failure).
      try {
        await supabase.from('documents').delete().eq('id', document.id)
      } catch (e) {
        console.error('Cleanup: document delete failed:', e)
      }
      await supabase.storage
        .from('pdfs')
        .remove([filePath])
        .catch((e) => console.error('Cleanup: storage remove failed:', e))
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
    console.error('Upload route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
