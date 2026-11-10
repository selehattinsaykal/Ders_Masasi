import { cx, formatShortDate } from '../lib/format'
import type { Bucket } from '../lib/stats'

/** Konu ya da tip bazında başarı çubukları. */
export function AccuracyBars({ buckets, empty }: { buckets: Bucket[]; empty: string }) {
  if (!buckets.length) return <p className="text-soft">{empty}</p>
  return (
    <ul className="space-y-3">
      {buckets.map((b) => (
        <li key={b.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate font-semibold">{b.label}</span>
            <span className="tabular shrink-0 text-sm text-soft">
              {b.correct} doğru, {b.wrong} yanlış
              {b.partial ? `, ${b.partial} kısmen` : ''}
              <span className={cx('ml-2 font-bold', b.percent >= 70 ? 'text-ok' : b.percent >= 40 ? 'text-warn' : 'text-bad')}>
                %{b.percent}
              </span>
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken">
            <div className="bg-ok" style={{ width: `${(b.correct / b.total) * 100}%` }} />
            <div className="bg-warn" style={{ width: `${(b.partial / b.total) * 100}%` }} />
            <div className="bg-bad" style={{ width: `${(b.wrong / b.total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Denemelerin başarı yüzdesi, zaman sırasıyla. */
export function TrendLine({ points }: { points: { at: number; percent: number; label: string }[] }) {
  if (points.length < 2) return <p className="text-soft">Eğilimi görmek için en az iki deneme bitir.</p>
  const W = 600
  const H = 180
  const padX = 14
  const padTop = 12
  const padBottom = 26
  const x = (i: number) => padX + (i * (W - padX * 2)) / (points.length - 1)
  const y = (p: number) => padTop + ((100 - p) * (H - padTop - padBottom)) / 100
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.percent).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Denemelerde başarı yüzdesi eğilimi">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g === 50 ? '4 4' : undefined} />
          <text x={W - padX} y={y(g) - 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)">
            %{g}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--pen)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.percent)} r="4.5" fill="var(--surface)" stroke="var(--pen)" strokeWidth="2.5">
          <title>{`${p.label}: %${p.percent} (${formatShortDate(p.at)})`}</title>
        </circle>
      ))}
      <text x={padX} y={H - 6} fontSize="11" fill="var(--ink-soft)">
        {formatShortDate(points[0].at)}
      </text>
      <text x={W - padX} y={H - 6} textAnchor="end" fontSize="11" fill="var(--ink-soft)">
        {formatShortDate(points[points.length - 1].at)}
      </text>
    </svg>
  )
}

/** Gün gün sütunlar (ör. son 14 günde çözülen soru). */
export function DayColumns({ days, unit, highlight = 'last' }: { days: { at: number; value: number }[]; unit: string; highlight?: 'first' | 'last' }) {
  const max = Math.max(1, ...days.map((d) => d.value))
  return (
    <div className="flex h-32 items-end gap-1" role="img" aria-label={`Günlük ${unit}`}>
      {days.map((d, i) => (
        <div key={d.at} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${formatShortDate(d.at)}: ${d.value} ${unit}`}>
          <span className="tabular text-[11px] text-soft">{d.value || ''}</span>
          <div
            className={cx('w-full rounded-t-sm', i === (highlight === 'last' ? days.length - 1 : 0) ? 'bg-marker' : 'bg-pen')}
            style={{ height: `${Math.max(d.value ? 4 : 1.5, (d.value / max) * 78)}%`, opacity: d.value ? 1 : 0.25 }}
          />
          <span className="text-[10px] text-soft">{new Date(d.at).getDate()}</span>
        </div>
      ))}
    </div>
  )
}

/** Son haftaların etkinlik ısı haritası. Sütunlar hafta, satırlar gün (Pzt–Paz). */
export function Heatmap({ days }: { days: { at: number; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value))
  // İlk günü pazartesiye hizala.
  const lead = (new Date(days[0].at).getDay() + 6) % 7
  const cells: ({ at: number; value: number } | null)[] = [...Array<null>(lead).fill(null), ...days]
  const level = (v: number) => (v === 0 ? 0 : v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1)
  const fill = ['var(--sunken)', 'color-mix(in srgb, var(--pen) 35%, var(--surface))', 'color-mix(in srgb, var(--pen) 68%, var(--surface))', 'var(--pen)']
  return (
    <div className="overflow-x-auto">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Günlük etkinlik ısı haritası">
        {cells.map((c, i) =>
          c ? (
            <div
              key={i}
              className="size-3.5 rounded-[3px] border border-line/60"
              style={{ background: fill[level(c.value)] }}
              title={`${formatShortDate(c.at)}: ${c.value} etkinlik`}
            />
          ) : (
            <div key={i} className="size-3.5" />
          ),
        )}
      </div>
    </div>
  )
}
