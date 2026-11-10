import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db, patch, removeRows, stamp } from '../../db/db'
import type { Course, Result, TopicStatus } from '../../db/schema'
import { percentOf } from '../../lib/grading'
import { cx } from '../../lib/format'
import { Badge, Button, Empty, IconButton, Input, Panel, ProgressBar } from '../../ui/kit'

const STATUS: { value: TopicStatus; label: string }[] = [
  { value: 'todo', label: 'Başlanmadı' },
  { value: 'doing', label: 'Çalışılıyor' },
  { value: 'done', label: 'Tamam' },
]

export function TopicsTab({ course }: { course: Course }) {
  const [name, setName] = useState('')

  const data = useLiveQuery(async () => {
    const [topics, questions, cards, answers] = await Promise.all([
      db.topics.where('courseId').equals(course.id).sortBy('order'),
      db.questions.where('courseId').equals(course.id).toArray(),
      db.cards.where('courseId').equals(course.id).toArray(),
      db.answers.where('courseId').equals(course.id).toArray(),
    ])
    const key = (s?: string) => s?.trim().toLocaleLowerCase('tr') ?? ''
    const stat = new Map<string, { q: number; c: number; res: Record<Result, number> }>()
    const get = (k: string) => {
      if (!stat.has(k)) stat.set(k, { q: 0, c: 0, res: { correct: 0, wrong: 0, blank: 0, partial: 0 } })
      return stat.get(k)!
    }
    for (const q of questions) if (q.topic) get(key(q.topic)).q++
    for (const c of cards) if (c.topic) get(key(c.topic)).c++
    for (const a of answers) if (a.topic) get(key(a.topic)).res[a.result]++
    return { topics, stat, key }
  }, [course.id])

  if (!data) return null
  const { topics, stat, key } = data
  const done = topics.filter((t) => t.status === 'done').length

  const add = async () => {
    const n = name.trim()
    if (!n) return
    await db.topics.add(stamp({ courseId: course.id, name: n, status: 'todo' as const, order: topics.length }))
    setName('')
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Konu adı, ör. İkili arama ağaçları" aria-label="Yeni konu" />
        <Button type="submit" variant="primary" icon={<Plus size={18} />} disabled={!name.trim()}>
          Ekle
        </Button>
      </form>

      {!topics.length ? (
        <Empty title="Konu listesi boş">
          Sınavda çıkacak konuları buraya yaz, çalıştıkça işaretle. Soru ve kartlardaki konu adları da buraya kendiliğinden eklenir.
        </Empty>
      ) : (
        <>
          <Panel className="p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-semibold">
                <span className="marker tabular">
                  {done} / {topics.length}
                </span>{' '}
                konu tamam
              </span>
              <span className="tabular text-sm text-soft">%{Math.round((done / topics.length) * 100)}</span>
            </div>
            <ProgressBar value={(done / topics.length) * 100} tone="ok" />
          </Panel>

          <ul className="space-y-2">
            {topics.map((t) => {
              const s = stat.get(key(t.name))
              const answered = s ? s.res.correct + s.res.wrong + s.res.partial : 0
              const pct = s ? percentOf(s.res.correct, s.res.partial, answered) : 0
              return (
                <li key={t.id}>
                  <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <div className="min-w-40 flex-1">
                      <p className={cx('font-semibold', t.status === 'done' && 'text-soft line-through')}>{t.name}</p>
                      <p className="tabular mt-0.5 flex flex-wrap items-center gap-2 text-sm text-soft">
                        <span>
                          {s?.q ?? 0} soru, {s?.c ?? 0} kart
                        </span>
                        {answered > 0 && <Badge tone={pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'bad'}>%{pct} başarı</Badge>}
                      </p>
                    </div>
                    <div className="inline-flex gap-1 rounded-lg bg-sunken p-1" role="radiogroup" aria-label={`${t.name} durumu`}>
                      {STATUS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={t.status === o.value}
                          onClick={() => patch(db.topics, t.id, { status: o.value })}
                          className={cx(
                            'min-h-9 rounded-md px-2.5 text-sm font-semibold',
                            t.status === o.value
                              ? o.value === 'done'
                                ? 'bg-ok text-surface'
                                : o.value === 'doing'
                                  ? 'bg-marker text-[#1b2440]'
                                  : 'bg-surface text-ink shadow-sm'
                              : 'text-soft hover:text-ink',
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <IconButton label={`${t.name} konusunu sil`} onClick={() => removeRows(db, 'topics', [t.id])}>
                      <Trash2 size={18} />
                    </IconButton>
                  </Panel>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
