import { describe, expect, it } from 'vitest'
import { plainText } from './format'

describe('plainText', () => {
  it('gömülü görselleri kısaltır, boşlukları sadeleştirir', () => {
    expect(plainText('Soru kökü\n\n![Final, 3. sayfa](data:image/jpeg;base64,/9j/AAAA)')).toBe('Soru kökü [görsel]')
    expect(plainText('a ![](https://x.y/z.png) b')).toBe('a [görsel] b')
  })
  it('görselsiz metne dokunmaz', () => {
    expect(plainText('  $x^2$   ve [bağlantı](https://a.b)  ')).toBe('$x^2$ ve [bağlantı](https://a.b)')
  })
})
