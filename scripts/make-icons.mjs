// public/icon.svg dosyasından PWA simgelerini üretir: node scripts/make-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const svg = readFileSync(join(pub, 'icon.svg'))

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(join(pub, 'icon-192.png'))
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(join(pub, 'icon-512.png'))
// Maskelenebilir simge: içerik güvenli alanda kalsın diye kenar boşluğu eklenir.
await sharp(svg, { density: 300 })
  .resize(384, 384)
  .extend({ top: 64, bottom: 64, left: 64, right: 64, background: '#2747d4' })
  .png()
  .toFile(join(pub, 'icon-maskable-512.png'))
console.log('Simgeler üretildi.')
