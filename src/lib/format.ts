const DAY = 86_400_000

export function formatDate(ts: number, withYear = true): string {
  return new Date(ts).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Bugünden hedef güne kaç takvim günü var (geçmişse negatif). */
export function daysUntil(ts: number, now = Date.now()): number {
  return Math.round((startOfDay(ts) - startOfDay(now)) / DAY)
}

export function countdownLabel(ts: number, now = Date.now()): string {
  const d = daysUntil(ts, now)
  if (d === 0) return 'Bugün'
  if (d === 1) return 'Yarın'
  if (d > 1) return `${d} gün kaldı`
  if (d === -1) return 'Dün'
  return `${-d} gün önce`
}

/** 75 -> "1 dk 15 sn", 3700 -> "1 sa 1 dk" */
export function formatDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h) return m ? `${h} sa ${m} dk` : `${h} sa`
  if (m) return s && m < 10 ? `${m} dk ${s} sn` : `${m} dk`
  return `${s} sn`
}

/** 75 -> "01:15" */
export function clock(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
}

export function relativeDay(ts: number, now = Date.now()): string {
  const d = daysUntil(ts, now)
  if (d === 0) return 'bugün'
  if (d === -1) return 'dün'
  if (d === 1) return 'yarın'
  if (d < 0 && d > -7) return `${-d} gün önce`
  return formatShortDate(ts)
}

/** datetime-local girdisi için yerel saatle "YYYY-MM-DDTHH:mm". */
export function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
