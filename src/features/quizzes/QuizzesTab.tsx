import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenCheck, FileJson, Plus, Shuffle, Sparkles, Trash2 } from 'lucide-react'
import { db, deleteAttempt } from '../../db/db'
import { EXAM_TYPE_LABEL, MODE_LABEL, type Attempt, type Course, type QuestionSet, type SetKind } from '../../db/schema'
import { relativeDay } from '../../lib/format'
import { buildQuestionStats, isMissed, startAttempt } from '../../lib/quiz'
import { attemptPercent } from '../../lib/stats'
import { Badge, Button, Empty, IconButton, SectionTitle } from '../../ui/kit'
import { CustomTest } from './CustomTest'
import { SetForm } from './SetForm'
import { MistakesPrompt, toMistake } from '../content-import/MistakesPrompt'

const KIND_TITLE: Record<SetKind, string> = { cikmis: 'Çıkmış sorular', calisma: 'Çalışma soruları' }

export function QuizzesTab({ course }: { course: Course }) {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [custom, setCustom] = useState(false)
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (params.get('karisik')) {
      setCustom(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const data = useLiveQuery(async () => {
    const [sets, questions, answers, attempts] = await Promise.all([
      db.questionSets.where('courseId').equals(course.id).toArray(),
      db.questions.where('courseId').equals(course.id).toArray(),
      db.answers.where('courseId').equals(course.id).toArray(),
      db.attempts.where('courseId').equals(course.id).toArray(),
    ])
    const stats = buildQuestionStats(answers)
    // Her sorunun en son verilen (boş olmayan) cevabı.
    const lastGiven = new Map<string, unknown>()
    for (const a of [...answers].sort((x, y) => x.updatedAt - y.updatedAt)) if (a.result !== 'blank') lastGiven.set(a.questionId, a.response)
    const counts = new Map<string, number>()
    for (const q of questions) counts.set(q.setId, (counts.get(q.setId) ?? 0) + 1)
    const last = new Map<string, Attempt>()
    for (const a of attempts.sort((x, y) => x.startedAt - y.startedAt)) if (a.setId && a.finishedAt) last.set(a.setId, a)
    return {
      sets: sets.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, 'tr', { numeric: true })),
      counts,
      last,
      questions,
      missed: questions.filter((q) => isMissed(stats.get(q.id))),
      lastGiven,
      unfinished: attempts.filter((a) => !a.finishedAt && a.mode !== 'optik').sort((a, b) => b.startedAt - a.startedAt),
    }
  }, [course.id])

  if (!data) return null

  const retryMissed = async () => {
    const id = await startAttempt({
      courseId: course.id,
      title: `${course.name}: yanlışlarım`,
      mode: 'yanlis',
      instant: true,
      questions: data.missed,
      shuffleQuestions: true,
    })
    nav(`/test/${id}`)
  }

  const row = (s: QuestionSet) => {
    const a = data.last.get(s.id)
    const n = data.counts.get(s.id) ?? 0
    return (
      <li key={s.id}>
        <Link to={`/set/${s.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
          <div className="min-w-0">
            <p className="truncate font-semibold">{s.title}</p>
            <p className="tabular flex flex-wrap items-center gap-1.5 text-sm text-soft">
              <span>{n} soru</span>
              {s.year && <Badge>{[s.year, s.term].filter(Boolean).join(' ')}</Badge>}
              {s.examType && <Badge>{EXAM_TYPE_LABEL[s.examType]}</Badge>}
            </p>
          </div>
          {a ? (
            <div className="tabular flex items-center gap-2 text-sm text-soft">
              <span>
                Son: {a.correct} doğru, {a.wrong} yanlış
              </span>
              <Badge tone={attemptPercent(a) >= 70 ? 'ok' : attemptPercent(a) >= 40 ? 'warn' : 'bad'}>%{attemptPercent(a)}</Badge>
            </div>
          ) : (
            n > 0 && <Badge tone="pen">Henüz çözülmedi</Badge>
          )}
        </Link>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<Shuffle size={18} />} onClick={() => setCustom(true)} disabled={!data.questions.length}>
          Karışık test
        </Button>
        {data.missed.length > 0 && (
          <Button icon={<BookOpenCheck size={18} />} onClick={retryMissed}>
            Yanlışlarım ({data.missed.length})
          </Button>
        )}
        {data.missed.length > 0 && (
          <Button icon={<Sparkles size={18} />} onClick={() => setAsking(true)}>
            Benzer soru iste
          </Button>
        )}
        <Button icon={<Plus size={18} />} onClick={() => setAdding(true)}>
          Yeni test
        </Button>
        <Button icon={<FileJson size={18} />} onClick={() => nav(`/ice-aktar?ders=${course.id}`)}>
          JSON içe aktar
        </Button>
      </div>

      {data.unfinished.length > 0 && (
        <section>
          <SectionTitle>Yarım kalanlar</SectionTitle>
          <ul className="space-y-2">
            {data.unfinished.map((a) => (
              <li key={a.id} className="flex items-center gap-1 rounded-xl border border-line bg-marker-wash pr-1.5">
                <Link to={`/test/${a.id}`} className="min-w-0 flex-1 px-4 py-3">
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="tabular text-sm text-soft">
                    {MODE_LABEL[a.mode]}, {a.currentIndex + 1}. soruda kaldın ({a.questionIds.length} soru), {relativeDay(a.startedAt)}
                  </p>
                </Link>
                <IconButton label="Yarım kalan testi sil" onClick={() => deleteAttempt(db, a.id)}>
                  <Trash2 size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!data.sets.length ? (
        <Empty
          title="Henüz test yok"
          action={
            <>
              <Button variant="primary" onClick={() => nav(`/ice-aktar?ders=${course.id}`)}>
                JSON içe aktar
              </Button>
              <Button onClick={() => setAdding(true)}>Elle test oluştur</Button>
            </>
          }
        >
          Çıkmış soruları ve çalışma sorularını hazırlattığın JSON dosyasından içe aktar ya da elle ekle.
        </Empty>
      ) : (
        (['cikmis', 'calisma'] as SetKind[])
          .filter((k) => data.sets.some((s) => s.kind === k))
          .map((k) => (
            <section key={k}>
              <SectionTitle>{KIND_TITLE[k]}</SectionTitle>
              <ul className="space-y-2">{data.sets.filter((s) => s.kind === k).map(row)}</ul>
            </section>
          ))
      )}

      <MistakesPrompt
        open={asking}
        onClose={() => setAsking(false)}
        course={course.name}
        courseId={course.id}
        items={data.missed.map((q) => toMistake(q, data.lastGiven.get(q.id)))}
      />
      <CustomTest open={custom} onClose={() => setCustom(false)} course={course} />
      <SetForm open={adding} onClose={() => setAdding(false)} courseId={course.id} onSaved={(id) => nav(`/set/${id}`)} />
    </div>
  )
}
