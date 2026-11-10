import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { db, ensureTopics, patch, stamp } from '../../db/db'
import { QUESTION_TYPE_LABEL, type CodeTest, type Question, type QuestionType } from '../../db/schema'
import { LETTERS } from '../../lib/format'
import { PY_VERSIONS } from '../../lib/python'
import { Markdown } from '../../ui/Markdown'
import { Button, Field, IconButton, Input, Modal, Segmented, Select, Textarea } from '../../ui/kit'

const TYPES: QuestionType[] = ['mcq', 'tf', 'fill', 'open', 'code']

export function QuestionEditor({
  open,
  onClose,
  setId,
  courseId,
  question,
}: {
  open: boolean
  onClose: () => void
  setId: string
  courseId: string
  question?: Question
}) {
  const [type, setType] = useState<QuestionType>('mcq')
  const [prompt, setPrompt] = useState('')
  const [topic, setTopic] = useState('')
  const [explanation, setExplanation] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [answerIndex, setAnswerIndex] = useState(0)
  const [answerBool, setAnswerBool] = useState(true)
  const [answers, setAnswers] = useState('')
  const [tolerance, setTolerance] = useState('')
  const [solution, setSolution] = useState('')
  const [pythonVersion, setPythonVersion] = useState('')
  const [starter, setStarter] = useState('')
  const [tests, setTests] = useState<CodeTest[]>([])
  const [preview, setPreview] = useState(false)
  const [topics, setTopics] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const q = question
    setType(q?.type ?? 'mcq')
    setPrompt(q?.prompt ?? '')
    setTopic(q?.topic ?? '')
    setExplanation(q?.explanation ?? '')
    setOptions(q?.options ?? ['', '', '', ''])
    setAnswerIndex(q?.answerIndex ?? 0)
    setAnswerBool(q?.answerBool ?? true)
    setAnswers((q?.answers ?? []).join('\n'))
    setTolerance(q?.tolerance != null ? String(q.tolerance) : '')
    setSolution(q?.solution ?? '')
    setPythonVersion(q?.pythonVersion ?? '')
    setStarter(q?.starter ?? '')
    setTests(q?.tests ?? [])
    setPreview(false)
    void db.topics.where('courseId').equals(courseId).toArray().then((t) => setTopics(t.map((x) => x.name)))
  }, [open, question, courseId])

  const cleanOptions = options.map((o) => o.trim())
  const answerList = answers.split('\n').map((a) => a.trim()).filter(Boolean)
  const valid =
    !!prompt.trim() &&
    (type !== 'mcq' || (cleanOptions.filter(Boolean).length >= 2 && cleanOptions.every(Boolean))) &&
    (type !== 'fill' || answerList.length > 0)

  const save = async () => {
    if (!valid) return
    const base = {
      type,
      prompt: prompt.trim(),
      topic: topic.trim() || undefined,
      explanation: explanation.trim() || undefined,
      options: type === 'mcq' ? cleanOptions : undefined,
      answerIndex: type === 'mcq' ? Math.min(answerIndex, cleanOptions.length - 1) : undefined,
      answerBool: type === 'tf' ? answerBool : undefined,
      answers: type === 'fill' ? answerList : undefined,
      tolerance: type === 'fill' && tolerance.trim() ? Number(tolerance.replace(',', '.')) || undefined : undefined,
      solution: type === 'open' || type === 'code' ? solution.trimEnd() || undefined : undefined,
      pythonVersion: type === 'code' ? pythonVersion || undefined : undefined,
      starter: type === 'code' ? starter.trimEnd() || undefined : undefined,
      tests: type === 'code' && tests.length ? tests : undefined,
    }
    if (question) await patch(db.questions, question.id, base)
    else {
      const last = await db.questions.where('setId').equals(setId).toArray()
      const order = last.reduce((m, q) => Math.max(m, q.order + 1), 0)
      await db.questions.add(stamp({ ...base, setId, courseId, order, starred: false }))
    }
    await ensureTopics(db, courseId, [base.topic])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={question ? 'Soruyu düzenle' : 'Yeni soru'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {question ? 'Kaydet' : 'Soruyu ekle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Soru tipi">
          <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold">Soru metni</span>
            <button type="button" className="text-sm font-semibold text-pen" onClick={() => setPreview((v) => !v)}>
              {preview ? 'Düzenle' : 'Önizle'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-24 rounded-lg border border-line p-3">
              <Markdown>{prompt || '_Boş_'}</Markdown>
            </div>
          ) : (
            <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Markdown, $formül$ ve ```kod``` yazabilirsin" aria-label="Soru metni" />
          )}
        </div>

        {type === 'mcq' && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Şıklar (doğru olanı işaretle)</legend>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="dogru" checked={answerIndex === i} onChange={() => setAnswerIndex(i)} className="size-[18px] accent-(--ok)" aria-label={`${LETTERS[i]} doğru cevap`} />
                <span className="w-5 font-display font-bold text-soft">{LETTERS[i]}</span>
                <Input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${LETTERS[i]} şıkkı`} />
                <IconButton
                  label={`${LETTERS[i]} şıkkını sil`}
                  disabled={options.length <= 2}
                  onClick={() => {
                    setOptions(options.filter((_, j) => j !== i))
                    setAnswerIndex((a) => (a > i ? a - 1 : a === i ? 0 : a))
                  }}
                >
                  <Trash2 size={17} />
                </IconButton>
              </div>
            ))}
            {options.length < 8 && (
              <Button size="sm" icon={<Plus size={16} />} onClick={() => setOptions([...options, ''])}>
                Şık ekle
              </Button>
            )}
          </fieldset>
        )}

        {type === 'tf' && (
          <div>
            <span className="mb-1 block text-sm font-semibold">Doğru cevap</span>
            <Segmented
              label="Doğru cevap"
              value={answerBool ? 'd' : 'y'}
              onChange={(v) => setAnswerBool(v === 'd')}
              options={[
                { value: 'd', label: 'Doğru' },
                { value: 'y', label: 'Yanlış' },
              ]}
            />
          </div>
        )}

        {type === 'fill' && (
          <>
            <Field label="Kabul edilen cevaplar" hint="Her satıra bir cevap. Büyük-küçük harf farkı önemsenmez.">
              <Textarea rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} />
            </Field>
            <Field label="Sayısal tolerans (isteğe bağlı)" hint="Ör. 0,01 yazarsan 3,14 için 3,13–3,15 arası doğru sayılır.">
              <Input value={tolerance} onChange={(e) => setTolerance(e.target.value)} inputMode="decimal" />
            </Field>
          </>
        )}

        {type === 'code' && (
          <>
            <Field label="Python sürümü" hint="Boş bırakırsan ayarlardaki varsayılan sürüm kullanılır.">
              <Select value={pythonVersion} onChange={(e) => setPythonVersion(e.target.value)}>
                <option value="">Varsayılan</option>
                {PY_VERSIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    Python {v.id}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Başlangıç kodu (isteğe bağlı)">
              <Textarea rows={4} value={starter} onChange={(e) => setStarter(e.target.value)} className="font-mono text-sm" spellCheck={false} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Otomatik testler</legend>
              <p className="text-sm text-soft">Test eklersen çıktı beklenenle karşılaştırılır; eklemezsen çözüme bakıp kendini değerlendirirsin.</p>
              {tests.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                  <Textarea rows={2} value={t.stdin} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, stdin: e.target.value } : x)))} placeholder="Girdi" aria-label={`${i + 1}. test girdisi`} className="font-mono text-sm" spellCheck={false} />
                  <Textarea rows={2} value={t.expected} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, expected: e.target.value } : x)))} placeholder="Beklenen çıktı" aria-label={`${i + 1}. test beklenen çıktısı`} className="font-mono text-sm" spellCheck={false} />
                  <IconButton label={`${i + 1}. testi sil`} onClick={() => setTests(tests.filter((_, j) => j !== i))}>
                    <Trash2 size={17} />
                  </IconButton>
                </div>
              ))}
              <Button size="sm" icon={<Plus size={16} />} onClick={() => setTests([...tests, { stdin: '', expected: '' }])}>
                Test ekle
              </Button>
            </fieldset>
          </>
        )}

        {(type === 'open' || type === 'code') && (
          <Field label="Örnek çözüm">
            <Textarea rows={4} value={solution} onChange={(e) => setSolution(e.target.value)} className={type === 'code' ? 'font-mono text-sm' : ''} spellCheck={type !== 'code'} />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Konu (isteğe bağlı)">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} list="konu-listesi" />
            <datalist id="konu-listesi">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Açıklama (isteğe bağlı)" hint="Cevaptan sonra gösterilir.">
          <Textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
