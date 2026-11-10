import { useEffect, useState } from 'react'
import { db, ensureTopics, patch, stamp } from '../../db/db'
import type { Card } from '../../db/schema'
import { newFsrsState } from '../../lib/scheduler'
import { Markdown } from '../../ui/Markdown'
import { Button, Field, Input, Modal, Textarea } from '../../ui/kit'

export function CardEditor({
  open,
  onClose,
  deckId,
  courseId,
  card,
}: {
  open: boolean
  onClose: () => void
  deckId: string
  courseId: string
  card?: Card
}) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [hint, setHint] = useState('')
  const [topic, setTopic] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!open) return
    setFront(card?.front ?? '')
    setBack(card?.back ?? '')
    setHint(card?.hint ?? '')
    setTopic(card?.topic ?? '')
    setPreview(false)
  }, [open, card])

  const valid = !!front.trim() && !!back.trim()

  const save = async (another: boolean) => {
    if (!valid) return
    const data = { front: front.trim(), back: back.trim(), hint: hint.trim() || undefined, topic: topic.trim() || undefined }
    if (card) await patch(db.cards, card.id, data)
    else {
      const now = Date.now()
      await db.cards.add(stamp({ ...data, deckId, courseId, starred: false, due: now, fsrs: newFsrsState(now) }))
    }
    await ensureTopics(db, courseId, [data.topic])
    if (another) {
      setFront('')
      setBack('')
      setHint('')
    } else onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={card ? 'Kartı düzenle' : 'Yeni kart'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          {!card && (
            <Button onClick={() => save(true)} disabled={!valid}>
              Ekle ve yenisini yaz
            </Button>
          )}
          <Button variant="primary" onClick={() => save(false)} disabled={!valid}>
            {card ? 'Kaydet' : 'Kartı ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <button type="button" className="text-sm font-semibold text-pen" onClick={() => setPreview((v) => !v)}>
            {preview ? 'Düzenle' : 'Önizle'}
          </button>
        </div>
        {preview ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-3">
              <p className="mb-1 text-sm font-semibold text-soft">Ön yüz</p>
              <Markdown>{front || '_Boş_'}</Markdown>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="mb-1 text-sm font-semibold text-soft">Arka yüz</p>
              <Markdown>{back || '_Boş_'}</Markdown>
            </div>
          </div>
        ) : (
          <>
            <Field label="Ön yüz (soru, kavram)">
              <Textarea rows={3} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Markdown ve $formül$ yazabilirsin" autoFocus />
            </Field>
            <Field label="Arka yüz (cevap, tanım)">
              <Textarea rows={4} value={back} onChange={(e) => setBack(e.target.value)} />
            </Field>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="İpucu (isteğe bağlı)">
            <Input value={hint} onChange={(e) => setHint(e.target.value)} />
          </Field>
          <Field label="Konu (isteğe bağlı)">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
