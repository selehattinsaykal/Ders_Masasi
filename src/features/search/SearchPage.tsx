import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, FileText, HelpCircle, Layers, ListChecks, NotebookPen, Terminal, type LucideIcon } from 'lucide-react'
import { db } from '../../db/db'
import { Input, PageHeader } from '../../ui/kit'
import { plainText } from '../../lib/format'

interface Hit {
  key: string
  to: string
  title: string
  detail: string
}

interface Group {
  label: string
  icon: LucideIcon
  hits: Hit[]
}

const LIMIT = 12

async function search(query: string): Promise<Group[]> {
  const q = query.trim().toLocaleLowerCase('tr')
  if (q.length < 2) return []
  const has = (...parts: (string | undefined)[]) => parts.some((p) => !!p && plainText(p).toLocaleLowerCase('tr').includes(q))
  const [courses, files, sets, questions, decks, cards, snippets, notes] = await Promise.all([
    db.courses.toArray(),
    db.files.toArray(),
    db.questionSets.toArray(),
    db.questions.toArray(),
    db.decks.toArray(),
    db.cards.toArray(),
    db.snippets.toArray(),
    db.notes.toArray(),
  ])
  const course = new Map(courses.map((c) => [c.id, c.name]))
  const setTitle = new Map(sets.map((s) => [s.id, s.title]))
  const deckTitle = new Map(decks.map((d) => [d.id, d.title]))
  const cut = (raw: string) => {
    const s = plainText(raw)
    return s.length > 140 ? `${s.slice(0, 140)}…` : s
  }

  const groups: Group[] = [
    {
      label: 'Dersler',
      icon: BookOpen,
      hits: courses.filter((c) => has(c.name, c.code)).map((c) => ({ key: c.id, to: `/ders/${c.id}`, title: c.name, detail: [c.code, c.term].filter(Boolean).join(', ') })),
    },
    {
      label: 'Notlar',
      icon: NotebookPen,
      hits: notes.filter((n) => has(n.title, n.body)).map((n) => ({ key: n.id, to: `/not/${n.id}`, title: n.title || 'Adsız not', detail: course.get(n.courseId) ?? '' })),
    },
    {
      label: 'PDF’ler',
      icon: FileText,
      hits: files.filter((f) => has(f.title)).map((f) => ({ key: f.id, to: `/dosya/${f.id}`, title: f.title, detail: course.get(f.courseId) ?? '' })),
    },
    {
      label: 'Testler',
      icon: ListChecks,
      hits: sets.filter((s) => has(s.title)).map((s) => ({ key: s.id, to: `/set/${s.id}`, title: s.title, detail: course.get(s.courseId) ?? '' })),
    },
    {
      label: 'Sorular',
      icon: HelpCircle,
      hits: questions
        .filter((x) => has(x.prompt, x.topic, x.explanation, ...(x.options ?? [])))
        .map((x) => ({ key: x.id, to: `/set/${x.setId}`, title: cut(x.prompt), detail: [course.get(x.courseId), setTitle.get(x.setId)].filter(Boolean).join(', ') })),
    },
    {
      label: 'Kartlar',
      icon: Layers,
      hits: cards
        .filter((c) => has(c.front, c.back, c.topic))
        .map((c) => ({ key: c.id, to: `/deste/${c.deckId}`, title: cut(c.front), detail: `${cut(c.back)} (${[course.get(c.courseId), deckTitle.get(c.deckId)].filter(Boolean).join(', ')})` })),
    },
    {
      label: 'Kodlar',
      icon: Terminal,
      hits: snippets.filter((s) => has(s.title, s.code)).map((s) => ({ key: s.id, to: `/kod/${s.id}`, title: s.title, detail: `Python ${s.pythonVersion}` })),
    },
  ]
  return groups.filter((g) => g.hits.length)
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<Group[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      void search(query).then((g) => !cancelled && setGroups(query.trim().length >= 2 ? g : null))
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  return (
    <>
      <PageHeader title="Ara" />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ders, not, soru, kart, PDF ya da kod ara" aria-label="Arama" autoFocus type="search" />

      <div className="mt-6 space-y-7" aria-live="polite">
        {groups === null && <p className="text-soft">Aramak için en az iki harf yaz. PDF’lerin içindeki metni aramak için PDF’i açıp oradaki aramayı kullan.</p>}
        {groups?.length === 0 && <p className="text-soft">“{query.trim()}” için sonuç yok.</p>}
        {groups?.map((g) => {
          const Icon = g.icon
          return (
            <section key={g.label}>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Icon size={19} className="text-pen" />
                {g.label}
                <span className="tabular text-sm font-normal text-soft">{g.hits.length}</span>
              </h2>
              <ul className="space-y-1.5">
                {g.hits.slice(0, LIMIT).map((h) => (
                  <li key={h.key}>
                    <Link to={h.to} className="block rounded-lg border border-line bg-surface px-4 py-2.5 hover:border-pen">
                      <span className="block font-semibold">{h.title}</span>
                      {h.detail && <span className="block text-sm text-soft">{h.detail}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {g.hits.length > LIMIT && <p className="mt-1.5 text-sm text-soft">{g.hits.length - LIMIT} sonuç daha var; aramayı daralt.</p>}
            </section>
          )
        })}
      </div>
    </>
  )
}
