import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  ClipboardCheck,
  Contrast,
  Maximize,
  Search,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { db, patch, removeRows, stamp } from '../../db/db'
import type { StudyFile } from '../../db/schema'
import { cx } from '../../lib/format'
import { openPdf, pageText, type PdfDoc } from '../../lib/pdf'
import { FocusBar } from '../../ui/Layout'
import { Button, Empty, IconButton, Input, Textarea } from '../../ui/kit'
import { OpticalPanel } from './OpticalPanel'

type PanelKind = 'marks' | 'search' | 'optik' | null
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const MAX_CANVAS_AREA = 14_000_000

function PageCanvas({ doc, n, width, active, onRatio }: { doc: PdfDoc; n: number; width: number; active: boolean; onRatio: (n: number, r: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (!active || width < 10) {
      // Görünmeyen sayfanın belleğini bırak.
      canvas.width = 0
      canvas.height = 0
      return
    }
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    void (async () => {
      try {
        const page = await doc.getPage(n)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        onRatio(n, base.height / base.width)
        let scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2)
        const area = base.width * base.height * scale * scale
        if (area > MAX_CANVAS_AREA) scale *= Math.sqrt(MAX_CANVAS_AREA / area)
        const viewport = page.getViewport({ scale })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        task = page.render({ canvas, canvasContext: ctx, viewport })
        await task.promise
      } catch {
        /* iptal edilen çizim */
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, n, width, active, onRatio])

  return <canvas ref={ref} className="block h-full w-full" />
}

export default function PdfViewerPage() {
  const { id = '' } = useParams()
  const file = useLiveQuery(() => db.files.get(id).then((f) => f ?? null), [id])
  const marks = useLiveQuery(() => db.bookmarks.where('fileId').equals(id).sortBy('page'), [id], [])

  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [invert, setInvert] = useState(false)
  const [panel, setPanel] = useState<PanelKind>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  const [ratios, setRatios] = useState<number[]>([])
  const [visible, setVisible] = useState<Set<number>>(new Set([1]))

  const scroller = useRef<HTMLDivElement>(null)
  const pageEls = useRef<(HTMLDivElement | null)[]>([])
  const restored = useRef(false)
  const pageRef = useRef(1)

  // Belgeyi aç.
  useEffect(() => {
    let cancelled = false
    let opened: PdfDoc | null = null
    restored.current = false
    setDoc(null)
    setError('')
    void (async () => {
      try {
        const f = await db.files.get(id)
        if (!f) return
        const b = await db.blobs.get(f.blobId)
        if (!b) throw new Error('PDF verisi bu cihazda yok. PDF’siz bir yedekten geri yüklenmiş olabilir.')
        const d = await openPdf(b.data)
        if (cancelled) return void d.loadingTask.destroy()
        opened = d
        const first = await d.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        setRatios(Array(d.numPages).fill(vp.height / vp.width))
        setDoc(d)
        if (f.pageCount !== d.numPages) await db.files.update(f.id, { pageCount: d.numPages })
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'PDF açılamadı.')
      }
    })()
    return () => {
      cancelled = true
      void opened?.loadingTask.destroy()
    }
  }, [id])

  // Okuma süresini kaydet (sekme görünürken).
  useEffect(() => {
    let visibleSince = document.hidden ? 0 : Date.now()
    let total = 0
    const started = Date.now()
    const onVis = () => {
      if (document.hidden && visibleSince) {
        total += Date.now() - visibleSince
        visibleSince = 0
      } else if (!document.hidden) visibleSince = Date.now()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (visibleSince) total += Date.now() - visibleSince
      const sec = Math.min(3 * 3600, Math.round(total / 1000))
      if (sec >= 30)
        void db.files.get(id).then((f) => {
          if (f) void db.studySessions.add(stamp({ courseId: f.courseId, kind: 'pdf' as const, startedAt: started, durationSec: sec }))
        })
    }
  }, [id])

  // Kapsayıcı genişliği.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    setBoxWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [doc])

  const pageWidth = Math.max(0, Math.round(Math.min(boxWidth - 16, 1040) * zoom))

  // Görünür sayfaları izle.
  useEffect(() => {
    const root = scroller.current
    if (!root || !doc) return
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev)
          for (const e of entries) {
            const n = Number((e.target as HTMLElement).dataset.page)
            if (e.isIntersecting) next.add(n)
            else next.delete(n)
          }
          return next
        })
      },
      { root, rootMargin: '900px 0px' },
    )
    pageEls.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [doc])

  const goTo = useCallback((n: number, smooth = false) => {
    const el = pageEls.current[n - 1]
    const root = scroller.current
    if (el && root) root.scrollTo({ top: el.offsetTop - 8, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Kaldığın sayfaya dön (ilk açılışta).
  useEffect(() => {
    if (!doc || !file || restored.current || !pageWidth) return
    restored.current = true
    const start = Math.min(file.lastPage ?? 1, doc.numPages)
    pageRef.current = start
    setPage(start)
    setPageInput(String(start))
    if (start > 1) requestAnimationFrame(() => goTo(start))
  }, [doc, file, pageWidth, goTo])

  // Yakınlaştırma ya da genişlik değişince aynı sayfada kal.
  useLayoutEffect(() => {
    if (restored.current) goTo(pageRef.current)
  }, [pageWidth, goTo])

  // Geçerli sayfayı kaydırmadan hesapla.
  useEffect(() => {
    const root = scroller.current
    if (!root || !doc) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = root.scrollTop + root.clientHeight * 0.35
        let current = 1
        for (let i = 0; i < pageEls.current.length; i++) {
          const el = pageEls.current[i]
          if (el && el.offsetTop <= mid) current = i + 1
          else break
        }
        if (current !== pageRef.current) {
          pageRef.current = current
          setPage(current)
          setPageInput(String(current))
        }
      })
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [doc])

  // Kalınan sayfayı gecikmeli kaydet.
  useEffect(() => {
    if (!doc || !restored.current) return
    const t = setTimeout(() => void patch(db.files, id, { lastPage: page }), 700)
    return () => clearTimeout(t)
  }, [page, doc, id])

  const onRatio = useCallback((n: number, r: number) => {
    setRatios((prev) => (Math.abs((prev[n - 1] ?? 0) - r) < 0.002 ? prev : prev.map((x, i) => (i === n - 1 ? r : x))))
  }, [])

  if (file === undefined) return null
  if (file === null) return <div className="p-6"><Empty title="Bu PDF bulunamadı">Silinmiş olabilir.</Empty></div>

  const marked = marks.find((m) => m.page === page)
  const toggleMark = async () => {
    if (marked) await removeRows(db, 'bookmarks', [marked.id])
    else await db.bookmarks.add(stamp({ fileId: id, courseId: file.courseId, page, note: '' }))
  }
  const step = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001)
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))])
  }
  const toggle = (p: PanelKind) => setPanel((cur) => (cur === p ? null : p))

  return (
    <div className="flex h-dvh flex-col bg-sunken">
      <FocusBar title={file.title} subtitle={doc ? `${page} / ${doc.numPages}` : 'Açılıyor…'} backTo={`/ders/${file.courseId}/materyaller`}>
        <IconButton label={marked ? 'Yer imini kaldır' : 'Bu sayfaya yer imi koy'} active={!!marked} onClick={toggleMark} disabled={!doc}>
          {marked ? <BookmarkCheck size={20} /> : <BookmarkIcon size={20} />}
        </IconButton>
      </FocusBar>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-1">
        <IconButton label="Uzaklaştır" onClick={() => step(-1)} disabled={zoom <= ZOOMS[0]}>
          <ZoomOut size={19} />
        </IconButton>
        <button type="button" onClick={() => setZoom(1)} className="tabular min-w-12 rounded-md px-1 text-sm font-semibold text-soft hover:text-ink" title="Genişliğe sığdır">
          %{Math.round(zoom * 100)}
        </button>
        <IconButton label="Yakınlaştır" onClick={() => step(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]}>
          <ZoomIn size={19} />
        </IconButton>
        <form
          className="mx-1 flex items-center gap-1.5 text-sm text-soft"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Math.max(1, Math.min(doc?.numPages ?? 1, Number(pageInput) || 1))
            goTo(n)
          }}
        >
          <label htmlFor="pdf-page" className="sr-only">
            Sayfaya git
          </label>
          <input
            id="pdf-page"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setPageInput(String(page))}
            className="tabular h-9 w-12 rounded-md border border-line bg-surface text-center font-semibold text-ink"
          />
          <span className="tabular whitespace-nowrap">/ {doc?.numPages ?? '…'}</span>
        </form>
        <span className="mx-1 h-6 w-px shrink-0 bg-line" />
        <IconButton label="Yer imleri ve notlar" active={panel === 'marks'} onClick={() => toggle('marks')}>
          <span className="relative">
            <BookmarkIcon size={19} />
            {marks.length > 0 && <span className="absolute -top-1.5 -right-2 rounded-full bg-pen px-1 text-[10px] leading-4 font-bold text-on-pen">{marks.length}</span>}
          </span>
        </IconButton>
        <IconButton label="PDF içinde ara" active={panel === 'search'} onClick={() => toggle('search')}>
          <Search size={19} />
        </IconButton>
        <IconButton label="Optik form" active={panel === 'optik'} onClick={() => toggle('optik')}>
          <ClipboardCheck size={19} />
        </IconButton>
        <IconButton label="Renkleri ters çevir (gece okuma)" active={invert} onClick={() => setInvert((v) => !v)}>
          <Contrast size={19} />
        </IconButton>
        <IconButton
          label="Tam ekran"
          className="hidden sm:inline-grid"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
        >
          <Maximize size={19} />
        </IconButton>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={scroller} className={cx('relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]', invert && 'pdf-invert')}>
          {error && <div className="p-6"><Empty title="PDF açılamadı">{error}</Empty></div>}
          {!doc && !error && <p className="p-6 text-center text-soft">PDF açılıyor…</p>}
          {doc && (
            <div className="mx-auto flex w-max min-w-full flex-col items-center gap-2 px-2 py-2">
              {ratios.map((r, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    pageEls.current[i] = el
                  }}
                  data-page={i + 1}
                  className="bg-white shadow-sm"
                  style={{ width: pageWidth, height: Math.round(pageWidth * r) }}
                >
                  <PageCanvas doc={doc} n={i + 1} width={pageWidth} active={visible.has(i + 1)} onRatio={onRatio} />
                </div>
              ))}
            </div>
          )}
        </div>

        {panel && (
          <aside className="safe-bottom flex max-h-[52dvh] min-h-0 w-full shrink-0 flex-col border-t border-line bg-surface lg:max-h-none lg:w-[22rem] lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between border-b border-line py-1 pr-1 pl-4">
              <h2 className="font-semibold">{panel === 'marks' ? 'Yer imleri ve notlar' : panel === 'search' ? 'PDF içinde ara' : 'Optik form'}</h2>
              <IconButton label="Paneli kapat" onClick={() => setPanel(null)}>
                <X size={19} />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel === 'marks' && <MarksPanel file={file} page={page} goTo={(n) => goTo(n, true)} />}
              {panel === 'search' && doc && <SearchPanel doc={doc} goTo={(n) => goTo(n)} />}
              {panel === 'optik' && <OpticalPanel file={file} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function MarksPanel({ file, page, goTo }: { file: StudyFile; page: number; goTo: (n: number) => void }) {
  const marks = useLiveQuery(() => db.bookmarks.where('fileId').equals(file.id).sortBy('page'), [file.id], [])
  const [note, setNote] = useState('')
  const here = marks.find((m) => m.page === page)

  const add = async () => {
    if (here) await patch(db.bookmarks, here.id, { note: [here.note, note.trim()].filter(Boolean).join('\n') })
    else await db.bookmarks.add(stamp({ fileId: file.id, courseId: file.courseId, page, note: note.trim() }))
    setNote('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${page}. sayfa için not (isteğe bağlı)`} aria-label="Sayfa notu" />
        <Button variant="primary" size="sm" onClick={add} disabled={!!here && !note.trim()}>
          {here ? 'Notu bu sayfaya ekle' : `${page}. sayfaya yer imi koy`}
        </Button>
      </div>
      {!marks.length ? (
        <p className="text-soft">Henüz yer imi yok. Sınavda çıkabilecek sayfaları işaretle, yanına not düş.</p>
      ) : (
        <ul className="space-y-2">
          {marks.map((m) => (
            <li key={m.id} className={cx('flex items-start gap-1 rounded-lg border px-1 py-1', m.page === page ? 'border-pen bg-pen-soft' : 'border-line')}>
              <button type="button" onClick={() => goTo(m.page)} className="min-w-0 flex-1 px-2 py-1 text-left">
                <span className="tabular font-semibold">{m.page}. sayfa</span>
                {m.note && <span className="mt-0.5 block text-sm whitespace-pre-wrap text-soft">{m.note}</span>}
              </button>
              <IconButton label="Yer imini sil" onClick={() => removeRows(db, 'bookmarks', [m.id])}>
                <Trash2 size={17} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchPanel({ doc, goTo }: { doc: PdfDoc; goTo: (n: number) => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ page: number; snippet: string }[] | null>(null)
  const [progress, setProgress] = useState(0)
  const cache = useRef<string[]>([])
  const run = useRef(0)

  const search = async () => {
    const q = query.trim().toLocaleLowerCase('tr')
    if (q.length < 2) return
    const me = ++run.current
    const found: { page: number; snippet: string }[] = []
    setHits([])
    for (let n = 1; n <= doc.numPages; n++) {
      if (run.current !== me) return
      const text = (cache.current[n] ??= await pageText(doc, n))
      const at = text.toLocaleLowerCase('tr').indexOf(q)
      if (at >= 0) {
        found.push({ page: n, snippet: text.slice(Math.max(0, at - 40), at + q.length + 60).trim() })
        setHits([...found])
      }
      setProgress(n)
    }
    setProgress(0)
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Aranacak sözcük" aria-label="Aranacak sözcük" autoFocus />
        <Button type="submit" variant="primary" disabled={query.trim().length < 2}>
          Ara
        </Button>
      </form>
      {progress > 0 && (
        <p className="tabular text-sm text-soft">
          Taranıyor: {progress} / {doc.numPages}
        </p>
      )}
      {hits && !progress && !hits.length && (
        <p className="text-soft">Sonuç yok. Taranmış (resim olarak kaydedilmiş) PDF’lerde metin araması çalışmaz.</p>
      )}
      {hits && hits.length > 0 && (
        <ul className="space-y-1.5">
          {hits.map((h) => (
            <li key={h.page}>
              <button type="button" onClick={() => goTo(h.page)} className="w-full rounded-lg border border-line px-3 py-2 text-left hover:border-pen">
                <span className="tabular font-semibold">{h.page}. sayfa</span>
                <span className="block text-sm text-soft">…{h.snippet}…</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
