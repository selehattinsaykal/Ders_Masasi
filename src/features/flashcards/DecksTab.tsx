import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileJson, Layers, Plus } from 'lucide-react'
import { db, stamp } from '../../db/db'
import type { Course } from '../../db/schema'
import { Badge, Button, Empty, Field, Input, Modal } from '../../ui/kit'

export function DecksTab({ course }: { course: Course }) {
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const data = useLiveQuery(async () => {
    const [decks, cards] = await Promise.all([
      db.decks.where('courseId').equals(course.id).toArray(),
      db.cards.where('courseId').equals(course.id).toArray(),
    ])
    const now = Date.now()
    const info = new Map<string, { total: number; due: number; fresh: number }>()
    for (const c of cards) {
      if (!info.has(c.deckId)) info.set(c.deckId, { total: 0, due: 0, fresh: 0 })
      const x = info.get(c.deckId)!
      x.total++
      if (c.due <= now) x.due++
      if (c.fsrs.reps === 0) x.fresh++
    }
    return { decks: decks.sort((a, b) => a.title.localeCompare(b.title, 'tr', { numeric: true })), info, due: cards.filter((c) => c.due <= now).length, total: cards.length }
  }, [course.id])

  if (!data) return null

  const add = async () => {
    if (!title.trim()) return
    const deck = stamp({ courseId: course.id, title: title.trim() })
    await db.decks.add(deck)
    setAdding(false)
    setTitle('')
    nav(`/deste/${deck.id}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {data.due > 0 && (
          <Button variant="primary" icon={<Layers size={18} />} onClick={() => nav(`/kart-calis?ders=${course.id}&mod=tekrar`)}>
            {data.due} kartı tekrar et
          </Button>
        )}
        {data.total > 0 && (
          <Button variant={data.due ? 'secondary' : 'primary'} onClick={() => nav(`/kart-calis?ders=${course.id}&mod=hepsi&karisik=1`)}>
            Dersin tüm kartlarını çalış
          </Button>
        )}
        <Button icon={<Plus size={18} />} onClick={() => setAdding(true)}>
          Yeni deste
        </Button>
        <Button icon={<FileJson size={18} />} onClick={() => nav(`/ice-aktar?ders=${course.id}`)}>
          JSON içe aktar
        </Button>
      </div>

      {!data.decks.length ? (
        <Empty
          title="Henüz kart destesi yok"
          action={
            <>
              <Button variant="primary" onClick={() => nav(`/ice-aktar?ders=${course.id}`)}>
                JSON içe aktar
              </Button>
              <Button onClick={() => setAdding(true)}>Elle deste oluştur</Button>
            </>
          }
        >
          Arkalı önlü kartları hazırlattığın JSON dosyasından içe aktar ya da kendin yaz.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.decks.map((d) => {
            const x = data.info.get(d.id) ?? { total: 0, due: 0, fresh: 0 }
            return (
              <li key={d.id}>
                <Link to={`/deste/${d.id}`} className="block h-full rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-pen">
                  <p className="text-lg font-semibold">{d.title}</p>
                  <p className="tabular mt-1 flex flex-wrap items-center gap-1.5 text-sm text-soft">
                    <span>{x.total} kart</span>
                    {x.due > 0 && <Badge tone="pen">{x.due} tekrar bekliyor</Badge>}
                    {x.fresh > 0 && <Badge>{x.fresh} yeni</Badge>}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Yeni deste"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Vazgeç
            </Button>
            <Button variant="primary" onClick={add} disabled={!title.trim()}>
              Desteyi oluştur
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <Field label="Deste adı">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ağaçlar" autoFocus />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
