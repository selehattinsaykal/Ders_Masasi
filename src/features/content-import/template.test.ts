import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countContent, parseContent } from '../../lib/content'
import { EXAMPLE_JSON } from './template'

describe('şablondaki örnek', () => {
  it('hatasız okunur ve her soru tipinden birer örnek içerir', () => {
    const p = parseContent(EXAMPLE_JSON)
    expect(p.fatal).toBeUndefined()
    expect(p.errors).toEqual([])
    expect(countContent(p)).toEqual({ decks: 1, cards: 1, sets: 1, questions: 5 })
    expect(p.sets[0].questions.map((q) => q.type)).toEqual(['mcq', 'tf', 'fill', 'open', 'code'])
    expect(p.sets[0].questions[0].answerIndex).toBe(1)
    expect(p.sets[0].questions[4].tests).toHaveLength(2)
  })

  it('examples/ornek-icerik.json şablonla aynıdır', () => {
    const file = JSON.parse(readFileSync('examples/ornek-icerik.json', 'utf8'))
    expect(file).toEqual(JSON.parse(EXAMPLE_JSON))
  })
})
