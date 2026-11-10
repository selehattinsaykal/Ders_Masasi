import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FolderOpen, Share2 } from 'lucide-react'
import { db } from '../../db/db'
import { BackupError, backupFileName, exportBackup, importBackup, readManifest, type BackupReport, type ImportMode, type Manifest } from '../../lib/backup'
import { canShare, downloadBlob, shareBlob } from '../../lib/files'
import { formatBytes, formatDateTime, relativeDay } from '../../lib/format'
import { useFeedback } from '../../ui/feedback'
import { Button, Check, Field, PageHeader, Panel, ProgressBar, SectionTitle, Select } from '../../ui/kit'

type Scope = 'full' | 'light' | 'course'

const COUNT_LABELS: [string, string][] = [
  ['courses', 'ders'],
  ['files', 'PDF'],
  ['questions', 'soru'],
  ['cards', 'kart'],
  ['attempts', 'deneme'],
  ['reviews', 'kart tekrarı'],
]

function summarize(counts: Record<string, number>): string {
  const parts = COUNT_LABELS.filter(([k]) => counts[k]).map(([k, label]) => `${counts[k]} ${label}`)
  return parts.length ? parts.join(', ') : 'içerik yok'
}

export default function BackupPage() {
  const { toast, confirm } = useFeedback()
  const [params] = useSearchParams()
  const presetCourse = params.get('ders') ?? ''

  const courses = useLiveQuery(() => db.courses.toArray(), [], [])
  const local = useLiveQuery(async () => {
    const out: Record<string, number> = {}
    for (const [k] of COUNT_LABELS) out[k] = await db.table(k).count()
    return out
  }, [])

  // Dışa aktarma
  const [scope, setScope] = useState<Scope>(presetCourse ? 'course' : 'full')
  const [courseId, setCourseId] = useState(presetCourse)
  const [withProgress, setWithProgress] = useState(false)
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null)
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null)
  const [lastBackup, setLastBackup] = useState(() => Number(localStorage.getItem('sonYedek') ?? 0))

  // İçe aktarma
  const fileInput = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<{ file: File; manifest: Manifest } | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<BackupReport | null>(null)
  const [importError, setImportError] = useState('')

  // Depolama
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)
  const refreshStorage = async () => {
    const est = await navigator.storage?.estimate?.()
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted })
  }
  useEffect(() => {
    void refreshStorage()
  }, [])

  useEffect(() => {
    if (scope === 'course' && !courseId && courses.length) setCourseId(courses[0].id)
  }, [scope, courseId, courses])

  const doExport = async () => {
    setReady(null)
    setExporting({ done: 0, total: 0 })
    try {
      const course = courses.find((c) => c.id === courseId)
      const blob = await exportBackup(
        db,
        scope === 'course'
          ? { courseId, includeFiles: true, includeProgress: withProgress }
          : { includeFiles: scope === 'full', includeProgress: true },
        (done, total) => setExporting({ done, total }),
      )
      const name = backupFileName(scope === 'course' ? 'course' : 'full', course?.name)
      setReady({ blob, name })
      if (scope === 'full') {
        localStorage.setItem('sonYedek', String(Date.now()))
        setLastBackup(Date.now())
      }
    } catch (e) {
      toast(`Yedek oluşturulamadı: ${(e as Error).message}`, 'bad')
    } finally {
      setExporting(null)
    }
  }

  const pick = async (file: File | undefined) => {
    setReport(null)
    setImportError('')
    setPicked(null)
    if (!file) return
    try {
      const manifest = await readManifest(file)
      setPicked({ file, manifest })
      setMode('merge')
    } catch (e) {
      setImportError(e instanceof BackupError ? e.message : 'Dosya okunamadı.')
    }
  }

  const doImport = async () => {
    if (!picked) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Cihazdaki veri değiştirilsin mi?',
        body: `Bu cihazdaki her şey (${summarize(local ?? {})}) silinir ve yerine yedekteki veri gelir. Bu işlem geri alınamaz.`,
        action: 'Sil ve yedeği yükle',
        danger: true,
      })
      if (!ok) return
    }
    setImporting({ done: 0, total: 0 })
    setImportError('')
    try {
      const r = await importBackup(db, picked.file, mode, (done, total) => setImporting({ done, total }))
      setReport(r)
      setPicked(null)
      toast('Yedek içe aktarıldı')
      void refreshStorage()
    } catch (e) {
      setImportError(e instanceof BackupError ? e.message : `İçe aktarılamadı: ${(e as Error).message}`)
    } finally {
      setImporting(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const shareable = ready ? canShare(ready.blob, ready.name) : false

  return (
    <>
      <PageHeader
        title="Yedekle ve taşı"
        subtitle="Tüm verin bu cihazda durur. Telefon ile bilgisayar arasında tek bir dosyayla taşırsın."
      />

      <div className="space-y-8">
        <section>
          <SectionTitle>Dışa aktar</SectionTitle>
          <Panel className="space-y-4 p-4 sm:p-5">
            <fieldset className="space-y-1">
              <legend className="sr-only">Yedek kapsamı</legend>
              {(
                [
                  ['full', 'Tam yedek', 'Dersler, PDF’ler, testler, kartlar, tüm geçmiş ve ayarlar.'],
                  ['light', 'PDF’siz hafif yedek', 'PDF’ler dışında her şey. Dosya küçük olur; ilerlemeni hızlıca taşımak için.'],
                  ['course', 'Tek ders', 'Bir dersi PDF’leri, soruları ve kartlarıyla dışa aktar; arkadaşınla paylaşabilirsin.'],
                ] as [Scope, string, string][]
              ).map(([value, label, hint]) => (
                <label key={value} className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
                  <input type="radio" name="scope" checked={scope === value} onChange={() => setScope(value)} className="mt-1 size-[18px] accent-(--pen)" />
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-sm text-soft">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {scope === 'course' && (
              <div className="space-y-2 border-t border-line pt-4">
                <Field label="Ders">
                  <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Check checked={withProgress} onChange={setWithProgress}>
                  Kendi ilerlememi de ekle (deneme geçmişi, kart zamanlaması, notlar)
                </Check>
              </div>
            )}

            {exporting ? (
              <div className="space-y-2">
                <p className="text-soft">
                  Yedek hazırlanıyor{exporting.total ? `: ${exporting.done} / ${exporting.total} dosya` : '…'}
                </p>
                <ProgressBar value={exporting.total ? (exporting.done / exporting.total) * 100 : 15} />
              </div>
            ) : (
              <Button variant="primary" onClick={doExport} disabled={scope === 'course' && !courseId}>
                Yedek dosyasını oluştur
              </Button>
            )}

            {ready && (
              <div className="rounded-lg bg-ok-soft p-4">
                <p className="font-semibold break-all">{ready.name}</p>
                <p className="text-sm text-soft">{formatBytes(ready.blob.size)}, hazır.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" icon={<Download size={18} />} onClick={() => downloadBlob(ready.blob, ready.name)}>
                    Cihaza indir
                  </Button>
                  {shareable && (
                    <Button icon={<Share2 size={18} />} onClick={() => shareBlob(ready.blob, ready.name, 'Ders Masası yedeği')}>
                      Paylaş
                    </Button>
                  )}
                </div>
                <p className="mt-3 text-sm text-soft">
                  Dosyayı diğer cihazına gönder (Drive, e-posta, kablo), orada bu sayfadan içe aktar.
                </p>
              </div>
            )}
            <p className="text-sm text-soft">
              {lastBackup ? `Bu cihazdan son tam yedek: ${relativeDay(lastBackup)}.` : 'Bu cihazdan henüz tam yedek alınmadı.'}
            </p>
          </Panel>
        </section>

        <section>
          <SectionTitle>İçe aktar</SectionTitle>
          <Panel className="space-y-4 p-4 sm:p-5">
            <div>
              <Button icon={<FolderOpen size={18} />} onClick={() => fileInput.current?.click()}>
                Yedek dosyası seç
              </Button>
              <input ref={fileInput} type="file" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <p className="mt-2 text-sm text-soft">“.studyapp” uzantılı dosyayı seç.</p>
            </div>

            {importError && <p className="rounded-lg bg-bad-soft px-3 py-2 font-semibold text-bad">{importError}</p>}

            {picked && (
              <div className="space-y-4 border-t border-line pt-4">
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-soft">Yedekte</dt>
                    <dd className="font-semibold">{summarize(picked.manifest.counts)}</dd>
                    <dd className="text-sm text-soft">
                      {formatDateTime(picked.manifest.exportedAt)} tarihli, {formatBytes(picked.file.size)}
                      {picked.manifest.scope === 'course' ? `, tek ders: ${picked.manifest.courseNames.join(', ')}` : ''}
                      {!picked.manifest.includesFiles ? ', PDF içermiyor' : ''}
                      {!picked.manifest.includesProgress ? ', ilerleme içermiyor' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-soft">Bu cihazda</dt>
                    <dd className="font-semibold">{summarize(local ?? {})}</dd>
                  </div>
                </dl>

                <fieldset className="space-y-1">
                  <legend className="sr-only">İçe aktarma biçimi</legend>
                  <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
                    <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1 size-[18px] accent-(--pen)" />
                    <span>
                      <span className="block font-semibold">Birleştir</span>
                      <span className="block text-sm text-soft">
                        Cihazdaki veri kalır, yedektekiler eklenir. Aynı kayıt iki yerde de varsa yeni olan kazanır.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === 'replace'}
                      disabled={picked.manifest.scope === 'course'}
                      onChange={() => setMode('replace')}
                      className="mt-1 size-[18px] accent-(--pen)"
                    />
                    <span className={picked.manifest.scope === 'course' ? 'opacity-50' : ''}>
                      <span className="block font-semibold">Değiştir</span>
                      <span className="block text-sm text-soft">
                        Cihazdaki her şey silinir, yerine yedekteki gelir. {picked.manifest.scope === 'course' && 'Tek ders yedeğinde kullanılamaz.'}
                      </span>
                    </span>
                  </label>
                </fieldset>

                {importing ? (
                  <div className="space-y-2">
                    <p className="text-soft">
                      İçe aktarılıyor{importing.total ? `: ${importing.done} / ${importing.total} dosya` : '…'}
                    </p>
                    <ProgressBar value={importing.total ? (importing.done / importing.total) * 100 : 15} />
                  </div>
                ) : (
                  <Button variant="primary" onClick={doImport}>
                    {mode === 'merge' ? 'Birleştirerek içe aktar' : 'Değiştirerek içe aktar'}
                  </Button>
                )}
              </div>
            )}

            {report && (
              <p className="tabular rounded-lg bg-ok-soft px-3 py-2 font-semibold">
                Tamamlandı: {report.added} kayıt eklendi, {report.updated} güncellendi, {report.skipped} zaten günceldi
                {report.deleted ? `, ${report.deleted} silindi` : ''}.
              </p>
            )}
          </Panel>
        </section>

        <section>
          <SectionTitle>Depolama</SectionTitle>
          <Panel className="space-y-3 p-4 sm:p-5">
            {storage ? (
              <>
                <p>
                  <span className="marker tabular font-semibold">{formatBytes(storage.usage)}</span> kullanılıyor
                  {storage.quota ? `, tarayıcının tanıdığı alan ${formatBytes(storage.quota)}.` : '.'}
                </p>
                {storage.persisted ? (
                  <p className="text-soft">Kalıcı depolama açık: tarayıcı yer açmak için bu veriyi kendiliğinden silmez.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-soft">
                      Kalıcı depolama kapalı. Tarayıcı, cihazda yer azalırsa veriyi silebilir; düzenli yedek al ya da kalıcı depolamayı iste.
                    </p>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const ok = await navigator.storage?.persist?.()
                        toast(ok ? 'Kalıcı depolama açıldı' : 'Tarayıcı şimdilik izin vermedi; uygulamayı ana ekrana ekleyince genelde açılır', ok ? 'ok' : 'bad')
                        void refreshStorage()
                      }}
                    >
                      Kalıcı depolama iste
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-soft">Bu tarayıcı depolama bilgisini paylaşmıyor.</p>
            )}
          </Panel>
        </section>
      </div>
    </>
  )
}
