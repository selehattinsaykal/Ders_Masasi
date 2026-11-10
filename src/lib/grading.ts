import type { Result } from '../db/schema'

/** Karşılaştırma için metni sadeleştirir: boşluk, büyük-küçük harf ve ı/i farkı yok sayılır. */
export function normalizeText(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
}

function toNumber(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function gradeFill(response: string | undefined | null, answers: string[], tolerance = 0): Result {
  if (response == null || !response.trim()) return 'blank'
  const given = normalizeText(response)
  const givenNum = toNumber(response)
  for (const a of answers) {
    if (normalizeText(a) === given) return 'correct'
    const n = toNumber(a)
    if (n !== null && givenNum !== null && Math.abs(n - givenNum) <= tolerance + 1e-12) return 'correct'
  }
  return 'wrong'
}

export function gradeMcq(response: number | null | undefined, answerIndex: number): Result {
  if (response == null) return 'blank'
  return response === answerIndex ? 'correct' : 'wrong'
}

export function gradeTf(response: boolean | null | undefined, answer: boolean): Result {
  if (response == null) return 'blank'
  return response === answer ? 'correct' : 'wrong'
}

function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
}

/** Program çıktısını beklenenle karşılaştırır; satır sonu türü ve sondaki boşluklar önemsenmez. */
export function compareOutput(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected)
}

export function gradeCode(passed: number, total: number): Result {
  if (total > 0 && passed === total) return 'correct'
  return passed > 0 ? 'partial' : 'wrong'
}

export interface Tally {
  correct: number
  wrong: number
  blank: number
  partial: number
  total: number
  /** Kısmen doğrular yarım sayılır. */
  percent: number
}

export function tally(results: Result[]): Tally {
  const t = { correct: 0, wrong: 0, blank: 0, partial: 0 }
  for (const r of results) t[r]++
  const total = results.length
  const percent = total ? Math.round(((t.correct + t.partial * 0.5) / total) * 100) : 0
  return { ...t, total, percent }
}

/** Net puan: `ratio` yanlış bir doğruyu götürür; 0 ise yanlışlar götürmez. */
export function netScore(correct: number, wrong: number, ratio: number): number {
  return ratio > 0 ? correct - wrong / ratio : correct
}

export function gradeOptical(key: (number | null)[], responses: (number | null)[]): Tally {
  const results: Result[] = []
  key.forEach((k, i) => {
    if (k == null) return
    results.push(gradeMcq(responses[i] ?? null, k))
  })
  return tally(results)
}

export function percentOf(correct: number, partial: number, total: number): number {
  return total ? Math.round(((correct + partial * 0.5) / total) * 100) : 0
}
