import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Button, Modal } from './kit'
import { cx } from '../lib/format'

interface ConfirmOptions {
  title: string
  body?: ReactNode
  action: string
  danger?: boolean
}

interface FeedbackApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  toast: (message: string, tone?: 'ok' | 'bad') => void
}

const Ctx = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('FeedbackProvider eksik')
  return api
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'ok' | 'bad' }[]>([])
  const nextId = useRef(1)

  const confirm = useCallback((o: ConfirmOptions) => {
    setAsk(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setAsk(null)
  }

  const toast = useCallback((message: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 6000 : 3200)
  }, [])

  return (
    <Ctx.Provider value={{ confirm, toast }}>
      {children}
      <Modal
        open={!!ask}
        onClose={() => settle(false)}
        title={ask?.title ?? ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>
              Vazgeç
            </Button>
            <Button variant={ask?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {ask?.action}
            </Button>
          </>
        }
      >
        <div className="text-soft">{ask?.body}</div>
      </Modal>
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-[15px] font-semibold shadow-lg',
              t.tone === 'ok' ? 'bg-ink text-paper' : 'bg-bad text-surface',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
