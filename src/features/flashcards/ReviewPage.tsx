import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers } from 'lucide-react'
import { db } from '../../db/db'
import { startOfDay } from '../../lib/format'
import { formatInterval } from '../../lib/scheduler'
import { DayColumns } from '../../ui/charts'
import { Button, Dot, Empty, PageHeader, Panel, SectionTitle } from '../../ui/kit'

const DAY = 86_400_000

/** Bugün tekrar zamanı gelen kartlar, derslere göre. */
export default function ReviewPage() {
  const nav = useNavigate()
  const data = useLiveQuery(async () => {
    const [courses, cards] = await Promise.all([db.courses.toArray(), db.cards.toArray()])
    const now = Date.now()
    const due = cards.filter((c) => c.due <= now)
    const byCourse = courses
      .map((c) => ({ course: c, due: due.filter((x) => x.courseId === c.id).length, total: cards.filter((x) => x.courseId === c.id).length }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.due - a.due)
    const upcoming = cards.filter((c) => c.due > now).sort((a, b) => a.due - b.due)
    // Önümüzdeki 7 gün: her gün zamanı gelecek kart sayısı.
    const today = startOfDay(now)
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const from = i === 0 ? -Infinity : startOfDay(today + i * DAY + DAY / 2)
      const to = startOfDay(today + (i + 1) * DAY + DAY / 2)
      return { at: startOfDay(today + i * DAY + DAY / 2), value: cards.filter((c) => c.due >= from && c.due < to).length }
    })
    return { total: cards.length, due: due.length, byCourse, nextDue: upcoming[0]?.due, forecast, now }
  }, [])

  if (!data) return null

  return (
    <>
      <PageHeader title="Bugünkü tekrar" subtitle="Zamanı gelen kartlar, unutmadan hemen önce." />

      {!data.total ? (
        <Empty title="Henüz kart yok" action={<Button variant="primary" onClick={() => nav('/ice-aktar')}>JSON içe aktar</Button>}>
          Bir derse kart ekleyince tekrar zamanı gelenler burada toplanır.
        </Empty>
      ) : (
        <div className="space-y-7">
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-display text-5xl leading-none font-bold tabular">
                <span className="marker">{data.due}</span>
              </p>
              <p className="mt-2 text-soft">
                {data.due ? 'kart tekrar bekliyor' : data.nextDue ? `Bugünlük bitti. Sıradaki kart ${formatInterval(data.nextDue - data.now)} sonra.` : 'Bugünlük bitti.'}
              </p>
            </div>
            {data.due > 0 && (
              <Button variant="primary" icon={<Layers size={18} />} onClick={() => nav('/kart-calis?mod=tekrar')}>
                Hepsini tekrar et
              </Button>
            )}
          </Panel>

          <section>
            <SectionTitle>Derslere göre</SectionTitle>
            <ul className="space-y-2">
              {data.byCourse.map(({ course, due, total }) => (
                <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                  <Link to={`/ders/${course.id}/kartlar`} className="flex min-w-0 items-center gap-2.5 font-semibold hover:text-pen">
                    <Dot color={course.color} />
                    <span className="truncate">{course.name}</span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="tabular text-sm text-soft">
                      {due} / {total} kart
                    </span>
                    <Button size="sm" variant={due ? 'primary' : 'secondary'} disabled={!due} onClick={() => nav(`/kart-calis?ders=${course.id}&mod=tekrar`)}>
                      Tekrar et
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle>Önümüzdeki 7 gün</SectionTitle>
            <Panel className="p-4">
              <DayColumns days={data.forecast} unit="kart" highlight="first" />
              <p className="mt-2 text-sm text-soft">Sarı sütun bugün zamanı gelenler; diğerleri o gün tekrar edilecek kartlar.</p>
            </Panel>
          </section>
        </div>
      )}
    </>
  )
}
