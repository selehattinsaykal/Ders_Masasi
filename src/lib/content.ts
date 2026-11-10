// Dışarıda (ör. Claude'a) hazırlatılan JSON içeriğini okur, doğrular ve veritabanına ekler.
// Biçimin belgesi: docs/json-format.md
import { ensureTopics, stamp, type StudyDB } from '../db/db'
import type { CodeTest, ExamType, Question, QuestionType, SetKind } from '../db/schema'
import { normalizeText } from './grading'
import { newFsrsState } from './scheduler'

export interface ParsedCard {
  front: string
  back: string
  hint?: string
  topic?: string
}

export interface ParsedQuestion {
  type: QuestionType
  prompt: string
  explanation?: string
  topic?: string
  difficulty?: number
  options?: string[]
  answerIndex?: number
  answerBool?: boolean
  answers?: string[]
  tolerance?: number
  solution?: string
  pythonVersion?: string
  starter?: string
  tests?: CodeTest[]
}

export interface ParsedDeck {
  title: string
  description?: string
  cards: ParsedCard[]
}

export interface ParsedSet {
  title: string
  kind: SetKind
  year?: number
  term?: string
  examType?: ExamType
  description?: string
  durationMin?: number
  questions: ParsedQuestion[]
}

export interface ParsedContent {
  course?: string
  decks: ParsedDeck[]
  sets: ParsedSet[]
  /** Atlanan öğelerin açıklamaları. */
  errors: string[]
  /** Dosya hiç okunamadıysa nedeni. */
  fatal?: string
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function str(o: Obj, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

/** Kod alanları: baştaki girintiyi korumak için kırpılmaz. */
function rawStr(o: Obj, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.length) return v
  }
  return undefined
}

function num(o: Obj, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  }
  return undefined
}

const TYPE_ALIASES: Record<string, QuestionType> = {
  mcq: 'mcq',
  coktan_secmeli: 'mcq',
  'çoktan seçmeli': 'mcq',
  test: 'mcq',
  tf: 'tf',
  dy: 'tf',
  truefalse: 'tf',
  'doğru/yanlış': 'tf',
  fill: 'fill',
  bosluk: 'fill',
  'boşluk doldurma': 'fill',
  open: 'open',
  klasik: 'open',
  code: 'code',
  kod: 'code',
}

const EXAM_ALIASES: Record<string, ExamType> = {
  vize: 'vize',
  arasınav: 'vize',
  'ara sınav': 'vize',
  midterm: 'vize',
  final: 'final',
  but: 'but',
  büt: 'but',
  bütünleme: 'but',
  quiz: 'quiz',
  diger: 'diger',
  diğer: 'diger',
}

function parseCard(raw: unknown, where: string, errors: string[]): ParsedCard | null {
  if (!isObj(raw)) {
    errors.push(`${where}: kart bir nesne olmalı ({"front": …, "back": …}).`)
    return null
  }
  const front = str(raw, 'front', 'on', 'ön', 'question', 'soru')
  const back = str(raw, 'back', 'arka', 'answer', 'cevap')
  if (!front) {
    errors.push(`${where}: "front" (ön yüz) eksik.`)
    return null
  }
  if (!back) {
    errors.push(`${where}: "back" (arka yüz) eksik.`)
    return null
  }
  return { front, back, hint: str(raw, 'hint', 'ipucu'), topic: str(raw, 'topic', 'konu') }
}

function parseQuestion(raw: unknown, where: string, errors: string[]): ParsedQuestion | null {
  if (!isObj(raw)) {
    errors.push(`${where}: soru bir nesne olmalı.`)
    return null
  }
  const prompt = str(raw, 'prompt', 'question', 'soru')
  if (!prompt) {
    errors.push(`${where}: "prompt" (soru metni) eksik.`)
    return null
  }
  const typeRaw = str(raw, 'type', 'tip', 'tür')?.toLocaleLowerCase('tr')
  let type = typeRaw ? TYPE_ALIASES[typeRaw] : undefined
  if (!type && !typeRaw) {
    // Tip yazılmamışsa alanlardan çıkar.
    if (Array.isArray(raw.options)) type = 'mcq'
    else if (typeof raw.answer === 'boolean') type = 'tf'
    else if (Array.isArray(raw.answers)) type = 'fill'
    else if (Array.isArray(raw.tests) || raw.starter !== undefined) type = 'code'
    else if (raw.solution !== undefined) type = 'open'
  }
  if (!type) {
    errors.push(`${where}: "type" tanınmadı (${typeRaw ?? 'yok'}). Geçerli: mcq, tf, fill, open, code.`)
    return null
  }

  const q: ParsedQuestion = {
    type,
    prompt,
    explanation: str(raw, 'explanation', 'aciklama', 'açıklama'),
    topic: str(raw, 'topic', 'konu'),
    difficulty: num(raw, 'difficulty', 'zorluk'),
  }

  if (type === 'mcq') {
    const options = Array.isArray(raw.options)
      ? raw.options.map((o) => (typeof o === 'string' ? o : typeof o === 'number' ? String(o) : ''))
      : []
    if (options.length < 2 || options.some((o) => !o.trim())) {
      errors.push(`${where}: "options" en az iki dolu şık içermeli.`)
      return null
    }
    const a = raw.answer
    let idx = -1
    if (typeof a === 'number' && Number.isInteger(a)) idx = a
    else if (typeof a === 'string') {
      const t = a.trim()
      if (/^[A-Ha-h]$/.test(t)) idx = t.toUpperCase().charCodeAt(0) - 65
      else if (/^\d+$/.test(t)) idx = Number(t)
      else idx = options.findIndex((o) => normalizeText(o) === normalizeText(t))
    }
    if (idx < 0 || idx >= options.length) {
      errors.push(`${where}: "answer" şıklarda yok. 0'dan başlayan sıra numarası ya da şık harfi (A, B, C…) yaz.`)
      return null
    }
    q.options = options
    q.answerIndex = idx
  } else if (type === 'tf') {
    const a = raw.answer
    let val: boolean | undefined
    if (typeof a === 'boolean') val = a
    else if (typeof a === 'string') {
      const t = a.trim().toLocaleLowerCase('tr')
      if (['true', 'doğru', 'dogru', 'd', 'evet'].includes(t)) val = true
      if (['false', 'yanlış', 'yanlis', 'y', 'hayır'].includes(t)) val = false
    }
    if (val === undefined) {
      errors.push(`${where}: doğru/yanlış sorusunda "answer" true ya da false olmalı.`)
      return null
    }
    q.answerBool = val
  } else if (type === 'fill') {
    const list = Array.isArray(raw.answers) ? raw.answers : raw.answer !== undefined ? [raw.answer] : []
    const answers = list
      .map((a) => (typeof a === 'string' ? a.trim() : typeof a === 'number' ? String(a) : ''))
      .filter(Boolean)
    if (!answers.length) {
      errors.push(`${where}: boşluk doldurmada "answers" (kabul edilen cevaplar) eksik.`)
      return null
    }
    q.answers = answers
    q.tolerance = num(raw, 'tolerance', 'tolerans')
  } else if (type === 'open') {
    q.solution = str(raw, 'solution', 'cozum', 'çözüm', 'answer', 'cevap')
  } else {
    const lang = str(raw, 'language', 'dil')?.toLowerCase()
    if (lang && lang !== 'python') {
      errors.push(`${where}: kod sorularında yalnızca Python destekleniyor ("${lang}" değil).`)
      return null
    }
    q.solution = rawStr(raw, 'solution', 'cozum', 'çözüm')
    q.starter = rawStr(raw, 'starter', 'baslangic', 'başlangıç')
    q.pythonVersion = str(raw, 'pythonVersion', 'python', 'version', 'surum', 'sürüm')
    if (raw.tests !== undefined) {
      if (!Array.isArray(raw.tests)) {
        errors.push(`${where}: "tests" bir liste olmalı.`)
        return null
      }
      const tests: CodeTest[] = []
      for (const t of raw.tests) {
        if (!isObj(t) || typeof (t.expected ?? t.beklenen) !== 'string') {
          errors.push(`${where}: her testte "expected" (beklenen çıktı) metni olmalı.`)
          return null
        }
        const stdin = t.stdin ?? t.girdi
        tests.push({
          stdin: typeof stdin === 'string' ? stdin : '',
          expected: (t.expected ?? t.beklenen) as string,
        })
      }
      if (tests.length) q.tests = tests
    }
  }
  return q
}

function parseDeck(raw: unknown, where: string, errors: string[], fallbackTitle: string): ParsedDeck | null {
  if (!isObj(raw) || !Array.isArray(raw.cards ?? raw.kartlar)) {
    errors.push(`${where}: destede "cards" listesi eksik.`)
    return null
  }
  const title = str(raw, 'title', 'baslik', 'başlık', 'name') ?? fallbackTitle
  const cards: ParsedCard[] = []
  ;((raw.cards ?? raw.kartlar) as unknown[]).forEach((c, i) => {
    const card = parseCard(c, `${title} › ${i + 1}. kart`, errors)
    if (card) cards.push(card)
  })
  return { title, description: str(raw, 'description', 'aciklama', 'açıklama'), cards }
}

function parseSet(raw: unknown, where: string, errors: string[], fallbackTitle: string): ParsedSet | null {
  if (!isObj(raw) || !Array.isArray(raw.questions ?? raw.sorular)) {
    errors.push(`${where}: testte "questions" listesi eksik.`)
    return null
  }
  const title = str(raw, 'title', 'baslik', 'başlık', 'name') ?? fallbackTitle
  const kindRaw = str(raw, 'kind', 'tur', 'tür')?.toLocaleLowerCase('tr')
  const examRaw = str(raw, 'examType', 'sinav', 'sınav')?.toLocaleLowerCase('tr')
  const examType = examRaw ? EXAM_ALIASES[examRaw] : undefined
  const year = num(raw, 'year', 'yil', 'yıl')
  const kind: SetKind =
    kindRaw === 'cikmis' || kindRaw === 'çıkmış' || kindRaw === 'past'
      ? 'cikmis'
      : kindRaw
        ? 'calisma'
        : year || examType
          ? 'cikmis'
          : 'calisma'
  const questions: ParsedQuestion[] = []
  ;((raw.questions ?? raw.sorular) as unknown[]).forEach((item, i) => {
    const q = parseQuestion(item, `${title} › ${i + 1}. soru`, errors)
    if (q) questions.push(q)
  })
  return {
    title,
    kind,
    year,
    term: str(raw, 'term', 'donem', 'dönem'),
    examType,
    description: str(raw, 'description', 'aciklama', 'açıklama'),
    durationMin: num(raw, 'durationMin', 'sure', 'süre'),
    questions,
  }
}

/** Yapıştırılan metindeki ```json … ``` çitini ve çevresindeki açıklamayı ayıklar. */
function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) return fence[1].trim()
  const t = text.trim()
  const start = Math.min(...['{', '['].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))))
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  return Number.isFinite(start) && end > start ? t.slice(start, end + 1) : t
}

export function parseContent(text: string): ParsedContent {
  const out: ParsedContent = { decks: [], sets: [], errors: [] }
  if (!text.trim()) return { ...out, fatal: 'Dosya boş.' }
  let data: unknown
  try {
    data = JSON.parse(extractJson(text))
  } catch (e) {
    return { ...out, fatal: `Geçerli bir JSON değil: ${(e as Error).message}` }
  }

  // Esnek girişler: yalnızca kart ya da soru listesi de kabul edilir.
  if (Array.isArray(data)) {
    const first = data.find(isObj)
    if (first && ('front' in first || 'back' in first || 'on' in first || 'ön' in first)) data = { decks: [{ cards: data }] }
    else if (first && ('cards' in first || 'kartlar' in first)) data = { decks: data }
    else if (first && ('questions' in first || 'sorular' in first)) data = { questionSets: data }
    else data = { questionSets: [{ questions: data }] }
  }
  if (!isObj(data)) return { ...out, fatal: 'JSON bir nesne ya da liste olmalı.' }

  out.course = str(data, 'course', 'ders')
  const decksRaw = data.decks ?? data.desteler ?? (Array.isArray(data.cards ?? data.kartlar) ? [data] : [])
  const setsRaw =
    data.questionSets ?? data.tests ?? data.testler ?? (Array.isArray(data.questions ?? data.sorular) ? [data] : [])

  if (!Array.isArray(decksRaw) || !Array.isArray(setsRaw))
    return { ...out, fatal: '"decks" ve "questionSets" birer liste olmalı.' }

  decksRaw.forEach((d, i) => {
    const deck = parseDeck(d, `${i + 1}. deste`, out.errors, decksRaw.length > 1 ? `Deste ${i + 1}` : 'İçe aktarılan kartlar')
    if (deck) out.decks.push(deck)
  })
  setsRaw.forEach((s, i) => {
    const set = parseSet(s, `${i + 1}. test`, out.errors, setsRaw.length > 1 ? `Test ${i + 1}` : 'İçe aktarılan sorular')
    if (set) out.sets.push(set)
  })

  if (!decksRaw.length && !setsRaw.length)
    return { ...out, fatal: 'Dosyada ne "decks" (kart desteleri) ne de "questionSets" (testler) var.' }
  return out
}

export function countContent(p: ParsedContent) {
  return {
    decks: p.decks.length,
    cards: p.decks.reduce((n, d) => n + d.cards.length, 0),
    sets: p.sets.length,
    questions: p.sets.reduce((n, s) => n + s.questions.length, 0),
  }
}

export type DuplicateMode = 'skip' | 'update'

export interface ImportReport {
  cardsAdded: number
  cardsUpdated: number
  cardsSkipped: number
  questionsAdded: number
  questionsUpdated: number
  questionsSkipped: number
}

/**
 * Okunan içeriği derse ekler. Aynı başlıklı deste/test varsa onun içine eklenir;
 * aynı kart (ön yüz) ya da soru (metin) yeniden gelirse `duplicates` kuralı uygulanır.
 * Güncellemede çalışma geçmişi (kart zamanlaması, soru geçmişi) korunur.
 */
export async function importContent(
  d: StudyDB,
  parsed: ParsedContent,
  courseId: string,
  duplicates: DuplicateMode = 'skip',
): Promise<ImportReport> {
  const report: ImportReport = {
    cardsAdded: 0,
    cardsUpdated: 0,
    cardsSkipped: 0,
    questionsAdded: 0,
    questionsUpdated: 0,
    questionsSkipped: 0,
  }
  const now = Date.now()

  await d.transaction('rw', [d.decks, d.cards, d.questionSets, d.questions, d.topics], async () => {
    const decks = await d.decks.where('courseId').equals(courseId).toArray()
    for (const pd of parsed.decks) {
      if (!pd.cards.length) continue
      let deck = decks.find((x) => normalizeText(x.title) === normalizeText(pd.title))
      if (!deck) {
        deck = stamp({ courseId, title: pd.title, description: pd.description })
        await d.decks.add(deck)
        decks.push(deck)
      }
      const existing = await d.cards.where('deckId').equals(deck.id).toArray()
      const byFront = new Map(existing.map((c) => [normalizeText(c.front), c]))
      for (const pc of pd.cards) {
        const key = normalizeText(pc.front)
        const old = byFront.get(key)
        if (old) {
          if (duplicates === 'update') {
            await d.cards.update(old.id, { back: pc.back, hint: pc.hint, topic: pc.topic, updatedAt: Date.now() })
            report.cardsUpdated++
          } else report.cardsSkipped++
          continue
        }
        const card = stamp({
          deckId: deck.id,
          courseId,
          front: pc.front,
          back: pc.back,
          hint: pc.hint,
          topic: pc.topic,
          starred: false,
          due: now,
          fsrs: newFsrsState(now),
        })
        await d.cards.add(card)
        byFront.set(key, card)
        report.cardsAdded++
      }
      await ensureTopics(d, courseId, pd.cards.map((c) => c.topic))
    }

    const sets = await d.questionSets.where('courseId').equals(courseId).toArray()
    for (const ps of parsed.sets) {
      if (!ps.questions.length) continue
      let set = sets.find((x) => normalizeText(x.title) === normalizeText(ps.title))
      if (!set) {
        set = stamp({
          courseId,
          title: ps.title,
          kind: ps.kind,
          year: ps.year,
          term: ps.term,
          examType: ps.examType,
          description: ps.description,
          durationMin: ps.durationMin,
        })
        await d.questionSets.add(set)
        sets.push(set)
      }
      const existing = await d.questions.where('setId').equals(set.id).toArray()
      const byPrompt = new Map(existing.map((q) => [normalizeText(q.prompt), q]))
      let order = existing.reduce((m, q) => Math.max(m, q.order + 1), 0)
      for (const pq of ps.questions) {
        const key = normalizeText(pq.prompt)
        const old = byPrompt.get(key)
        if (old) {
          if (duplicates === 'update') {
            await d.questions.update(old.id, { ...pq, updatedAt: Date.now() } as Partial<Question>)
            report.questionsUpdated++
          } else report.questionsSkipped++
          continue
        }
        const q: Question = stamp({ ...pq, setId: set.id, courseId, order: order++, starred: false })
        await d.questions.add(q)
        byPrompt.set(key, q)
        report.questionsAdded++
      }
      await ensureTopics(d, courseId, ps.questions.map((q) => q.topic))
    }
  })
  return report
}
