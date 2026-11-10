import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Terminal, Trash2 } from 'lucide-react'
import { db, removeRows } from '../../db/db'
import type { Course } from '../../db/schema'
import { relativeDay } from '../../lib/format'
import { buildQuestionStats } from '../../lib/quiz'
import { Badge, Button, Empty, IconButton, SectionTitle } from '../../ui/kit'

export function CodeTab({ course }: { course: Course }) {
  const nav = useNavigate()
  const data = useLiveQuery(async () => {
    const [snippets, questions, answers] = await Promise.all([
      db.snippets.where('courseId').equals(course.id).toArray(),
      db.questions.where('courseId').equals(course.id).filter((q) => q.type === 'code').toArray(),
      db.answers.where('courseId').equals(course.id).filter((a) => a.type === 'code').toArray(),
    ])
    return { snippets: snippets.sort((a, b) => b.updatedAt - a.updatedAt), questions, stats: buildQuestionStats(answers) }
  }, [course.id])

  if (!data) return null

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => nav(`/kod?ders=${course.id}`)}>
          Yeni kod denemesi
        </Button>
      </div>

      <section>
        <SectionTitle>Kayıtlı kodlar</SectionTitle>
        {!data.snippets.length ? (
          <Empty title="Kayıtlı kod yok">Serbest kod alanında yazıp kaydettiğin denemeler burada durur.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.snippets.map((s) => (
              <li key={s.id} className="flex items-center gap-1 rounded-xl border border-line bg-surface pr-1.5 hover:border-pen">
                <Link to={`/kod/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
                  <Terminal size={20} className="shrink-0 text-pen" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.title}</span>
                    <span className="text-sm text-soft">
                      Python {s.pythonVersion}, {relativeDay(s.updatedAt)}
                    </span>
                  </span>
                </Link>
                <IconButton label="Kodu sil" onClick={() => removeRows(db, 'snippets', [s.id])}>
                  <Trash2 size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.questions.length > 0 && (
        <section>
          <SectionTitle>Kod soruları</SectionTitle>
          <ul className="space-y-2">
            {data.questions.map((q) => {
              const s = data.stats.get(q.id)
              return (
                <li key={q.id}>
                  <Link to={`/set/${q.setId}`} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                    <p className="line-clamp-2">{q.prompt}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
                      {q.pythonVersion && <Badge>Python {q.pythonVersion}</Badge>}
                      {q.tests?.length ? <Badge tone="pen">{q.tests.length} test</Badge> : <Badge>Kendin değerlendir</Badge>}
                      {s && <Badge tone={s.last === 'correct' ? 'ok' : s.last === 'partial' ? 'warn' : 'bad'}>{s.seen} kez denendi</Badge>}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
