import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pin, PinOff, Trash2 } from 'lucide-react'
import { db, patch, removeRows } from '../../db/db'
import { cx } from '../../lib/format'
import { BackLink } from '../../ui/Layout'
import { Markdown } from '../../ui/Markdown'
import { useFeedback } from '../../ui/feedback'
import { Empty, IconButton, Segmented } from '../../ui/kit'

const HELP = 'Başlık: # Başlık · Kalın: **metin** · Liste: - madde · Formül: $x^2$ ya da $$\\int_0^1 x\\,dx$$ · Kod: ```python … ```'

/** Not düzenleyici: yazdıkça kaydeder. Masaüstünde yazı ve önizleme yan yana. */
export default function NotePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { confirm } = useFeedback()
  const note = useLiveQuery(() => db.notes.get(id).then((n) => n ?? null), [id])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [view, setView] = useState<'yaz' | 'onizle'>('yaz')
  const [saved, setSaved] = useState(true)
  const loaded = useRef<string | null>(null)

  useEffect(() => {
    if (!note || loaded.current === note.id) return
    loaded.current = note.id
    setTitle(note.title)
    setBody(note.body)
    setView(note.body ? 'onizle' : 'yaz')
  }, [note])

  // Yazmayı bıraktıktan kısa süre sonra kaydet.
  useEffect(() => {
    if (!note || loaded.current !== note.id || (title === note.title && body === note.body)) return
    setSaved(false)
    const t = setTimeout(async () => {
      await patch(db.notes, note.id, { title, body })
      setSaved(true)
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body])

  if (note === undefined) return null
  if (note === null) return <Empty title="Bu not bulunamadı">Silinmiş olabilir.</Empty>

  const back = `/ders/${note.courseId}/notlar`

  const remove = async () => {
    const ok = await confirm({ title: 'Not silinsin mi?', body: 'Bu not kalıcı olarak silinir.', action: 'Notu sil', danger: true })
    if (!ok) return
    await removeRows(db, 'notes', [note.id])
    nav(back, { replace: true })
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <BackLink to={back}>Notlar</BackLink>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-sm text-soft" aria-live="polite">
            {saved ? 'Kaydedildi' : 'Kaydediliyor…'}
          </span>
          <IconButton
            label={note.pinned ? 'Özetten çıkar' : 'Sınav öncesi özete sabitle'}
            active={note.pinned}
            onClick={() => patch(db.notes, note.id, { pinned: !note.pinned })}
          >
            {note.pinned ? <PinOff size={19} /> : <Pin size={19} />}
          </IconButton>
          <IconButton label="Notu sil" onClick={remove}>
            <Trash2 size={19} />
          </IconButton>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Not başlığı"
        aria-label="Not başlığı"
        className="mb-4 w-full bg-transparent font-display text-[1.7rem] leading-tight font-bold placeholder:text-soft/60 focus:outline-none sm:text-[2rem]"
      />

      <div className="mb-3 lg:hidden">
        <Segmented
          label="Görünüm"
          value={view}
          onChange={setView}
          options={[
            { value: 'yaz', label: 'Yaz' },
            { value: 'onizle', label: 'Önizle' },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cx(view === 'onizle' && 'hidden lg:block')}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'Formülleri, tanımları, kendi özetini yaz.\n\n' + HELP}
            aria-label="Not içeriği"
            spellCheck={false}
            className="min-h-[60dvh] w-full resize-y rounded-xl border border-line bg-surface p-4 font-mono text-[14px] leading-relaxed focus:border-pen focus:ring-2 focus:ring-pen/25 focus:outline-none"
          />
          <p className="mt-1 text-xs text-soft">{HELP}</p>
        </div>
        <div className={cx('min-h-[30dvh] rounded-xl border border-line bg-surface p-4 lg:p-5', view === 'yaz' && 'hidden lg:block')}>
          {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-soft">Önizleme burada görünür.</p>}
        </div>
      </div>
    </>
  )
}
