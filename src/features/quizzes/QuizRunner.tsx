import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Flag, LayoutGrid, Star, Timer } from 'lucide-react'
import { db, patch } from '../../db/db'
import { MODE_LABEL, QUESTION_TYPE_LABEL, type Answer, type Question, type Result } from '../../db/schema'
import { clock, cx } from '../../lib/format'
import { gradeCode } from '../../lib/grading'
import { autoGrade, buildQuestionStats, finishAttempt, lettersOnly, saveAnswer } from '../../lib/quiz'
import { FocusBar } from '../../ui/Layout'
import { Markdown } from '../../ui/Markdown'
import { useFeedback } from '../../ui/feedback'
import { Badge, Button, Empty, IconButton, Modal, ProgressBar, Textarea } from '../../ui/kit'
import { QuestionBody } from './QuestionBody'

const RESULT_TEXT: Record<Result, string> = { correct: 'Doğru', wrong: 'Yanlış', partial: 'Kısmen doğru', blank: 'Boş' }

export default function QuizRunner() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { confirm } = useFeedback()

  const data = useLiveQuery(async () => {
    const attempt = await db.attempts.get(id)
    if (!attempt) return null
    const [questions, answers, history] = await Promise.all([
      db.questions.bulkGet(attempt.questionIds),
      db.answers.where('attemptId').equals(id).toArray(),
      db.answers.where('questionId').anyOf(attempt.questionIds).toArray(),
    ])
    return {
      attempt,
      questions: questions.filter((q): q is Question => !!q),
      answers: new Map(answers.map((a) => [a.questionId, a])),
      past: buildQuestionStats(history.filter((a) => a.attemptId !== id)),
    }
  }, [id])

  const [index, setIndex] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<string, unknown>>({})
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [palette, setPalette] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const elapsedRef = useRef(0)
  const finishing = useRef(false)

  const attempt = data?.attempt
  const questions = data?.questions ?? []

  // İlk yüklemede kaldığı yerden başlat.
  useEffect(() => {
    if (!attempt || index !== null) return
    setIndex(Math.min(attempt.currentIndex, Math.max(0, attempt.questionIds.length - 1)))
    setElapsed(attempt.durationSec)
    elapsedRef.current = attempt.durationSec
  }, [attempt, index])

  // Bitmiş deneme sonuç sayfasına gider.
  useEffect(() => {
    if (attempt?.finishedAt) nav(`/sonuc/${attempt.id}`, { replace: true })
  }, [attempt, nav])

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    await finishAttempt(id, elapsedRef.current)
    nav(`/sonuc/${id}`, { replace: true })
  }, [id, nav])

  // Süre sayacı: sekme görünürken ilerler, aralıklarla kaydedilir.
  const ticking = elapsed !== null && !!attempt && !attempt.finishedAt
  useEffect(() => {
    if (!ticking) return
    const t = setInterval(() => {
      if (document.hidden) return
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      if (elapsedRef.current % 10 === 0) void db.attempts.update(id, { durationSec: elapsedRef.current })
    }, 1000)
    return () => {
      clearInterval(t)
      if (!finishing.current) void db.attempts.update(id, { durationSec: elapsedRef.current })
    }
  }, [ticking, id])

  const limit = attempt?.limitSec
  useEffect(() => {
    if (limit && elapsed !== null && elapsed >= limit) void finish()
  }, [limit, elapsed, finish])

  const q = index !== null ? questions[index] : undefined
  const answer = q ? data?.answers.get(q.id) : undefined
  const instant = attempt?.instant ?? true
  const selfGraded = q?.type === 'open' || (q?.type === 'code' && !q.tests?.length)
  const graded = !!answer && !answer.needsReview
  const revealed = instant && (q?.type === 'code' ? !!shown[q.id] : graded || (selfGraded && !!shown[q?.id ?? '']))
  const locked = instant && graded && q?.type !== 'code'
  const response = q ? (q.id in drafts ? drafts[q.id] : (answer?.response ?? (q.type === 'code' ? undefined : null))) : null

  const go = useCallback(
    (to: number) => {
      if (!attempt) return
      const next = Math.max(0, Math.min(questions.length - 1, to))
      setIndex(next)
      setNoteOpen(false)
      void db.attempts.update(attempt.id, { currentIndex: next })
      window.scrollTo({ top: 0 })
    },
    [attempt, questions.length],
  )

  const setResponse = (r: unknown) => {
    if (!q || !attempt) return
    setDrafts((d) => ({ ...d, [q.id]: r }))
    if (instant) return
    // Sınav modu: her değişiklik hemen kaydedilir, sonuç sonda gösterilir.
    const empty = r == null || (typeof r === 'string' && !r.trim())
    if (q.type === 'open' || q.type === 'code') {
      if (q.type === 'code' && answer && !answer.needsReview) return // test sonucu zaten kayıtlı
      void saveAnswer(attempt, q, { response: r, result: 'blank', needsReview: !empty })
    } else void saveAnswer(attempt, q, { response: r, result: autoGrade(q, r) ?? 'blank' })
  }

  const check = useCallback(async () => {
    if (!q || !attempt) return
    const result = autoGrade(q, response)
    if (!result || result === 'blank') return
    await saveAnswer(attempt, q, { response, result })
  }, [q, attempt, response])

  const selfGrade = async (result: Result) => {
    if (!q || !attempt) return
    await saveAnswer(attempt, q, { response: response ?? null, result })
  }

  const onCodeTested = async (code: string, passed: number, total: number) => {
    if (!q || !attempt) return
    await saveAnswer(attempt, q, { response: code, result: gradeCode(passed, total), passed, total })
  }

  const isLast = index === questions.length - 1
  const answeredCount = useMemo(
    () => questions.filter((x) => {
      const a = data?.answers.get(x.id)
      return a && (a.result !== 'blank' || a.needsReview)
    }).length,
    [questions, data],
  )

  const askFinish = async () => {
    const left = questions.length - answeredCount
    if (left > 0) {
      const ok = await confirm({
        title: 'Test bitirilsin mi?',
        body: `${left} soru cevaplanmadı; boş sayılacak.`,
        action: 'Testi bitir',
      })
      if (!ok) return
    }
    await finish()
  }

  // Klavye: A–E / 1–5 şık seçer, Enter kontrol eder ya da ilerler, oklar gezinir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (t?.closest('input, textarea, select, .cm-editor, [role="dialog"]') || e.ctrlKey || e.metaKey || e.altKey) return
      if (!q) return
      if (e.key === 'ArrowRight') return go((index ?? 0) + 1)
      if (e.key === 'ArrowLeft') return go((index ?? 0) - 1)
      if (e.key === 'Enter') {
        e.preventDefault()
        if (instant && !graded && !selfGraded && q.type !== 'code') void check()
        else if (!isLast) go((index ?? 0) + 1)
        return
      }
      if (locked) return
      if (q.type === 'mcq') {
        const order = (!lettersOnly(q) && attempt?.optionOrder?.[q.id]) || q.options!.map((_, i) => i)
        const k = e.key.toUpperCase()
        const pos = /^[1-8]$/.test(k) ? Number(k) - 1 : /^[A-H]$/.test(k) ? k.charCodeAt(0) - 65 : -1
        if (pos >= 0 && pos < order.length) setResponse(order[pos])
      } else if (q.type === 'tf') {
        if (e.key.toLowerCase() === 'd') setResponse(true)
        if (e.key.toLowerCase() === 'y') setResponse(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (data === undefined || (data && index === null)) return null
  if (data === null || !attempt)
    return (
      <div className="p-6">
        <Empty title="Bu test bulunamadı">Silinmiş olabilir.</Empty>
      </div>
    )
  if (!q)
    return (
      <div className="p-6">
        <Empty title="Bu testte soru kalmamış" action={<Button onClick={() => nav(-1)}>Geri dön</Button>}>
          Sorular silinmiş olabilir.
        </Empty>
      </div>
    )

  const past = data.past.get(q.id)
  const remaining = limit && elapsed !== null ? limit - elapsed : null
  const canCheck = instant && !graded && !selfGraded && q.type !== 'code'
  const hasDraft = response != null && !(typeof response === 'string' && !response.trim())

  return (
    <div className="min-h-dvh pb-24">
      <FocusBar title={attempt.title} subtitle={MODE_LABEL[attempt.mode]} backTo={`/ders/${attempt.courseId}/testler`}>
        <span
          className={cx(
            'tabular mr-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold',
            remaining !== null && remaining <= 60 ? 'bg-bad-soft text-bad' : 'text-soft',
          )}
          aria-label={remaining !== null ? 'Kalan süre' : 'Geçen süre'}
        >
          <Timer size={15} />
          {clock(remaining !== null ? remaining : (elapsed ?? 0))}
        </span>
        <IconButton label="Tüm sorular" onClick={() => setPalette(true)}>
          <LayoutGrid size={20} />
        </IconButton>
      </FocusBar>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div className="mb-4">
          <div className="tabular mb-1.5 flex justify-between text-sm text-soft">
            <span>
              Soru <span className="font-bold text-ink">{index! + 1}</span> / {questions.length}
            </span>
            <span>{answeredCount} cevaplandı</span>
          </div>
          <ProgressBar value={(answeredCount / questions.length) * 100} />
        </div>

        <article className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Badge>{QUESTION_TYPE_LABEL[q.type]}</Badge>
            {q.topic && <Badge tone="pen">{q.topic}</Badge>}
            {past && (
              <Badge tone={past.last === 'correct' ? 'ok' : 'bad'}>
                {past.seen} kez çözdün, {past.correct} doğru
              </Badge>
            )}
            <IconButton
              label={q.starred ? 'Yıldızı kaldır' : 'Soruyu yıldızla'}
              active={q.starred}
              className="ml-auto"
              onClick={() => patch(db.questions, q.id, { starred: !q.starred })}
            >
              <Star size={19} fill={q.starred ? 'currentColor' : 'none'} />
            </IconButton>
          </div>

          <Markdown className="mb-5 text-[17px]">{q.prompt}</Markdown>

          <QuestionBody
            key={q.id}
            q={q}
            order={attempt.optionOrder?.[q.id]}
            response={response}
            onResponse={setResponse}
            revealed={revealed}
            locked={locked}
            onSubmit={() => (canCheck ? void check() : undefined)}
            onCodeTested={onCodeTested}
          />

          {instant && graded && answer && <Feedback answer={answer} q={q} showExplanation={revealed || q.type !== 'code'} />}

          {instant && selfGraded && shown[q.id] && (
            <div className="mt-4">
              <p className="mb-2 font-semibold">{graded ? 'Değerlendirmen' : 'Çözümle karşılaştır: cevabın nasıldı?'}</p>
              <div className="flex flex-wrap gap-2">
                {(['correct', 'partial', 'wrong'] as Result[]).map((r) => (
                  <Button
                    key={r}
                    onClick={() => selfGrade(r)}
                    className={cx(
                      answer?.result === r && !answer.needsReview && (r === 'correct' ? '!border-ok !bg-ok-soft !text-ok' : r === 'wrong' ? '!border-bad !bg-bad-soft !text-bad' : '!border-warn !bg-warn-soft !text-warn'),
                    )}
                  >
                    {RESULT_TEXT[r]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {canCheck && (
              <Button variant="primary" onClick={check} disabled={!hasDraft}>
                Kontrol et
              </Button>
            )}
            {instant && (selfGraded || q.type === 'code') && !shown[q.id] && (
              <Button variant={selfGraded ? 'primary' : 'secondary'} onClick={() => setShown((s) => ({ ...s, [q.id]: true }))}>
                Çözümü göster
              </Button>
            )}
            <button type="button" onClick={() => setNoteOpen((v) => !v)} className="ml-auto text-sm font-semibold text-soft underline hover:text-pen">
              {q.note ? 'Notunu göster' : 'Not ekle'}
            </button>
          </div>

          {noteOpen && (
            <Textarea
              className="mt-3"
              rows={2}
              defaultValue={q.note ?? ''}
              placeholder="Bu soruyla ilgili kendine not"
              aria-label="Soru notu"
              onBlur={(e) => patch(db.questions, q.id, { note: e.target.value.trim() || undefined })}
            />
          )}
        </article>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <Button icon={<ChevronLeft size={18} />} onClick={() => go(index! - 1)} disabled={index === 0}>
            <span className="hidden sm:inline">Önceki</span>
          </Button>
          <Button variant="ghost" icon={<Flag size={17} />} onClick={askFinish} className="ml-auto">
            Bitir
          </Button>
          {isLast ? (
            <Button variant="primary" onClick={askFinish}>
              Testi bitir
            </Button>
          ) : (
            <Button variant={canCheck && hasDraft ? 'secondary' : 'primary'} onClick={() => go(index! + 1)}>
              {instant && !graded && !hasDraft ? 'Boş geç' : 'Sonraki'}
              <ChevronRight size={18} />
            </Button>
          )}
        </div>
      </div>

      <Modal open={palette} onClose={() => setPalette(false)} title="Tüm sorular">
        <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {questions.map((x, i) => {
            const a = data.answers.get(x.id)
            const done = a && (a.result !== 'blank' || a.needsReview)
            const tone = !done
              ? 'border-line text-soft'
              : !instant || a.needsReview
                ? 'border-pen bg-pen-soft text-pen'
                : a.result === 'correct'
                  ? 'border-ok bg-ok-soft text-ok'
                  : a.result === 'partial'
                    ? 'border-warn bg-warn-soft text-warn'
                    : 'border-bad bg-bad-soft text-bad'
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => {
                    go(i)
                    setPalette(false)
                  }}
                  aria-current={i === index}
                  className={cx('tabular grid aspect-square w-full place-items-center rounded-lg border-2 font-bold', tone, i === index && 'ring-2 ring-pen ring-offset-2 ring-offset-surface')}
                >
                  {i + 1}
                </button>
              </li>
            )
          })}
        </ol>
      </Modal>
    </div>
  )
}

function Feedback({ answer, q, showExplanation }: { answer: Answer; q: Question; showExplanation: boolean }) {
  const ok = answer.result === 'correct'
  const partial = answer.result === 'partial'
  return (
    <div
      className={cx('mt-4 rounded-xl border px-4 py-3', ok ? 'border-ok/40 bg-ok-soft' : partial ? 'border-warn/40 bg-warn-soft' : 'border-bad/40 bg-bad-soft')}
      role="status"
    >
      <p className={cx('flex items-center gap-2 font-display text-lg font-bold', ok ? 'text-ok' : partial ? 'text-warn' : 'text-bad')}>
        {ok ? <CircleCheck size={20} /> : <CircleX size={20} />}
        {RESULT_TEXT[answer.result]}
        {answer.total ? <span className="tabular text-sm font-semibold">({answer.passed} / {answer.total} test)</span> : null}
      </p>
      {showExplanation && q.explanation && <Markdown className="mt-2">{q.explanation}</Markdown>}
    </div>
  )
}
