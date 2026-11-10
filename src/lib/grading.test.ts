import { describe, expect, it } from 'vitest'
import {
  compareOutput,
  gradeCode,
  gradeFill,
  gradeMcq,
  gradeOptical,
  gradeTf,
  netScore,
  normalizeText,
  tally,
} from './grading'

describe('normalizeText', () => {
  it('büyük-küçük harf ve boşluk farkını yok sayar', () => {
    expect(normalizeText('  İlk   Giren  ')).toBe(normalizeText('ilk giren'))
  })
  it('noktalı ve noktasız i farkını yok sayar', () => {
    expect(normalizeText('FIFO')).toBe(normalizeText('fifo'))
    expect(normalizeText('IŞIK')).toBe(normalizeText('ışık'))
  })
})

describe('gradeFill', () => {
  it('kabul edilen cevaplardan biri tutarsa doğru', () => {
    expect(gradeFill('ilk giren ilk çıkar', ['FIFO', 'İlk giren ilk çıkar'])).toBe('correct')
    expect(gradeFill('fifo', ['FIFO'])).toBe('correct')
  })
  it('tutmazsa yanlış, boşsa boş', () => {
    expect(gradeFill('lifo', ['FIFO'])).toBe('wrong')
    expect(gradeFill('   ', ['FIFO'])).toBe('blank')
    expect(gradeFill(undefined, ['FIFO'])).toBe('blank')
  })
  it('sayısal cevapta virgül ve toleransı kabul eder', () => {
    expect(gradeFill('3,14', ['3.14'])).toBe('correct')
    expect(gradeFill('3.0', ['3'])).toBe('correct')
    expect(gradeFill('3.15', ['3.14'], 0.02)).toBe('correct')
    expect(gradeFill('3.2', ['3.14'], 0.02)).toBe('wrong')
  })
})

describe('gradeMcq / gradeTf', () => {
  it('çoktan seçmeli', () => {
    expect(gradeMcq(2, 2)).toBe('correct')
    expect(gradeMcq(1, 2)).toBe('wrong')
    expect(gradeMcq(null, 2)).toBe('blank')
    expect(gradeMcq(0, 0)).toBe('correct')
  })
  it('doğru / yanlış', () => {
    expect(gradeTf(false, false)).toBe('correct')
    expect(gradeTf(true, false)).toBe('wrong')
    expect(gradeTf(undefined, true)).toBe('blank')
  })
})

describe('kod çıktısı', () => {
  it('satır sonu ve sondaki boşluk farkını yok sayar', () => {
    expect(compareOutput('120\r\n', '120')).toBe(true)
    expect(compareOutput('a  \nb\n\n', 'a\nb')).toBe(true)
    expect(compareOutput('a\nc', 'a\nb')).toBe(false)
    expect(compareOutput(' a', 'a')).toBe(false)
  })
  it('geçen test sayısına göre sonuç verir', () => {
    expect(gradeCode(3, 3)).toBe('correct')
    expect(gradeCode(1, 3)).toBe('partial')
    expect(gradeCode(0, 3)).toBe('wrong')
  })
})

describe('tally / netScore', () => {
  it('sonuçları sayar ve yüzde verir', () => {
    const t = tally(['correct', 'correct', 'wrong', 'blank', 'partial'])
    expect(t).toMatchObject({ correct: 2, wrong: 1, blank: 1, partial: 1, total: 5 })
    // kısmen doğru yarım sayılır: (2 + 0.5) / 5
    expect(t.percent).toBe(50)
  })
  it('boş listede yüzde 0', () => {
    expect(tally([]).percent).toBe(0)
  })
  it('net: N yanlış bir doğruyu götürür', () => {
    expect(netScore(10, 4, 4)).toBe(9)
    expect(netScore(10, 4, 0)).toBe(10)
    expect(netScore(1, 8, 4)).toBe(-1)
  })
})

describe('gradeOptical', () => {
  it('anahtarı olmayan soruları saymaz', () => {
    const t = gradeOptical([0, 1, null, 3], [0, 2, 1, null])
    expect(t).toMatchObject({ correct: 1, wrong: 1, blank: 1, total: 3 })
  })
})
