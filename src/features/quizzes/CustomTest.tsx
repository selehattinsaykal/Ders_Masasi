import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { QUESTION_TYPE_LABEL, type Course, type QuestionType } from '../../db/schema'
import { cx, shuffle } from '../../lib/format'
import { buildQuestionStats, isMissed, startAttempt } from '../../lib/quiz'
import { Button, Check, Field, Input, Modal, Segmented } from '../../ui/kit'

type Source = 'hepsi' | 'cikmis' | 'calisma'
type Status = 'hepsi' | 'yanlis' | 'yeni' | 'yildiz'

function Chips<T extends string>({ all, picked, onToggle, labelOf }: { all: T[]; picked: Set<T>; onToggle: (v: T) => void; labelOf: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={picked.has(v)}
          onClick={() => onToggle(v)}
          className={cx(
            'min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors',
            picked.has(v) ? 'border-pen bg-pen-soft text-pen' : 'border-line text-soft hover:border-pen',
          )}
        >
          {labelOf(v)}
        </button>
      ))}
    </div>
  )
}

/** Dersin tüm sorularından filtreyle karışık test kurar. */
export function CustomTest({ open, onClose, course }: { open: boolean; onClose: () => void; course: Course }) {
  const nav = useNavigate()
  const [source, setSource] = useState<Source>('hepsi')
  const [status, setStatus] = useState<Status>('hepsi')
  const [topics, setTopics] = useState<Set<string>>(new Set())
  const [types, setTypes] = useState<Set<QuestionType>>(new Set())
  const [count, setCount] = useState('20')
  const [instant, setInstant] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [minutes, setMinutes] = useState('')

  const data = useLiveQuery(async () => {
    if (!open) return undefined
    const [questions, sets, answers] = await Promise.all([
      db.questions.where('courseId').equals(course.id).toArray(),
      db.questionSets.where('courseId').equals(course.id).toArray(),
      db.answers.where('courseId').equals(course.id).toArray(),
    ])
    return { questions, kindOf: new Map(sets.map((s) => [s.id, s.kind])), stats: buildQuestionStats(answers) }
  }, [open, course.id])

  useEffect(() => {
    if (open) {
      setTopics(new Set())
      setTypes(new Set())
    }
  }, [open])

  const allTopics = useMemo(() => [...new Set((data?.questions ?? []).map((q) => q.topic).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'tr')), [data])
  const allTypes = useMemo(() => [...new Set((data?.questions ?? []).map((q) => q.type))], [data])

  const pool = useMemo(() => {
    if (!data) return []
    return data.questions.filter((q) => {
      if (source !== 'hepsi' && data.kindOf.get(q.setId) !== source) return false
      if (topics.size && !(q.topic && topics.has(q.topic))) return false
      if (types.size && !types.has(q.type)) return false
      const s = data.stats.get(q.id)
      if (status === 'yanlis' && !isMissed(s)) return false
      if (status === 'yeni' && s) return false
      if (status === 'yildiz' && !q.starred) return false
      return true
    })
  }, [data, source, status, topics, types])

  const n = Math.max(1, Math.min(pool.length, Number(count) || pool.length))
  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const start = async () => {
    const picked = shuffle(pool).slice(0, n)
    const id = await startAttempt({
      courseId: course.id,
      title: `${course.name}: karışık test`,
      mode: 'karisik',
      instant,
      questions: picked,
      shuffleQuestions: true,
      shuffleOptions,
      limitSec: !instant && Number(minutes) > 0 ? Number(minutes) * 60 : undefined,
    })
    nav(`/test/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Karışık test"
      footer={
        <>
          <span className="tabular mr-auto self-center text-soft">
            <span className="font-bold text-ink">{pool.length}</span> soru uygun
          </span>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={start} disabled={!pool.length}>
            {pool.length ? `${n} soruyla başla` : 'Uygun soru yok'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Kaynak</span>
          <Segmented
            label="Kaynak"
            value={source}
            onChange={setSource}
            options={[
              { value: 'hepsi', label: 'Hepsi' },
              { value: 'cikmis', label: 'Çıkmış sorular' },
              { value: 'calisma', label: 'Çalışma soruları' },
            ]}
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Hangi sorular</span>
          <Segmented
            label="Hangi sorular"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'hepsi', label: 'Hepsi' },
              { value: 'yanlis', label: 'Yanlış yaptıklarım' },
              { value: 'yeni', label: 'Hiç çözmediklerim' },
              { value: 'yildiz', label: 'Yıldızlılar' },
            ]}
          />
        </div>
        {allTopics.length > 0 && (
          <div>
            <span className="mb-1.5 block text-sm font-semibold">Konular {topics.size === 0 && <span className="font-normal text-soft">(seçmezsen hepsi)</span>}</span>
            <Chips all={allTopics} picked={topics} onToggle={(v) => setTopics(toggle(topics, v))} labelOf={(v) => v} />
          </div>
        )}
        {allTypes.length > 1 && (
          <div>
            <span className="mb-1.5 block text-sm font-semibold">Soru tipleri {types.size === 0 && <span className="font-normal text-soft">(seçmezsen hepsi)</span>}</span>
            <Chips all={allTypes} picked={types} onToggle={(v) => setTypes(toggle(types, v))} labelOf={(v) => QUESTION_TYPE_LABEL[v]} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Soru sayısı">
            <Input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
          </Field>
          {!instant && (
            <Field label="Süre, dakika (isteğe bağlı)">
              <Input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </Field>
          )}
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Geri bildirim</span>
          <Segmented
            label="Geri bildirim"
            value={instant ? 'aninda' : 'sonda'}
            onChange={(v) => setInstant(v === 'aninda')}
            options={[
              { value: 'aninda', label: 'Her sorudan sonra' },
              { value: 'sonda', label: 'Test bitince' },
            ]}
          />
        </div>
        <Check checked={shuffleOptions} onChange={setShuffleOptions}>
          Şıkların yerini karıştır
        </Check>
      </div>
    </Modal>
  )
}
