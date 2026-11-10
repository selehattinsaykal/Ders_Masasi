import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteAttempt, patch, stamp } from '../../db/db'
import type { Attempt, OpticalKey, StudyFile } from '../../db/schema'
import { LETTERS, cx, formatDateTime } from '../../lib/format'
import { gradeOptical } from '../../lib/grading'
import { useFeedback } from '../../ui/feedback'
import { Button, Field, Input, ScoreRow, Segmented, Select } from '../../ui/kit'

/** PDF olarak duran sınavlar için cevap formu: şıkları işaretle, anahtarla karşılaştır. */
export function OpticalPanel({ file }: { file: StudyFile }) {
  const { toast, confirm } = useFeedback()
  const [tab, setTab] = useState<'cevap' | 'anahtar'>('cevap')
  const [count, setCount] = useState('20')
  const [optionCount, setOptionCount] = useState('5')
  const [paste, setPaste] = useState('')

  const attempts = useLiveQuery(
    () => db.attempts.where('courseId').equals(file.courseId).filter((a) => a.fileId === file.id).sortBy('startedAt'),
    [file.id],
  )
  if (!attempts) return null

  const key = file.optical
  const open = attempts.find((a) => !a.finishedAt)
  const lastDone = [...attempts].reverse().find((a) => a.finishedAt)

  if (!key)
    return (
      <div className="space-y-4">
        <p className="text-soft">
          Bu PDF’teki soruları çözerken şıkları buradan işaretle. Cevap anahtarını girince doğru, yanlış ve boş sayın çıkar.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Soru sayısı">
            <Input type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Şık sayısı">
            <Select value={optionCount} onChange={(e) => setOptionCount(e.target.value)}>
              <option value="2">2 (D / Y)</option>
              <option value="4">4 (A–D)</option>
              <option value="5">5 (A–E)</option>
            </Select>
          </Field>
        </div>
        <Button
          variant="primary"
          onClick={async () => {
            const n = Math.max(1, Math.min(200, Number(count) || 0))
            await patch(db.files, file.id, { optical: { count: n, optionCount: Number(optionCount), key: Array(n).fill(null) } })
          }}
        >
          Cevap formunu oluştur
        </Button>
      </div>
    )

  const setKeyAt = async (i: number, v: number | null) => {
    const next: OpticalKey = { ...key, key: key.key.map((k, j) => (j === i ? v : k)) }
    await patch(db.files, file.id, { optical: next })
  }

  const mark = async (i: number, v: number | null) => {
    if (open) {
      const responses = open.optical!.responses.map((r, j) => (j === i ? v : r))
      await patch(db.attempts, open.id, { optical: { ...open.optical!, responses } })
      return
    }
    const responses: (number | null)[] = Array(key.count).fill(null)
    responses[i] = v
    const a: Attempt = stamp({
      courseId: file.courseId,
      fileId: file.id,
      title: file.title,
      mode: 'optik' as const,
      instant: false,
      questionIds: [],
      currentIndex: 0,
      startedAt: Date.now(),
      durationSec: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
      partial: 0,
      optical: { count: key.count, optionCount: key.optionCount, key: key.key, responses },
    })
    await db.attempts.add(a)
  }

  const check = async () => {
    if (!open) return
    if (!key.key.some((k) => k != null)) {
      setTab('anahtar')
      return toast('Önce cevap anahtarını gir', 'bad')
    }
    const t = gradeOptical(key.key, open.optical!.responses)
    await patch(db.attempts, open.id, {
      optical: { ...open.optical!, key: key.key },
      correct: t.correct,
      wrong: t.wrong,
      blank: t.blank,
      finishedAt: Date.now(),
      durationSec: Math.min(4 * 3600, Math.round((Date.now() - open.startedAt) / 1000)),
    })
  }

  const applyPaste = async () => {
    const letters = paste.toUpperCase().replace(/[^A-HX\-_.]/g, '')
    if (!letters) return
    const next = key.key.map((k, i) => {
      const ch = letters[i]
      if (ch === undefined) return k
      const idx = ch.charCodeAt(0) - 65
      return idx >= 0 && idx < key.optionCount ? idx : null
    })
    await patch(db.files, file.id, { optical: { ...key, key: next } })
    setPaste('')
    toast(`${Math.min(letters.length, key.count)} cevap anahtara işlendi`)
  }

  const resetForm = async () => {
    const ok = await confirm({
      title: 'Cevap formu sıfırlansın mı?',
      body: 'Soru sayısı ve cevap anahtarı silinir. Önceki denemelerin sonuçları kalır.',
      action: 'Formu sıfırla',
      danger: true,
    })
    if (ok) {
      if (open) await deleteAttempt(db, open.id)
      await patch(db.files, file.id, { optical: undefined })
    }
  }

  const letters = LETTERS.slice(0, key.optionCount)
  const rows = Array.from({ length: key.count }, (_, i) => i)
  const filledKey = key.key.filter((k) => k != null).length
  // Açık deneme yoksa son bitmiş denemenin sonucu gösterilir.
  const result = open ? null : (lastDone ?? null)
  const sheet = open?.optical ?? result?.optical

  return (
    <div className="space-y-4">
      <Segmented
        label="Görünüm"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'cevap', label: 'Cevaplarım' },
          { value: 'anahtar', label: `Cevap anahtarı (${filledKey}/${key.count})` },
        ]}
      />

      {tab === 'anahtar' && (
        <div className="flex gap-2">
          <Input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Anahtarı yapıştır: ABCDA…" aria-label="Cevap anahtarını yapıştır" />
          <Button onClick={applyPaste} disabled={!paste.trim()}>
            İşle
          </Button>
        </div>
      )}

      {tab === 'cevap' && result && (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <p className="text-sm text-soft">Son deneme, {formatDateTime(result.startedAt)}</p>
          <ScoreRow correct={result.correct} wrong={result.wrong} blank={result.blank} />
        </div>
      )}

      <ol className="space-y-1.5">
        {rows.map((i) => {
          const k = key.key[i]
          const r = tab === 'cevap' ? (sheet?.responses[i] ?? null) : k
          const graded = tab === 'cevap' && !!result
          const gradedKey = result?.optical?.key[i] ?? null
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="tabular w-7 shrink-0 text-right text-sm font-semibold text-soft">{i + 1}.</span>
              <div className="flex gap-1.5">
                {letters.map((L, j) => {
                  const picked = r === j
                  let look = picked ? 'border-pen bg-pen text-on-pen' : 'border-line text-soft hover:border-pen'
                  if (graded && gradedKey != null) {
                    if (j === gradedKey) look = 'border-ok bg-ok text-surface'
                    else if (picked) look = 'border-bad bg-bad text-surface'
                    else look = 'border-line text-soft/60'
                  }
                  if (tab === 'anahtar' && picked) look = 'border-ok bg-ok text-surface'
                  return (
                    <button
                      key={L}
                      type="button"
                      disabled={graded}
                      aria-pressed={picked}
                      aria-label={`${i + 1}. soru ${L}`}
                      onClick={() => (tab === 'cevap' ? mark(i, picked ? null : j) : setKeyAt(i, picked ? null : j))}
                      className={cx('grid size-9 place-items-center rounded-full border-2 font-display text-sm font-bold transition-colors', look)}
                    >
                      {L}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>

      {tab === 'cevap' && (
        <div className="sticky -bottom-4 -mx-4 flex flex-wrap gap-2 border-t border-line bg-surface px-4 py-3">
          {open ? (
            <Button variant="primary" onClick={check}>
              Kontrol et
            </Button>
          ) : (
            result && (
              <Button variant="primary" onClick={() => mark(0, null)}>
                Yeni deneme başlat
              </Button>
            )
          )}
          {!open && !result && <p className="text-sm text-soft">İşaretlemeye başla; hazır olunca kontrol et.</p>}
        </div>
      )}

      {attempts.filter((a) => a.finishedAt).length > 1 && (
        <div>
          <h3 className="mb-1 font-semibold">Önceki denemeler</h3>
          <ul className="tabular space-y-1 text-sm text-soft">
            {attempts
              .filter((a) => a.finishedAt)
              .reverse()
              .map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{formatDateTime(a.startedAt)}</span>
                  <span>
                    {a.correct} doğru, {a.wrong} yanlış, {a.blank} boş
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={resetForm} className="text-sm font-semibold text-soft underline hover:text-bad">
        Soru sayısını değiştir (formu sıfırla)
      </button>
    </div>
  )
}
