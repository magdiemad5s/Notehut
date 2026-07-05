'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RealtimeOcrStatus } from '@/components/realtime-ocr-status'
import { byokToHeaders, useByokStore } from '@/lib/store/byok-store'

interface UploadPdfProps {
  topicId: string
}

/**
 * UploadPdf — file input + upload trigger.
 *
 * On submit, POSTs the PDF to /api/upload as multipart/form-data.
 * On success, renders RealtimeOcrStatus with the returned queueId
 * so the user can watch the OCR → chunk → embed pipeline progress.
 */
export function UploadPdf({ topicId }: UploadPdfProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [queueId, setQueueId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const byok = useByokStore()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    // Reset prior pipeline state when a new file is chosen
    setQueueId(null)
  }

  const onUpload = useCallback(async () => {
    if (!file) {
      toast.error('Please select a PDF file first')
      return
    }
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File exceeds 25 MB limit')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('topicId', topicId)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed (${res.status})`)
      }

      const data = (await res.json()) as { documentId: string; queueId: string }
      setQueueId(data.queueId)
      toast.success('File uploaded — waiting for OCR')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [file, topicId])

  const handleEmbeddings = useCallback(async () => {
    if (!queueId) return
    try {
      const res = await fetch('/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...byokToHeaders(byok),
        },
        body: JSON.stringify({ queueId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Embeddings failed (${res.status})`)
      }
      const data = (await res.json()) as { chunkCount: number }
      toast.success(`Embedded ${data.chunkCount} chunks`)
    } catch (error) {
      console.error('Embeddings error:', error)
      toast.error(error instanceof Error ? error.message : 'Embeddings failed')
    }
  }, [queueId, byok])

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pdf-upload">Upload PDF</Label>
        <Input
          id="pdf-upload"
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          disabled={uploading}
        />
        {file && (
          <p className="text-sm text-muted-foreground">
            {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </div>

      <Button
        onClick={onUpload}
        disabled={!file || uploading}
        className="w-full"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {uploading ? 'Uploading…' : 'Upload'}
      </Button>

      {queueId && (
        <RealtimeOcrStatus
          queueId={queueId}
          onCompleted={handleEmbeddings}
        />
      )}
    </Card>
  )
}
