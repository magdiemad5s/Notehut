'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface WeaknessesChartProps {
  weaknesses: { topic_name: string; error_count: number }[]
}

export default function WeaknessesChart({ weaknesses }: WeaknessesChartProps) {
  const max = weaknesses.reduce(
    (m, w) => Math.max(m, w.error_count),
    0,
  )

  if (weaknesses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Topic Weaknesses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              No weaknesses tracked yet. Take some exams to see your weak areas.
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic Weaknesses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {weaknesses.map((w) => (
            <div key={w.topic_name} className="flex items-center gap-3">
              <span className="w-32 truncate text-sm">{w.topic_name}</span>
              <div className="flex-1 overflow-hidden rounded bg-muted h-6">
                <div
                  className="h-full rounded bg-red-500"
                  style={{
                    width: `${max > 0 ? (w.error_count / max) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="w-8 text-sm text-muted-foreground">
                {w.error_count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
