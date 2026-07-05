import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { resolveChatModel } from '@/lib/ai/providers'
import { retrieveChunks } from '@/lib/rag/retrieve'
import { chatSystemPrompt } from '@/lib/ai/prompts'
import type { ByokConfig } from '@/lib/store/byok-store'

/**
 * POST /api/ai/chat
 *
 * Auth-gated streaming RAG chat endpoint. Accepts UIMessage[] (AI SDK v7
 * format with parts), retrieves relevant document chunks via BYOK embeddings,
 * and streams an LLM response using streamText.
 *
 * Auth: required (authenticated user).
 * Body: { messages: UIMessage[], topicId: string (uuid) }
 * Headers: BYOK config via headers (byokToHeaders).
 *
 * Returns: UIMessage stream response (text/event-stream).
 */

const requestBodySchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    parts: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })),
  })).min(1),
  topicId: z.string().uuid(),
})

/** Extract BYOK config from request headers (set by byokToHeaders). */
function readByokFromHeaders(request: NextRequest): ByokConfig {
  const h = (name: string) => request.headers.get(name) ?? ''
  return {
    llmProvider: (h('x-byok-provider') as ByokConfig['llmProvider']) || 'custom',
    llmBaseURL: h('x-byok-base-url'),
    llmApiKey: h('x-byok-api-key'),
    llmModelName: h('x-byok-model'),
    embeddingsBaseURL: h('x-byok-embeddings-base-url'),
    embeddingsModel: h('x-byok-embeddings-model') || 'qwen3-embedding:0.6b',
  }
}

/** Extract text content from a UIMessage's parts array. */
function getMessageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: string; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

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
    let body: z.infer<typeof requestBodySchema>
    try {
      const raw = await request.json()
      const result = requestBodySchema.safeParse(raw)
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

    // --- Read BYOK config from headers ------------------------------------
    const byok = readByokFromHeaders(request)
    // Gemini doesn't need a base URL (uses createGoogleGenerativeAI with apiKey only)
    const needsBaseURL = byok.llmProvider !== 'gemini'
    if (needsBaseURL && !byok.llmBaseURL) {
      return NextResponse.json(
        { error: 'LLM base URL is required for non-Gemini providers (configure in Settings)' },
        { status: 400 },
      )
    }
    if (!byok.llmApiKey) {
      return NextResponse.json(
        { error: 'LLM API key is required (configure in Settings)' },
        { status: 400 },
      )
    }

    // --- Find last user message (extract text from parts) -----------------
    const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 },
      )
    }
    const lastUserText = getMessageText(lastUserMessage.parts)
    if (!lastUserText.trim()) {
      return NextResponse.json(
        { error: 'User message is empty' },
        { status: 400 },
      )
    }

    // --- Retrieve relevant chunks (RAG) -----------------------------------
    let context = ''
    try {
      const chunks = await retrieveChunks({
        topicId: body.topicId,
        query: lastUserText,
        byok,
        k: 5,
      })
      if (chunks.length > 0) {
        context = chunks.map((c) => c.content).join('\n\n')
      }
    } catch {
      return NextResponse.json(
        { error: 'Failed to retrieve context. Check your embeddings configuration.' },
        { status: 502 },
      )
    }

    // --- Convert UIMessage[] → ModelMessage[] (AI SDK v7) -----------------
    const modelMessages = await convertToModelMessages(body.messages as UIMessage[])

    // --- Stream LLM response ----------------------------------------------
    // streamText returns immediately; errors surface during streaming.
    // Use onError callbacks for proper error reporting.
    const result = streamText({
      model: resolveChatModel(byok),
      system: chatSystemPrompt(context),
      messages: modelMessages,
      temperature: 0.3,
      maxOutputTokens: 2048,
      onError: ({ error }) => {
        console.error('streamText error:', error)
      },
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error('UIMessage stream error:', error)
        return 'The assistant encountered an error. Please try again.'
      },
    })
  } catch (error) {
    console.error('Chat route error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}
