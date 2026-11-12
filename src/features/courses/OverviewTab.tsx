import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenCheck, FileText, Layers, RotateCcw, Shuffle } from 'lucide-react'
import { db } from '../../db/db'
import { EXAM_TYPE_LABEL, MODE_LABEL, type Course } from '../../db/schema'
import { countdownLabel, daysUntil, formatDate, relativeDay } from '../../lib/format'
import { percentOf } from '../../lib/grading'
import { buildQuestionStats, isMissed, startAttempt } from '../../lib/quiz'
import { attemptPercent } from '../../lib/stats'
import { Badge, Button, Empty, Panel, ScoreRow, SectionTitle } from '../../ui/kit'
import { GradeCard } from '../grades/GradeCard'

export function OverviewTab({ course }: { course: Course }) {
  const nav = useNavigate()
  const data = useLiveQuery(async () => {
    const [files, questions, cards, answers, attempts, exams, topics] = await Promise.all([
      db.files.where('courseId').equals(course.id).toArray(),
      db.questions.where('courseId').equals(course.id).toArray(),
      db.cards.where('courseId').equals(course.id).toArray(),
      db.answers.where('courseId').equals(course.id).toArray(),
      db.attempts.where('courseId').equals(course.id).toArray(),
      db.exams.where('courseId').equals(course.id).sortBy('date'),
      db.topics.where('courseId').equals(course.id).toArray(),
    ])
    const stats = buildQuestionStats(answers)
    const missed = questions.filter((q) => isMissed(stats.get(q.id)))
    const now = Date.now()
    const res = { correct: 0, wrong: 0, partial: 0 }
    for (const a of answers) if (a.result !== 'blank') res[a.result]++
    return {
      files,
      questions,
      cards,
      missed,
      due: cards.filter((c) => c.due <= now).length,
      res,
      attempts: attempts.sort((a, b) => b.startedAt - a.startedAt),
      nextExam: exams.find((e) => daysUntil(e.date) >= 0),
      lastFile: files.filter((f) => f.lastPage).sort((a, b) => b.updatedAt - a.updatedAt)[0],
      topics,
    }
  }, [course.id])

  if (!data) return null
  const { files, questions, cards, missed, due, res, attempts, nextExam, lastFile, topics } = data
  const unfinished = attempts.find((a) => !a.finishedAt && a.mode !== 'optik')
  const answered = res.correct + res.wrong + res.partial

  const gradeSection = (
    <section>
      <SectionTitle>Not hesabı</SectionTitle>
      <GradeCard course={course} compact />
    </section>
  )

  if (!files.length && !questions.length && !cards.length)
    return (
      <div className="space-y-6">
      <Empty
        title="Bu derste henüz içerik yok"
        action={
          <>
            <Button variant="primary" onClick={() => nav(`/ders/${course.id}/materyaller`)}>
              PDF yükle
            </Button>
            <Button onClick={() => nav(`/ice-aktar?ders=${course.id}`)}>JSON içe aktar</Button>
          </>
        }
      >
        Ders sunumlarını ve çalışma PDF’lerini yükle, hazırlattığın kart ve soru dosyalarını içe aktar.
      </Empty>
      {gradeSection}
      </div>
    )

  const retryMissed = async () => {
    const id = await startAttempt({
      courseId: course.id,
      title: `${course.name}: yanlışlarım`,
      mode: 'yanlis',
      instant: true,
      questions: missed,
      shuffleQuestions: true,
    })
    nav(`/test/${id}`)
  }

  return (
    <div className="space-y-6">
      {nextExam && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-soft">
              {EXAM_TYPE_LABEL[nextExam.type]}, {formatDate(nextExam.date)}
            </p>
            <p className="font-display text-3xl font-bold">
              <span className="marker">{countdownLabel(nextExam.date)}</span>
            </p>
          </div>
          <div className="tabular text-right text-soft">
            {topics.length > 0 && (
              <p>
                {topics.filter((t) => t.status === 'done').length} / {topics.length} konu tamam
              </p>
            )}
            {nextExam.topics && <p className="max-w-xs text-sm">{nextExam.topics}</p>}
          </div>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {unfinished && (
          <Button variant="primary" className="justify-start" icon={<RotateCcw size={18} />} onClick={() => nav(`/test/${unfinished.id}`)}>
            Yarım kalan teste devam et
          </Button>
        )}
        {due > 0 && (
          <Button variant={unfinished ? 'secondary' : 'primary'} className="justify-start" icon={<Layers size={18} />} onClick={() => nav(`/kart-calis?ders=${course.id}&mod=tekrar`)}>
            {due} kartı tekrar et
          </Button>
        )}
        {missed.length > 0 && (
          <Button className="justify-start" icon={<BookOpenCheck size={18} />} onClick={retryMissed}>
            {missed.length} yanlışını yeniden çöz
          </Button>
        )}
        {questions.length > 0 && (
          <Button className="justify-start" icon={<Shuffle size={18} />} onClick={() => nav(`/ders/${course.id}/testler?karisik=1`)}>
            Karışık test oluştur
          </Button>
        )}
        {lastFile && (
          <Button className="justify-start" icon={<FileText size={18} />} onClick={() => nav(`/dosya/${lastFile.id}`)}>
            <span className="truncate">
              {lastFile.title}, {lastFile.lastPage}. sayfadan devam
            </span>
          </Button>
        )}
      </div>

      {answered > 0 && (
        <section>
          <SectionTitle action={<Link to={`/ders/${course.id}/istatistik`} className="text-sm font-semibold text-pen">Ayrıntılı istatistik</Link>}>
            Şimdiye kadar
          </SectionTitle>
          <Panel className="p-4">
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold tabular">
                <span className="marker">%{percentOf(res.correct, res.partial, answered)}</span>
              </span>
              <span className="text-soft">başarı, {answered} cevap</span>
            </div>
            <ScoreRow correct={res.correct} wrong={res.wrong} blank={0} partial={res.partial} compact />
          </Panel>
        </section>
      )}

      {attempts.filter((a) => a.finishedAt).length > 0 && (
        <section>
          <SectionTitle>Son denemeler</SectionTitle>
          <ul className="space-y-2">
            {attempts
              .filter((a) => a.finishedAt)
              .slice(0, 5)
              .map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.mode === 'optik' && a.fileId ? `/dosya/${a.fileId}` : `/sonuc/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.title}</p>
                      <p className="text-sm text-soft">
                        {MODE_LABEL[a.mode]}, {relativeDay(a.startedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreRow correct={a.correct} wrong={a.wrong} blank={a.blank} partial={a.partial} compact />
                      <Badge tone={attemptPercent(a) >= 70 ? 'ok' : attemptPercent(a) >= 40 ? 'warn' : 'bad'}>%{attemptPercent(a)}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
      {gradeSection}
    </div>
  )
}
