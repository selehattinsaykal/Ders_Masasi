import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pin, Plus, Printer } from 'lucide-react'
import { db, stamp } from '../../db/db'
import type { Course } from '../../db/schema'
import { plainText, relativeDay } from '../../lib/format'
import { Markdown } from '../../ui/Markdown'
import { Badge, Button, Empty, Panel, SectionTitle } from '../../ui/kit'

/** İlk anlamlı satırı düz metin olarak verir (liste önizlemesi için). */
function excerpt(body: string): string {
  const line = body
    .split('\n')
    .map((l) => plainText(l).replace(/^[#>*\-\s]+/, '').trim())
    .find(Boolean)
  return line ? (line.length > 120 ? `${line.slice(0, 120)}…` : line) : 'Boş not'
}

export function NotesTab({ course }: { course: Course }) {
  const nav = useNavigate()
  const notes = useLiveQuery(
    () => db.notes.where('courseId').equals(course.id).toArray().then((l) => l.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)),
    [course.id],
  )
  if (!notes) return null
  const pinned = notes.filter((n) => n.pinned)

  const create = async () => {
    const note = stamp({ courseId: course.id, title: '', body: '', pinned: false })
    await db.notes.add(note)
    nav(`/not/${note.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<Plus size={18} />} onClick={create}>
          Yeni not
        </Button>
        {pinned.length > 0 && (
          <Button icon={<Printer size={18} />} onClick={() => nav(`/ozet/${course.id}`)}>
            Sınav öncesi özet ({pinned.length})
          </Button>
        )}
      </div>

      {!notes.length ? (
        <Empty title="Henüz not yok" action={<Button variant="primary" onClick={create}>İlk notu yaz</Button>}>
          Formülleri, tanımları ve kendi özetlerini yaz. Sabitlediğin notlar sınav öncesi tek sayfalık özette toplanır.
        </Empty>
      ) : (
        <section>
          <SectionTitle>Notlar</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Link to={`/not/${n.id}`} className="block h-full rounded-xl border border-line bg-surface px-4 py-3 hover:border-pen">
                  <p className="flex items-start gap-2 font-semibold">
                    <span className="min-w-0 flex-1 truncate">{n.title || 'Adsız not'}</span>
                    {n.pinned && (
                      <Badge tone="pen">
                        <Pin size={12} />
                        Özette
                      </Badge>
                    )}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-soft">{excerpt(n.body)}</p>
                  <p className="mt-1 text-xs text-soft">{relativeDay(n.updatedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pinned.length > 0 && (
        <section>
          <SectionTitle>Sabitlenenler</SectionTitle>
          <div className="space-y-3">
            {pinned.slice(0, 2).map((n) => (
              <Panel key={n.id} className="p-4">
                <p className="mb-2 font-semibold">{n.title || 'Adsız not'}</p>
                <Markdown className="text-[15px]">{n.body}</Markdown>
              </Panel>
            ))}
            {pinned.length > 2 && (
              <Link to={`/ozet/${course.id}`} className="text-sm font-semibold text-pen">
                Tüm sabitlenen notları gör
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
