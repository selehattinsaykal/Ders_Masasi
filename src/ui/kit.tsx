import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { X } from 'lucide-react'
import { cx } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-pen text-on-pen hover:bg-pen-strong',
  secondary: 'bg-surface text-ink border border-line hover:border-pen hover:text-pen',
  ghost: 'text-soft hover:text-ink hover:bg-sunken',
  danger: 'bg-surface text-bad border border-line hover:border-bad',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors select-none disabled:opacity-45',
        size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-[15px]',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

export function IconButton({ label, active, className, children, type, ...rest }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cx(
        'inline-grid size-10 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-40',
        active ? 'bg-pen-soft text-pen' : 'text-soft hover:bg-sunken hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-line bg-surface', className)}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  back?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-[1.7rem] leading-tight font-bold text-balance sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  )
}

const FIELD =
  'w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-soft/70 focus:border-pen focus:outline-none focus:ring-2 focus:ring-pen/25'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-soft">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD, 'min-h-11', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD, 'py-2 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD, 'min-h-11 pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 rounded-md px-3 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex min-h-9 items-center gap-2.5 text-[15px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] accent-(--pen)"
      />
      <span>{children}</span>
    </label>
  )
}

type Tone = 'neutral' | 'pen' | 'ok' | 'bad' | 'warn'
const TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-soft',
  pen: 'bg-pen-soft text-pen',
  ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap', TONE[tone])}>
      {children}
    </span>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-5 py-9 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-soft">{children}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'pen' }: { value: number; tone?: 'pen' | 'ok' }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-300', tone === 'ok' ? 'bg-ok' : 'bg-pen')} style={{ width: `${v}%` }} />
    </div>
  )
}

/** Optik form balonu: şık harfi taşıyan yuvarlak. */
export function Bubble({
  children,
  state = 'idle',
  size = 'md',
}: {
  children: ReactNode
  state?: 'idle' | 'picked' | 'correct' | 'wrong'
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full border-2 font-display font-bold tabular transition-colors',
        size === 'sm' ? 'size-8 text-sm' : 'size-9 text-[15px]',
        state === 'idle' && 'border-line text-soft',
        state === 'picked' && 'border-pen bg-pen text-on-pen',
        state === 'correct' && 'border-ok bg-ok text-surface',
        state === 'wrong' && 'border-bad bg-bad text-surface',
      )}
    >
      {children}
    </span>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b1026]/55 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'safe-bottom flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl outline-none sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line py-2 pr-2 pl-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton label="Kapat" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** Doğru / yanlış / boş sayıları. */
export function ScoreRow({
  correct,
  wrong,
  blank,
  partial = 0,
  compact,
}: {
  correct: number
  wrong: number
  blank: number
  partial?: number
  compact?: boolean
}) {
  const items: [string, number, string][] = [
    ['Doğru', correct, 'text-ok'],
    ['Yanlış', wrong, 'text-bad'],
    ['Boş', blank, 'text-soft'],
  ]
  if (partial) items.splice(2, 0, ['Kısmen', partial, 'text-warn'])
  if (compact)
    return (
      <span className="tabular inline-flex gap-3 text-sm font-semibold">
        {items.map(([label, n, color]) => (
          <span key={label} className={color}>
            {n} {label.toLocaleLowerCase('tr')}
          </span>
        ))}
      </span>
    )
  return (
    <dl className={cx('grid gap-2', items.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {items.map(([label, n, color]) => (
        <div key={label} className="min-w-0 rounded-lg bg-sunken px-2.5 py-2.5 sm:px-3">
          <dd className={cx('font-display text-3xl leading-none font-bold tabular', color)}>{n}</dd>
          <dt className="mt-1 text-sm text-soft">{label}</dt>
        </div>
      ))}
    </dl>
  )
}

export function Dot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full" style={{ background: color }} />
}
