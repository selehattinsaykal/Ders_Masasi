import { useEffect, useState } from 'react'
import { db, patch, stamp } from '../../db/db'
import { EXAM_TYPE_LABEL, type ExamType, type QuestionSet, type SetKind } from '../../db/schema'
import { Button, Field, Input, Modal, Segmented, Select } from '../../ui/kit'

export function SetForm({
  open,
  onClose,
  courseId,
  set,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  courseId: string
  set?: QuestionSet
  onSaved?: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<SetKind>('calisma')
  const [year, setYear] = useState('')
  const [term, setTerm] = useState('')
  const [examType, setExamType] = useState<ExamType | ''>('')
  const [durationMin, setDurationMin] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(set?.title ?? '')
    setKind(set?.kind ?? 'calisma')
    setYear(set?.year ? String(set.year) : '')
    setTerm(set?.term ?? '')
    setExamType(set?.examType ?? '')
    setDurationMin(set?.durationMin ? String(set.durationMin) : '')
  }, [open, set])

  const save = async () => {
    if (!title.trim()) return
    const data = {
      title: title.trim(),
      kind,
      year: kind === 'cikmis' && Number(year) ? Number(year) : undefined,
      term: kind === 'cikmis' ? term.trim() || undefined : undefined,
      examType: kind === 'cikmis' ? examType || undefined : undefined,
      durationMin: Number(durationMin) > 0 ? Number(durationMin) : undefined,
    }
    if (set) {
      await patch(db.questionSets, set.id, data)
      onSaved?.(set.id)
    } else {
      const rec = stamp({ ...data, courseId })
      await db.questionSets.add(rec)
      onSaved?.(rec.id)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={set ? 'Testi düzenle' : 'Yeni test'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save} disabled={!title.trim()}>
            {set ? 'Kaydet' : 'Testi oluştur'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Başlık">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2024 Güz Vize" autoFocus />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-semibold">Tür</span>
          <Segmented
            label="Tür"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'calisma', label: 'Çalışma soruları' },
              { value: 'cikmis', label: 'Çıkmış sorular' },
            ]}
          />
        </div>
        {kind === 'cikmis' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Yıl">
              <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="2024" />
            </Field>
            <Field label="Dönem">
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Güz" />
            </Field>
            <Field label="Sınav">
              <Select value={examType} onChange={(e) => setExamType(e.target.value as ExamType | '')}>
                <option value="">Seçilmedi</option>
                {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((k) => (
                  <option key={k} value={k}>
                    {EXAM_TYPE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Sınav süresi, dakika (isteğe bağlı)" hint="Sınav modunda bu süre önerilir.">
          <Input value={durationMin} onChange={(e) => setDurationMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </Field>
      </div>
    </Modal>
  )
}
