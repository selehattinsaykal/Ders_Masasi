// "Finalden kaç almalıyım?" hesabı. Notlar 0–100, ağırlıklar yüzde.
import type { GradingScheme } from '../db/schema'

export type GradeStatus =
  | 'invalid' // ağırlıklar 100 etmiyor
  | 'need' // kalan sınav(lar)dan belli bir not gerekiyor
  | 'safe' // ortalama zaten yetiyor; yalnızca baraj (varsa) önemli
  | 'impossible' // 100 alsa bile yetmiyor
  | 'passed'
  | 'failed'

export interface GradeResult {
  status: GradeStatus
  /** Şimdiye kadar toplanan puan (ağırlıklı). */
  earned: number
  /** Tüm notlar girildiyse ağırlıklı ortalama. */
  average?: number
  /** Kalan her sınavdan alınması gereken not (baraj dahil). */
  needed?: number
  /** Yalnızca ortalamayı tutturmak için gereken not. */
  neededForAverage?: number
  /** Henüz notu girilmemiş sınavlar. */
  remaining: string[]
  reason?: string
}

const round1 = (n: number) => Math.round(n * 10) / 10
/** Not tam sayıdır; gereken notu yukarı yuvarla (kayan nokta payıyla). */
const ceilScore = (n: number) => Math.ceil(n - 1e-9)

export function evaluateGrade(s: GradingScheme): GradeResult {
  const total = s.parts.reduce((n, p) => n + (p.weight || 0), 0)
  const earned = s.parts.reduce((n, p) => n + (p.score != null ? (p.weight * p.score) / 100 : 0), 0)
  const left = s.parts.filter((p) => p.score == null)
  const remaining = left.map((p) => p.name)

  if (Math.abs(total - 100) > 0.01)
    return { status: 'invalid', earned: round1(earned), remaining, reason: `Ağırlıkların toplamı %${round1(total)}; %100 olmalı.` }

  const last = s.parts[s.parts.length - 1]
  const finalMin = s.finalMin ?? 0

  if (!left.length) {
    const average = round1(earned)
    if (finalMin && last.score! < finalMin)
      return { status: 'failed', earned: average, average, remaining, reason: `${last.name} notu baraj olan ${finalMin}’in altında.` }
    return { status: average >= s.passing ? 'passed' : 'failed', earned: average, average, remaining }
  }

  const leftWeight = left.reduce((n, p) => n + p.weight, 0)
  const neededForAverage = Math.max(0, ceilScore(((s.passing - earned) * 100) / leftWeight))
  // Baraj yalnızca son sınav henüz girilmemişse gereken notu etkiler.
  const lastPending = last.score == null
  const needed = lastPending ? Math.max(neededForAverage, finalMin) : neededForAverage

  if (!lastPending && finalMin && last.score! < finalMin)
    return { status: 'failed', earned: round1(earned), remaining, reason: `${last.name} notu baraj olan ${finalMin}’in altında.` }
  if (needed > 100) return { status: 'impossible', earned: round1(earned), needed, neededForAverage, remaining }
  if (neededForAverage === 0) return { status: 'safe', earned: round1(earned), needed, neededForAverage, remaining }
  return { status: 'need', earned: round1(earned), needed, neededForAverage, remaining }
}

export function defaultScheme(): GradingScheme {
  return {
    parts: [
      { id: crypto.randomUUID(), name: 'Vize', weight: 40 },
      { id: crypto.randomUUID(), name: 'Final', weight: 60 },
    ],
    passing: 50,
  }
}
