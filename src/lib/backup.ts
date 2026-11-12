// Tam yedek: tüm veriyi tek bir .studyapp (zip) dosyasına yazar ve geri okur.
//   manifest.json  şema sürümü, tarih, sayımlar
//   data.json      tüm tablolar (ikili veri hariç)
//   blobs/<id>     PDF ve diğer ikili dosyalar, sıkıştırılmadan
import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
  configure,
  type Entry,
} from '@zip.js/zip.js'
import type { StudyDB } from '../db/db'
import { SCHEMA_VERSION, TABLES, type BlobRec, type Card, type Question, type StudyFile, type TableName, type Tombstone } from '../db/schema'
import { newFsrsState } from './scheduler'

// Zip işlemi ana iş parçacığında: ek worker dosyası gerekmez, çevrimdışı da çalışır.
configure({ useWebWorkers: false })

export interface Manifest {
  app: 'ders-masasi'
  format: 'studyapp-backup'
  schemaVersion: number
  exportedAt: number
  scope: 'full' | 'course'
  includesFiles: boolean
  includesProgress: boolean
  courseNames: string[]
  counts: Record<string, number>
  blobBytes: number
}

export interface ExportOptions {
  /** Yalnızca bu dersi aktar (arkadaşla paylaşmak için). */
  courseId?: string
  /** PDF'leri dahil et. */
  includeFiles?: boolean
  /** Deneme geçmişi, kart zamanlaması, yıldızlar, notlar. */
  includeProgress?: boolean
}

type Rows = Record<string, Record<string, unknown>[]>

const PROGRESS_TABLES: TableName[] = ['attempts', 'answers', 'reviews', 'studySessions', 'bookmarks']
const FILE_TABLES: TableName[] = ['files', 'blobs', 'bookmarks']

async function collect(d: StudyDB, o: Required<Omit<ExportOptions, 'courseId'>> & { courseId?: string }) {
  const rows: Rows = {}
  for (const t of TABLES) {
    if (t === 'blobs') continue
    if (!o.includeFiles && FILE_TABLES.includes(t)) continue
    if (!o.includeProgress && PROGRESS_TABLES.includes(t)) continue
    if (o.courseId && (t === 'settings' || t === 'tombstones')) continue
    let list = (await d.table(t).toArray()) as Record<string, unknown>[]
    if (o.courseId) list = list.filter((r) => (t === 'courses' ? r.id === o.courseId : r.courseId === o.courseId))
    rows[t] = list
  }
  if (!o.includeProgress) {
    const now = Date.now()
    rows.cards = (rows.cards as unknown as Card[] | undefined ?? []).map((c) => ({
      ...c,
      starred: false,
      due: now,
      fsrs: newFsrsState(now),
    })) as never
    rows.questions = (rows.questions as unknown as Question[] | undefined ?? []).map((q) => {
      const { note: _note, ...rest } = q
      return { ...rest, starred: false }
    }) as never
    if (rows.files)
      rows.files = (rows.files as unknown as StudyFile[]).map((f) => {
        const { lastPage: _lastPage, ...rest } = f
        return rest
      }) as never
    if (rows.topics) rows.topics = rows.topics.map((t) => ({ ...t, status: 'todo' }))
  }
  return rows
}

export async function exportBackup(
  d: StudyDB,
  options: ExportOptions = {},
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const o = { includeFiles: true, includeProgress: true, ...options }
  const rows = await collect(d, o)

  const blobIds = o.includeFiles ? ((rows.files ?? []) as unknown as StudyFile[]).map((f) => f.blobId) : []
  const blobMeta: Record<string, unknown>[] = []
  const zip = new ZipWriter(new BlobWriter('application/zip'))
  let blobBytes = 0
  let done = 0
  for (const id of blobIds) {
    const rec = await d.blobs.get(id)
    onProgress?.(++done, blobIds.length)
    if (!rec) continue
    const { data, ...meta } = rec
    blobMeta.push({ ...meta, size: data.byteLength })
    blobBytes += data.byteLength
    await zip.add(`blobs/${id}`, new Uint8ArrayReader(new Uint8Array(data)), { level: 0 })
  }
  if (o.includeFiles) rows.blobs = blobMeta

  const courses = (rows.courses ?? []) as { name: string }[]
  const manifest: Manifest = {
    app: 'ders-masasi',
    format: 'studyapp-backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    scope: o.courseId ? 'course' : 'full',
    includesFiles: o.includeFiles,
    includesProgress: o.includeProgress,
    courseNames: courses.map((c) => c.name),
    counts: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])),
    blobBytes,
  }
  await zip.add('data.json', new TextReader(JSON.stringify({ tables: rows })), { level: 6 })
  await zip.add('manifest.json', new TextReader(JSON.stringify(manifest, null, 2)), { level: 6 })
  return zip.close()
}

export class BackupError extends Error {}

interface Opened {
  manifest: Manifest
  entries: Map<string, Entry>
  close: () => Promise<void>
}

async function readText(entry: Entry): Promise<string> {
  if (entry.directory) throw new BackupError('Yedek dosyası bozuk.')
  return entry.getData(new TextWriter())
}

async function open(file: Blob): Promise<Opened> {
  let reader: ZipReader<Blob>
  let list: Entry[]
  try {
    reader = new ZipReader(new BlobReader(file))
    list = await reader.getEntries()
  } catch {
    throw new BackupError('Bu dosya bir yedek dosyası değil ya da bozulmuş.')
  }
  const entries = new Map(list.map((e) => [e.filename, e]))
  const m = entries.get('manifest.json')
  if (!m || !entries.has('data.json')) {
    await reader.close()
    throw new BackupError('Bu dosya Ders Masası yedeği değil (manifest bulunamadı).')
  }
  let manifest: Manifest
  try {
    manifest = JSON.parse(await readText(m))
  } catch {
    await reader.close()
    throw new BackupError('Yedeğin manifest dosyası okunamadı.')
  }
  if (manifest.format !== 'studyapp-backup') {
    await reader.close()
    throw new BackupError('Bu dosya Ders Masası yedeği değil.')
  }
  if (manifest.schemaVersion > SCHEMA_VERSION) {
    await reader.close()
    throw new BackupError('Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelle.')
  }
  return { manifest, entries, close: () => reader.close() }
}

/** İçe aktarmadan önce gösterilecek özet. */
export async function readManifest(file: Blob): Promise<Manifest> {
  const o = await open(file)
  await o.close()
  return o.manifest
}

/** Eski şema sürümlerindeki veriyi güncel şemaya taşır. 1 → 2: yalnızca notlar tablosu eklendi, dönüşüm gerekmez. */
function migrate(rows: Rows, _from: number): Rows {
  return rows
}

export type ImportMode = 'replace' | 'merge'

export interface BackupReport {
  added: number
  updated: number
  skipped: number
  deleted: number
}

const CHUNK = 500

export async function importBackup(
  d: StudyDB,
  file: Blob,
  mode: ImportMode,
  onProgress?: (done: number, total: number) => void,
): Promise<BackupReport> {
  const { manifest, entries, close } = await open(file)
  const report: BackupReport = { added: 0, updated: 0, skipped: 0, deleted: 0 }
  try {
    let rows: Rows
    try {
      rows = migrate(JSON.parse(await readText(entries.get('data.json')!)).tables, manifest.schemaVersion)
    } catch {
      throw new BackupError('Yedeğin veri dosyası okunamadı.')
    }
    const blobMeta = (rows.blobs ?? []) as unknown as (Omit<BlobRec, 'data'> & { size: number })[]
    delete rows.blobs
    const present = Object.keys(rows).filter((t) => (TABLES as readonly string[]).includes(t)) as TableName[]

    const readBlob = async (id: string): Promise<ArrayBuffer | null> => {
      const e = entries.get(`blobs/${id}`)
      if (!e || e.directory) return null
      const bytes = await e.getData(new Uint8ArrayWriter())
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    }

    if (mode === 'replace') {
      await d.transaction('rw', d.tables, async () => {
        for (const t of present) await d.table(t).clear()
        if (manifest.includesFiles) await d.blobs.clear()
        // PDF'siz yedek geri yüklenirken silme izleri de sıfırlanır.
        if (!present.includes('tombstones')) await d.tombstones.clear()
        for (const t of present) {
          const list = rows[t]
          for (let i = 0; i < list.length; i += CHUNK) await d.table(t).bulkPut(list.slice(i, i + CHUNK))
          report.added += list.length
        }
      })
      let done = 0
      for (const meta of blobMeta) {
        const data = await readBlob(meta.id)
        onProgress?.(++done, blobMeta.length)
        if (!data) continue
        const { size: _size, ...rest } = meta
        await d.blobs.put({ ...rest, data })
        report.added++
      }
      if (!manifest.includesFiles) await dropOrphanFiles(d)
      return report
    }

    // Birleştir: yeni olan kazanır; silinmiş olan geri gelmez.
    const localTombs = new Map((await d.tombstones.toArray()).map((t) => [t.id, t]))
    const fileTombs = (rows.tombstones ?? []) as unknown as Tombstone[]

    await d.transaction('rw', d.tables, async () => {
      for (const t of present) {
        if (t === 'tombstones') continue
        const table = d.table(t)
        const incoming = rows[t] as { id: string; updatedAt?: number }[]
        for (let i = 0; i < incoming.length; i += CHUNK) {
          const part = incoming.slice(i, i + CHUNK)
          const local = (await table.bulkGet(part.map((r) => r.id))) as ({ updatedAt?: number } | undefined)[]
          const toPut: unknown[] = []
          part.forEach((row, j) => {
            const tomb = localTombs.get(row.id)
            if (tomb && tomb.deletedAt >= (row.updatedAt ?? 0)) return void report.skipped++
            const mine = local[j]
            if (!mine) {
              toPut.push(row)
              report.added++
            } else if ((row.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
              toPut.push(row)
              report.updated++
            } else report.skipped++
          })
          if (toPut.length) await table.bulkPut(toPut)
        }
      }

      // Diğer cihazda silinenleri burada da sil (burada sonradan değiştirilmediyse).
      for (const tomb of fileTombs) {
        if (!(TABLES as readonly string[]).includes(tomb.table)) continue
        const mine = (await d.table(tomb.table).get(tomb.id)) as { updatedAt?: number } | undefined
        if (mine && (mine.updatedAt ?? 0) <= tomb.deletedAt) {
          await d.table(tomb.table).delete(tomb.id)
          report.deleted++
        }
        const known = localTombs.get(tomb.id)
        if (!known || known.deletedAt < tomb.deletedAt) await d.tombstones.put(tomb)
      }
    })

    let done = 0
    for (const meta of blobMeta) {
      onProgress?.(++done, blobMeta.length)
      if (localTombs.has(meta.id) || (await d.blobs.get(meta.id))) continue
      const data = await readBlob(meta.id)
      if (!data) continue
      const { size: _size, ...rest } = meta
      await d.blobs.put({ ...rest, data })
    }
    await dropOrphanFiles(d)
    return report
  } finally {
    await close()
  }
}

/** Dersi ya da ikili verisi kalmamış dosya kayıtlarını temizler. */
async function dropOrphanFiles(d: StudyDB): Promise<void> {
  const courseIds = new Set(await d.courses.toCollection().primaryKeys())
  const blobIds = new Set(await d.blobs.toCollection().primaryKeys())
  const files = await d.files.toArray()
  const bad = files.filter((f) => !courseIds.has(f.courseId) || !blobIds.has(f.blobId))
  if (!bad.length) return
  await d.files.bulkDelete(bad.map((f) => f.id))
  const live = new Set(files.filter((f) => !bad.includes(f)).map((f) => f.blobId))
  await d.blobs.bulkDelete([...blobIds].filter((id) => !live.has(id)))
}

export function backupFileName(manifestScope: 'full' | 'course', courseName?: string, at = new Date()): string {
  const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
  const slug = courseName
    ? courseName
        .toLocaleLowerCase('tr')
        .replace(/[^a-z0-9ğüşıöç]+/g, '-')
        .replace(/^-|-$/g, '')
    : ''
  return manifestScope === 'course' && slug ? `ders-${slug}-${date}.studyapp` : `ders-yedek-${date}.studyapp`
}
