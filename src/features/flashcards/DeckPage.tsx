import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { db, deleteCard, deleteDeck, patch } from '../../db/db'
import type { Card } from '../../db/schema'
import { relativeDay } from '../../lib/format'
import { BackLink } from '../../ui/Layout'
import { useFeedback } from '../../ui/feedback'
import { Badge, Button, Check, Empty, Field, IconButton, Input, Modal, PageHeader, Panel, SectionTitle } from '../../ui/kit'
import { CardEditor } from './CardEditor'

export default function DeckPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { confirm, toast } = useFeedback()
  const [editor, setEditor] = useState<{ open: boolean; card?: Card }>({ open: false })
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const [mix, setMix] = useState(true)
  const [reverse, setReverse] = useState(false)
  const [filter, setFilter] = useState('')

  const data = useLiveQuery(async () => {
    const deck = await db.decks.get(id)
    if (!deck) return null
    const cards = await db.cards.where('deckId').equals(id).sortBy('createdAt')
    const reviews = await db.reviews.where('cardId').anyOf(cards.map((c) => c.id)).toArray()
    const last = new Map<string, number>()
    for (const r of reviews.sort((a, b) => a.at - b.at)) last.set(r.cardId, r.rating)
    return { deck, cards, last }
  }, [id])

  if (data === undefined) return null
  if (data === null) return <Empty title="Bu deste bulunamadı">Silinmiş olabilir.</Empty>
  const { deck, cards, last } = data
  const now = Date.now()
  const due = cards.filter((c) => c.due <= now).length
  const weak = cards.filter((c) => (last.get(c.id) ?? 9) <= 2).length
  const starred = cards.filter((c) => c.starred).length

  const study = (mod: string) => nav(`/kart-calis?deste=${deck.id}&mod=${mod}${mix ? '&karisik=1' : ''}${reverse ? '&ters=1' : ''}`)

  const remove = async () => {
    const ok = await confirm({
      title: `“${deck.title}” silinsin mi?`,
      body: `${cards.length} kart ve tekrar geçmişi kalıcı olarak silinir.`,
      action: 'Desteyi sil',
      danger: true,
    })
    if (!ok) return
    await deleteDeck(db, deck.id)
    toast('Deste silindi')
    nav(`/ders/${deck.courseId}/kartlar`, { replace: true })
  }

  const q = filter.trim().toLocaleLowerCase('tr')
  const shown = q ? cards.filter((c) => `${c.front} ${c.back} ${c.topic ?? ''}`.toLocaleLowerCase('tr').includes(q)) : cards

  return (
    <>
      <PageHeader
        back={<BackLink to={`/ders/${deck.courseId}/kartlar`}>Kartlar</BackLink>}
        title={deck.title}
        subtitle={`${cards.length} kart`}
        actions={
          <>
            <IconButton
              label="Desteyi yeniden adlandır"
              onClick={() => {
                setTitle(deck.title)
                setRenaming(true)
              }}
            >
              <Pencil size={19} />
            </IconButton>
            <IconButton label="Desteyi sil" onClick={remove}>
              <Trash2 size={19} />
            </IconButton>
          </>
        }
      />

      <div className="space-y-7">
        {cards.length > 0 && (
          <Panel className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Button variant="primary" className="w-full" icon={<Layers size={18} />} onClick={() => study('tekrar')} disabled={!due}>
                  {due ? `${due} kartı tekrar et` : 'Bugünlük tekrar bitti'}
                </Button>
                <p className="text-sm text-soft">Aralıklı tekrar: her kartı unutmaya yakınken sorar, bildikçe aralığı açar.</p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => study('hepsi')}>
                  Sınav öncesi: hepsini çalış
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => study('bilemedim')} disabled={!weak}>
                    Bilemediklerim ({weak})
                  </Button>
                  <Button size="sm" onClick={() => study('yildiz')} disabled={!starred}>
                    Yıldızlılar ({starred})
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 border-t border-line pt-3">
              <Check checked={mix} onChange={setMix}>
                Kartları karıştır
              </Check>
              <Check checked={reverse} onChange={setReverse}>
                Ters çalış (önce arka yüz)
              </Check>
            </div>
          </Panel>
        )}

        <section>
          <SectionTitle
            action={
              <Button size="sm" icon={<Plus size={16} />} onClick={() => setEditor({ open: true })}>
                Kart ekle
              </Button>
            }
          >
            Kartlar
          </SectionTitle>
          {!cards.length ? (
            <Empty title="Bu destede kart yok" action={<Button variant="primary" onClick={() => setEditor({ open: true })}>İlk kartı yaz</Button>}>
              Kartları elle yazabilir ya da aynı başlıklı bir JSON dosyasını içe aktarabilirsin.
            </Empty>
          ) : (
            <>
              {cards.length > 8 && <Input className="mb-3" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Kartlarda ara" aria-label="Kartlarda ara" />}
              <ul className="space-y-2">
                {shown.map((c) => (
                  <li key={c.id} className="flex items-start gap-1 rounded-xl border border-line bg-surface py-2 pr-1.5 pl-4">
                    <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1 py-1.5 sm:grid-cols-2">
                      <p className="line-clamp-3 font-semibold">{c.front}</p>
                      <p className="line-clamp-3 text-soft">{c.back}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-sm sm:col-span-2">
                        {c.topic && <Badge tone="pen">{c.topic}</Badge>}
                        {c.fsrs.reps === 0 ? <Badge>Yeni</Badge> : c.due <= now ? <Badge tone="warn">Tekrar zamanı</Badge> : <span className="text-soft">Sonraki tekrar: {relativeDay(c.due)}</span>}
                      </p>
                    </div>
                    <IconButton label={c.starred ? 'Yıldızı kaldır' : 'Yıldızla'} active={c.starred} onClick={() => patch(db.cards, c.id, { starred: !c.starred })}>
                      <Star size={18} fill={c.starred ? 'currentColor' : 'none'} />
                    </IconButton>
                    <IconButton label="Kartı düzenle" onClick={() => setEditor({ open: true, card: c })}>
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton label="Kartı sil" onClick={() => deleteCard(db, c.id)}>
                      <Trash2 size={18} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <CardEditor open={editor.open} onClose={() => setEditor({ open: false })} deckId={deck.id} courseId={deck.courseId} card={editor.card} />
      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Desteyi yeniden adlandır"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim()}
              onClick={async () => {
                await patch(db.decks, deck.id, { title: title.trim() })
                setRenaming(false)
              }}
            >
              Kaydet
            </Button>
          </>
        }
      >
        <Field label="Deste adı">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  )
}
