import type { Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { QUESTION_TYPE_LABEL } from '../../db/schema'
import { formatDuration } from '../../lib/format'
import { percentOf } from '../../lib/grading'
import { attemptPercent, dailyActivity, groupAccuracy, lastDays, retention, streak } from '../../lib/stats'
import { AccuracyBars, DayColumns, Heatmap, TrendLine } from '../../ui/charts'
import { Empty, Panel, SectionTitle } from '../../ui/kit'

function Stat({ value, label, mark }: { value: string; label: string; mark?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="font-display text-3xl leading-tight font-bold tabular">{mark ? <span className="marker">{value}</span> : value}</p>
      <p className="text-sm text-soft">{label}</p>
    </div>
  )
}

/** İstatistikler: tek ders için ya da (courseId verilmezse) tüm dersler için. */
export function StatsView({ courseId }: { courseId?: string }) {
  const data = useLiveQuery(async () => {
    const pick = <T,>(table: Table<T, string>) => (courseId ? table.where('courseId').equals(courseId).toArray() : table.toArray())
    const [answers, reviews, attempts, sessions, courses] = await Promise.all([
      pick(db.answers),
      pick(db.reviews),
      pick(db.attempts),
      pick(db.studySessions),
      db.courses.toArray(),
    ])
    return { answers, reviews, attempts, sessions, courses }
  }, [courseId])

  if (!data) return null
  const { answers, reviews, attempts, sessions, courses } = data
  const graded = answers.filter((a) => a.result !== 'blank')
  const optical = attempts.filter((a) => a.mode === 'optik' && a.finishedAt)
  const correct = graded.filter((a) => a.result === 'correct').length + optical.reduce((n, a) => n + a.correct, 0)
  const partial = graded.filter((a) => a.result === 'partial').length
  const answered = graded.length + optical.reduce((n, a) => n + a.correct + a.wrong, 0)

  if (!answered && !reviews.length && !sessions.length)
    return <Empty title="Henüz istatistik yok">Test çözdükçe ve kart tekrar ettikçe başarı oranın, zayıf konuların ve çalışma süren burada birikir.</Empty>

  const activity = dailyActivity(answers, reviews, attempts, sessions)
  const days14 = lastDays(14)
  const days105 = lastDays(105)
  const weekSec = lastDays(7).reduce((n, d) => n + (activity.get(d)?.sec ?? 0), 0)
  const totalSec = [...activity.values()].reduce((n, d) => n + d.sec, 0)
  const pomodoros = sessions.filter((s) => s.kind === 'pomodoro').length

  const trend = attempts
    .filter((a) => a.finishedAt && a.correct + a.wrong + a.blank + a.partial > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-30)
    .map((a) => ({ at: a.startedAt, percent: attemptPercent(a), label: a.title }))

  const byTopic = groupAccuracy(answers, (a) => a.topic).sort((a, b) => a.percent - b.percent)
  const byType = groupAccuracy(answers, (a) => QUESTION_TYPE_LABEL[a.type])
  const courseName = new Map(courses.map((c) => [c.id, c.name]))
  const byCourse = courseId ? [] : groupAccuracy(answers, (a) => courseName.get(a.courseId)).sort((a, b) => a.percent - b.percent)

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat value={`%${percentOf(correct, partial, answered)}`} label={`başarı, ${answered} cevap`} mark />
        <Stat value={String(streak(activity))} label="günlük seri" />
        <Stat value={formatDuration(weekSec)} label="son 7 günde çalışma" />
        <Stat value={formatDuration(totalSec)} label="toplam çalışma" />
        <Stat value={reviews.length ? `%${retention(reviews)}` : '–'} label={`kart hatırlama, ${reviews.length} tekrar`} />
      </div>

      <section>
        <SectionTitle>Son 15 hafta</SectionTitle>
        <Panel className="p-4">
          <Heatmap days={days105.map((at) => ({ at, value: (activity.get(at)?.questions ?? 0) + (activity.get(at)?.cards ?? 0) }))} />
          <p className="mt-2 text-sm text-soft">Her kare bir gün; koyulaştıkça o gün çözülen soru ve tekrar edilen kart artar.</p>
        </Panel>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section>
          <SectionTitle>Son 14 günde çözülen soru</SectionTitle>
          <Panel className="p-4">
            <DayColumns days={days14.map((at) => ({ at, value: activity.get(at)?.questions ?? 0 }))} unit="soru" />
          </Panel>
        </section>
        <section>
          <SectionTitle>Son 14 günde tekrar edilen kart</SectionTitle>
          <Panel className="p-4">
            <DayColumns days={days14.map((at) => ({ at, value: activity.get(at)?.cards ?? 0 }))} unit="kart" />
          </Panel>
        </section>
      </div>

      <section>
        <SectionTitle>Denemelerde başarı eğilimi</SectionTitle>
        <Panel className="p-4">
          <TrendLine points={trend} />
        </Panel>
      </section>

      <section>
        <SectionTitle>Konulara göre (zayıftan güçlüye)</SectionTitle>
        <Panel className="p-4">
          <AccuracyBars buckets={byTopic} empty="Konu bilgisi olan soru çözünce burada görünür." />
        </Panel>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section>
          <SectionTitle>Soru tipine göre</SectionTitle>
          <Panel className="p-4">
            <AccuracyBars buckets={byType} empty="Henüz cevaplanan soru yok." />
          </Panel>
        </section>
        {!courseId && (
          <section>
            <SectionTitle>Derslere göre</SectionTitle>
            <Panel className="p-4">
              <AccuracyBars buckets={byCourse} empty="Henüz cevaplanan soru yok." />
            </Panel>
          </section>
        )}
      </div>

      {pomodoros > 0 && (
        <p className="tabular text-soft">
          {pomodoros} pomodoro tamamlandı, toplam {formatDuration(sessions.filter((s) => s.kind === 'pomodoro').reduce((n, s) => n + s.durationSec, 0))} odak.
        </p>
      )}
    </div>
  )
}
