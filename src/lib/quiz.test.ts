import { describe, expect, it } from 'vitest'
import { db, stamp } from '../db/db'
import type { Question } from '../db/schema'
import { lettersOnly, startAttempt } from './quiz'

const q = (options: string[]): Question =>
  stamp({ setId: 's', courseId: 'c', order: 0, type: 'mcq' as const, prompt: 'p', options, answerIndex: 1, starred: false })

describe('lettersOnly', () => {
  it('şıkları yalnızca harf olan soruyu tanır', () => {
    expect(lettersOnly(q(['A', 'B', 'C', 'D', 'E']))).toBe(true)
    expect(lettersOnly(q(['A', 'B']))).toBe(true)
    expect(lettersOnly(q(['FIFO', 'LIFO']))).toBe(false)
    expect(lettersOnly(q(['B', 'A']))).toBe(false)
  })

  it('şık karıştırma açıkken bile görselli soruların şıkları karıştırılmaz', async () => {
    const image = q(['A', 'B', 'C', 'D', 'E'])
    const text = q(['bir', 'iki', 'üç', 'dört', 'beş'])
    const id = await startAttempt({ courseId: 'c', title: 't', mode: 'karisik', instant: true, questions: [image, text], shuffleOptions: true })
    const a = (await db.attempts.get(id))!
    expect(a.optionOrder?.[image.id]).toBeUndefined()
    expect(a.optionOrder?.[text.id]).toHaveLength(5)
  })
})
