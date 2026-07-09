'use client'

import { Shield } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatsSection } from './stats-section'
import { AiConfigSection as AIConfigSection } from './ai-config-section'
import { OcrWorkerSection } from './ocr-worker-section'
import { AdminQueueSection } from './queue-section'
import { UsersSection } from './users-section'

export function AdminTabs({ currentUserId }: { currentUserId: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="size-6" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="ai-config">AI Config</TabsTrigger>
          <TabsTrigger value="ocr-worker">OCR Worker</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <StatsSection />
        </TabsContent>
        <TabsContent value="ai-config">
          <AIConfigSection />
        </TabsContent>
        <TabsContent value="ocr-worker">
          <OcrWorkerSection />
        </TabsContent>
        <TabsContent value="queue">
          <AdminQueueSection />
        </TabsContent>
        <TabsContent value="users">
          <UsersSection currentUserId={currentUserId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
