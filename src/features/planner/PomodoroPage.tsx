import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { db } from '../../db/db'
import { clock, formatDuration, startOfDay } from '../../lib/format'
import { Button, Field, Input, PageHeader, Panel, Select } from '../../ui/kit'
import { usePomodoro } from './pomodoro-context'

export default function PomodoroPage() {
  const p = usePomodoro()
  const courses = useLiveQuery(() => db.courses.toArray(), [], [])
  const today = useLiveQuery(
    () => db.studySessions.where('startedAt').aboveOrEqual(startOfDay(Date.now())).filter((s) => s.kind === 'pomodoro').toArray(),
    [],
    [],
  )

  const progress = 1 - p.remainingSec / p.totalSec
  const R = 108
  const C = 2 * Math.PI * R
  const idle = !p.running && p.pausedLeft === undefined

  return (
    <>
      <PageHeader title="Pomodoro" subtitle="Odaklan, kısa mola ver, tekrarla. Odak süreleri çalışma istatistiğine eklenir." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel className="flex flex-col items-center px-4 py-8">
          <p className="mb-4 font-display text-xl font-semibold">
            <span className="marker">{p.phase === 'work' ? 'Odak' : 'Mola'}</span>
          </p>
          <div className="relative grid place-items-center">
            <svg viewBox="0 0 240 240" className="size-60 -rotate-90" aria-hidden>
              <circle cx="120" cy="120" r={R} fill="none" stroke="var(--sunken)" strokeWidth="12" />
              <circle
                cx="120"
                cy="120"
                r={R}
                fill="none"
                stroke={p.phase === 'work' ? 'var(--pen)' : 'var(--ok)'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <p className="absolute font-display text-6xl font-bold tabular" role="timer" aria-live="off">
              {clock(p.remainingSec)}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {p.running ? (
              <Button variant="primary" icon={<Pause size={18} />} onClick={p.pause}>
                Duraklat
              </Button>
            ) : (
              <Button variant="primary" icon={<Play size={18} />} onClick={p.start}>
                {idle ? 'Başlat' : 'Devam et'}
              </Button>
            )}
            <Button icon={<SkipForward size={18} />} onClick={p.skip}>
              {p.phase === 'work' ? 'Molaya geç' : 'Molayı atla'}
            </Button>
            <Button variant="ghost" icon={<RotateCcw size={18} />} onClick={p.reset} disabled={idle && p.phase === 'work'}>
              Sıfırla
            </Button>
          </div>
          <p className="tabular mt-5 text-soft">
            Bugün {today.length} odak, {formatDuration(today.reduce((n, s) => n + s.durationSec, 0))}
          </p>
        </Panel>

        <div className="space-y-4">
          <Field label="Hangi ders için?" hint="Süre bu dersin istatistiğine yazılır.">
            <Select value={p.courseId ?? ''} onChange={(e) => p.configure({ courseId: e.target.value || undefined })}>
              <option value="">Derse bağlı değil</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Odak (dk)">
              <Input
                type="number"
                min={5}
                max={120}
                value={p.workMin}
                disabled={!idle}
                onChange={(e) => p.configure({ workMin: Math.max(1, Math.min(180, Number(e.target.value) || 25)) })}
              />
            </Field>
            <Field label="Mola (dk)">
              <Input
                type="number"
                min={1}
                max={60}
                value={p.breakMin}
                disabled={!idle}
                onChange={(e) => p.configure({ breakMin: Math.max(1, Math.min(60, Number(e.target.value) || 5)) })}
              />
            </Field>
          </div>
          {!idle && <p className="text-sm text-soft">Süreleri değiştirmek için önce sayacı sıfırla.</p>}
        </div>
      </div>
    </>
  )
}
