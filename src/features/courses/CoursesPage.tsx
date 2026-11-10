import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db } from '../../db/db'
import { EXAM_TYPE_LABEL } from '../../db/schema'
import { countdownLabel, daysUntil } from '../../lib/format'
import { Badge, Button, Check, Empty, PageHeader } from '../../ui/kit'
import { CourseForm } from './CourseForm'

export default function CoursesPage() {
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const data = useLiveQuery(async () => {
    const [courses, files, questions, cards, exams] = await Promise.all([
      db.courses.toArray(),
      db.files.toArray(),
      db.questions.toArray(),
      db.cards.toArray(),
      db.exams.where('date').aboveOrEqual(Date.now() - 86_400_000).sortBy('date'),
    ])
    const count = (list: { courseId: string }[]) => {
      const m = new Map<string, number>()
      for (const x of list) m.set(x.courseId, (m.get(x.courseId) ?? 0) + 1)
      return m
    }
    const now = Date.now()
    return {
      courses: courses.sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      files: count(files),
      questions: count(questions),
      cards: count(cards),
      due: count(cards.filter((c) => c.due <= now)),
      nextExam: new Map(exams.reverse().map((e) => [e.courseId, e])),
    }
  }, [])

  if (!data) return null
  const visible = data.courses.filter((c) => showArchived || !c.archived)
  const archivedCount = data.courses.filter((c) => c.archived).length

  return (
    <>
      <PageHeader
        title="Dersler"
        actions={
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
            Yeni ders
          </Button>
        }
      />

      {!data.courses.length ? (
        <Empty
          title="Henüz ders yok"
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
              İlk dersini ekle
            </Button>
          }
        >
          Her dersin kendi PDF’leri, testleri, kartları ve istatistikleri olur.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((c) => {
            const exam = data.nextExam.get(c.id)
            const soon = exam && daysUntil(exam.date) <= 7
            const due = data.due.get(c.id) ?? 0
            return (
              <li key={c.id}>
                <Link
                  to={`/ders/${c.id}`}
                  className="group relative block h-full overflow-hidden rounded-xl border border-line bg-surface py-4 pr-4 pl-6 transition-colors hover:border-pen"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-2" style={{ background: c.color }} />
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xl leading-snug font-semibold group-hover:text-pen">{c.name}</h2>
                    {c.archived && <Badge>Arşivde</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-soft">{[c.code, c.term].filter(Boolean).join(', ') || ' '}</p>
                  <p className="tabular mt-3 text-[15px] text-soft">
                    {data.files.get(c.id) ?? 0} PDF, {data.questions.get(c.id) ?? 0} soru, {data.cards.get(c.id) ?? 0} kart
                  </p>
                  <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
                    {exam && (
                      <Badge tone={soon ? 'warn' : 'neutral'}>
                        {EXAM_TYPE_LABEL[exam.type]}: {countdownLabel(exam.date)}
                      </Badge>
                    )}
                    {due > 0 && <Badge tone="pen">{due} kart tekrar bekliyor</Badge>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {archivedCount > 0 && (
        <div className="mt-4">
          <Check checked={showArchived} onChange={setShowArchived}>
            Arşivlenen dersleri göster ({archivedCount})
          </Check>
        </div>
      )}

      <CourseForm open={adding} onClose={() => setAdding(false)} onSaved={(id) => nav(`/ders/${id}`)} />
    </>
  )
}
