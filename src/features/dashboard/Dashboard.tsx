import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { DatabaseBackup, FileText, Flame, Layers, RotateCcw, Search } from 'lucide-react'
import { db, getSetting } from '../../db/db'
import { EXAM_TYPE_LABEL } from '../../db/schema'
import { countdownLabel, cx, daysUntil, formatDate, formatDuration, startOfDay } from '../../lib/format'
import { dailyActivity, groupAccuracy, streak } from '../../lib/stats'
import { Badge, Button, Dot, Panel, ProgressBar, SectionTitle } from '../../ui/kit'

export default function Dashboard() {
  const nav = useNavigate()
  const data = useLiveQuery(async () => {
    const now = Date.now()
    const [courses, exams, cards, answers, reviews, attempts, sessions, files, goal] = await Promise.all([
      db.courses.toArray(),
      db.exams.where('date').aboveOrEqual(startOfDay(now)).sortBy('date'),
      db.cards.toArray(),
      db.answers.toArray(),
      db.reviews.toArray(),
      db.attempts.toArray(),
      db.studySessions.toArray(),
      db.files.toArray(),
      getSetting(db, 'dailyGoal', 30),
    ])
    const activity = dailyActivity(answers, reviews, attempts, sessions)
    const today = activity.get(startOfDay(now)) ?? { questions: 0, cards: 0, sec: 0 }
    const weak = groupAccuracy(answers, (a) => (a.topic ? `${a.courseId}\u0000${a.topic}` : undefined))
      .filter((b) => b.total >= 3 && b.percent < 70)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 4)
    return {
      courses: new Map(courses.map((c) => [c.id, c])),
      hasCourses: courses.length > 0,
      exams: exams.slice(0, 4),
      due: cards.filter((c) => c.due <= now).length,
      today,
      goal,
      streak: streak(activity),
      unfinished: attempts.filter((a) => !a.finishedAt && a.mode !== 'optik').sort((a, b) => b.updatedAt - a.updatedAt)[0],
      lastFile: files.filter((f) => f.lastPage).sort((a, b) => b.updatedAt - a.updatedAt)[0],
      weak,
      hasData: cards.length + answers.length + files.length > 0,
    }
  }, [])

  if (!data) return null
  const lastBackup = Number(localStorage.getItem('sonYedek') ?? 0)
  const backupStale = data.hasData && Date.now() - lastBackup > 7 * 86_400_000
  const doneToday = data.today.questions + data.today.cards

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-soft">{formatDate(Date.now())}</p>
          <h1 className="text-[2rem] leading-tight font-bold sm:text-[2.4rem]">Bugün ne çalışıyoruz?</h1>
        </div>
        <Link to="/ara" aria-label="Ara" title="Ara" className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface text-soft hover:border-pen hover:text-pen">
          <Search size={20} />
        </Link>
      </header>

      {!data.hasCourses ? (
        <Panel className="p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Başlamak için üç adım</h2>
          <ol className="mt-4 space-y-4">
            {(
              [
                ['Derslerini ekle', 'Her dersin kendi PDF’leri, testleri ve kartları olur.', '/dersler', 'Ders ekle'],
                ['İçeriği getir', 'Ders sunumlarını yükle; hazırlattığın kart ve soru JSON’larını içe aktar.', '/ice-aktar', 'JSON içe aktar'],
                ['Cihazlar arasında taşı', 'Tüm verini tek dosyayla telefona ya da bilgisayara aktar.', '/yedek', 'Yedekle ve taşı'],
              ] as [string, string, string, string][]
            ).map(([title, body, to, action], i) => (
              <li key={to} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-pen font-display font-bold text-pen">{i + 1}</span>
                <div className="min-w-48 flex-1">
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-soft">{body}</p>
                </div>
                <Button variant={i === 0 ? 'primary' : 'secondary'} size="sm" onClick={() => nav(to)}>
                  {action}
                </Button>
              </li>
            ))}
          </ol>
        </Panel>
      ) : (
        <div className="space-y-7">
          {data.exams.length > 0 && (
            <section>
              <SectionTitle action={<Link to="/takvim" className="text-sm font-semibold text-pen">Takvim</Link>}>Yaklaşan sınavlar</SectionTitle>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.exams.map((e, i) => {
                  const c = data.courses.get(e.courseId)
                  const d = daysUntil(e.date)
                  return (
                    <li key={e.id}>
                      <Link to={`/ders/${e.courseId}`} className="flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold">
                            {c && <Dot color={c.color} />}
                            <span className="truncate">{c?.name ?? 'Ders'}</span>
                          </p>
                          <p className="text-sm text-soft">
                            {EXAM_TYPE_LABEL[e.type]}, {formatDate(e.date, false)}
                          </p>
                        </div>
                        <span className={cx('tabular shrink-0 font-display text-xl font-bold', d <= 3 ? 'text-bad' : '')}>
                          <span className={i === 0 ? 'marker' : ''}>{countdownLabel(e.date)}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle>Bugün</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <Panel className="p-4">
                <p className="font-display text-4xl leading-none font-bold tabular">{data.due}</p>
                <p className="mt-1 text-soft">kart tekrar bekliyor</p>
                <Button className="mt-3 w-full" size="sm" variant={data.due ? 'primary' : 'secondary'} icon={<Layers size={16} />} disabled={!data.due} onClick={() => nav('/kart-calis?mod=tekrar')}>
                  {data.due ? 'Tekrar et' : 'Bugünlük bitti'}
                </Button>
              </Panel>
              <Panel className="p-4">
                <p className="font-display text-4xl leading-none font-bold tabular">
                  {doneToday}
                  <span className="text-xl text-soft"> / {data.goal}</span>
                </p>
                <p className="mt-1 mb-3 text-soft">günlük hedef (soru + kart)</p>
                <ProgressBar value={(doneToday / data.goal) * 100} tone="ok" />
                <p className="tabular mt-2 text-sm text-soft">
                  {data.today.questions} soru, {data.today.cards} kart{data.today.sec ? `, ${formatDuration(data.today.sec)}` : ''}
                </p>
              </Panel>
              <Panel className="p-4">
                <p className="flex items-center gap-2 font-display text-4xl leading-none font-bold tabular">
                  <Flame size={28} className={data.streak ? 'text-warn' : 'text-soft'} />
                  {data.streak}
                </p>
                <p className="mt-1 text-soft">günlük seri</p>
                <p className="mt-3 text-sm text-soft">{data.streak ? 'Seriyi sürdürmek için bugün de bir şey çöz.' : 'Bugün bir soru çöz ya da kart tekrar et, seri başlasın.'}</p>
              </Panel>
            </div>
          </section>

          {(data.unfinished || data.lastFile) && (
            <section>
              <SectionTitle>Kaldığın yerden</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.unfinished && (
                  <Link to={`/test/${data.unfinished.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                    <RotateCcw size={22} className="shrink-0 text-pen" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{data.unfinished.title}</span>
                      <span className="tabular text-sm text-soft">
                        {data.unfinished.currentIndex + 1}. soruda kaldın ({data.unfinished.questionIds.length} soru)
                      </span>
                    </span>
                  </Link>
                )}
                {data.lastFile && (
                  <Link to={`/dosya/${data.lastFile.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                    <FileText size={22} className="shrink-0 text-pen" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{data.lastFile.title}</span>
                      <span className="tabular text-sm text-soft">
                        {data.lastFile.lastPage}. sayfa{data.lastFile.pageCount ? ` / ${data.lastFile.pageCount}` : ''}
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          {data.weak.length > 0 && (
            <section>
              <SectionTitle action={<Link to="/istatistik" className="text-sm font-semibold text-pen">İstatistik</Link>}>Zayıf konular</SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.weak.map((b) => {
                  const [courseId, topic] = b.label.split('\u0000')
                  const c = data.courses.get(courseId)
                  return (
                    <li key={b.label}>
                      <Link to={`/ders/${courseId}/testler?karisik=1`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{topic}</span>
                          <span className="block truncate text-sm text-soft">{c?.name}</span>
                        </span>
                        <Badge tone={b.percent < 40 ? 'bad' : 'warn'}>
                          %{b.percent}, {b.total} cevap
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {backupStale && (
            <Panel className="flex flex-wrap items-center justify-between gap-3 bg-marker-wash px-4 py-3">
              <p className="flex items-center gap-2 font-semibold">
                <DatabaseBackup size={20} />
                {lastBackup ? 'Son yedeğin üzerinden bir haftadan fazla geçti.' : 'Bu cihazdan henüz yedek almadın.'}
              </p>
              <Button size="sm" onClick={() => nav('/yedek')}>
                Yedek al
              </Button>
            </Panel>
          )}
        </div>
      )}
    </>
  )
}
