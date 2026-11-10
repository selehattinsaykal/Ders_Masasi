import type { Answer, Attempt, Result, Review, StudySession } from '../db/schema'
import { startOfDay } from './format'
import { percentOf } from './grading'

const DAY = 86_400_000

export interface DayActivity {
  questions: number
  cards: number
  sec: number
}

/** Gün gün etkinlik: çözülen soru, tekrar edilen kart, çalışma süresi. */
export function dailyActivity(
  answers: Answer[],
  reviews: Review[],
  attempts: Attempt[],
  sessions: StudySession[],
): Map<number, DayActivity> {
  const map = new Map<number, DayActivity>()
  const day = (ts: number) => {
    const k = startOfDay(ts)
    if (!map.has(k)) map.set(k, { questions: 0, cards: 0, sec: 0 })
    return map.get(k)!
  }
  for (const a of answers) if (a.result !== 'blank') day(a.updatedAt).questions++
  for (const r of reviews) day(r.at).cards++
  for (const a of attempts) if (a.durationSec) day(a.startedAt).sec += a.durationSec
  for (const s of sessions) day(s.startedAt).sec += s.durationSec
  // Optik form denemeleri cevap satırı üretmez; soru sayısı denemeden gelir.
  for (const a of attempts) if (a.mode === 'optik' && a.finishedAt) day(a.startedAt).questions += a.correct + a.wrong
  return map
}

/** Bugün (ya da dün) biten kesintisiz gün serisi. */
export function streak(activity: Map<number, DayActivity>, now = Date.now()): number {
  const active = (ts: number) => {
    const d = activity.get(ts)
    return !!d && d.questions + d.cards + d.sec > 0
  }
  let t = startOfDay(now)
  if (!active(t)) t = startOfDay(t - DAY / 2)
  let n = 0
  while (active(t)) {
    n++
    t = startOfDay(t - DAY / 2)
  }
  return n
}

export interface Bucket {
  label: string
  correct: number
  wrong: number
  partial: number
  total: number
  percent: number
}

/** Cevapları bir anahtara (konu, soru tipi) göre gruplar. Boşlar hariç. */
export function groupAccuracy(answers: Answer[], keyOf: (a: Answer) => string | undefined): Bucket[] {
  const map = new Map<string, Record<Result, number>>()
  for (const a of answers) {
    if (a.result === 'blank') continue
    const k = keyOf(a)
    if (!k) continue
    if (!map.has(k)) map.set(k, { correct: 0, wrong: 0, blank: 0, partial: 0 })
    map.get(k)![a.result]++
  }
  return [...map.entries()].map(([label, r]) => {
    const total = r.correct + r.wrong + r.partial
    return { label, correct: r.correct, wrong: r.wrong, partial: r.partial, total, percent: percentOf(r.correct, r.partial, total) }
  })
}

export function attemptPercent(a: Attempt): number {
  return percentOf(a.correct, a.partial, a.correct + a.wrong + a.blank + a.partial)
}

/** Kart tekrarlarında hatırlama oranı: "Tekrar" dışındaki puanların payı. */
export function retention(reviews: Review[]): number {
  if (!reviews.length) return 0
  return Math.round((reviews.filter((r) => r.rating > 1).length / reviews.length) * 100)
}

export function lastDays(n: number, now = Date.now()): number[] {
  const out: number[] = []
  let t = startOfDay(now)
  for (let i = 0; i < n; i++) {
    out.unshift(t)
    t = startOfDay(t - DAY / 2)
  }
  return out
}
