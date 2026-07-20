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
        <div className="space-y-4">
          {weaknesses.map((w) => (
            <div key={w.topic_name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="truncate text-sm font-medium">{w.topic_name}</span>
              <div
                className="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1"
                role="progressbar"
                aria-label={`${w.topic_name}: ${w.error_count} errors`}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={w.error_count}
              >
                <div
                  className="h-full rounded-full bg-amber-500 dark:bg-amber-400"
                  style={{
                    width: `${max > 0 ? (w.error_count / max) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="row-start-1 text-sm tabular-nums text-muted-foreground sm:row-auto">
                {w.error_count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
