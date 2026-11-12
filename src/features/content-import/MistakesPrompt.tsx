import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy } from 'lucide-react'
import type { Question } from '../../db/schema'
import { formatDate } from '../../lib/format'
import { useFeedback } from '../../ui/feedback'
import { Button, Modal, Segmented } from '../../ui/kit'
import { buildMistakesPrompt, type MistakeItem } from './template'

export function toMistake(q: Question, given: unknown): MistakeItem {
  return {
    type: q.type,
    prompt: q.prompt,
    topic: q.topic,
    options: q.options,
    answerIndex: q.answerIndex,
    answerBool: q.answerBool,
    answers: q.answers,
    solution: q.solution,
    pythonVersion: q.pythonVersion,
    given,
  }
}

/** Yanlışlardan benzer soru üretmek için Claude'a verilecek istemi hazırlar. */
export function MistakesPrompt({
  open,
  onClose,
  course,
  courseId,
  items,
}: {
  open: boolean
  onClose: () => void
  course: string
  courseId: string
  items: MistakeItem[]
}) {
  const nav = useNavigate()
  const { toast } = useFeedback()
  const [count, setCount] = useState<'5' | '10' | '20'>('10')
  const title = `Yanlışlarıma benzer (${formatDate(Date.now(), false)})`
  const prompt = open ? buildMistakesPrompt({ course, items, count: Number(count), title }) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast('İstem kopyalandı')
    } catch {
      toast('Kopyalanamadı; metni elle seçip kopyala', 'bad')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Benzer soru iste"
      footer={
        <>
          <Button variant="ghost" onClick={() => nav(`/ice-aktar?ders=${courseId}`)}>
            JSON içe aktar
          </Button>
          <Button variant="primary" icon={<Copy size={17} />} onClick={copy}>
            İstemi kopyala
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-[15px]">
          <li>İstemi kopyala ve Claude’a yapıştır.</li>
          <li>Claude’un verdiği JSON’u “JSON içe aktar” sayfasında bu derse ekle.</li>
          <li>
            “{title}” testini çöz. Görsel olarak eklenmiş soruları Claude göremez; onların yerine metinde [görsel] yazar.
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">Kaç soru?</span>
          <Segmented
            label="Soru sayısı"
            value={count}
            onChange={setCount}
            options={[
              { value: '5', label: '5' },
              { value: '10', label: '10' },
              { value: '20', label: '20' },
            ]}
          />
          <span className="text-sm text-soft">{items.length > 30 ? `İlk 30 yanlış kullanılır (toplam ${items.length}).` : `${items.length} yanlış kullanılır.`}</span>
        </div>
        <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-sunken p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{prompt}</pre>
      </div>
    </Modal>
  )
}
