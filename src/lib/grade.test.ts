import { describe, expect, it } from 'vitest'
import type { GradingScheme } from '../db/schema'
import { evaluateGrade } from './grade'

const scheme = (vize?: number, final?: number, extra: Partial<GradingScheme> = {}): GradingScheme => ({
  parts: [
    { id: 'v', name: 'Vize', weight: 40, score: vize },
    { id: 'f', name: 'Final', weight: 60, score: final },
  ],
  passing: 50,
  ...extra,
})

describe('evaluateGrade', () => {
  it('vizeye göre finalde gereken notu hesaplar', () => {
    // 40*0.4 = 16; (50 - 16) / 0.6 = 56.67 → 57
    const r = evaluateGrade(scheme(40))
    expect(r.status).toBe('need')
    expect(r.needed).toBe(57)
    expect(r.remaining).toEqual(['Final'])
  })

  it('tam sayıya yukarı yuvarlar ama gereksiz yere artırmaz', () => {
    // 50*0.4 = 20; (50-20)/0.6 = 50 tam
    expect(evaluateGrade(scheme(50)).needed).toBe(50)
  })

  it('final barajı varsa gereken not onun altına inmez', () => {
    const r = evaluateGrade(scheme(100, undefined, { finalMin: 50 }))
    // ortalama için 17 yeter ama baraj 50
    expect(r.needed).toBe(50)
    expect(r.neededForAverage).toBe(17)
  })

  it('imkânsız durumu bildirir', () => {
    const r = evaluateGrade(scheme(0, undefined, { passing: 70 }))
    // (70 - 0) / 0.6 = 116.7
    expect(r.status).toBe('impossible')
    expect(r.needed).toBe(117)
  })

  it('tüm notlar girilince ortalamayı ve sonucu verir', () => {
    expect(evaluateGrade(scheme(40, 60))).toMatchObject({ status: 'passed', average: 52 })
    expect(evaluateGrade(scheme(40, 50))).toMatchObject({ status: 'failed', average: 46 })
  })

  it('ortalama yetse de final barajının altında kalınca kalır', () => {
    const r = evaluateGrade(scheme(100, 40, { finalMin: 50 }))
    expect(r.average).toBe(64)
    expect(r.status).toBe('failed')
    expect(r.reason).toContain('Final')
  })

  it('birden çok sınav kalmışsa hepsinden aynı notu varsayar', () => {
    const r = evaluateGrade({
      parts: [
        { id: 'q', name: 'Quiz', weight: 20, score: 80 },
        { id: 'v', name: 'Vize', weight: 30 },
        { id: 'f', name: 'Final', weight: 50 },
      ],
      passing: 60,
    })
    // 16 puan var; (60 - 16) / 0.8 = 55
    expect(r).toMatchObject({ status: 'need', needed: 55, remaining: ['Vize', 'Final'] })
  })

  it('hiç sınav kalmadan geçmek garantiyse bunu söyler', () => {
    const r = evaluateGrade({
      parts: [
        { id: 'v', name: 'Vize', weight: 60, score: 100 },
        { id: 'f', name: 'Final', weight: 40 },
      ],
      passing: 50,
    })
    expect(r.status).toBe('safe')
    expect(r.needed).toBe(0)
  })

  it('ağırlıklar 100 etmiyorsa uyarır', () => {
    const r = evaluateGrade({ parts: [{ id: 'v', name: 'Vize', weight: 40 }], passing: 50 })
    expect(r.status).toBe('invalid')
    expect(r.reason).toContain('40')
  })
})
