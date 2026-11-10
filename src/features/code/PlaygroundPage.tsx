import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FilePlus2, Save, Trash2 } from 'lucide-react'
import { db, getSetting, removeRows, stamp } from '../../db/db'
import { cx, relativeDay } from '../../lib/format'
import { DEFAULT_PY } from '../../lib/python'
import { useFeedback } from '../../ui/feedback'
import { Button, Field, Input, PageHeader, Panel, Select } from '../../ui/kit'
import { CodeWorkbench } from './CodeWorkbench'

const STARTER = 'ad = input("Adın: ")\nprint(f"Merhaba, {ad}!")\n'

/** Serbest kod alanı: yaz, çalıştır, istersen bir derse kaydet. */
export default function PlaygroundPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { toast } = useFeedback()

  const courses = useLiveQuery(() => db.courses.toArray(), [], [])
  const snippets = useLiveQuery(() => db.snippets.orderBy('id').toArray().then((l) => l.sort((a, b) => b.updatedAt - a.updatedAt)), [], [])

  const [title, setTitle] = useState('')
  const [code, setCode] = useState(STARTER)
  const [stdin, setStdin] = useState('Ada\n')
  const [version, setVersion] = useState(DEFAULT_PY)
  const [courseId, setCourseId] = useState(params.get('ders') ?? '')
  const [dirty, setDirty] = useState(false)
  const loaded = useRef<string | null>(null)

  useEffect(() => {
    const key = id ?? 'yeni'
    if (loaded.current === key) return
    loaded.current = key
    void (async () => {
      if (id) {
        const s = await db.snippets.get(id)
        if (s) {
          setTitle(s.title)
          setCode(s.code)
          setStdin(s.stdin)
          setVersion(s.pythonVersion)
          setCourseId(s.courseId ?? '')
          setDirty(false)
          return
        }
      }
      setTitle('')
      setCode(STARTER)
      setStdin('Ada\n')
      setCourseId(params.get('ders') ?? '')
      setVersion(await getSetting(db, 'pythonVersion', DEFAULT_PY))
      setDirty(false)
    })()
  }, [id, params])

  const save = async () => {
    const data = { title: title.trim() || 'Adsız kod', code, stdin, pythonVersion: version, courseId: courseId || undefined }
    if (id && (await db.snippets.get(id))) {
      await db.snippets.update(id, { ...data, updatedAt: Date.now() })
    } else {
      const rec = stamp(data)
      await db.snippets.add(rec)
      loaded.current = rec.id
      nav(`/kod/${rec.id}`, { replace: true })
    }
    setTitle(data.title)
    setDirty(false)
    toast('Kod kaydedildi')
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setDirty(true)
  }

  return (
    <>
      <PageHeader
        title="Kod alanı"
        subtitle="Python yaz ve çalıştır. Sürümü seçebilirsin; her sürüm ilk kullanımda bir kez indirilir."
        actions={
          <>
            {id && (
              <Button icon={<FilePlus2 size={18} />} onClick={() => nav('/kod')}>
                Yeni
              </Button>
            )}
            <Button variant="primary" icon={<Save size={18} />} onClick={save} disabled={!dirty && !!id}>
              Kaydet
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Başlık">
              <Input value={title} onChange={(e) => touch(setTitle)(e.target.value)} placeholder="Adsız kod" />
            </Field>
            <Field label="Ders (isteğe bağlı)">
              <Select value={courseId} onChange={(e) => touch(setCourseId)(e.target.value)}>
                <option value="">Derse bağlı değil</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <CodeWorkbench code={code} onCode={touch(setCode)} version={version} onVersion={touch(setVersion)} stdin={stdin} onStdin={touch(setStdin)} />
        </div>

        <aside>
          <h2 className="mb-2 text-lg font-semibold">Kayıtlı kodlar</h2>
          {!snippets.length ? (
            <Panel className="p-4 text-soft">Kaydettiğin kodlar burada listelenir.</Panel>
          ) : (
            <ul className="space-y-1.5">
              {snippets.map((s) => (
                <li key={s.id} className={cx('flex items-center rounded-lg border bg-surface pr-1', s.id === id ? 'border-pen' : 'border-line')}>
                  <Link to={`/kod/${s.id}`} className="min-w-0 flex-1 px-3 py-2">
                    <span className="block truncate font-semibold">{s.title}</span>
                    <span className="text-sm text-soft">
                      Python {s.pythonVersion}, {relativeDay(s.updatedAt)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`${s.title} kodunu sil`}
                    title="Sil"
                    className="grid size-9 place-items-center rounded-md text-soft hover:text-bad"
                    onClick={async () => {
                      await removeRows(db, 'snippets', [s.id])
                      if (s.id === id) nav('/kod', { replace: true })
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
