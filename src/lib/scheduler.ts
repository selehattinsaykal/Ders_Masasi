// ts-fsrs sarmalayıcısı: kart durumunu düz sayılarla (yedeğe yazılabilir biçimde) tutar.
import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import type { FsrsState } from '../db/schema'

export const DAY = 86_400_000

const engine = fsrs(generatorParameters({ enable_fuzz: false }))

function toState(c: FsrsCard): FsrsState {
  const s: FsrsState = {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
  }
  if (c.last_review) s.last_review = c.last_review.getTime()
  return s
}

function toCard(s: FsrsState): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps ?? 0,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as FsrsCard['state'],
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  }
}

export function newFsrsState(now: number): FsrsState {
  return toState(createEmptyCard(new Date(now)))
}

export type Rating = 1 | 2 | 3 | 4
export const RATING_LABEL: Record<Rating, string> = { 1: 'Tekrar', 2: 'Zor', 3: 'İyi', 4: 'Kolay' }

export function rateCard(state: FsrsState, rating: Rating, now: number): FsrsState {
  return toState(engine.next(toCard(state), new Date(now), rating as Grade).card)
}

/** Her puan için kartın bir sonraki gösterim zamanı. */
export function previewDue(state: FsrsState, now: number): Record<Rating, number> {
  return {
    1: rateCard(state, 1, now).due,
    2: rateCard(state, 2, now).due,
    3: rateCard(state, 3, now).due,
    4: rateCard(state, 4, now).due,
  }
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} dk`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} sa`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days} gün`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} ay`
  return `${(days / 365).toFixed(1).replace('.', ',')} yıl`
}
