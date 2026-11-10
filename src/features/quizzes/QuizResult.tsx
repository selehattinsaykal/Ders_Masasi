import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react'
import { db, deleteAttempt, getSetting } from '../../db/db'
import { MODE_LABEL, QUESTION_TYPE_LABEL, type Answer, type Question, type Result } from '../../db/schema'
import { LETTERS, cx, formatDateTime, formatDuration } from '../../lib/format'
import { netScore, percentOf } from '../../lib/grading'
import { correctAnswerText, recount, startAttempt } from '../../lib/quiz'
import { groupAccuracy } from '../../lib/stats'
import { BackLink } from '../../ui/Layout'
import { Markdown } from '../../ui/Markdown'
import { AccuracyBars } from '../../ui/charts'
import { useFeedback } from '../../ui/feedback'
import { Badge, Button, Check, Empty, PageHeader, Panel, ScoreRow, SectionTitle } from '../../ui/kit'

const RESULT_TEXT: Record<Result, string> = { correct: 'Doğru', wrong: 'Yanlış', partial: 'Kısmen', blank: 'Boş' }
const RESULT_TONE: Record<Result, 'ok' | 'bad' | 'warn' | 'neutral'> = { correct: 'ok', wrong: 'bad', partial: 'warn', blank: 'neutral' }

function responseText(q: Question, a: Answer | undefined, order?: number[]): string {
  const r = a?.response
  if (r == null || r === '') return '(boş)'
  if (q.type === 'mcq') {
    const pos = order ? order.indexOf(r as number) : (r as number)
    return `${LETTERS[pos] ?? '?'}) ${q.options?.[r as number] ?? ''}`
  }
  if (q.type === 'tf') return r ? 'Doğru' : 'Yanlış'
  return String(r)
}

export default function QuizResult() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { confirm } = useFeedback()
  const [onlyMissed, setOnlyMissed] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const attempt = await db.attempts.get(id)
    if (!attempt) return null
    const [questions, answers, ratio] = await Promise.all([
      db.questions.bulkGet(attempt.questionIds),
      db.answers.where('attemptId').equals(id).toArray(),
      getSetting(db, 'negativeRatio', 0),
    ])
    return { attempt, questions: questions.filter((q): q is Question => !!q), answers: new Map(answers.map((a) => [a.questionId, a])), ratio }
  }, [id])

  if (data === undefined) return null
  if (data === null) return <Empty title="Bu deneme bulunamadı">Silinmiş olabilir.</Empty>

  const { attempt, questions, answers, ratio } = data
  const total = attempt.correct + attempt.wrong + attempt.blank + attempt.partial
  const percent = percentOf(attempt.correct, attempt.partial, total)
  const pending = questions.filter((q) => answers.get(q.id)?.needsReview)
  const missed = questions.filter((q) => ['wrong', 'partial'].includes(answers.get(q.id)?.result ?? ''))
  const list = [...answers.values()]
  const byTopic = groupAccuracy(list, (a) => a.topic).sort((a, b) => a.percent - b.percent)
  const byType = groupAccuracy(list, (a) => QUESTION_TYPE_LABEL[a.type])

  const grade = async (q: Question, result: Result) => {
    const a = answers.get(q.id)
    if (!a) return
    await db.answers.update(a.id, { result, needsReview: false, updatedAt: Date.now() })
    await recount(attempt.id)
  }

  const retry = async (qs: Question[], title: string, mode: 'yanlis' | 'calisma') => {
    const next = await startAttempt({
      courseId: attempt.courseId,
      setId: mode === 'calisma' ? attempt.setId : undefined,
      title,
      mode,
      instant: true,
      questions: qs,
      shuffleQuestions: mode === 'yanlis',
    })
    nav(`/test/${next}`)
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Bu deneme silinsin mi?',
      body: 'Denemenin sonuçları istatistiklerden de çıkar.',
      action: 'Denemeyi sil',
      danger: true,
    })
    if (!ok) return
    await deleteAttempt(db, attempt.id)
    nav(`/ders/${attempt.courseId}/testler`, { replace: true })
  }

  return (
    <>
      <PageHeader
        back={<BackLink to={`/ders/${attempt.courseId}/testler`}>Testler</BackLink>}
        title={attempt.title}
        subtitle={`${MODE_LABEL[attempt.mode]}, ${formatDateTime(attempt.startedAt)}`}
      />

      <div className="space-y-7">
        {pending.length > 0 && (
          <section>
            <SectionTitle>Önce bunları değerlendir ({pending.length})</SectionTitle>
            <p className="mb-3 text-soft">Yazdığın cevapları örnek çözümle karşılaştır; sonucun buna göre güncellenir.</p>
            <ul className="space-y-3">
              {pending.map((q) => (
                <li key={q.id}>
                  <Panel className="space-y-3 p-4">
                    <Markdown>{q.prompt}</Markdown>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-sm font-semibold text-soft">Senin cevabın</p>
                        <pre className={cx('rounded-lg bg-sunken p-3 text-sm whitespace-pre-wrap', q.type === 'code' ? 'font-mono' : 'font-sans')}>
                          {String(answers.get(q.id)?.response ?? '')}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-soft">Örnek çözüm</p>
                        <div className="rounded-lg bg-ok-soft p-3">
                          {q.solution ? (
                            <Markdown>{q.type === 'code' ? '```python\n' + q.solution + '\n```' : q.solution}</Markdown>
                          ) : (
                            <p className="text-soft">Çözüm eklenmemiş.</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['correct', 'partial', 'wrong'] as Result[]).map((r) => (
                        <Button key={r} size="sm" onClick={() => grade(q, r)}>
                          {RESULT_TEXT[r]}
                        </Button>
                      ))}
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-6xl leading-none font-bold tabular">
              <span className="marker">%{percent}</span>
            </p>
            <dl className="tabular text-right text-soft">
              <div>
                <dt className="sr-only">Süre</dt>
                <dd>{formatDuration(attempt.durationSec)}</dd>
              </div>
              {ratio > 0 && (
                <div>
                  <dt className="inline">Net: </dt>
                  <dd className="inline font-bold text-ink">{netScore(attempt.correct, attempt.wrong, ratio).toFixed(2).replace('.', ',')}</dd>
                </div>
              )}
            </dl>
          </div>
          <ScoreRow correct={attempt.correct} wrong={attempt.wrong} blank={attempt.blank} partial={attempt.partial} />
          <div className="mt-4 flex flex-wrap gap-2">
            {missed.length > 0 && (
              <Button variant="primary" icon={<RotateCcw size={17} />} onClick={() => retry(missed, `${attempt.title}: yanlışlar`, 'yanlis')}>
                {missed.length} yanlışı yeniden çöz
              </Button>
            )}
            <Button onClick={() => retry(questions, attempt.title, 'calisma')}>Tümünü yeniden çöz</Button>
            <Button variant="ghost" icon={<Trash2 size={17} />} onClick={remove}>
              Denemeyi sil
            </Button>
          </div>
        </Panel>

        {byTopic.length > 0 && (
          <section>
            <SectionTitle>Konulara göre</SectionTitle>
            <Panel className="p-4">
              <AccuracyBars buckets={byTopic} empty="" />
            </Panel>
          </section>
        )}

        {byType.length > 1 && (
          <section>
            <SectionTitle>Soru tipine göre</SectionTitle>
            <Panel className="p-4">
              <AccuracyBars buckets={byType} empty="" />
            </Panel>
          </section>
        )}

        <section>
          <SectionTitle
            action={
              missed.length > 0 && (
                <Check checked={onlyMissed} onChange={setOnlyMissed}>
                  Yalnızca yanlışlar
                </Check>
              )
            }
          >
            Sorular
          </SectionTitle>
          <ol className="space-y-2">
            {questions.map((q, i) => {
              const a = answers.get(q.id)
              const result = a?.result ?? 'blank'
              if (onlyMissed && !missed.includes(q)) return null
              const open = openId === q.id
              const order = attempt.optionOrder?.[q.id]
              return (
                <li key={q.id}>
                  <Panel>
                    <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : q.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                      <span className="tabular w-7 shrink-0 pt-0.5 text-right font-bold text-soft">{i + 1}.</span>
                      <span className={cx('min-w-0 flex-1', !open && 'line-clamp-2')}>{open ? <Markdown>{q.prompt}</Markdown> : q.prompt}</span>
                      <Badge tone={a?.needsReview ? 'pen' : RESULT_TONE[result]}>{a?.needsReview ? 'Değerlendir' : RESULT_TEXT[result]}</Badge>
                      <ChevronDown size={18} className={cx('mt-0.5 shrink-0 text-soft transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-line px-4 py-3">
                        {q.type !== 'open' && q.type !== 'code' && (
                          <dl className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <dt className="text-sm text-soft">Senin cevabın</dt>
                              <dd className={cx('font-semibold', result === 'correct' ? 'text-ok' : result === 'wrong' ? 'text-bad' : '')}>
                                {responseText(q, a, order)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm text-soft">Doğru cevap</dt>
                              <dd className="font-semibold text-ok">
                                {q.type === 'mcq' ? `${LETTERS[order ? order.indexOf(q.answerIndex!) : q.answerIndex!]}) ` : ''}
                                {correctAnswerText(q)}
                              </dd>
                            </div>
                          </dl>
                        )}
                        {(q.type === 'open' || q.type === 'code') && (
                          <>
                            <div>
                              <p className="text-sm text-soft">Senin cevabın</p>
                              <pre className={cx('mt-1 rounded-lg bg-sunken p-3 text-sm whitespace-pre-wrap', q.type === 'code' ? 'font-mono' : 'font-sans')}>
                                {responseText(q, a)}
                              </pre>
                              {a?.total ? (
                                <p className="tabular mt-1 text-sm text-soft">
                                  {a.passed} / {a.total} test geçti
                                </p>
                              ) : null}
                            </div>
                            {q.solution && (
                              <div>
                                <p className="text-sm text-soft">Örnek çözüm</p>
                                <Markdown className="mt-1">{q.type === 'code' ? '```python\n' + q.solution + '\n```' : q.solution}</Markdown>
                              </div>
                            )}
                          </>
                        )}
                        {q.explanation && (
                          <div>
                            <p className="text-sm text-soft">Açıklama</p>
                            <Markdown>{q.explanation}</Markdown>
                          </div>
                        )}
                      </div>
                    )}
                  </Panel>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </>
  )
}
