import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Play, Plus, Star, Timer, Trash2 } from 'lucide-react'
import { db, deleteQuestion, deleteSet, patch } from '../../db/db'
import { EXAM_TYPE_LABEL, MODE_LABEL, QUESTION_TYPE_LABEL, type Question } from '../../db/schema'
import { formatDateTime, formatDuration } from '../../lib/format'
import { buildQuestionStats, startAttempt } from '../../lib/quiz'
import { attemptPercent } from '../../lib/stats'
import { BackLink } from '../../ui/Layout'
import { useFeedback } from '../../ui/feedback'
import { Badge, Button, Check, Empty, Field, IconButton, Input, PageHeader, Panel, ScoreRow, SectionTitle } from '../../ui/kit'
import { QuestionEditor } from './QuestionEditor'
import { SetForm } from './SetForm'

export default function SetPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { confirm, toast } = useFeedback()
  const [editingSet, setEditingSet] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; question?: Question }>({ open: false })
  const [shuffleQ, setShuffleQ] = useState(false)
  const [shuffleO, setShuffleO] = useState(false)
  const [minutes, setMinutes] = useState('')

  const data = useLiveQuery(async () => {
    const set = await db.questionSets.get(id)
    if (!set) return null
    const [questions, attempts] = await Promise.all([
      db.questions.where('setId').equals(id).sortBy('order'),
      db.attempts.where('setId').equals(id).toArray(),
    ])
    const answers = await db.answers.where('questionId').anyOf(questions.map((q) => q.id)).toArray()
    return { set, questions, stats: buildQuestionStats(answers), attempts: attempts.sort((a, b) => b.startedAt - a.startedAt) }
  }, [id])

  const suggested = data ? (data.set.durationMin ?? Math.max(5, Math.round(data.questions.length * 1.5))) : 0
  useEffect(() => {
    if (suggested && !minutes) setMinutes(String(suggested))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested])

  if (data === undefined) return null
  if (data === null) return <Empty title="Bu test bulunamadı">Silinmiş olabilir.</Empty>
  const { set, questions, stats, attempts } = data

  const start = async (mode: 'calisma' | 'sinav') => {
    const attemptId = await startAttempt({
      courseId: set.courseId,
      setId: set.id,
      title: set.title,
      mode,
      instant: mode === 'calisma',
      questions,
      shuffleQuestions: shuffleQ,
      shuffleOptions: shuffleO,
      limitSec: mode === 'sinav' && Number(minutes) > 0 ? Number(minutes) * 60 : undefined,
    })
    nav(`/test/${attemptId}`)
  }

  const removeSet = async () => {
    const ok = await confirm({
      title: `“${set.title}” silinsin mi?`,
      body: `${questions.length} soru ve bu testin deneme geçmişi kalıcı olarak silinir.`,
      action: 'Testi sil',
      danger: true,
    })
    if (!ok) return
    await deleteSet(db, set.id)
    toast('Test silindi')
    nav(`/ders/${set.courseId}/testler`, { replace: true })
  }

  const removeQuestion = async (q: Question) => {
    const ok = await confirm({ title: 'Soru silinsin mi?', body: 'Sorunun geçmişi de silinir.', action: 'Soruyu sil', danger: true })
    if (ok) await deleteQuestion(db, q.id)
  }

  const finished = attempts.filter((a) => a.finishedAt)
  const unfinished = attempts.find((a) => !a.finishedAt)

  return (
    <>
      <PageHeader
        back={<BackLink to={`/ders/${set.courseId}/testler`}>Testler</BackLink>}
        title={set.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="pen">{set.kind === 'cikmis' ? 'Çıkmış sorular' : 'Çalışma soruları'}</Badge>
            {set.year && <Badge>{[set.year, set.term].filter(Boolean).join(' ')}</Badge>}
            {set.examType && <Badge>{EXAM_TYPE_LABEL[set.examType]}</Badge>}
            <span className="tabular">{questions.length} soru</span>
          </span>
        }
        actions={
          <>
            <IconButton label="Testi düzenle" onClick={() => setEditingSet(true)}>
              <Pencil size={19} />
            </IconButton>
            <IconButton label="Testi sil" onClick={removeSet}>
              <Trash2 size={19} />
            </IconButton>
          </>
        }
      />

      <div className="space-y-7">
        {questions.length > 0 && (
          <Panel className="space-y-4 p-4 sm:p-5">
            {unfinished && (
              <Button variant="primary" className="w-full" onClick={() => nav(`/test/${unfinished.id}`)}>
                Yarım kalan denemeye devam et ({unfinished.currentIndex + 1}. soru)
              </Button>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Button variant={unfinished ? 'secondary' : 'primary'} className="w-full" icon={<Play size={18} />} onClick={() => start('calisma')}>
                  Çalışma modunda çöz
                </Button>
                <p className="text-sm text-soft">Her sorudan sonra doğru cevabı ve açıklamayı görürsün.</p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" icon={<Timer size={18} />} onClick={() => start('sinav')}>
                  Sınav modunda çöz
                </Button>
                <Field label="Süre (dakika)">
                  <Input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Süresiz" />
                </Field>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 border-t border-line pt-3">
              <Check checked={shuffleQ} onChange={setShuffleQ}>
                Soruları karıştır
              </Check>
              <Check checked={shuffleO} onChange={setShuffleO}>
                Şıkları karıştır
              </Check>
            </div>
          </Panel>
        )}

        {finished.length > 0 && (
          <section>
            <SectionTitle>Denemeler</SectionTitle>
            <ul className="space-y-2">
              {finished.map((a) => (
                <li key={a.id}>
                  <Link to={`/sonuc/${a.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                    <span className="text-soft">
                      {formatDateTime(a.startedAt)}, {MODE_LABEL[a.mode]}, {formatDuration(a.durationSec)}
                    </span>
                    <span className="flex items-center gap-3">
                      <ScoreRow correct={a.correct} wrong={a.wrong} blank={a.blank} partial={a.partial} compact />
                      <Badge tone={attemptPercent(a) >= 70 ? 'ok' : attemptPercent(a) >= 40 ? 'warn' : 'bad'}>%{attemptPercent(a)}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionTitle
            action={
              <Button size="sm" icon={<Plus size={16} />} onClick={() => setEditor({ open: true })}>
                Soru ekle
              </Button>
            }
          >
            Sorular
          </SectionTitle>
          {!questions.length ? (
            <Empty title="Bu testte soru yok" action={<Button variant="primary" onClick={() => setEditor({ open: true })}>İlk soruyu ekle</Button>}>
              Soruları elle ekleyebilir ya da aynı başlıklı bir JSON dosyasını içe aktarabilirsin.
            </Empty>
          ) : (
            <ol className="space-y-2">
              {questions.map((q, i) => {
                const s = stats.get(q.id)
                return (
                  <li key={q.id} className="flex items-start gap-1 rounded-xl border border-line bg-surface py-2 pr-1.5 pl-4">
                    <span className="tabular w-7 shrink-0 pt-2 font-bold text-soft">{i + 1}.</span>
                    <div className="min-w-0 flex-1 py-1.5">
                      <p className="line-clamp-2">{q.prompt}</p>
                      <p className="tabular mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                        <Badge>{QUESTION_TYPE_LABEL[q.type]}</Badge>
                        {q.topic && <Badge tone="pen">{q.topic}</Badge>}
                        {s ? (
                          <Badge tone={s.last === 'correct' ? 'ok' : s.last === 'partial' ? 'warn' : 'bad'}>
                            {s.seen} kez: {s.correct} doğru, {s.wrong} yanlış
                          </Badge>
                        ) : (
                          <span className="text-soft">Henüz çözülmedi</span>
                        )}
                      </p>
                    </div>
                    <IconButton label={q.starred ? 'Yıldızı kaldır' : 'Yıldızla'} active={q.starred} onClick={() => patch(db.questions, q.id, { starred: !q.starred })}>
                      <Star size={18} fill={q.starred ? 'currentColor' : 'none'} />
                    </IconButton>
                    <IconButton label="Soruyu düzenle" onClick={() => setEditor({ open: true, question: q })}>
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton label="Soruyu sil" onClick={() => removeQuestion(q)}>
                      <Trash2 size={18} />
                    </IconButton>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      <SetForm open={editingSet} onClose={() => setEditingSet(false)} courseId={set.courseId} set={set} />
      <QuestionEditor open={editor.open} onClose={() => setEditor({ open: false })} setId={set.id} courseId={set.courseId} question={editor.question} />
    </>
  )
}
