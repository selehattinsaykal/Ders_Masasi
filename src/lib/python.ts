// Python çalıştırma: her sürüm için ayrı bir worker. Sonsuz döngüde worker sonlandırılır.
import type { CodeTest } from '../db/schema'
import { compareOutput } from './grading'

export interface PyVersion {
  id: string
  /** Bu Python sürümünü taşıyan Pyodide derlemesi. */
  pyodide: string
}

// Eşleme, her derleme yüklenip sys.version okunarak doğrulandı.
export const PY_VERSIONS: PyVersion[] = [
  { id: '3.9', pyodide: '0.19.1' },
  { id: '3.10', pyodide: '0.22.1' },
  { id: '3.11', pyodide: '0.25.1' },
  { id: '3.12', pyodide: '0.27.7' },
  { id: '3.13', pyodide: '0.29.3' },
]
export const DEFAULT_PY = '3.12'

const indexURL = (v: PyVersion) => `https://cdn.jsdelivr.net/pyodide/v${v.pyodide}/full/`

/** "3.9.7", "python3.9", "3.9" gibi yazımları desteklenen sürüme çevirir. */
export function resolveVersion(wanted: string | undefined, fallback = DEFAULT_PY): string {
  const m = wanted?.match(/3\.(\d+)/)
  const id = m ? `3.${m[1]}` : undefined
  return PY_VERSIONS.some((v) => v.id === id) ? id! : fallback
}

export interface RunResult {
  output: string
  ok: boolean
  timedOut: boolean
  stopped: boolean
}

class Runner {
  private worker: Worker
  private ready: Promise<string>
  private nextId = 1
  private current: { id: number; finish: (r: Omit<RunResult, 'output'>) => void } | null = null
  private onOut: ((text: string) => void) | null = null
  fullVersion = ''

  constructor(readonly version: PyVersion) {
    this.worker = new Worker(new URL('py-worker.js', document.baseURI))
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const m = e.data
        if (m.type === 'ready') {
          this.fullVersion = m.version
          resolve(m.version)
        } else if (m.type === 'init-error') reject(new Error(m.error))
        else if (m.type === 'out' && this.current?.id === m.id) this.onOut?.(m.text)
        else if (m.type === 'done' && this.current?.id === m.id) this.current?.finish({ ok: m.ok, timedOut: false, stopped: false })
      }
      this.worker.onerror = (e) => reject(new Error(e.message || 'Python yüklenemedi'))
    })
    this.worker.postMessage({ type: 'init', indexURL: indexURL(version) })
  }

  whenReady(): Promise<string> {
    return this.ready
  }

  async run(code: string, stdin: string, onOut: (t: string) => void, timeoutMs: number): Promise<Omit<RunResult, 'output'>> {
    await this.ready
    if (this.current) throw new Error('Zaten çalışan bir kod var.')
    const id = this.nextId++
    this.onOut = onOut
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.current?.finish({ ok: false, timedOut: true, stopped: false }), timeoutMs)
      this.current = {
        id,
        finish: (r) => {
          clearTimeout(timer)
          this.current = null
          this.onOut = null
          if (r.timedOut || r.stopped) this.dispose()
          resolve(r)
        },
      }
      this.worker.postMessage({ type: 'run', id, code, stdin })
    })
  }

  stop(): void {
    this.current?.finish({ ok: false, timedOut: false, stopped: true })
  }

  dispose(): void {
    this.worker.terminate()
    if (runners.get(this.version.id) === this) runners.delete(this.version.id)
  }
}

const runners = new Map<string, Runner>()

function runnerFor(versionId: string): Runner {
  const v = PY_VERSIONS.find((x) => x.id === versionId) ?? PY_VERSIONS.find((x) => x.id === DEFAULT_PY)!
  let r = runners.get(v.id)
  if (!r) {
    r = new Runner(v)
    runners.set(v.id, r)
    // Yükleme başarısız olursa (ör. çevrimdışı) bir sonraki denemede yeniden kurulsun.
    r.whenReady().catch(() => r!.dispose())
  }
  return r
}

/** Sürümü yükler (gerekirse indirir) ve tam sürüm numarasını döndürür, ör. "3.9.5". */
export function loadPython(versionId: string): Promise<string> {
  return runnerFor(versionId).whenReady()
}

export async function runPython(
  versionId: string,
  code: string,
  stdin = '',
  opts: { onOut?: (text: string) => void; timeoutMs?: number } = {},
): Promise<RunResult> {
  let output = ''
  const r = await runnerFor(versionId).run(
    code,
    stdin,
    (t) => {
      output += t
      opts.onOut?.(t)
    },
    opts.timeoutMs ?? 10_000,
  )
  return { ...r, output }
}

export function stopPython(versionId: string): void {
  runners.get(versionId)?.stop()
}

export interface TestOutcome {
  stdin: string
  expected: string
  actual: string
  pass: boolean
  timedOut: boolean
}

export async function runTests(
  versionId: string,
  code: string,
  tests: CodeTest[],
  timeoutMs = 10_000,
  onProgress?: (done: number) => void,
): Promise<TestOutcome[]> {
  const out: TestOutcome[] = []
  for (const t of tests) {
    const r = await runPython(versionId, code, t.stdin, { timeoutMs })
    out.push({
      stdin: t.stdin,
      expected: t.expected,
      actual: r.output,
      pass: r.ok && !r.timedOut && compareOutput(r.output, t.expected),
      timedOut: r.timedOut,
    })
    onProgress?.(out.length)
  }
  return out
}

/** Çevrimdışı kullanım için indirilmiş (önbellekteki) sürümler. Yalnızca kurulu uygulamada anlamlıdır. */
export async function cachedVersions(): Promise<Set<string>> {
  const found = new Set<string>()
  if (!('caches' in window)) return found
  try {
    const cache = await caches.open('pyodide')
    const keys = await cache.keys()
    for (const v of PY_VERSIONS)
      if (keys.some((k) => k.url.includes(`/pyodide/v${v.pyodide}/`) && /pyodide\.asm\.wasm|pyodide\.asm\.js/.test(k.url))) found.add(v.id)
  } catch {
    /* önbellek okunamadı */
  }
  return found
}

export async function removeCachedVersion(versionId: string): Promise<void> {
  const v = PY_VERSIONS.find((x) => x.id === versionId)
  if (!v || !('caches' in window)) return
  runners.get(versionId)?.dispose()
  const cache = await caches.open('pyodide')
  for (const k of await cache.keys()) if (k.url.includes(`/pyodide/v${v.pyodide}/`)) await cache.delete(k)
}
