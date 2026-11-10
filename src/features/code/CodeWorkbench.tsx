import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, CircleX, FlaskConical, Play, Square } from 'lucide-react'
import { db, getSetting } from '../../db/db'
import type { CodeTest } from '../../db/schema'
import { cx } from '../../lib/format'
import { PY_VERSIONS, loadPython, runPython, runTests, stopPython, type TestOutcome } from '../../lib/python'
import { Button, Select } from '../../ui/kit'

const Editor = lazy(() => import('./CodeEditorImpl'))

type Status = 'idle' | 'loading' | 'running' | 'testing'

export function CodeWorkbench({
  code,
  onCode,
  version,
  onVersion,
  stdin,
  onStdin,
  tests,
  onTested,
  readOnly,
}: {
  code: string
  onCode: (v: string) => void
  version: string
  onVersion: (v: string) => void
  stdin: string
  onStdin: (v: string) => void
  tests?: CodeTest[]
  onTested?: (passed: number, total: number) => void
  readOnly?: boolean
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [output, setOutput] = useState('')
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState('')
  const [outcomes, setOutcomes] = useState<TestOutcome[] | null>(null)
  const timeoutSec = useLiveQuery(() => getSetting(db, 'codeTimeoutSec', 10), [], 10)
  const codeRef = useRef(code)
  codeRef.current = code
  const stdinRef = useRef(stdin)
  stdinRef.current = stdin
  const busy = status !== 'idle'

  useEffect(() => {
    setLoaded('')
  }, [version])

  const prepare = async (): Promise<boolean> => {
    setStatus('loading')
    setNote('')
    try {
      setLoaded(await loadPython(version))
      return true
    } catch {
      setNote(`Python ${version} yüklenemedi. Bu sürümü ilk kez kullanıyorsan internet bağlantısı gerekir; sonra çevrimdışı çalışır.`)
      setStatus('idle')
      return false
    }
  }

  const run = useCallback(async () => {
    if (status !== 'idle') return
    setOutcomes(null)
    setOutput('')
    if (!(await prepare())) return
    setStatus('running')
    try {
      const r = await runPython(version, codeRef.current, stdinRef.current, {
        onOut: (t) => setOutput((o) => o + t),
        timeoutMs: timeoutSec * 1000,
      })
      if (r.timedOut) setNote(`Süre aşımı: kod ${timeoutSec} saniyede bitmedi ve durduruldu. Sonsuz döngü olabilir.`)
      else if (r.stopped) setNote('Durduruldu.')
      else if (/EOFError/.test(r.output)) setNote('Program girdi bekledi ama girdi kutusunda okunacak satır kalmadı.')
    } catch (e) {
      setNote((e as Error).message)
    }
    setStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, version, timeoutSec])

  const test = async () => {
    if (!tests?.length || status !== 'idle') return
    setOutput('')
    setOutcomes(null)
    if (!(await prepare())) return
    setStatus('testing')
    try {
      const res = await runTests(version, codeRef.current, tests, timeoutSec * 1000)
      setOutcomes(res)
      onTested?.(res.filter((r) => r.pass).length, res.length)
    } catch (e) {
      setNote((e as Error).message)
    }
    setStatus('idle')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span>Python</span>
          <Select value={version} onChange={(e) => onVersion(e.target.value)} disabled={busy} className="!min-h-9 !w-auto" aria-label="Python sürümü">
            {PY_VERSIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
              </option>
            ))}
          </Select>
        </label>
        {status === 'running' || status === 'testing' ? (
          <Button size="sm" variant="danger" icon={<Square size={15} />} onClick={() => stopPython(version)}>
            Durdur
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<Play size={15} />} onClick={run} disabled={busy}>
            Çalıştır
          </Button>
        )}
        {!!tests?.length && (
          <Button size="sm" icon={<FlaskConical size={15} />} onClick={test} disabled={busy || readOnly}>
            Testleri çalıştır ({tests.length})
          </Button>
        )}
        <span className="text-sm text-soft" aria-live="polite">
          {status === 'loading' && `Python ${version} hazırlanıyor…`}
          {status === 'running' && 'Çalışıyor…'}
          {status === 'testing' && 'Testler çalışıyor…'}
          {status === 'idle' && loaded && `Python ${loaded}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <Suspense fallback={<pre className="min-h-44 bg-surface p-3 font-mono text-sm">{code}</pre>}>
          <Editor value={code} onChange={onCode} onRun={run} readOnly={readOnly} />
        </Suspense>
      </div>

      <details className="rounded-lg border border-line bg-surface" open={!!stdin}>
        <summary className="min-h-10 px-3 py-2 text-sm font-semibold">Girdi (input() ile okunacak satırlar)</summary>
        <textarea
          value={stdin}
          onChange={(e) => onStdin(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="Her satır bir input() çağrısına gider"
          className="block w-full border-t border-line bg-surface px-3 py-2 font-mono text-sm focus:outline-none"
          aria-label="Program girdisi"
        />
      </details>

      {(output || note) && !outcomes && (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="border-b border-line bg-sunken px-3 py-1.5 text-sm font-semibold">Çıktı</div>
          {output && <pre className="max-h-72 overflow-auto bg-surface p-3 font-mono text-sm whitespace-pre-wrap">{output}</pre>}
          {note && <p className="bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">{note}</p>}
        </div>
      )}
      {note && outcomes && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">{note}</p>}

      {outcomes && (
        <div className="space-y-2">
          <p className="font-semibold">
            <span className="marker tabular">
              {outcomes.filter((o) => o.pass).length} / {outcomes.length}
            </span>{' '}
            test geçti
          </p>
          <ul className="space-y-2">
            {outcomes.map((o, i) => (
              <li key={i} className={cx('rounded-lg border px-3 py-2', o.pass ? 'border-ok/40 bg-ok-soft' : 'border-bad/40 bg-bad-soft')}>
                <p className={cx('flex items-center gap-2 font-semibold', o.pass ? 'text-ok' : 'text-bad')}>
                  {o.pass ? <CircleCheck size={17} /> : <CircleX size={17} />}
                  {i + 1}. test {o.pass ? 'geçti' : o.timedOut ? 'süre aşımına uğradı' : 'kaldı'}
                </p>
                {!o.pass && (
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                    <Block label="Girdi" text={o.stdin || '(yok)'} />
                    <Block label="Beklenen çıktı" text={o.expected} />
                    <Block label="Senin çıktın" text={o.actual || '(boş)'} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 font-semibold text-soft">{label}</p>
      <pre className="max-h-40 overflow-auto rounded-md bg-surface p-2 font-mono text-[13px] whitespace-pre-wrap">{text}</pre>
    </div>
  )
}
