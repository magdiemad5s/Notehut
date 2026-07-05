'use client'

import { useState, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { GraduationCap, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { byokToHeaders, useByokStore } from '@/lib/store/byok-store'

interface TutorPanelProps {
  topicId: string
  topicName: string
}

/** Extract text content from a UIMessage's parts array (AI SDK v7). */
function getMessageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

export function TutorPanel({ topicId, topicName }: TutorPanelProps) {
  const byok = useByokStore()
  const [input, setInput] = useState('')

  // Memoize transport to avoid re-creating it on every render (causes
  // stream re-initialization in @ai-sdk/react).
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/tutor',
        headers: byokToHeaders(byok),
        body: { topicId, topicName },
      }),
    [byok, topicId, topicName],
  )

  const { messages, sendMessage, status, error, stop } = useChat({ transport })

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <Card className="flex flex-col h-[600px]">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <GraduationCap className="size-8" />
          <p className="text-sm">Ask the tutor for a study guide on {topicName}</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => {
              const text = getMessageText(message.parts)
              return (
                <div
                  key={message.id}
                  className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[80%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground'
                        : 'max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted'
                    }
                  >
                    {text}
                  </div>
                </div>
              )
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-500 mt-2">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          )}
        </ScrollArea>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your documents..."
          disabled={isLoading}
        />
        {isLoading ? (
          <Button type="button" onClick={stop} variant="destructive">
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <Send className="size-4" />
          </Button>
        )}
      </form>
    </Card>
  )
}
