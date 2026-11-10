import { describe, expect, it } from 'vitest'
import { DAY, formatInterval, newFsrsState, previewDue, rateCard } from './scheduler'

const NOW = Date.UTC(2026, 10, 10, 9, 0, 0)

describe('scheduler', () => {
  it('yeni kart hemen tekrar edilebilir', () => {
    const s = newFsrsState(NOW)
    expect(s.due).toBe(NOW)
    expect(s.reps).toBe(0)
  })

  it('durum düz sayılardan oluşur (yedeğe yazılabilir)', () => {
    const s = rateCard(newFsrsState(NOW), 3, NOW)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
    expect(typeof s.due).toBe('number')
  })

  it('"Kolay" kartı günler sonraya, "Tekrar" dakikalar sonraya atar', () => {
    const easy = rateCard(newFsrsState(NOW), 4, NOW)
    const again = rateCard(newFsrsState(NOW), 1, NOW)
    expect(easy.due - NOW).toBeGreaterThanOrEqual(DAY)
    expect(again.due - NOW).toBeLessThan(DAY)
    expect(easy.due).toBeGreaterThan(again.due)
  })

  it('art arda "İyi" verildikçe aralık büyür', () => {
    let s = newFsrsState(NOW)
    let t = NOW
    const gaps: number[] = []
    for (let i = 0; i < 5; i++) {
      s = rateCard(s, 3, t)
      gaps.push(s.due - t)
      t = s.due
    }
    expect(gaps[4]).toBeGreaterThan(gaps[1])
    expect(s.reps).toBe(5)
  })

  it('unutulan kartın tekrar sayacı artar', () => {
    let s = newFsrsState(NOW)
    s = rateCard(s, 4, NOW)
    s = rateCard(s, 1, s.due)
    expect(s.lapses).toBe(1)
  })

  it('önizleme dört puan için sıralı tarihler verir', () => {
    const p = previewDue(newFsrsState(NOW), NOW)
    expect(p[1]).toBeLessThanOrEqual(p[2])
    expect(p[2]).toBeLessThanOrEqual(p[3])
    expect(p[3]).toBeLessThanOrEqual(p[4])
  })

  it('aralığı Türkçe yazar', () => {
    expect(formatInterval(5 * 60_000)).toBe('5 dk')
    expect(formatInterval(3 * 3_600_000)).toBe('3 sa')
    expect(formatInterval(4 * DAY)).toBe('4 gün')
    expect(formatInterval(60 * DAY)).toBe('2 ay')
  })
})
