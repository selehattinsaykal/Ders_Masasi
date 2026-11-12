import { describe, expect, it } from 'vitest'
import { buildMistakesPrompt } from './template'

describe('buildMistakesPrompt', () => {
  const p = buildMistakesPrompt({
    course: 'Veri Yapıları',
    count: 10,
    title: 'Yanlışlarıma benzer',
    items: [
      { type: 'mcq', prompt: 'Yığın hangi ilkeyle çalışır?', options: ['FIFO', 'LIFO'], answerIndex: 1, given: 0, topic: 'Yığın' },
      { type: 'tf', prompt: 'İkili arama sırasız dizide çalışır.', answerBool: false, given: true, topic: 'Arama' },
      { type: 'code', prompt: 'Faktöriyel ![şekil](data:image/png;base64,AAAA)', solution: 'print(1)', pythonVersion: '3.9', given: 'print(2)' },
    ],
  })

  it('her yanlışı doğru cevap ve verilen cevapla anlatır', () => {
    expect(p).toContain('Veri Yapıları')
    expect(p).toContain('10 yeni soru')
    expect(p).toContain('Doğru cevap: B')
    expect(p).toContain('Benim cevabım: A')
    expect(p).toContain('Benim cevabım: Doğru')
    expect(p).toContain('Zayıf olduğum konular: Yığın, Arama')
  })

  it('kod sürümünü ve test başlığını belirtir, gömülü görseli çıkarır', () => {
    expect(p).toContain('Python 3.9')
    expect(p).toContain('"title": "Yanlışlarıma benzer"')
    expect(p).toContain('[görsel]')
    expect(p).not.toContain('base64')
    expect(p).toContain('"kind": "calisma"')
  })
})
