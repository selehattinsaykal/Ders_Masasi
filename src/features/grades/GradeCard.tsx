import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { db, patch } from '../../db/db'
import type { Course, GradingScheme } from '../../db/schema'
import { cx } from '../../lib/format'
import { defaultScheme, evaluateGrade, type GradeResult } from '../../lib/grade'
import { IconButton, Panel } from '../../ui/kit'

const num = (v: string): number | undefined => {
  const t = v.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined
}

function Headline({ r, scheme }: { r: GradeResult; scheme: GradingScheme }) {
  const last = scheme.parts[scheme.parts.length - 1]?.name ?? 'Final'
  const who = r.remaining.length === 1 ? `${r.remaining[0]}’den` : `kalan sınavların her birinden`
  switch (r.status) {
    case 'invalid':
      return <p className="font-semibold text-warn">{r.reason}</p>
    case 'need':
      return (
        <p className="text-lg">
          Geçmek için {who} en az{' '}
          <span className="marker font-display text-3xl font-bold tabular">{r.needed}</span> almalısın.
          {r.needed !== r.neededForAverage && <span className="block text-sm text-soft">Ortalama için {r.neededForAverage} yeterdi ama {last} barajı {scheme.finalMin}.</span>}
        </p>
      )
    case 'safe':
      return (
        <p className="text-lg">
          Ortalaman şimdiden yetiyor.
          {r.needed ? (
            <>
              {' '}
              {last} barajı için en az <span className="marker font-display text-3xl font-bold tabular">{r.needed}</span> alman yeter.
            </>
          ) : (
            ' Kalan sınavlar için bir alt sınır yok.'
          )}
        </p>
      )
    case 'impossible':
      return (
        <p className="text-lg text-bad">
          {who.charAt(0).toUpperCase() + who.slice(1)} {r.needed} gerekiyor; 100 alsan da ortalama yetmiyor. Bütünlemede final notu yerine büt notunu girerek yeniden hesapla.
        </p>
      )
    case 'passed':
      return (
        <p className="text-lg">
          Ortalaman <span className="marker font-display text-3xl font-bold tabular">{r.average}</span>, <span className="font-semibold text-ok">geçiyorsun</span>.
        </p>
      )
    case 'failed':
      return (
        <p className="text-lg">
          Ortalaman <span className="font-display text-3xl font-bold tabular">{r.average ?? '–'}</span>, <span className="font-semibold text-bad">geçme notunun altında</span>.
          {r.reason && <span className="block text-sm text-soft">{r.reason}</span>}
        </p>
      )
  }
}

/** Dersin not hesabı: ağırlıkları ve notları gir, gereken notu gör. Yazdıkça kaydeder. */
export function GradeCard({ course, compact }: { course: Course; compact?: boolean }) {
  const [s, setS] = useState<GradingScheme>(() => course.grading ?? defaultScheme())
  const [texts, setTexts] = useState<Record<string, string>>({})
  const first = useRef(true)

  // Başka bir cihazdan/yedekten gelen değişikliği al (düzenleme sırasında değil).
  useEffect(() => {
    if (course.grading && JSON.stringify(course.grading) !== JSON.stringify(s)) setS(course.grading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => void patch(db.courses, course.id, { grading: s }), 400)
    return () => clearTimeout(t)
  }, [s, course.id])

  const r = evaluateGrade(s)
  const setPart = (id: string, change: Partial<GradingScheme['parts'][number]>) =>
    setS((x) => ({ ...x, parts: x.parts.map((p) => (p.id === id ? { ...p, ...change } : p)) }))
  const field = (key: string, value: number | undefined) => (key in texts ? texts[key] : value == null ? '' : String(value))
  const onText = (key: string, v: string, apply: (n: number | undefined) => void) => {
    setTexts((t) => ({ ...t, [key]: v }))
    apply(num(v))
  }
  const input = 'h-10 w-full rounded-lg border border-line bg-surface px-2 text-center tabular focus:border-pen focus:outline-none focus:ring-2 focus:ring-pen/25'

  return (
    <Panel className="space-y-4 p-4 sm:p-5">
      {!compact && <h2 className="text-lg font-semibold">{course.name}</h2>}
      <Headline r={r} scheme={s} />

      <table className="w-full border-separate border-spacing-y-1.5 text-[15px]">
        <thead>
          <tr className="text-left text-sm text-soft">
            <th className="font-semibold">Sınav</th>
            <th className="w-20 text-center font-semibold">Ağırlık %</th>
            <th className="w-20 text-center font-semibold">Notun</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {s.parts.map((p, i) => (
            <tr key={p.id}>
              <td className="pr-2">
                <input value={p.name} onChange={(e) => setPart(p.id, { name: e.target.value })} aria-label={`${i + 1}. sınavın adı`} className={cx(input, 'text-left font-semibold')} />
              </td>
              <td className="pr-2">
                <input inputMode="decimal" value={field(`w${p.id}`, p.weight)} onChange={(e) => onText(`w${p.id}`, e.target.value, (n) => setPart(p.id, { weight: n ?? 0 }))} aria-label={`${p.name} ağırlığı`} className={input} />
              </td>
              <td className="pr-1">
                <input
                  inputMode="decimal"
                  value={field(`s${p.id}`, p.score)}
                  placeholder="?"
                  onChange={(e) => onText(`s${p.id}`, e.target.value, (n) => setPart(p.id, { score: n }))}
                  aria-label={`${p.name} notu`}
                  className={cx(input, p.score == null && 'border-dashed')}
                />
              </td>
              <td>
                <IconButton label={`${p.name} satırını sil`} disabled={s.parts.length <= 1} onClick={() => setS((x) => ({ ...x, parts: x.parts.filter((q) => q.id !== p.id) }))}>
                  <Trash2 size={17} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => setS((x) => ({ ...x, parts: [...x.parts.slice(0, -1), { id: crypto.randomUUID(), name: 'Quiz', weight: 0 }, ...x.parts.slice(-1)] }))}
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-pen"
      >
        <Plus size={16} />
        Sınav ekle (quiz, ödev, proje)
      </button>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Geçme notu</span>
          <input inputMode="decimal" value={field('passing', s.passing)} onChange={(e) => onText('passing', e.target.value, (n) => setS((x) => ({ ...x, passing: n ?? 0 })))} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{s.parts[s.parts.length - 1]?.name || 'Final'} barajı</span>
          <input inputMode="decimal" placeholder="yok" value={field('finalMin', s.finalMin)} onChange={(e) => onText('finalMin', e.target.value, (n) => setS((x) => ({ ...x, finalMin: n || undefined })))} className={input} />
        </label>
      </div>
      <p className="text-sm text-soft">
        Notunu henüz bilmediğin sınavları boş bırak. Son satır final kabul edilir; bütünlemeye kaldıysan final notu yerine büt notunu yaz. Harf notu bağıl hesaplanıyorsa sonuç yalnızca yol gösterir.
      </p>
    </Panel>
  )
}
