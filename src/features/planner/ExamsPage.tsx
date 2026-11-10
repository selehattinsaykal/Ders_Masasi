import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db, patch, removeRows, stamp } from '../../db/db'
import { EXAM_TYPE_LABEL, type Exam, type ExamType } from '../../db/schema'
import { countdownLabel, cx, daysUntil, formatDateTime, toLocalInput } from '../../lib/format'
import { Badge, Button, Dot, Empty, Field, IconButton, Input, Modal, PageHeader, SectionTitle, Select, Textarea } from '../../ui/kit'

export default function ExamsPage() {
  const [editor, setEditor] = useState<{ open: boolean; exam?: Exam }>({ open: false })
  const data = useLiveQuery(async () => {
    const [exams, courses] = await Promise.all([db.exams.orderBy('date').toArray(), db.courses.toArray()])
    return { exams, courses: new Map(courses.map((c) => [c.id, c])), list: courses }
  }, [])

  if (!data) return null
  const upcoming = data.exams.filter((e) => daysUntil(e.date) >= 0)
  const past = data.exams.filter((e) => daysUntil(e.date) < 0).reverse()

  const row = (e: Exam, faded = false) => {
    const c = data.courses.get(e.courseId)
    const d = daysUntil(e.date)
    return (
      <li key={e.id} className={cx('flex items-start gap-1 rounded-xl border border-line bg-surface py-3 pr-1.5 pl-4', faded && 'opacity-70')}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            {c && <Dot color={c.color} />}
            <Link to={`/ders/${e.courseId}`} className="font-semibold hover:text-pen">
              {c?.name ?? 'Silinmiş ders'}
            </Link>
            <Badge>{EXAM_TYPE_LABEL[e.type]}</Badge>
          </p>
          <p className="mt-0.5 text-soft">{formatDateTime(e.date)}</p>
          {e.topics && <p className="mt-1 text-[15px]">Konular: {e.topics}</p>}
          {e.note && <p className="mt-1 text-[15px] whitespace-pre-wrap text-soft">{e.note}</p>}
        </div>
        {!faded && (
          <span className={cx('tabular mt-0.5 shrink-0 font-display text-lg font-bold', d <= 3 ? 'text-bad' : d <= 7 ? 'text-warn' : '')}>
            <span className={d <= 7 ? 'marker' : ''}>{countdownLabel(e.date)}</span>
          </span>
        )}
        <IconButton label="Sınavı düzenle" onClick={() => setEditor({ open: true, exam: e })}>
          <Pencil size={18} />
        </IconButton>
        <IconButton label="Sınavı sil" onClick={() => removeRows(db, 'exams', [e.id])}>
          <Trash2 size={18} />
        </IconButton>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        title="Sınav takvimi"
        actions={
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditor({ open: true })} disabled={!data.list.length}>
            Sınav ekle
          </Button>
        }
      />

      {!data.list.length ? (
        <Empty title="Önce bir ders ekle" action={<Link to="/dersler" className="font-semibold text-pen">Derslere git</Link>}>
          Sınav tarihleri derslere bağlıdır.
        </Empty>
      ) : !data.exams.length ? (
        <Empty title="Takvim boş" action={<Button variant="primary" onClick={() => setEditor({ open: true })}>İlk sınavı ekle</Button>}>
          Vize ve final tarihlerini gir; ana sayfada geri sayımı görürsün.
        </Empty>
      ) : (
        <div className="space-y-7">
          <section>
            <SectionTitle>Yaklaşan</SectionTitle>
            {upcoming.length ? <ul className="space-y-2">{upcoming.map((e) => row(e))}</ul> : <p className="text-soft">Yaklaşan sınav yok.</p>}
          </section>
          {past.length > 0 && (
            <section>
              <SectionTitle>Geçmiş</SectionTitle>
              <ul className="space-y-2">{past.map((e) => row(e, true))}</ul>
            </section>
          )}
        </div>
      )}

      <ExamForm open={editor.open} exam={editor.exam} onClose={() => setEditor({ open: false })} courses={data.list} />
    </>
  )
}

function ExamForm({ open, exam, onClose, courses }: { open: boolean; exam?: Exam; onClose: () => void; courses: { id: string; name: string }[] }) {
  const [courseId, setCourseId] = useState('')
  const [type, setType] = useState<ExamType>('vize')
  const [date, setDate] = useState('')
  const [topics, setTopics] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setCourseId(exam?.courseId ?? courses[0]?.id ?? '')
    setType(exam?.type ?? 'vize')
    const base = new Date()
    base.setDate(base.getDate() + 7)
    base.setHours(10, 0, 0, 0)
    setDate(toLocalInput(exam?.date ?? base.getTime()))
    setTopics(exam?.topics ?? '')
    setNote(exam?.note ?? '')
  }, [open, exam, courses])

  const ts = date ? new Date(date).getTime() : NaN
  const valid = !!courseId && Number.isFinite(ts)

  const save = async () => {
    if (!valid) return
    const data = { courseId, type, date: ts, topics: topics.trim() || undefined, note: note.trim() || undefined }
    if (exam) await patch(db.exams, exam.id, data)
    else await db.exams.add(stamp(data))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exam ? 'Sınavı düzenle' : 'Sınav ekle'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {exam ? 'Kaydet' : 'Sınavı ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ders">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tür">
            <Select value={type} onChange={(e) => setType(e.target.value as ExamType)}>
              {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((k) => (
                <option key={k} value={k}>
                  {EXAM_TYPE_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tarih ve saat">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Kapsanan konular (isteğe bağlı)">
          <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="1–6. haftalar, ağaçlar dahil" />
        </Field>
        <Field label="Not (isteğe bağlı)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Derslik, izin verilen kaynaklar…" />
        </Field>
      </div>
    </Modal>
  )
}
