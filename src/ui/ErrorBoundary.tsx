import { Component, type ReactNode } from 'react'

/** Beklenmedik bir hata tüm ekranı boş bırakmasın: ne olduğunu söyle, veriye dokunmadan devam ettir. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-lg p-6 pt-16">
        <div className="rounded-xl border border-line bg-surface p-6">
          <h1 className="text-2xl font-bold">Bu sayfa açılırken bir hata oluştu</h1>
          <p className="mt-2 text-soft">Verin yerinde duruyor. Sayfayı yenilemek çoğu zaman sorunu çözer.</p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-sunken p-3 font-mono text-sm whitespace-pre-wrap">{this.state.error.message}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => location.reload()} className="min-h-11 rounded-lg bg-pen px-4 font-semibold text-on-pen">
              Sayfayı yenile
            </button>
            <button
              type="button"
              onClick={() => {
                location.hash = '#/'
                location.reload()
              }}
              className="min-h-11 rounded-lg border border-line px-4 font-semibold"
            >
              Ana sayfaya dön
            </button>
          </div>
        </div>
      </div>
    )
  }
}
