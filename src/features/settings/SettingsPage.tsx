import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../../db/db'
import { DEFAULT_PY, PY_VERSIONS, cachedVersions, loadPython, removeCachedVersion } from '../../lib/python'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { useFeedback } from '../../ui/feedback'
import { Badge, Button, Field, Input, PageHeader, Panel, SectionTitle, Segmented, Select } from '../../ui/kit'

export default function SettingsPage() {
  const { toast, confirm } = useFeedback()
  const [theme, setTheme] = useState<Theme>(getTheme)
  const settings = useLiveQuery(async () => ({
    pythonVersion: await getSetting(db, 'pythonVersion', DEFAULT_PY),
    codeTimeoutSec: await getSetting(db, 'codeTimeoutSec', 10),
    dailyGoal: await getSetting(db, 'dailyGoal', 30),
    negativeRatio: await getSetting(db, 'negativeRatio', 0),
  }))

  const [cached, setCached] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)
  const [verified, setVerified] = useState<Record<string, string>>({})
  const refresh = () => void cachedVersions().then(setCached)
  useEffect(refresh, [])

  if (!settings) return null

  const download = async (id: string) => {
    setLoading(id)
    try {
      const full = await loadPython(id)
      setVerified((v) => ({ ...v, [id]: full }))
      toast(`Python ${full} hazır`)
    } catch {
      toast(`Python ${id} indirilemedi. İnternet bağlantını kontrol et.`, 'bad')
    } finally {
      setLoading(null)
      refresh()
    }
  }

  const wipe = async () => {
    const ok = await confirm({
      title: 'Tüm veri silinsin mi?',
      body: 'Bu cihazdaki dersler, PDF’ler, testler, kartlar ve tüm geçmiş kalıcı olarak silinir. Yedeğin yoksa geri getirilemez.',
      action: 'Her şeyi sil',
      danger: true,
    })
    if (!ok) return
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) await t.clear()
    })
    toast('Tüm veri silindi')
  }

  return (
    <>
      <PageHeader title="Ayarlar" />
      <div className="space-y-8">
        <section>
          <SectionTitle>Görünüm</SectionTitle>
          <Panel className="p-4">
            <Segmented
              label="Tema"
              value={theme}
              onChange={(t) => {
                setTheme(t)
                applyTheme(t)
              }}
              options={[
                { value: 'sistem', label: 'Cihaza uy' },
                { value: 'acik', label: 'Açık' },
                { value: 'koyu', label: 'Koyu' },
              ]}
            />
          </Panel>
        </section>

        <section>
          <SectionTitle>Çalışma</SectionTitle>
          <Panel className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Günlük hedef" hint="Bir günde çözülecek soru ve tekrar edilecek kart toplamı.">
              <Input
                type="number"
                min={1}
                max={500}
                defaultValue={settings.dailyGoal}
                onBlur={(e) => setSetting(db, 'dailyGoal', Math.max(1, Math.min(500, Number(e.target.value) || 30)))}
              />
            </Field>
            <Field label="Net hesabı" hint="Sonuç ekranında doğru ve yanlıştan net hesaplanır.">
              <Select value={String(settings.negativeRatio)} onChange={(e) => setSetting(db, 'negativeRatio', Number(e.target.value))}>
                <option value="0">Kapalı (yanlış doğruyu götürmez)</option>
                <option value="4">4 yanlış 1 doğruyu götürür</option>
                <option value="3">3 yanlış 1 doğruyu götürür</option>
              </Select>
            </Field>
          </Panel>
        </section>

        <section>
          <SectionTitle>Python</SectionTitle>
          <Panel className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Varsayılan sürüm" hint="Soru kendi sürümünü belirtmiyorsa bu kullanılır.">
                <Select value={settings.pythonVersion} onChange={(e) => setSetting(db, 'pythonVersion', e.target.value)}>
                  {PY_VERSIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      Python {v.id}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Süre sınırı (saniye)" hint="Bu sürede bitmeyen kod durdurulur.">
                <Input
                  type="number"
                  min={2}
                  max={120}
                  defaultValue={settings.codeTimeoutSec}
                  onBlur={(e) => setSetting(db, 'codeTimeoutSec', Math.max(2, Math.min(120, Number(e.target.value) || 10)))}
                />
              </Field>
            </div>
            <div>
              <p className="mb-1 font-semibold">Sürümler</p>
              <p className="mb-3 text-sm text-soft">
                Her sürüm ilk kullanımda internetten bir kez indirilir (yaklaşık 10 MB), sonra çevrimdışı çalışır. Sınav öncesi kullanacağın sürümü buradan indirebilirsin.
              </p>
              <ul className="space-y-2">
                {PY_VERSIONS.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <span className="flex items-center gap-2 font-semibold">
                      Python {verified[v.id] ?? v.id}
                      {cached.has(v.id) && <Badge tone="ok">İndirildi</Badge>}
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => download(v.id)} disabled={loading !== null}>
                        {loading === v.id ? 'Hazırlanıyor…' : cached.has(v.id) ? 'Dene' : 'İndir'}
                      </Button>
                      {cached.has(v.id) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await removeCachedVersion(v.id)
                            refresh()
                          }}
                        >
                          Kaldır
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </section>

        <section>
          <SectionTitle>Veri</SectionTitle>
          <Panel className="space-y-3 p-4">
            <p className="text-soft">Verin yalnızca bu cihazda durur; hiçbir sunucuya gönderilmez. Taşımak ve korumak için “Yedekle ve taşı” sayfasını kullan.</p>
            <Button variant="danger" onClick={wipe}>
              Bu cihazdaki tüm veriyi sil
            </Button>
          </Panel>
        </section>

        <p className="text-sm text-soft">Ders Masası, sürüm {__APP_VERSION__}</p>
      </div>
    </>
  )
}
