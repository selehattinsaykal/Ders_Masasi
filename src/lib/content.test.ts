import { beforeEach, describe, expect, it } from 'vitest'
import { StudyDB, stamp } from '../db/db'
import { countContent, importContent, parseContent } from './content'
import { rateCard } from './scheduler'

const SAMPLE = {
  format: 'studyapp-content',
  version: 1,
  course: 'Veri Yapıları',
  decks: [
    {
      title: 'Ağaçlar',
      cards: [
        { front: 'AVL nedir?', back: 'Dengeli ikili arama ağacı', hint: 'denge', topic: 'Ağaçlar' },
        { front: 'Yığın ilkesi?', back: 'LIFO' },
      ],
    },
  ],
  questionSets: [
    {
      title: '2024 Güz Vize',
      kind: 'cikmis',
      year: 2024,
      term: 'Güz',
      examType: 'vize',
      questions: [
        { type: 'mcq', prompt: 'S1', options: ['a', 'b', 'c', 'd'], answer: 2, topic: 'Yığın' },
        { type: 'tf', prompt: 'S2', answer: false },
        { type: 'fill', prompt: 'S3 ___', answers: ['FIFO'] },
        { type: 'open', prompt: 'S4', solution: 'çözüm' },
        {
          type: 'code',
          prompt: 'S5',
          language: 'python',
          pythonVersion: '3.9',
          starter: 'def f(n):\n    pass',
          tests: [{ stdin: '5\n', expected: '120\n' }],
        },
      ],
    },
  ],
}

describe('parseContent', () => {
  it('tam biçimi okur', () => {
    const p = parseContent(JSON.stringify(SAMPLE))
    expect(p.fatal).toBeUndefined()
    expect(p.errors).toEqual([])
    expect(p.course).toBe('Veri Yapıları')
    expect(countContent(p)).toEqual({ decks: 1, cards: 2, sets: 1, questions: 5 })
    const [mcq, tf, fill, open, code] = p.sets[0].questions
    expect(mcq.answerIndex).toBe(2)
    expect(tf.answerBool).toBe(false)
    expect(fill.answers).toEqual(['FIFO'])
    expect(open.solution).toBe('çözüm')
    expect(code.pythonVersion).toBe('3.9')
    expect(code.starter).toBe('def f(n):\n    pass')
    expect(code.tests).toEqual([{ stdin: '5\n', expected: '120\n' }])
    expect(p.sets[0]).toMatchObject({ kind: 'cikmis', year: 2024, examType: 'vize' })
  })

  it('şık harfini ve şık metnini cevap olarak kabul eder', () => {
    const p = parseContent(
      JSON.stringify({
        questions: [
          { type: 'mcq', prompt: 'a', options: ['x', 'y', 'z'], answer: 'B' },
          { type: 'mcq', prompt: 'b', options: ['x', 'y', 'z'], answer: 'z' },
        ],
      }),
    )
    expect(p.sets[0].questions.map((q) => q.answerIndex)).toEqual([1, 2])
  })

  it('hatalı öğeyi atlar, nedenini söyler, kalanını alır', () => {
    const p = parseContent(
      JSON.stringify({
        decks: [{ title: 'D', cards: [{ front: 'yalnızca ön' }, { front: 'a', back: 'b' }] }],
        questionSets: [
          {
            title: 'T',
            questions: [
              { type: 'mcq', prompt: 'x', options: ['a', 'b'], answer: 5 },
              { type: 'tf', prompt: 'y', answer: true },
              { type: 'bilinmeyen', prompt: 'z' },
            ],
          },
        ],
      }),
    )
    expect(countContent(p)).toMatchObject({ cards: 1, questions: 1 })
    expect(p.errors).toHaveLength(3)
    expect(p.errors[0]).toContain('D › 1. kart')
    expect(p.errors[0]).toContain('back')
    expect(p.errors[1]).toContain('T › 1. soru')
    expect(p.errors[1]).toContain('şıklarda yok')
    expect(p.errors[2]).toContain('tanınmadı')
  })

  it('yalın kart listesini ve kod çiti içindeki JSON’u kabul eder', () => {
    const p = parseContent('İşte kartlar:\n```json\n[{"front":"a","back":"b"}]\n```')
    expect(countContent(p)).toMatchObject({ decks: 1, cards: 1 })
  })

  it('tip yazılmamışsa alanlardan çıkarır', () => {
    const p = parseContent(JSON.stringify([{ prompt: 'q', options: ['a', 'b'], answer: 0 }, { prompt: 'r', answer: true }]))
    expect(p.sets[0].questions.map((q) => q.type)).toEqual(['mcq', 'tf'])
  })

  it('bozuk JSON için anlaşılır hata verir', () => {
    expect(parseContent('{"decks": [').fatal).toContain('Geçerli bir JSON değil')
    expect(parseContent('').fatal).toBe('Dosya boş.')
    expect(parseContent('{"foo": 1}').fatal).toContain('decks')
  })
})

describe('importContent', () => {
  let d: StudyDB
  let courseId: string
  let n = 0

  beforeEach(async () => {
    d = new StudyDB(`content-test-${n++}`)
    const course = stamp({ name: 'Veri Yapıları', color: '#2747d4', archived: false })
    courseId = course.id
    await d.courses.add(course)
  })

  it('kartları, soruları ve konuları derse ekler', async () => {
    const r = await importContent(d, parseContent(JSON.stringify(SAMPLE)), courseId)
    expect(r).toMatchObject({ cardsAdded: 2, questionsAdded: 5 })
    expect(await d.decks.count()).toBe(1)
    expect(await d.cards.count()).toBe(2)
    expect(await d.questions.count()).toBe(5)
    const topics = (await d.topics.toArray()).map((t) => t.name).sort()
    expect(topics).toEqual(['Ağaçlar', 'Yığın'])
    const qs = await d.questions.orderBy('id').toArray()
    expect(new Set(qs.map((q) => q.order))).toEqual(new Set([0, 1, 2, 3, 4]))
  })

  it('aynı dosya ikinci kez gelince tekrar eklemez', async () => {
    const parsed = parseContent(JSON.stringify(SAMPLE))
    await importContent(d, parsed, courseId)
    const r = await importContent(d, parsed, courseId)
    expect(r).toMatchObject({ cardsAdded: 0, cardsSkipped: 2, questionsAdded: 0, questionsSkipped: 5 })
    expect(await d.decks.count()).toBe(1)
    expect(await d.questionSets.count()).toBe(1)
    expect(await d.cards.count()).toBe(2)
  })

  it('güncelleme modunda içeriği değiştirir ama ilerlemeyi korur', async () => {
    await importContent(d, parseContent(JSON.stringify(SAMPLE)), courseId)
    const card = (await d.cards.toArray()).find((c) => c.front === 'AVL nedir?')!
    const studied = rateCard(card.fsrs, 4, Date.now())
    await d.cards.update(card.id, { fsrs: studied, due: studied.due })

    const changed = structuredClone(SAMPLE)
    changed.decks[0].cards[0].back = 'Yeni arka yüz'
    const r = await importContent(d, parseContent(JSON.stringify(changed)), courseId, 'update')
    expect(r.cardsUpdated).toBe(2)
    const after = (await d.cards.get(card.id))!
    expect(after.back).toBe('Yeni arka yüz')
    expect(after.fsrs.reps).toBe(1)
    expect(after.due).toBe(studied.due)
  })
})
