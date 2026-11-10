// Test oturumu (deneme) işlemleri: başlatma, cevap kaydetme, bitirme, soru geçmişi.
import { db, stamp } from '../db/db'
import type { Answer, Attempt, AttemptMode, Question, Result } from '../db/schema'
import { shuffle } from './format'
import { gradeFill, gradeMcq, gradeTf, tally } from './grading'

export interface QStat {
  seen: number
  correct: number
  wrong: number
  partial: number
  last?: Result
}

/** Soru bazında geçmiş. Boş bırakılanlar ve henüz değerlendirilmeyenler sayılmaz. */
export function buildQuestionStats(answers: Answer[]): Map<string, QStat> {
  const map = new Map<string, QStat>()
  for (const a of [...answers].sort((x, y) => x.updatedAt - y.updatedAt)) {
    if (a.result === 'blank') continue
    let s = map.get(a.questionId)
    if (!s) map.set(a.questionId, (s = { seen: 0, correct: 0, wrong: 0, partial: 0 }))
    s.seen++
    s[a.result]++
    s.last = a.result
  }
  return map
}

export const isMissed = (s?: QStat) => s?.last === 'wrong' || s?.last === 'partial'

export interface StartOptions {
  courseId: string
  setId?: string
  title: string
  mode: AttemptMode
  instant: boolean
  questions: Question[]
  shuffleQuestions?: boolean
  shuffleOptions?: boolean
  limitSec?: number
}

export async function startAttempt(o: StartOptions): Promise<string> {
  const list = o.shuffleQuestions ? shuffle(o.questions) : [...o.questions].sort((a, b) => a.order - b.order)
  const optionOrder: Record<string, number[]> = {}
  if (o.shuffleOptions)
    for (const q of list) if (q.type === 'mcq' && q.options) optionOrder[q.id] = shuffle(q.options.map((_, i) => i))
  const attempt: Attempt = stamp({
    courseId: o.courseId,
    setId: o.setId,
    title: o.title,
    mode: o.mode,
    instant: o.instant,
    questionIds: list.map((q) => q.id),
    optionOrder: o.shuffleOptions ? optionOrder : undefined,
    currentIndex: 0,
    startedAt: Date.now(),
    durationSec: 0,
    limitSec: o.limitSec,
    correct: 0,
    wrong: 0,
    blank: 0,
    partial: 0,
  })
  await db.attempts.add(attempt)
  return attempt.id
}

/** Otomatik puanlanabilen tiplerde sonucu verir; klasik ve kod için null (ayrı değerlendirilir). */
export function autoGrade(q: Question, response: unknown): Result | null {
  switch (q.type) {
    case 'mcq':
      return gradeMcq(response as number | null, q.answerIndex ?? -1)
    case 'tf':
      return gradeTf(response as boolean | null, q.answerBool ?? false)
    case 'fill':
      return gradeFill(response as string | null, q.answers ?? [], q.tolerance)
    default:
      return null
  }
}

export const answerId = (attemptId: string, questionId: string) => `${attemptId}:${questionId}`

export async function saveAnswer(
  attempt: Attempt,
  q: Question,
  data: Pick<Answer, 'response' | 'result'> & Partial<Pick<Answer, 'needsReview' | 'passed' | 'total'>>,
): Promise<void> {
  const id = answerId(attempt.id, q.id)
  const now = Date.now()
  const old = await db.answers.get(id)
  await db.answers.put({
    id,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
    attemptId: attempt.id,
    questionId: q.id,
    courseId: attempt.courseId,
    type: q.type,
    topic: q.topic,
    ...data,
  })
}

/** Deneme sayımlarını cevaplardan yeniden hesaplar. */
export async function recount(attemptId: string): Promise<void> {
  const answers = await db.answers.where('attemptId').equals(attemptId).toArray()
  const t = tally(answers.map((a) => a.result))
  await db.attempts.update(attemptId, {
    correct: t.correct,
    wrong: t.wrong,
    blank: t.blank,
    partial: t.partial,
    updatedAt: Date.now(),
  })
}

export async function finishAttempt(attemptId: string, durationSec: number): Promise<void> {
  const attempt = await db.attempts.get(attemptId)
  if (!attempt) return
  const have = new Set((await db.answers.where('attemptId').equals(attemptId).toArray()).map((a) => a.questionId))
  const questions = await db.questions.bulkGet(attempt.questionIds)
  for (const q of questions) {
    if (!q || have.has(q.id)) continue
    await saveAnswer(attempt, q, { response: null, result: 'blank' })
  }
  await db.attempts.update(attemptId, { finishedAt: Date.now(), durationSec, updatedAt: Date.now() })
  await recount(attemptId)
}

/** Bir sorunun doğru cevabını okunur metne çevirir. */
export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return q.options?.[q.answerIndex ?? -1] ?? ''
    case 'tf':
      return q.answerBool ? 'Doğru' : 'Yanlış'
    case 'fill':
      return (q.answers ?? []).join(' / ')
    default:
      return q.solution ?? ''
  }
}
