import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { safeServerFetch } from '@/lib/security/outbound-url'

const testRequestSchema = z.object({
  type: z.enum(['llm', 'embeddings']),
  baseURL: z
    .string()
    .url('Base URL must be a valid URL')
    .max(2048, 'Base URL too long')
    .optional(),
  apiKey: z
    .string()
    .max(2048, 'API key too long')
    .regex(/^[^\r\n]*$/, 'API key must not contain newlines')
    .optional(),
  model: z.string().max(256, 'Model name too long').optional(),
  provider: z.enum(['custom', 'gemini', 'deepseek']).optional(),
})

/** Extract BYOK config from request headers, falling back to body fields. */
function readByokFromRequest(request: NextRequest, body: z.infer<typeof testRequestSchema>) {
  const getHeader = (name: string) => request.headers.get(name) || undefined

  // LLM config: headers take priority, body as fallback
  const provider = (getHeader('x-byok-provider') as 'custom' | 'gemini' | 'deepseek' | undefined)
    ?? body.provider
  const baseURL = getHeader('x-byok-base-url') ?? body.baseURL
  const apiKey = getHeader('x-byok-api-key') ?? body.apiKey
  const model = getHeader('x-byok-model') ?? body.model

  // Embeddings config: separate header namespace
  const embeddingsBaseURL = getHeader('x-byok-embeddings-base-url') ?? baseURL
  const embeddingsApiKey = getHeader('x-byok-embeddings-api-key') ?? body.apiKey
  const embeddingsModel = getHeader('x-byok-embeddings-model') ?? body.model

  return { provider, baseURL, apiKey, model, embeddingsBaseURL, embeddingsApiKey, embeddingsModel }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check — require authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      )
    }

    // Parse and validate request body
    let body: z.infer<typeof testRequestSchema>
    try {
      const raw = await request.json()
      const result = testRequestSchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            message:
              result.error.issues[0]?.message || 'Invalid request body',
          },
          { status: 400 },
        )
      }
      body = result.data
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 },
      )
    }

    const byok = readByokFromRequest(request, body)

    if (body.type === 'llm') {
      if (byok.provider !== 'gemini' && !byok.baseURL) {
        return NextResponse.json(
          { success: false, message: 'Base URL is required' },
          { status: 400 },
        )
      }
      return await testLlmConnection(byok.baseURL ?? '', byok.apiKey, byok.provider, byok.model)
    }

    // embeddings
    if (!byok.embeddingsBaseURL) {
      return NextResponse.json(
        { success: false, message: 'Base URL is required' },
        { status: 400 },
      )
    }
    return await testEmbeddingsConnection(
      byok.embeddingsBaseURL,
      byok.embeddingsApiKey,
      byok.embeddingsModel,
    )
  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred' },
      { status: 500 },
    )
  }
}

async function testLlmConnection(
  baseURL: string,
  apiKey: string | undefined,
  provider: 'custom' | 'gemini' | 'deepseek' | undefined,
  model: string | undefined,
) {
  const normalizedBase = baseURL.replace(/\/+$/, '')

  if (provider === 'gemini') {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models'

    try {
      const response = await safeServerFetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Goog-Api-Key': apiKey } : {}),
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.error(
          `Gemini API error (${response.status}):`,
          await response.text().catch(() => '(unreadable)'),
        )
        return NextResponse.json(
          {
            success: false,
            message: `Upstream API returned status ${response.status}`,
          },
          { status: 502 },
        )
      }

      const data = await response.json()
      const modelCount = data.models?.length ?? 0
      return NextResponse.json(
        {
          success: true,
          message: `Connected successfully — ${modelCount} models available`,
        },
        { status: 200 },
      )
    } catch (error) {
      console.error('Gemini connection error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to reach upstream API' },
        { status: 502 },
      )
    }
  }

  // OpenAI-compatible (custom, deepseek) — try GET /models first
  const url = `${normalizedBase}/models`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const response = await safeServerFetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      const data = await response.json()
      const modelCount = data.data?.length ?? 0
      return NextResponse.json(
        {
          success: true,
          message: `Connected successfully — ${modelCount} models available`,
        },
        { status: 200 },
      )
    }

    // If /models fails, try a minimal chat completion as fallback
    if (response.status === 404) {
      const chatUrl = `${normalizedBase}/chat/completions`
      const chatBody = {
        model: model || 'test',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }

      const chatResponse = await safeServerFetch(chatUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
        signal: AbortSignal.timeout(15000),
      })

      if (chatResponse.ok) {
        return NextResponse.json(
          {
            success: true,
            message: 'Connected successfully — chat completion works',
          },
          { status: 200 },
        )
      }

      console.error(
        `Chat test failed (${chatResponse.status}):`,
        await chatResponse.text().catch(() => '(unreadable)'),
      )
      return NextResponse.json(
        {
          success: false,
          message: `Upstream API returned status ${chatResponse.status}`,
        },
        { status: 502 },
      )
    }

    console.error(
      `API error (${response.status}):`,
      await response.text().catch(() => '(unreadable)'),
    )
    return NextResponse.json(
      {
        success: false,
        message: `Upstream API returned status ${response.status}`,
      },
      { status: 502 },
    )
  } catch (error) {
    console.error('LLM connection error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to reach upstream API' },
      { status: 502 },
    )
  }
}

async function testEmbeddingsConnection(
  baseURL: string,
  apiKey: string | undefined,
  model: string | undefined,
) {
  const normalizedBase = baseURL.replace(/\/+$/, '')
  const url = `${normalizedBase}/embeddings`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const response = await safeServerFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'qwen3-embedding:0.6b',
        input: 'connection test',
      }),
      // 60s budget: Ollama cold start (loading model into VRAM from disk)
      // can take 20-40s on Colab. The actual /api/embeddings route uses 120s.
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      console.error(
        `Embeddings API error (${response.status}):`,
        await response.text().catch(() => '(unreadable)'),
      )
      return NextResponse.json(
        {
          success: false,
          message: `Upstream API returned status ${response.status}`,
        },
        { status: 502 },
      )
    }

    const data = await response.json()
    const embeddingDim = data.data?.[0]?.embedding?.length ?? 0
    return NextResponse.json(
      {
        success: true,
        message: `Connected successfully — embedding dimension: ${embeddingDim}`,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Embeddings connection error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to reach upstream API' },
      { status: 502 },
    )
  }
}
