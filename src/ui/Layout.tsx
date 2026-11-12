import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  DatabaseBackup,
  FileJson,
  Home,
  Layers,
  Menu,
  Search,
  Settings,
  Terminal,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { db } from '../db/db'
import { clock, cx } from '../lib/format'
import { usePomodoro } from '../features/planner/pomodoro-context'
import { IconButton } from './kit'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const MAIN: Item[] = [
  { to: '/', label: 'Ana sayfa', icon: Home, end: true },
  { to: '/dersler', label: 'Dersler', icon: BookOpen },
  { to: '/tekrar', label: 'Tekrar', icon: Layers },
  { to: '/kod', label: 'Kod', icon: Terminal },
]

const MORE: Item[] = [
  { to: '/takvim', label: 'Sınav takvimi', icon: CalendarDays },
  { to: '/istatistik', label: 'İstatistik', icon: BarChart3 },
  { to: '/not-hesabi', label: 'Not hesabı', icon: Calculator },
  { to: '/pomodoro', label: 'Pomodoro', icon: Timer },
  { to: '/ara', label: 'Ara', icon: Search },
]

const DATA: Item[] = [
  { to: '/ice-aktar', label: 'JSON içe aktar', icon: FileJson },
  { to: '/yedek', label: 'Yedekle ve taşı', icon: DatabaseBackup },
  { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
]

export const MORE_ITEMS = [...MORE, ...DATA]

function useDueCount(): number {
  return useLiveQuery(() => db.cards.where('due').belowOrEqual(Date.now()).count(), [], 0)
}

function SideLink({ item, badge }: { item: Item; badge?: ReactNode }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex min-h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors',
          isActive ? 'text-ink' : 'text-soft hover:bg-sunken hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} className={isActive ? 'text-pen' : ''} />
          <span className={isActive ? 'marker' : ''}>{item.label}</span>
          {badge}
        </>
      )}
    </NavLink>
  )
}

function CountBadge({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="tabular ml-auto rounded-full bg-pen px-2 py-px text-xs font-bold text-on-pen">{n > 99 ? '99+' : n}</span>
  )
}

function PomodoroChip() {
  const p = usePomodoro()
  if (!p.running) return null
  return (
    <NavLink
      to="/pomodoro"
      className="tabular flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-bold"
    >
      <Timer size={16} className="text-pen" />
      {p.phase === 'work' ? 'Odak' : 'Mola'} {clock(p.remainingSec)}
    </NavLink>
  )
}

export function Shell() {
  const due = useDueCount()
  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/90 px-3 py-5 backdrop-blur lg:flex">
        <NavLink to="/" className="mb-6 flex items-center gap-2.5 px-3">
          <img src="./icon.svg" alt="" className="size-8 rounded-lg" />
          <span className="font-display text-xl font-bold">Ders Masası</span>
        </NavLink>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Ana menü">
          {MAIN.map((it) => (
            <SideLink key={it.to} item={it} badge={it.to === '/tekrar' ? <CountBadge n={due} /> : undefined} />
          ))}
          <div className="my-3 border-t border-line" />
          {MORE.map((it) => (
            <SideLink key={it.to} item={it} />
          ))}
          <div className="my-3 border-t border-line" />
          {DATA.map((it) => (
            <SideLink key={it.to} item={it} />
          ))}
        </nav>
        <PomodoroChip />
      </aside>

      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mb-3 flex justify-end lg:hidden">
          <PomodoroChip />
        </div>
        <Outlet />
      </main>

      <nav
        aria-label="Ana menü"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {[...MAIN, { to: '/daha', label: 'Daha', icon: Menu } as Item].map((it) => {
            const Icon = it.icon
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cx('relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-xs font-semibold', isActive ? 'text-ink' : 'text-soft')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon size={22} className={isActive ? 'text-pen' : ''} />
                      {it.to === '/tekrar' && due > 0 && (
                        <span className="tabular absolute -top-1.5 -right-3 rounded-full bg-pen px-1.5 text-[10px] leading-4 font-bold text-on-pen">
                          {due > 99 ? '99+' : due}
                        </span>
                      )}
                    </span>
                    <span className={isActive ? 'marker' : ''}>{it.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/** Tam ekran çalışma sayfaları (test, kart, PDF) için sade üst çubuk. */
export function FocusBar({
  title,
  subtitle,
  backTo,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  backTo?: string
  children?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="sticky top-0 z-20 flex min-h-14 items-center gap-1 border-b border-line bg-surface/95 px-2 backdrop-blur">
      <IconButton label="Geri" onClick={() => (backTo ? nav(backTo) : nav(-1))}>
        <ArrowLeft size={21} />
      </IconButton>
      <div className="min-w-0 flex-1 px-1">
        <div className="truncate font-display font-semibold">{title}</div>
        {subtitle && <div className="truncate text-sm text-soft">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink to={to} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-soft hover:text-pen">
      <ArrowLeft size={15} />
      {children}
    </NavLink>
  )
}
