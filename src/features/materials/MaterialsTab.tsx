import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileText, Pencil, Trash2, Upload } from 'lucide-react'
import { db, deleteFile, patch } from '../../db/db'
import { FILE_KIND_LABEL, type Course, type FileKind, type StudyFile } from '../../db/schema'
import { addPdf, downloadBlob } from '../../lib/files'
import { cx, formatBytes } from '../../lib/format'
import { useFeedback } from '../../ui/feedback'
import { Badge, Button, Empty, Field, IconButton, Input, Modal, Select } from '../../ui/kit'

const KINDS: FileKind[] = ['sunum', 'calisma', 'cikmis', 'diger']

export function MaterialsTab({ course }: { course: Course }) {
  const { confirm, toast } = useFeedback()
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<FileKind>('sunum')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [editing, setEditing] = useState<StudyFile | null>(null)

  const data = useLiveQuery(async () => {
    const [files, attempts] = await Promise.all([
      db.files.where('courseId').equals(course.id).toArray(),
      db.attempts.where('courseId').equals(course.id).toArray(),
    ])
    const last = new Map<string, (typeof attempts)[number]>()
    for (const a of attempts.sort((x, y) => x.startedAt - y.startedAt)) if (a.fileId && a.finishedAt) last.set(a.fileId, a)
    return { files: files.sort((a, b) => a.title.localeCompare(b.title, 'tr', { numeric: true })), last }
  }, [course.id])

  const upload = async (list: FileList | File[]) => {
    const pdfs = [...list].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (!pdfs.length) return toast('Yalnızca PDF dosyaları yüklenebilir', 'bad')
    setBusy(true)
    try {
      for (const f of pdfs) await addPdf(f, course.id, kind)
      toast(pdfs.length === 1 ? 'PDF yüklendi' : `${pdfs.length} PDF yüklendi`)
    } catch (e) {
      toast(`Yüklenemedi: ${(e as Error).message}`, 'bad')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async (f: StudyFile) => {
    const ok = await confirm({
      title: `“${f.title}” silinsin mi?`,
      body: 'PDF ve yer imleri bu cihazdan silinir.',
      action: 'PDF’i sil',
      danger: true,
    })
    if (ok) await deleteFile(db, f.id)
  }

  const download = async (f: StudyFile) => {
    const b = await db.blobs.get(f.blobId)
    if (b) downloadBlob(new Blob([b.data], { type: b.mime }), `${f.title}.pdf`)
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void upload(e.dataTransfer.files)
        }}
        className={cx(
          'flex flex-wrap items-end gap-3 rounded-xl border-2 border-dashed px-4 py-4 transition-colors',
          over ? 'border-pen bg-pen-soft' : 'border-line bg-surface/60',
        )}
      >
        <div className="min-w-44 flex-1">
          <Field label="Yüklenecek PDF’in türü">
            <Select value={kind} onChange={(e) => setKind(e.target.value as FileKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {FILE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button variant="primary" icon={<Upload size={18} />} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Yükleniyor…' : 'PDF seç'}
        </Button>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        <p className="w-full text-sm text-soft">Birden çok dosya seçebilir ya da dosyaları buraya sürükleyebilirsin.</p>
      </div>

      {!data.files.length ? (
        <Empty title="Henüz PDF yok">Ders sunumlarını, çalışma notlarını ve çıkmış sınav PDF’lerini buraya yükle.</Empty>
      ) : (
        KINDS.filter((k) => data.files.some((f) => f.kind === k)).map((k) => (
          <section key={k}>
            <h2 className="mb-2 text-lg font-semibold">{FILE_KIND_LABEL[k]}</h2>
            <ul className="space-y-2">
              {data.files
                .filter((f) => f.kind === k)
                .map((f) => {
                  const a = data.last.get(f.id)
                  return (
                    <li key={f.id} className="flex items-center gap-1 rounded-xl border border-line bg-surface pr-1.5 hover:border-pen">
                      <Link to={`/dosya/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
                        <FileText size={22} className="shrink-0 text-pen" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{f.title}</span>
                          <span className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-soft">
                            <span>
                              {f.pageCount ? `${f.pageCount} sayfa, ` : ''}
                              {formatBytes(f.size)}
                            </span>
                            {f.lastPage && f.lastPage > 1 && <Badge tone="pen">{f.lastPage}. sayfada kaldın</Badge>}
                            {a && (
                              <Badge tone="ok">
                                Optik: {a.correct} doğru, {a.wrong} yanlış
                              </Badge>
                            )}
                          </span>
                        </span>
                      </Link>
                      <IconButton label="Adı ve türü düzenle" onClick={() => setEditing(f)}>
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton label="PDF’i indir" onClick={() => download(f)} className="hidden sm:inline-grid">
                        <Download size={18} />
                      </IconButton>
                      <IconButton label="PDF’i sil" onClick={() => remove(f)}>
                        <Trash2 size={18} />
                      </IconButton>
                    </li>
                  )
                })}
            </ul>
          </section>
        ))
      )}

      <EditFile file={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function EditFile({ file, onClose }: { file: StudyFile | null; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<FileKind>('sunum')
  const [seen, setSeen] = useState<string | null>(null)
  if (file && seen !== file.id) {
    setSeen(file.id)
    setTitle(file.title)
    setKind(file.kind)
  }
  if (!file && seen) setSeen(null)

  const save = async () => {
    if (!file || !title.trim()) return
    await patch(db.files, file.id, { title: title.trim(), kind })
    onClose()
  }

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      title="PDF’i düzenle"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save} disabled={!title.trim()}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Başlık">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Tür">
          <Select value={kind} onChange={(e) => setKind(e.target.value as FileKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {FILE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
