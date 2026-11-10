import { useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { downloadBlob } from '../../lib/files'
import { BackLink } from '../../ui/Layout'
import { useFeedback } from '../../ui/feedback'
import { Button, PageHeader, Panel, SectionTitle, Segmented } from '../../ui/kit'
import { EXAMPLE_JSON, RULES, buildPrompt } from './template'

type Kind = 'kart' | 'soru' | 'cikmis' | 'kod'

/** Kart ve soru JSON'u hazırlatmak için kopyalanabilir istem. */
export default function TemplatePage() {
  const { toast } = useFeedback()
  const [kind, setKind] = useState<Kind>('kart')
  const prompt = buildPrompt(kind)

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} kopyalandı`)
    } catch {
      toast('Kopyalanamadı; metni elle seçip kopyala', 'bad')
    }
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/ice-aktar">JSON içe aktar</BackLink>}
        title="Yapay zekâ için şablon"
        subtitle="İstemi kopyala, ders notunla ya da sınav kâğıdınla birlikte Claude’a ver, çıkan JSON’u içe aktar."
      />

      <div className="space-y-7">
        <section>
          <SectionTitle>Ne hazırlatmak istiyorsun?</SectionTitle>
          <Segmented
            label="İçerik türü"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'kart', label: 'Çalışma kartları' },
              { value: 'soru', label: 'Çalışma soruları' },
              { value: 'cikmis', label: 'Çıkmış sınav' },
              { value: 'kod', label: 'Kod soruları' },
            ]}
          />
          <Panel className="mt-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken px-4 py-2">
              <span className="font-semibold">Hazır istem</span>
              <Button size="sm" variant="primary" icon={<Copy size={15} />} onClick={() => copy(prompt, 'İstem')}>
                İstemi kopyala
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto p-4 text-sm leading-relaxed whitespace-pre-wrap">{prompt}</pre>
          </Panel>
        </section>

        <section>
          <SectionTitle>Nasıl kullanılır</SectionTitle>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>İstemi kopyala ve Claude’a yapıştır; yanına ders PDF’ini ya da sınav kâğıdını ekle.</li>
            <li>Kaç kart ya da soru istediğini, hangi konuları kapsayacağını istemin başına ekleyebilirsin.</li>
            <li>Çıkan JSON’u dosya olarak indir ya da metni kopyala.</li>
            <li>“JSON içe aktar” sayfasında dosyayı seç ya da metni yapıştır; önizlemeyi görüp derse ekle.</li>
          </ol>
        </section>

        <section>
          <SectionTitle>Biçim kuralları</SectionTitle>
          <Panel className="p-4">
            <pre className="text-sm leading-relaxed whitespace-pre-wrap">{RULES}</pre>
          </Panel>
        </section>

        <section>
          <SectionTitle
            action={
              <div className="flex gap-2">
                <Button size="sm" icon={<Copy size={15} />} onClick={() => copy(EXAMPLE_JSON, 'Örnek')}>
                  Kopyala
                </Button>
                <Button size="sm" icon={<Download size={15} />} onClick={() => downloadBlob(new Blob([EXAMPLE_JSON], { type: 'application/json' }), 'ornek-icerik.json')}>
                  İndir
                </Button>
              </div>
            }
          >
            Örnek dosya
          </SectionTitle>
          <Panel className="p-4">
            <pre className="max-h-96 overflow-auto font-mono text-[13px] leading-relaxed">{EXAMPLE_JSON}</pre>
          </Panel>
        </section>
      </div>
    </>
  )
}
