import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureTopics, patch, stamp } from '../../db/db'
import type { QuestionType, StudyFile } from '../../db/schema'
import { LETTERS, cx } from '../../lib/format'
import { newFsrsState } from '../../lib/scheduler'
import { useFeedback } from '../../ui/feedback'
import { Button, Field, Input, Modal, Segmented, Select, Textarea } from '../../ui/kit'

type Target = 'soru' | 'kart' | 'not'
type CropType = Exclude<QuestionType, 'code'>
const NEW = '__yeni__'

/** PDF'ten kesilen görseli soru, kart ya da not olarak kaydeder. */
export function CropSaveModal({
  open,
  onClose,
  image,
  page,
  file,
}: {
  open: boolean
  onClose: () => void
  image: string | null
  page: number
  file: StudyFile
}) {
  const { toast } = useFeedback()
  const lists = useLiveQuery(
    async () => ({
      sets: await db.questionSets.where('courseId').equals(file.courseId).toArray(),
      decks: await db.decks.where('courseId').equals(file.courseId).toArray(),
      notes: await db.notes.where('courseId').equals(file.courseId).toArray(),
    }),
    [file.courseId],
  )

  const [target, setTarget] = useState<Target>(() => (localStorage.getItem('kesHedef') as Target) || 'soru')
  const [setId, setSetId] = useState('')
  const [deckId, setDeckId] = useState('')
  const [noteId, setNoteId] = useState('')
  const [newName, setNewName] = useState(file.title)
  const [type, setType] = useState<CropType>('mcq')
  const [optionCount, setOptionCount] = useState(5)
  const [answerIndex, setAnswerIndex] = useState<number | null>(null)
  const [answerBool, setAnswerBool] = useState<boolean | null>(null)
  const [fill, setFill] = useState('')
  const [text, setText] = useState('')
  const [other, setOther] = useState('')
  const [imageSide, setImageSide] = useState<'on' | 'arka'>('on')
  const [topic, setTopic] = useState('')

  // Seçimleri hatırla: art arda kesilen sorular aynı teste gider.
  useEffect(() => {
    if (!lists) return
    // Geçerli seçim duruyorsa koru; yoksa bu PDF için son kullanılanı, o da yoksa "yeni" seç.
    const pick = (current: string, all: { id: string }[], key: string) => {
      const has = (id: string | null) => !!id && all.some((x) => x.id === id)
      if (has(current)) return current
      const last = localStorage.getItem(key)
      return has(last) ? last! : NEW
    }
    setSetId((v) => pick(v, lists.sets, `kesTest:${file.id}`))
    setDeckId((v) => pick(v, lists.decks, `kesDeste:${file.id}`))
    setNoteId((v) => pick(v, lists.notes, `kesNot:${file.id}`))
  }, [lists, file.id])

  useEffect(() => {
    if (!open) return
    setAnswerIndex(null)
    setAnswerBool(null)
    setFill('')
    setText('')
    setOther('')
  }, [open, image])

  if (!lists) return null
  const img = image ? `![${file.title}, ${page}. sayfa](${image})` : ''
  const withText = (t: string) => (t.trim() ? `${t.trim()}\n\n${img}` : img)

  const valid =
    !!image &&
    (target === 'soru'
      ? (setId !== NEW || !!newName.trim()) &&
        (type === 'mcq' ? answerIndex !== null : type === 'tf' ? answerBool !== null : type === 'fill' ? !!fill.trim() : true)
      : target === 'kart'
        ? (deckId !== NEW || !!newName.trim()) && !!other.trim()
        : noteId !== NEW || !!newName.trim())

  const save = async () => {
    if (!valid || !image) return
    localStorage.setItem('kesHedef', target)
    if (target === 'soru') {
      let sid = setId
      if (sid === NEW) {
        const s = stamp({ courseId: file.courseId, title: newName.trim(), kind: file.kind === 'cikmis' ? ('cikmis' as const) : ('calisma' as const) })
        await db.questionSets.add(s)
        sid = s.id
        setSetId(sid)
      }
      localStorage.setItem(`kesTest:${file.id}`, sid)
      const order = (await db.questions.where('setId').equals(sid).toArray()).reduce((m, q) => Math.max(m, q.order + 1), 0)
      await db.questions.add(
        stamp({
          setId: sid,
          courseId: file.courseId,
          order,
          type,
          prompt: withText(text),
          topic: topic.trim() || undefined,
          starred: false,
          options: type === 'mcq' ? LETTERS.slice(0, optionCount) : undefined,
          answerIndex: type === 'mcq' ? answerIndex! : undefined,
          answerBool: type === 'tf' ? answerBool! : undefined,
          answers: type === 'fill' ? fill.split('\n').map((x) => x.trim()).filter(Boolean) : undefined,
          solution: type === 'open' ? other.trim() || undefined : undefined,
        }),
      )
      toast(`Soru eklendi (${order + 1}. soru)`)
    } else if (target === 'kart') {
      let did = deckId
      if (did === NEW) {
        const d = stamp({ courseId: file.courseId, title: newName.trim() })
        await db.decks.add(d)
        did = d.id
        setDeckId(did)
      }
      localStorage.setItem(`kesDeste:${file.id}`, did)
      const now = Date.now()
      await db.cards.add(
        stamp({
          deckId: did,
          courseId: file.courseId,
          front: imageSide === 'on' ? withText(text) : other.trim(),
          back: imageSide === 'on' ? other.trim() : withText(text),
          topic: topic.trim() || undefined,
          starred: false,
          due: now,
          fsrs: newFsrsState(now),
        }),
      )
      toast('Kart eklendi')
    } else {
      let nid = noteId
      const block = `${text.trim() ? `${text.trim()}\n\n` : ''}${img}\n`
      if (nid === NEW) {
        const n = stamp({ courseId: file.courseId, title: newName.trim(), body: block, pinned: false })
        await db.notes.add(n)
        nid = n.id
        setNoteId(nid)
      } else {
        const n = await db.notes.get(nid)
        if (n) await patch(db.notes, nid, { body: `${n.body.trimEnd()}\n\n${block}` })
      }
      localStorage.setItem(`kesNot:${file.id}`, nid)
      toast('Nota eklendi')
    }
    await ensureTopics(db, file.courseId, [topic])
    onClose()
  }

  const container =
    target === 'soru' ? { value: setId, set: setId === NEW, onChange: setSetId, list: lists.sets, label: 'Hangi teste?' }
    : target === 'kart' ? { value: deckId, set: deckId === NEW, onChange: setDeckId, list: lists.decks, label: 'Hangi desteye?' }
    : { value: noteId, set: noteId === NEW, onChange: setNoteId, list: lists.notes.map((n) => ({ ...n, title: n.title || 'Adsız not' })), label: 'Hangi nota?' }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Kesilen bölümü kaydet"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {target === 'soru' ? 'Soruyu ekle' : target === 'kart' ? 'Kartı ekle' : 'Nota ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {image && <img src={image} alt={`${page}. sayfadan kesilen bölüm`} className="max-h-56 w-full rounded-lg border border-line bg-white object-contain" />}

        <Segmented
          label="Nereye eklensin"
          value={target}
          onChange={setTarget}
          options={[
            { value: 'soru', label: 'Soru' },
            { value: 'kart', label: 'Kart' },
            { value: 'not', label: 'Not' },
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={container.label}>
            <Select value={container.value} onChange={(e) => container.onChange(e.target.value)}>
              {container.list.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
              <option value={NEW}>{target === 'soru' ? 'Yeni test…' : target === 'kart' ? 'Yeni deste…' : 'Yeni not…'}</option>
            </Select>
          </Field>
          {container.set && (
            <Field label="Adı">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Field>
          )}
        </div>

        {target === 'soru' && (
          <>
            <Field label="Soru tipi">
              <Select value={type} onChange={(e) => setType(e.target.value as CropType)}>
                <option value="mcq">Çoktan seçmeli (şıklar görselde)</option>
                <option value="tf">Doğru / Yanlış</option>
                <option value="fill">Boşluk doldurma</option>
                <option value="open">Klasik</option>
              </Select>
            </Field>
            {type === 'mcq' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold">Şık sayısı</span>
                  <Segmented
                    label="Şık sayısı"
                    value={String(optionCount)}
                    onChange={(v) => {
                      setOptionCount(Number(v))
                      setAnswerIndex((a) => (a !== null && a >= Number(v) ? null : a))
                    }}
                    options={['2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
                  />
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">Doğru şık</span>
                  <div className="flex gap-2" role="radiogroup" aria-label="Doğru şık">
                    {LETTERS.slice(0, optionCount).map((L, i) => (
                      <button
                        key={L}
                        type="button"
                        role="radio"
                        aria-checked={answerIndex === i}
                        onClick={() => setAnswerIndex(i)}
                        className={cx(
                          'grid size-11 place-items-center rounded-full border-2 font-display font-bold',
                          answerIndex === i ? 'border-ok bg-ok text-surface' : 'border-line text-soft hover:border-pen',
                        )}
                      >
                        {L}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {type === 'tf' && (
              <div>
                <span className="mb-1.5 block text-sm font-semibold">Doğru cevap</span>
                <Segmented
                  label="Doğru cevap"
                  value={answerBool === null ? '' : answerBool ? 'd' : 'y'}
                  onChange={(v) => setAnswerBool(v === 'd')}
                  options={[
                    { value: 'd', label: 'Doğru' },
                    { value: 'y', label: 'Yanlış' },
                  ]}
                />
              </div>
            )}
            {type === 'fill' && (
              <Field label="Kabul edilen cevaplar" hint="Her satıra bir cevap.">
                <Textarea rows={2} value={fill} onChange={(e) => setFill(e.target.value)} />
              </Field>
            )}
            {type === 'open' && (
              <Field label="Çözüm (isteğe bağlı)">
                <Textarea rows={3} value={other} onChange={(e) => setOther(e.target.value)} />
              </Field>
            )}
          </>
        )}

        {target === 'kart' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">Görsel</span>
              <Segmented
                label="Görsel hangi yüzde"
                value={imageSide}
                onChange={setImageSide}
                options={[
                  { value: 'on', label: 'Ön yüzde' },
                  { value: 'arka', label: 'Arka yüzde' },
                ]}
              />
            </div>
            <Field label={imageSide === 'on' ? 'Arka yüz (cevap)' : 'Ön yüz (soru, kavram)'}>
              <Textarea rows={3} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Markdown ve $formül$ yazabilirsin" />
            </Field>
          </>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Görselin üstüne yazı (isteğe bağlı)">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={target === 'not' ? 'Açıklama' : 'Ör. soru kökü'} />
          </Field>
          {target !== 'not' && (
            <Field label="Konu (isteğe bağlı)">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  )
}
