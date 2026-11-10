import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, stamp } from '../../db/db'

type Phase = 'work' | 'break'

interface Stored {
  phase: Phase
  /** Çalışıyorsa bitiş zamanı. */
  endAt?: number
  /** Duraklatıldıysa kalan saniye. */
  pausedLeft?: number
  startedAt?: number
  courseId?: string
  workMin: number
  breakMin: number
  rounds: number
}

const KEY = 'pomodoro'
const DEFAULT: Stored = { phase: 'work', workMin: 25, breakMin: 5, rounds: 0 }

function load(): Stored {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT
  }
}

interface Api extends Stored {
  running: boolean
  remainingSec: number
  totalSec: number
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => void
  configure: (c: Partial<Pick<Stored, 'workMin' | 'breakMin' | 'courseId'>>) => void
}

const Ctx = createContext<Api | null>(null)

export function usePomodoro(): Api {
  const api = useContext(Ctx)
  if (!api) throw new Error('PomodoroProvider eksik')
  return api
}

function beep() {
  try {
    const ac = new AudioContext()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.connect(g)
    g.connect(ac.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.9)
    o.start()
    o.stop(ac.currentTime + 0.95)
  } catch {
    /* ses çalınamadıysa sessiz geç */
  }
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Stored>(load)
  const [now, setNow] = useState(Date.now())
  const finishing = useRef(false)

  const save = useCallback((next: Stored) => {
    localStorage.setItem(KEY, JSON.stringify(next))
    setS(next)
  }, [])

  const running = s.endAt !== undefined
  const totalSec = (s.phase === 'work' ? s.workMin : s.breakMin) * 60
  const remainingSec = running ? Math.max(0, Math.ceil((s.endAt! - now) / 1000)) : (s.pausedLeft ?? totalSec)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [running])

  const finishPhase = useCallback(
    async (state: Stored, completed: boolean) => {
      if (state.phase === 'work') {
        const total = state.workMin * 60
        const left = state.endAt ? Math.max(0, (state.endAt - Date.now()) / 1000) : (state.pausedLeft ?? total)
        const worked = Math.round(total - left)
        if (worked >= 60)
          await db.studySessions.add(
            stamp({ courseId: state.courseId, kind: 'pomodoro' as const, startedAt: Date.now() - worked * 1000, durationSec: worked }),
          )
      }
      const { endAt: _e, pausedLeft: _p, startedAt: _s, ...rest } = state
      save({
        ...rest,
        phase: state.phase === 'work' ? 'break' : 'work',
        rounds: state.phase === 'work' && completed ? state.rounds + 1 : state.rounds,
      })
    },
    [save],
  )

  useEffect(() => {
    if (!running || remainingSec > 0 || finishing.current) return
    finishing.current = true
    beep()
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(s.phase === 'work' ? 'Odak süresi bitti, mola zamanı' : 'Mola bitti, devam')
      } catch {
        /* bildirim gösterilemedi */
      }
    }
    void finishPhase(s, true).finally(() => (finishing.current = false))
  }, [running, remainingSec, s, finishPhase])

  const api: Api = {
    ...s,
    running,
    remainingSec,
    totalSec,
    start: () => {
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
      setNow(Date.now())
      const { pausedLeft: _p, ...rest } = s
      save({ ...rest, endAt: Date.now() + remainingSec * 1000, startedAt: s.startedAt ?? Date.now() })
    },
    pause: () => {
      const { endAt: _e, ...rest } = s
      save({ ...rest, pausedLeft: remainingSec })
    },
    reset: () => {
      const { endAt: _e, pausedLeft: _p, startedAt: _s, ...rest } = s
      save({ ...rest, phase: 'work' })
    },
    skip: () => void finishPhase(s, false),
    configure: (c) => {
      const { pausedLeft: _p, ...rest } = s
      const courseId = 'courseId' in c ? c.courseId : s.courseId
      // Sayaç çalışırken yalnızca ders değiştirilebilir.
      save(running || s.pausedLeft !== undefined ? { ...s, courseId } : { ...rest, ...c, courseId })
    },
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
