import { useRef, useState } from 'react'
import type { Region } from '../../lib/pdf'

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export function normalizeRegion(a: { x: number; y: number }, b: { x: number; y: number }): Region {
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }
}

/** Sayfanın üzerine serilen seçim katmanı: sürükleyerek dikdörtgen çizilir. */
export function CropLayer({
  selection,
  onSelect,
}: {
  selection: Region | null
  onSelect: (r: Region | null) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<Region | null>(null)

  const point = (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) }
  }

  const shown = draft ?? selection

  return (
    <div
      ref={box}
      className="absolute inset-0 z-10 cursor-crosshair touch-none bg-pen/5"
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        start.current = point(e)
        setDraft(normalizeRegion(start.current, start.current))
      }}
      onPointerMove={(e) => {
        if (start.current) setDraft(normalizeRegion(start.current, point(e)))
      }}
      onPointerUp={(e) => {
        if (!start.current) return
        const r = normalizeRegion(start.current, point(e))
        start.current = null
        setDraft(null)
        // Çok küçük seçim (yanlışlıkla dokunma) yok sayılır.
        onSelect(r.x1 - r.x0 > 0.03 && r.y1 - r.y0 > 0.015 ? r : null)
      }}
      onPointerCancel={() => {
        start.current = null
        setDraft(null)
      }}
    >
      {shown && (
        <div
          className="pointer-events-none absolute border-2 border-pen bg-marker/25"
          style={{
            left: `${shown.x0 * 100}%`,
            top: `${shown.y0 * 100}%`,
            width: `${(shown.x1 - shown.x0) * 100}%`,
            height: `${(shown.y1 - shown.y0) * 100}%`,
            boxShadow: '0 0 0 9999px rgb(11 16 38 / 0.28)',
          }}
        />
      )}
    </div>
  )
}
