import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardPaste, FolderOpen, Sparkles } from 'lucide-react'
import { db, stamp } from '../../db/db'
import { COURSE_COLORS } from '../../db/schema'
import { countContent, importContent, parseContent, type DuplicateMode, type ImportReport, type ParsedContent } from '../../lib/content'
import { normalizeText } from '../../lib/grading'
import { cx } from '../../lib/format'
import { Button, Field, Input, PageHeader, Panel, SectionTitle, Segmented, Select, Textarea } from '../../ui/kit'

const NEW = '__yeni__'

export default function ImportPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const courses = useLiveQuery(() => db.courses.toArray(), [])
  const fileInput = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [pasting, setPasting] = useState(false)
  const [parsed, setParsed] = useState<ParsedContent | null>(null)
  const [courseId, setCourseId] = useState(params.get('ders') ?? '')
  const [newName, setNewName] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateMode>('skip')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<{ r: ImportReport; courseId: string } | null>(null)

  const read = (content: string, from: string) => {
    setReport(null)
    setSource(from)
    setParsed(parseContent(content))
  }

  const pickFiles = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    read(await f.text(), f.name)
    if (fileInput.current) fileInput.current.value = ''
  }

  // Dosyadaki ders adı mevcut bir dersle eşleşiyorsa onu seç; yoksa yeni ders öner.
  useEffect(() => {
    if (!parsed || parsed.fatal || !courses) return
    if (params.get('ders') && courses.some((c) => c.id === params.get('ders'))) return setCourseId(params.get('ders')!)
    const match = parsed.course && courses.find((c) => normalizeText(c.name) === normalizeText(parsed.course!))
    if (match) setCourseId(match.id)
    else if (parsed.course || !courses.length) {
      setCourseId(NEW)
      setNewName(parsed.course ?? '')
    } else if (!courseId) setCourseId(courses[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, courses])

  const counts = useMemo(() => (parsed ? countContent(parsed) : null), [parsed])
  const nothing = counts ? counts.cards + counts.questions === 0 : true

  const run = async () => {
    if (!parsed || nothing) return
    setBusy(true)
    try {
      let target = courseId
      if (courseId === NEW) {
        const n = await db.courses.count()
        const course = stamp({ name: newName.trim(), color: COURSE_COLORS[n % COURSE_COLORS.length], archived: false })
        await db.courses.add(course)
        target = course.id
      }
      const r = await importContent(db, parsed, target, duplicates)
      setReport({ r, courseId: target })
      setParsed(null)
      setText('')
      setPasting(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="JSON içe aktar"
        subtitle="Hazırlattığın kart ve soru dosyalarını derslerine ekle."
        actions={
          <Link to="/sablon" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 font-semibold hover:border-pen hover:text-pen">
            <Sparkles size={18} />
            Yapay zekâ için şablon
          </Link>
        }
      />

      <div className="space-y-6">
        {report && (
          <Panel className="space-y-3 border-ok/50 bg-ok-soft p-4">
            <p className="font-display text-lg font-semibold">İçe aktarıldı</p>
            <p className="tabular">
              {report.r.cardsAdded} kart ve {report.r.questionsAdded} soru eklendi
              {report.r.cardsUpdated + report.r.questionsUpdated > 0 && `, ${report.r.cardsUpdated + report.r.questionsUpdated} öğe güncellendi`}
              {report.r.cardsSkipped + report.r.questionsSkipped > 0 && `, zaten var olan ${report.r.cardsSkipped + report.r.questionsSkipped} öğe atlandı`}.
            </p>
            <div className="flex flex-wrap gap-2">
              {report.r.questionsAdded + report.r.questionsUpdated + report.r.questionsSkipped > 0 && (
                <Button variant="primary" onClick={() => nav(`/ders/${report.courseId}/testler`)}>
                  Testlere git
                </Button>
              )}
              {report.r.cardsAdded + report.r.cardsUpdated + report.r.cardsSkipped > 0 && <Button onClick={() => nav(`/ders/${report.courseId}/kartlar`)}>Kartlara git</Button>}
            </div>
          </Panel>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            void pickFiles(e.dataTransfer.files)
          }}
          className={cx('rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors', over ? 'border-pen bg-pen-soft' : 'border-line bg-surface/60')}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" icon={<FolderOpen size={18} />} onClick={() => fileInput.current?.click()}>
              JSON dosyası seç
            </Button>
            <Button icon={<ClipboardPaste size={18} />} onClick={() => setPasting((v) => !v)}>
              Metin olarak yapıştır
            </Button>
          </div>
          <input ref={fileInput} type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => pickFiles(e.target.files)} />
          <p className="mt-2 text-sm text-soft">Dosyayı buraya da sürükleyebilirsin.</p>
        </div>

        {pasting && (
          <div className="space-y-2">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "decks": [ … ], "questionSets": [ … ] }' className="font-mono text-sm" spellCheck={false} aria-label="JSON metni" />
            <Button variant="primary" onClick={() => read(text, 'Yapıştırılan metin')} disabled={!text.trim()}>
              Metni oku
            </Button>
          </div>
        )}

        {parsed?.fatal && (
          <Panel className="border-bad/50 bg-bad-soft p-4">
            <p className="font-semibold text-bad">{source}: okunamadı</p>
            <p className="mt-1">{parsed.fatal}</p>
          </Panel>
        )}

        {parsed && !parsed.fatal && counts && (
          <section>
            <SectionTitle>Önizleme: {source}</SectionTitle>
            <Panel className="space-y-5 p-4 sm:p-5">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ['Deste', counts.decks],
                    ['Kart', counts.cards],
                    ['Test', counts.sets],
                    ['Soru', counts.questions],
                  ] as [string, number][]
                ).map(([label, n]) => (
                  <div key={label} className="rounded-lg bg-sunken px-3 py-2.5">
                    <dd className="font-display text-3xl leading-none font-bold tabular">{n}</dd>
                    <dt className="mt-1 text-sm text-soft">{label}</dt>
                  </div>
                ))}
              </dl>

              <ul className="space-y-1 text-[15px]">
                {parsed.decks.map((d, i) => (
                  <li key={`d${i}`}>
                    <span className="font-semibold">{d.title}</span> <span className="tabular text-soft">deste, {d.cards.length} kart</span>
                  </li>
                ))}
                {parsed.sets.map((s, i) => (
                  <li key={`s${i}`}>
                    <span className="font-semibold">{s.title}</span>{' '}
                    <span className="tabular text-soft">
                      {s.kind === 'cikmis' ? 'çıkmış sorular' : 'çalışma soruları'}, {s.questions.length} soru
                    </span>
                  </li>
                ))}
              </ul>

              {parsed.errors.length > 0 && (
                <div className="rounded-lg border border-warn/40 bg-warn-soft p-3">
                  <p className="font-semibold text-warn">{parsed.errors.length} öğe hatalı, atlanacak</p>
                  <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm">
                    {parsed.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {nothing ? (
                <p className="font-semibold text-bad">İçe aktarılacak geçerli kart ya da soru yok.</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Hangi derse eklensin?">
                      <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                        {(courses ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value={NEW}>Yeni ders oluştur…</option>
                      </Select>
                    </Field>
                    {courseId === NEW && (
                      <Field label="Yeni dersin adı">
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ders adı" />
                      </Field>
                    )}
                  </div>
                  <div>
                    <span className="mb-1.5 block text-sm font-semibold">Aynı kart ya da soru zaten varsa</span>
                    <Segmented
                      label="Yinelenen içerik"
                      value={duplicates}
                      onChange={setDuplicates}
                      options={[
                        { value: 'skip', label: 'Atla' },
                        { value: 'update', label: 'İçeriğini güncelle' },
                      ]}
                    />
                    <p className="mt-1 text-sm text-soft">Aynı başlıklı deste ve testler birleştirilir. Güncellemede çalışma geçmişin korunur.</p>
                  </div>
                  <Button variant="primary" onClick={run} disabled={busy || !courseId || (courseId === NEW && !newName.trim())}>
                    {busy ? 'Ekleniyor…' : `${counts.cards} kart ve ${counts.questions} soruyu içe aktar`}
                  </Button>
                </>
              )}
            </Panel>
          </section>
        )}
      </div>
    </>
  )
}
