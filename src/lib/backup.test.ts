import { describe, expect, it } from 'vitest'
import { StudyDB, deleteCard, deleteCourse, patch, setSetting, stamp } from '../db/db'
import { TABLES } from '../db/schema'
import { BackupError, backupFileName, exportBackup, importBackup, readManifest } from './backup'
import { importContent, parseContent } from './content'
import { rateCard } from './scheduler'

let n = 0
const fresh = () => new StudyDB(`backup-test-${n++}`)

const PDF_BYTES = new Uint8Array(70_000).map((_, i) => (i * 31 + 7) % 256)

async function seed(d: StudyDB) {
  const course = stamp({ name: 'Veri Yapıları', code: 'BM201', color: '#2747d4', archived: false })
  await d.courses.add(course)
  await importContent(
    d,
    parseContent(
      JSON.stringify({
        decks: [{ title: 'Ağaçlar', cards: [{ front: 'AVL?', back: 'dengeli', topic: 'Ağaçlar' }, { front: 'B?', back: 'b' }] }],
        questionSets: [
          {
            title: '2024 Vize',
            year: 2024,
            questions: [
              { type: 'mcq', prompt: 'S1', options: ['a', 'b'], answer: 0 },
              { type: 'code', prompt: 'S2', tests: [{ stdin: '', expected: '1\n' }] },
            ],
          },
        ],
      }),
    ),
    course.id,
  )
  const blob = stamp({ mime: 'application/pdf', data: PDF_BYTES.buffer.slice(0) as ArrayBuffer })
  await d.blobs.add(blob)
  const file = stamp({
    courseId: course.id,
    kind: 'sunum' as const,
    title: 'Hafta 1',
    mime: 'application/pdf',
    size: PDF_BYTES.byteLength,
    blobId: blob.id,
    lastPage: 5,
  })
  await d.files.add(file)
  await d.bookmarks.add(stamp({ fileId: file.id, courseId: course.id, page: 3, note: 'önemli' }))

  const [q] = await d.questions.toArray()
  const attempt = stamp({
    courseId: course.id,
    title: '2024 Vize',
    mode: 'calisma' as const,
    instant: true,
    questionIds: [q.id],
    currentIndex: 0,
    startedAt: 1,
    finishedAt: 2,
    durationSec: 60,
    correct: 1,
    wrong: 0,
    blank: 0,
    partial: 0,
  })
  await d.attempts.add(attempt)
  await d.answers.add(
    stamp({ attemptId: attempt.id, questionId: q.id, courseId: course.id, type: 'mcq' as const, response: 0, result: 'correct' as const }),
  )
  const [card] = await d.cards.toArray()
  const s = rateCard(card.fsrs, 3, Date.now())
  await patch(d.cards, card.id, { fsrs: s, due: s.due, starred: true })
  await d.reviews.add(stamp({ cardId: card.id, courseId: course.id, rating: 3, mode: 'fsrs' as const, at: Date.now() }))
  await d.exams.add(stamp({ courseId: course.id, type: 'vize' as const, date: Date.UTC(2026, 10, 20) }))
  await d.snippets.add(stamp({ courseId: course.id, title: 'deneme', code: 'print(1)', stdin: '', pythonVersion: '3.9' }))
  await d.studySessions.add(stamp({ courseId: course.id, kind: 'pomodoro' as const, startedAt: 1, durationSec: 1500 }))
  await d.notes.add(stamp({ courseId: course.id, title: 'Formüller', body: '$O(n \log n)$', pinned: true }))
  await setSetting(d, 'pythonVersion', '3.9')
  return { course, file, blob, card }
}

async function dump(d: StudyDB) {
  const out: Record<string, unknown[]> = {}
  for (const t of TABLES) {
    const rows = (await d.table(t).toArray()) as { id: string; data?: ArrayBuffer }[]
    out[t] = rows
      .map((r) => (r.data ? { ...r, data: Array.from(new Uint8Array(r.data)) } : r))
      .sort((a, b) => a.id.localeCompare(b.id))
  }
  return out
}

describe('yedek gidiş-dönüş', () => {
  it('dışa aktar → boş veritabanına içe aktar: her şey birebir aynı', async () => {
    const a = fresh()
    await seed(a)
    const file = await exportBackup(a)

    const m = await readManifest(file)
    expect(m).toMatchObject({ scope: 'full', includesFiles: true, includesProgress: true, courseNames: ['Veri Yapıları'] })
    expect(m.counts.cards).toBe(2)
    expect(m.counts.notes).toBe(1)
    expect(m.blobBytes).toBe(PDF_BYTES.byteLength)

    const b = fresh()
    await importBackup(b, file, 'replace')
    expect(await dump(b)).toEqual(await dump(a))
  })

  it('"Değiştir" cihazdaki eski veriyi siler', async () => {
    const a = fresh()
    await seed(a)
    const file = await exportBackup(a)
    const b = fresh()
    await seed(b) // farklı kimliklerle başka veri
    await importBackup(b, file, 'replace')
    expect(await dump(b)).toEqual(await dump(a))
  })

  it('PDF’siz yedek dosya kayıtlarını içermez; geri yüklerken cihazdaki PDF’lere dokunmaz', async () => {
    const a = fresh()
    const { file: f } = await seed(a)
    const light = await exportBackup(a, { includeFiles: false })
    const m = await readManifest(light)
    expect(m.includesFiles).toBe(false)
    expect(m.counts.files).toBeUndefined()
    expect(light.size).toBeLessThan(PDF_BYTES.byteLength)

    await importBackup(a, light, 'replace')
    expect(await a.files.get(f.id)).toBeTruthy()
    expect(await a.blobs.count()).toBe(1)
  })

  it('tek ders, ilerleme hariç: geçmiş gitmez, kartlar sıfırdan başlar', async () => {
    const a = fresh()
    const { course } = await seed(a)
    const other = stamp({ name: 'Başka Ders', color: '#000', archived: false })
    await a.courses.add(other)
    await a.decks.add(stamp({ courseId: other.id, title: 'x' }))

    const file = await exportBackup(a, { courseId: course.id, includeProgress: false })
    const b = fresh()
    await importBackup(b, file, 'merge')
    expect((await b.courses.toArray()).map((c) => c.name)).toEqual(['Veri Yapıları'])
    expect(await b.decks.count()).toBe(1)
    expect(await b.attempts.count()).toBe(0)
    expect(await b.reviews.count()).toBe(0)
    expect(await b.files.count()).toBe(1)
    const cards = await b.cards.toArray()
    expect(cards.every((c) => c.fsrs.reps === 0 && !c.starred)).toBe(true)
    expect((await b.files.toArray())[0].lastPage).toBeUndefined()
  })
})

describe('yedek birleştirme', () => {
  it('iki cihazdaki çalışmayı tek veride toplar; yeni olan kazanır', async () => {
    const pc = fresh()
    const { card, course } = await seed(pc)
    const phone = fresh()
    await importBackup(phone, await exportBackup(pc), 'replace')

    // Telefonda: bir kart düzenlenir, yeni bir deneme çözülür.
    await new Promise((r) => setTimeout(r, 5))
    await patch(phone.cards, card.id, { back: 'telefonda düzeltildi' })
    await phone.attempts.add(
      stamp({
        courseId: course.id,
        title: 'telefon denemesi',
        mode: 'sinav' as const,
        instant: false,
        questionIds: [],
        currentIndex: 0,
        startedAt: 5,
        durationSec: 10,
        correct: 0,
        wrong: 0,
        blank: 0,
        partial: 0,
      }),
    )
    // Bilgisayarda: yeni bir sınav tarihi eklenir.
    await pc.exams.add(stamp({ courseId: course.id, type: 'final' as const, date: Date.UTC(2027, 0, 10) }))

    const r = await importBackup(pc, await exportBackup(phone), 'merge')
    expect(r.added).toBe(1)
    expect(r.updated).toBe(1)
    expect((await pc.cards.get(card.id))!.back).toBe('telefonda düzeltildi')
    expect(await pc.attempts.count()).toBe(2)
    expect(await pc.exams.count()).toBe(2)
    expect(await pc.blobs.count()).toBe(1)
  })

  it('eski yedek yeni veriyi ezmez', async () => {
    const pc = fresh()
    const { card } = await seed(pc)
    const old = await exportBackup(pc)
    await new Promise((r) => setTimeout(r, 5))
    await patch(pc.cards, card.id, { back: 'sonradan düzeltildi' })
    await importBackup(pc, old, 'merge')
    expect((await pc.cards.get(card.id))!.back).toBe('sonradan düzeltildi')
  })

  it('silinen kayıt birleştirmede geri gelmez ve diğer cihazda da silinir', async () => {
    const pc = fresh()
    const { card } = await seed(pc)
    const before = await exportBackup(pc)
    const phone = fresh()
    await importBackup(phone, before, 'replace')

    await new Promise((r) => setTimeout(r, 5))
    await deleteCard(pc, card.id)

    // Eski yedek geri birleştirilse de silinen kart dönmez.
    await importBackup(pc, before, 'merge')
    expect(await pc.cards.get(card.id)).toBeUndefined()

    // Silme bilgisi telefona taşınır.
    const r = await importBackup(phone, await exportBackup(pc), 'merge')
    expect(await phone.cards.get(card.id)).toBeUndefined()
    expect(r.deleted).toBeGreaterThanOrEqual(1)
    expect(await phone.reviews.where('cardId').equals(card.id).count()).toBe(0)
  })
})

describe('ders silme', () => {
  it('dersin notlarını da siler ve silme izi bırakır', async () => {
    const d = fresh()
    const { course } = await seed(d)
    const [note] = await d.notes.toArray()
    await deleteCourse(d, course.id)
    expect(await d.notes.count()).toBe(0)
    expect(await d.tombstones.get(note.id)).toMatchObject({ table: 'notes' })
  })
})

describe('hatalı dosyalar', () => {
  it('yedek olmayan dosyayı anlaşılır hatayla reddeder', async () => {
    const d = fresh()
    await expect(importBackup(d, new Blob(['merhaba']), 'merge')).rejects.toBeInstanceOf(BackupError)
  })

  it('daha yeni şema sürümünü reddeder ve veriye dokunmaz', async () => {
    const { BlobWriter, TextReader, ZipWriter } = await import('@zip.js/zip.js')
    const zip = new ZipWriter(new BlobWriter())
    await zip.add('manifest.json', new TextReader(JSON.stringify({ format: 'studyapp-backup', schemaVersion: 99 })))
    await zip.add('data.json', new TextReader('{"tables":{}}'))
    const file = await zip.close()
    const d = fresh()
    await seed(d)
    await expect(importBackup(d, file, 'replace')).rejects.toThrow(/daha yeni/)
    expect(await d.courses.count()).toBe(1)
  })
})

describe('backupFileName', () => {
  it('tarihli dosya adı üretir', () => {
    const at = new Date(2026, 10, 10)
    expect(backupFileName('full', undefined, at)).toBe('ders-yedek-2026-11-10.studyapp')
    expect(backupFileName('course', 'Veri Yapıları', at)).toBe('ders-veri-yapıları-2026-11-10.studyapp')
  })
})
