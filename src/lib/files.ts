import { db, stamp } from '../db/db'
import type { FileKind, StudyFile } from '../db/schema'

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Cihaz dosya paylaşımını destekliyorsa paylaşım menüsünü açar. */
export function canShare(blob: Blob, name: string): boolean {
  try {
    const file = new File([blob], name, { type: blob.type })
    return !!navigator.canShare?.({ files: [file] })
  } catch {
    return false
  }
}

export async function shareBlob(blob: Blob, name: string, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([blob], name, { type: blob.type })], title })
    return true
  } catch {
    return false
  }
}

export async function addPdf(file: File, courseId: string, kind: FileKind): Promise<StudyFile> {
  const data = await file.arrayBuffer()
  const blob = stamp({ mime: file.type || 'application/pdf', data })
  const rec: StudyFile = stamp({
    courseId,
    kind,
    title: file.name.replace(/\.pdf$/i, ''),
    mime: blob.mime,
    size: data.byteLength,
    blobId: blob.id,
  })
  await db.transaction('rw', db.blobs, db.files, async () => {
    await db.blobs.add(blob)
    await db.files.add(rec)
  })
  return rec
}

export function readFileText(file: File): Promise<string> {
  return file.text()
}
