import { useEffect, useState } from 'react'
import { Check as CheckIcon } from 'lucide-react'
import { db, patch, stamp } from '../../db/db'
import { COURSE_COLORS, type Course } from '../../db/schema'
import { Button, Field, Input, Modal } from '../../ui/kit'

export function CourseForm({
  open,
  onClose,
  course,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  course?: Course
  onSaved?: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [term, setTerm] = useState('')
  const [color, setColor] = useState(COURSE_COLORS[0])

  useEffect(() => {
    if (!open) return
    setName(course?.name ?? '')
    setCode(course?.code ?? '')
    setTerm(course?.term ?? '')
    if (course) setColor(course.color)
    else void db.courses.count().then((n) => setColor(COURSE_COLORS[n % COURSE_COLORS.length]))
  }, [open, course])

  const save = async () => {
    const data = { name: name.trim(), code: code.trim() || undefined, term: term.trim() || undefined, color }
    if (!data.name) return
    if (course) {
      await patch(db.courses, course.id, data)
      onSaved?.(course.id)
    } else {
      const rec = stamp({ ...data, archived: false })
      await db.courses.add(rec)
      onSaved?.(rec.id)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={course ? 'Dersi düzenle' : 'Yeni ders'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            {course ? 'Kaydet' : 'Dersi ekle'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Ders adı">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Veri Yapıları" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ders kodu">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="BM201" />
          </Field>
          <Field label="Dönem">
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="2026 Güz" />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Renk</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Renk">
            {COURSE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Renk ${c}`}
                onClick={() => setColor(c)}
                className="grid size-9 place-items-center rounded-full text-white"
                style={{ background: c }}
              >
                {color === c && <CheckIcon size={18} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
