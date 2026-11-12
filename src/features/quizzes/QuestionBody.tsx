import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../../db/db'
import type { Question, Result } from '../../db/schema'
import { LETTERS, cx } from '../../lib/format'
import { DEFAULT_PY, resolveVersion } from '../../lib/python'
import { lettersOnly } from '../../lib/quiz'
import { Markdown } from '../../ui/Markdown'
import { Bubble, Input, Textarea } from '../../ui/kit'
import { CodeWorkbench } from '../code/CodeWorkbench'

export interface QuestionBodyProps {
  q: Question
  /** Şıkların gösterim sırası (özgün indeksler). */
  order?: number[]
  response: unknown
  onResponse: (r: unknown) => void
  /** Doğru cevap ve çözüm gösterilsin mi. */
  revealed: boolean
  /** Cevap değiştirilemez. */
  locked: boolean
  result?: Result
  onSubmit?: () => void
  onCodeTested?: (code: string, passed: number, total: number) => void
}

/** Sorunun cevap alanı: tipine göre şıklar, D/Y, boşluk, metin ya da kod editörü. */
export function QuestionBody({ q, order, response, onResponse, revealed, locked, onSubmit, onCodeTested }: QuestionBodyProps) {
  if (q.type === 'mcq' && lettersOnly(q)) {
    // Şıklar görselin içinde: yalnızca harf balonları, karıştırılmadan.
    return (
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Şıklar">
        {q.options!.map((L, i) => {
          const picked = response === i
          const state = revealed ? (i === q.answerIndex ? 'correct' : picked ? 'wrong' : 'idle') : picked ? 'picked' : 'idle'
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-label={`${L} şıkkı`}
              disabled={locked}
              onClick={() => onResponse(picked ? null : i)}
              className={cx(
                'grid size-14 place-items-center rounded-full border-2 font-display text-xl font-bold transition-colors',
                state === 'idle' && 'border-line text-soft',
                state === 'idle' && !locked && 'hover:border-pen hover:text-ink',
                state === 'picked' && 'border-pen bg-pen text-on-pen',
                state === 'correct' && 'border-ok bg-ok text-surface',
                state === 'wrong' && 'border-bad bg-bad text-surface',
              )}
            >
              {L}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'mcq') {
    const idx = order ?? (q.options ?? []).map((_, i) => i)
    return (
      <ul className="space-y-2" role="radiogroup" aria-label="Şıklar">
        {idx.map((orig, pos) => {
          const picked = response === orig
          const correct = orig === q.answerIndex
          const state = revealed ? (correct ? 'correct' : picked ? 'wrong' : 'idle') : picked ? 'picked' : 'idle'
          return (
            <li key={orig}>
              <button
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={locked}
                onClick={() => onResponse(picked ? null : orig)}
                className={cx(
                  'flex w-full items-start gap-3 rounded-xl border-2 bg-surface px-3 py-2.5 text-left transition-colors',
                  state === 'idle' && 'border-line',
                  state === 'idle' && !locked && 'hover:border-pen',
                  state === 'picked' && 'border-pen bg-pen-soft',
                  state === 'correct' && 'border-ok bg-ok-soft',
                  state === 'wrong' && 'border-bad bg-bad-soft',
                )}
              >
                <Bubble state={state}>{LETTERS[pos]}</Bubble>
                <Markdown className="min-w-0 flex-1 pt-1">{q.options![orig]}</Markdown>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  if (q.type === 'tf') {
    return (
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Doğru ya da yanlış">
        {[true, false].map((v) => {
          const picked = response === v
          const correct = v === q.answerBool
          const state = revealed ? (correct ? 'correct' : picked ? 'wrong' : 'idle') : picked ? 'picked' : 'idle'
          return (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={locked}
              onClick={() => onResponse(picked ? null : v)}
              className={cx(
                'min-h-14 rounded-xl border-2 bg-surface font-display text-lg font-bold transition-colors',
                state === 'idle' && 'border-line text-soft',
                state === 'idle' && !locked && 'hover:border-pen hover:text-ink',
                state === 'picked' && 'border-pen bg-pen-soft text-pen',
                state === 'correct' && 'border-ok bg-ok-soft text-ok',
                state === 'wrong' && 'border-bad bg-bad-soft text-bad',
              )}
            >
              {v ? 'Doğru' : 'Yanlış'}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'fill') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit?.()
        }}
        className="space-y-2"
      >
        <Input
          value={(response as string) ?? ''}
          onChange={(e) => onResponse(e.target.value)}
          disabled={locked}
          placeholder="Cevabını yaz"
          aria-label="Cevabın"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {revealed && (
          <p className="text-[15px]">
            <span className="text-soft">Kabul edilen cevap: </span>
            <span className="font-semibold text-ok">{(q.answers ?? []).join(' / ')}</span>
          </p>
        )}
      </form>
    )
  }

  if (q.type === 'open') {
    return (
      <div className="space-y-3">
        <Textarea
          rows={5}
          value={(response as string) ?? ''}
          onChange={(e) => onResponse(e.target.value)}
          disabled={locked}
          placeholder="Cevabını buraya yazabilir ya da kâğıtta çözüp kendini değerlendirebilirsin"
          aria-label="Cevabın"
        />
        {revealed && (
          <div className="rounded-xl border border-ok/40 bg-ok-soft px-4 py-3">
            <p className="mb-1 text-sm font-semibold text-ok">Örnek çözüm</p>
            {q.solution ? <Markdown>{q.solution}</Markdown> : <p className="text-soft">Bu soru için çözüm eklenmemiş.</p>}
          </div>
        )}
      </div>
    )
  }

  return <CodeAnswer q={q} response={response} onResponse={onResponse} revealed={revealed} locked={locked} onCodeTested={onCodeTested} />
}

function CodeAnswer({ q, response, onResponse, revealed, locked, onCodeTested }: QuestionBodyProps) {
  const fallback = useLiveQuery(() => getSetting(db, 'pythonVersion', DEFAULT_PY), [], DEFAULT_PY)
  const [version, setVersion] = useState<string | null>(null)
  const [stdin, setStdin] = useState(q.tests?.[0]?.stdin ?? '')
  const code = typeof response === 'string' ? response : (q.starter ?? '')
  const active = version ?? resolveVersion(q.pythonVersion, fallback)

  return (
    <div className="space-y-3">
      {q.pythonVersion && <p className="text-sm text-soft">Bu soru Python {q.pythonVersion} için hazırlandı.</p>}
      <CodeWorkbench
        code={code}
        onCode={onResponse}
        version={active}
        onVersion={setVersion}
        stdin={stdin}
        onStdin={setStdin}
        tests={q.tests}
        onTested={(passed, total) => onCodeTested?.(code, passed, total)}
        readOnly={locked}
      />
      {revealed && (
        <div className="rounded-xl border border-ok/40 bg-ok-soft px-4 py-3">
          <p className="mb-1 text-sm font-semibold text-ok">Örnek çözüm</p>
          {q.solution ? <Markdown>{'```python\n' + q.solution + '\n```'}</Markdown> : <p className="text-soft">Bu soru için çözüm eklenmemiş.</p>}
        </div>
      )}
    </div>
  )
}
