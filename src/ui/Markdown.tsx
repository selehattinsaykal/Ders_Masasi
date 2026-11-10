import { lazy, Suspense } from 'react'
import { cx } from '../lib/format'

const Impl = lazy(() => import('./MarkdownImpl'))

/** Markdown + LaTeX formül + renklendirilmiş kod. Ağır kısım ilk kullanımda yüklenir. */
export function Markdown({ children, className }: { children: string | undefined; className?: string }) {
  if (!children) return null
  return (
    <Suspense fallback={<div className={cx('md whitespace-pre-wrap', className)}>{children}</div>}>
      <Impl className={className}>{children}</Impl>
    </Suspense>
  )
}
