import type { GradeResult, Question } from '@/lib/ai/schemas'

/** Grade objective question types without invoking an LLM. */
export function gradeObjectiveQuestion(
  question: Extract<Question, { type: 'mcq' | 'checkbox' }>,
  studentAnswer: string | undefined,
): GradeResult {
  if (studentAnswer === undefined || studentAnswer.trim() === '') {
    return { score: 0, feedback: 'No answer provided', isCorrect: false }
  }

  if (question.type === 'mcq') {
    const selected = Number(studentAnswer)
    const isCorrect = Number.isInteger(selected) && selected === question.correctAnswer
    return {
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? 'Correct' : 'Incorrect',
      isCorrect,
    }
  }

  const selected = new Set(
    studentAnswer
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Number.isInteger),
  )
  const expected = new Set(question.correctAnswers)
  const isCorrect =
    selected.size === expected.size &&
    [...selected].every((index) => expected.has(index))

  return {
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? 'Correct' : 'Incorrect',
    isCorrect,
  }
}
