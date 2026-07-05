'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { byokToHeaders, useByokStore } from '@/lib/store/byok-store'
import type { Exam } from '@/lib/ai/schemas'

interface ExamConfigDialogProps {
  topicId: string
  onExamGenerated: (exam: Exam) => void
}

const QUESTION_TYPE_OPTIONS = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'essay', label: 'Essay' },
] as const

/**
 * ExamConfigDialog — modal dialog for configuring and generating an exam.
 *
 * Collects question types, count, difficulty, and share preference.
 * On submit, POSTs to /api/ai/generate-exam and forwards the result
 * via the onExamGenerated callback.
 */
export function ExamConfigDialog({ topicId, onExamGenerated }: ExamConfigDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [questionTypes, setQuestionTypes] = useState<string[]>(['mcq'])
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState('medium')

  const byok = useByokStore()

  const toggleQuestionType = (type: string) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const handleSubmit = async () => {
    if (questionTypes.length === 0) {
      toast.error('Select at least one question type')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/ai/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokToHeaders(byok) },
        body: JSON.stringify({ topicId, config: { questionTypes, count, difficulty } }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Exam generation failed (${res.status})`)
      }

      const data = (await res.json()) as { questions: Exam['questions'] }
      onExamGenerated({ questions: data.questions })
      toast.success('Exam generated!')
      setOpen(false)
    } catch (error) {
      console.error('Exam generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Exam generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Sparkles className="size-4" />
            Generate Exam
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exam Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Question types */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Question Types</legend>
            <div className="flex gap-4">
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input text-primary accent-primary"
                    checked={questionTypes.includes(option.value)}
                    onChange={() => toggleQuestionType(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Count */}
          <div className="space-y-2">
            <Label htmlFor="exam-count">Number of Questions</Label>
            <Input
              id="exam-count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <Label htmlFor="exam-difficulty">Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => v && setDifficulty(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline">Cancel</Button>
            }
          />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? 'Generating\u2026' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
