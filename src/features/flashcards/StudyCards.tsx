import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lightbulb, Star } from 'lucide-react'
import { db, stamp } from '../../db/db'
import type { Card } from '../../db/schema'
import { cx, formatDuration, shuffle } from '../../lib/format'
import { RATING_LABEL, formatInterval, previewDue, rateCard, type Rating } from '../../lib/scheduler'
import { FocusBar } from '../../ui/Layout'
import { Markdown } from '../../ui/Markdown'
import { Button, Empty, IconButton, Panel, ProgressBar } from '../../ui/kit'

type Mode = 'tekrar' | 'hepsi' | 'bilemedim' | 'yildiz'
const MODE_TITLE: Record<Mode, string> = {
  tekrar: 'Aralıklı tekrar',
  hepsi: 'Sınav öncesi çalışma',
  bilemedim: 'Bilemediklerim',
  yildiz: 'Yıldızlı kartlar',
}

const RATE_STYLE: Record<Rating, string> = {
  1: 'border-bad text-bad hover:bg-bad-soft',
  2: 'border-warn text-warn hover:bg-warn-soft',
  3: 'border-ok text-ok hover:bg-ok-soft',
  4: 'border-pen text-pen hover:bg-pen-soft',
}

/** Kart çalışma oturumu. Kuyruk açılışta bir kez kurulur; "bilemedim" denen kart sona eklenir. */
export default function StudyCards() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const deckId = params.get('deste')
  const courseId = params.get('ders')
  const mode = (params.get('mod') as Mode) || 'tekrar'
  const reverse = params.get('ters') === '1'
  const mix = params.get('karisik') === '1'
  const fsrs = mode === 'tekrar'

  const [queue, setQueue] = useState<Card[] | null>(null)
  const [total, setTotal] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hint, setHint] = useState(false)
  const [tally, setTally] = useState({ known: 0, unknown: 0 })
  const [drag, setDrag] = useState(0)
  const [finishedSec, setFinishedSec] = useState<number | null>(null)
  const startedAt = useRef(Date.now())
  const down = useRef<{ x: number; y: number } | null>(null)
  const busy = useRef(false)
  const backPath = deckId ? `/deste/${deckId}` : courseId ? `/ders/${courseId}/kartlar` : '/tekrar'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let cards = deckId
        ? await db.cards.where('deckId').equals(deckId).toArray()
        : courseId
          ? await db.cards.where('courseId').equals(courseId).toArray()
          : await db.cards.toArray()
      const now = Date.now()
      if (mode === 'tekrar') cards = cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due)
      else if (mode === 'yildiz') cards = cards.filter((c) => c.starred)
      else if (mode === 'bilemedim') {
        const reviews = await db.reviews.where('cardId').anyOf(cards.map((c) => c.id)).toArray()
        const last = new Map<string, number>()
        for (const r of reviews.sort((a, b) => a.at - b.at)) last.set(r.cardId, r.rating)
        cards = cards.filter((c) => (last.get(c.id) ?? 9) <= 2)
      } else cards.sort((a, b) => a.createdAt - b.createdAt)
      if (mix) cards = shuffle(cards)
      if (cancelled) return
      setQueue(cards)
      setTotal(cards.length)
    })()
    return () => {
      cancelled = true
    }
  }, [deckId, courseId, mode, mix])

  // Oturum süresini kaydet.
  useEffect(() => {
    const started = startedAt.current
    return () => {
      const sec = Math.min(3 * 3600, Math.round((Date.now() - started) / 1000))
      if (sec >= 20) void db.studySessions.add(stamp({ courseId: courseId ?? undefined, kind: 'kart' as const, startedAt: started, durationSec: sec }))
    }
  }, [courseId])

  const card = queue?.[0]

  const next = useCallback((again: Card | null) => {
    setQueue((q) => {
      if (!q) return q
      const rest = q.slice(1)
      if (again) return [...rest, again]
      return rest
    })
    if (!again) setDoneCount((n) => n + 1)
    setFlipped(false)
    setHint(false)
    setDrag(0)
  }, [])

  useEffect(() => {
    if (queue && !queue.length && total > 0 && finishedSec === null) setFinishedSec(Math.round((Date.now() - startedAt.current) / 1000))
  }, [queue, total, finishedSec])

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || busy.current) return
      busy.current = true
      try {
        const now = Date.now()
        await db.reviews.add(stamp({ cardId: card.id, courseId: card.courseId, rating, mode: fsrs ? ('fsrs' as const) : ('cram' as const), at: now }))
        if (rating >= 3) setTally((t) => ({ ...t, known: t.known + 1 }))
        else setTally((t) => ({ ...t, unknown: t.unknown + 1 }))
        if (fsrs) {
          const state = rateCard(card.fsrs, rating, now)
          await db.cards.update(card.id, { fsrs: state, due: state.due, updatedAt: now })
          // Kısa süre sonra tekrar gelecek kart bu oturumda yeniden sorulur.
          next(rating === 1 ? { ...card, fsrs: state, due: state.due } : null)
        } else next(rating < 3 ? card : null)
      } finally {
        busy.current = false
      }
    },
    [card, fsrs, next],
  )

  // Klavye: Boşluk çevirir; 1–4 puanlar; sınav öncesi modda ← bilemedim, → bildim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest('input, textarea, [role="dialog"]') || !card) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped) {
        if (fsrs && /^[1-4]$/.test(e.key)) void rate(Number(e.key) as Rating)
        else if (!fsrs && (e.key === 'ArrowLeft' || e.key === '1')) void rate(1)
        else if (!fsrs && (e.key === 'ArrowRight' || e.key === '2')) void rate(3)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, flipped, fsrs, rate])

  const toggleStar = async () => {
    if (!card) return
    const starred = !card.starred
    await db.cards.update(card.id, { starred, updatedAt: Date.now() })
    setQueue((q) => q && q.map((c) => (c.id === card.id ? { ...c, starred } : c)))
  }

  if (!queue) return null

  if (!total)
    return (
      <div className="min-h-dvh">
        <FocusBar title={MODE_TITLE[mode]} backTo={backPath} />
        <div className="mx-auto max-w-xl p-6">
          <Empty title={mode === 'tekrar' ? 'Şu an tekrar edilecek kart yok' : 'Bu seçime uyan kart yok'} action={<Button onClick={() => nav(backPath)}>Geri dön</Button>}>
            {mode === 'tekrar' ? 'Zamanı gelen kartlar burada görünür. İstersen destenin tamamını sınav öncesi modda çalışabilirsin.' : undefined}
          </Empty>
        </div>
      </div>
    )

  if (!card)
    return (
      <div className="min-h-dvh">
        <FocusBar title={MODE_TITLE[mode]} backTo={backPath} />
        <div className="mx-auto max-w-xl space-y-4 p-6">
          <Panel className="p-6 text-center">
            <p className="font-display text-3xl font-bold">
              <span className="marker">{total} kart</span> bitti
            </p>
            <p className="tabular mt-2 text-soft">
              {tally.known} bildin, {tally.unknown} kez takıldın, {formatDuration(finishedSec ?? 0)}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => nav(backPath)}>
                Tamam
              </Button>
              {!fsrs && <Button onClick={() => nav(0)}>Bir tur daha</Button>}
            </div>
          </Panel>
        </div>
      </div>
    )

  const front = reverse ? card.back : card.front
  const back = reverse ? card.front : card.back
  const preview = fsrs ? previewDue(card.fsrs, Date.now()) : null
  const now = Date.now()

  return (
    <div className="flex min-h-dvh flex-col">
      <FocusBar title={MODE_TITLE[mode]} subtitle={`${doneCount} / ${total} kart, ${queue.length} kaldı`} backTo={backPath}>
        <IconButton label={card.starred ? 'Yıldızı kaldır' : 'Kartı yıldızla'} active={card.starred} onClick={toggleStar}>
          <Star size={20} fill={card.starred ? 'currentColor' : 'none'} />
        </IconButton>
      </FocusBar>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4 pb-6">
        <ProgressBar value={(doneCount / total) * 100} tone="ok" />

        <div
          className="flip-scene my-5 flex flex-1 touch-pan-y flex-col select-none"
          style={{ transform: `translateX(${drag}px) rotate(${drag / 40}deg)`, transition: down.current ? 'none' : 'transform 0.2s' }}
          onPointerDown={(e) => {
            down.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerMove={(e) => {
            if (!down.current || !flipped) return
            const dx = e.clientX - down.current.x
            if (Math.abs(dx) > 12) setDrag(dx)
          }}
          onPointerUp={(e) => {
            const start = down.current
            down.current = null
            if (!start) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (flipped && Math.abs(dx) > 90) return void rate(dx > 0 ? 3 : 1)
            setDrag(0)
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !(e.target as HTMLElement).closest('a, button')) setFlipped((f) => !f)
          }}
          onPointerCancel={() => {
            down.current = null
            setDrag(0)
          }}
        >
          <div className={cx('flip-card min-h-72 flex-1', flipped && 'is-flipped')}>
            <div className="flip-face flex flex-col rounded-2xl border-2 border-line bg-surface p-5 sm:p-7" aria-hidden={flipped}>
              <div className="flex flex-1 items-center justify-center">
                <Markdown className="w-full text-center text-xl">{front}</Markdown>
              </div>
              <div className="mt-4 flex min-h-10 items-center justify-between gap-3 text-sm text-soft">
                {card.hint && !reverse ? (
                  hint ? (
                    <span className="flex items-start gap-1.5 text-warn">
                      <Lightbulb size={16} className="mt-0.5 shrink-0" />
                      {card.hint}
                    </span>
                  ) : (
                    <button type="button" tabIndex={flipped ? -1 : 0} onClick={() => setHint(true)} className="flex items-center gap-1.5 font-semibold underline">
                      <Lightbulb size={16} />
                      İpucu göster
                    </button>
                  )
                ) : (
                  <span>{card.topic}</span>
                )}
                <span className="ml-auto">Çevirmek için dokun</span>
              </div>
            </div>
            <div className="flip-face is-back flex flex-col rounded-2xl border-2 border-pen bg-surface p-5 sm:p-7" aria-hidden={!flipped}>
              <div className="flex flex-1 items-center justify-center">
                <Markdown className="w-full text-center text-lg">{back}</Markdown>
              </div>
              <p className="mt-4 text-center text-sm text-soft">Sağa kaydır: bildim, sola kaydır: bilemedim</p>
            </div>
          </div>
        </div>

        {!flipped ? (
          <Button variant="primary" className="w-full" onClick={() => setFlipped(true)}>
            Cevabı göster
          </Button>
        ) : fsrs ? (
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => rate(r)}
                className={cx('flex min-h-14 flex-col items-center justify-center rounded-lg border-2 bg-surface font-semibold transition-colors', RATE_STYLE[r])}
              >
                <span>{RATING_LABEL[r]}</span>
                <span className="tabular text-xs font-normal text-soft">{formatInterval(preview![r] - now)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => rate(1)} className={cx('min-h-14 rounded-lg border-2 bg-surface font-semibold', RATE_STYLE[1])}>
              Bilemedim
            </button>
            <button type="button" onClick={() => rate(3)} className={cx('min-h-14 rounded-lg border-2 bg-surface font-semibold', RATE_STYLE[3])}>
              Bildim
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
