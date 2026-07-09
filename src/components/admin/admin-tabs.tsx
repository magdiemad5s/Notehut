'use client'

import { Shield } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatsSection } from './stats-section'
import { AiConfigSection as AIConfigSection } from './ai-config-section'
import { OcrWorkerSection } from './ocr-worker-section'
import { AdminQueueSection } from './queue-section'
import { UsersSection } from './users-section'

const TABS = [
  { id: 'stats', label: 'Stats', Component: StatsSection },
  { id: 'ai-config', label: 'AI Config', Component: AIConfigSection },
  { id: 'ocr-worker', label: 'OCR Worker', Component: OcrWorkerSection },
  { id: 'queue', label: 'Queue', Component: AdminQueueSection },
  { id: 'users', label: 'Users', Component: UsersSection },
] as const

export function AdminTabs({ currentUserId }: { currentUserId: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="size-6" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => {
          // UsersSection needs currentUserId to disable own-row toggle
          if (tab.id === 'users') {
            return (
              <TabsContent key={tab.id} value={tab.id}>
                <UsersSection currentUserId={currentUserId} />
              </TabsContent>
            )
          }
          return (
            <TabsContent key={tab.id} value={tab.id}>
              <tab.Component />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
