// Tüm kayıt tipleri. Her kayıt kalıcı bir kimlik (UUID) ve güncelleme zamanı taşır;
// yedekleri birleştirerek içe aktarma bu iki alan üzerine kuruludur.

export interface Base {
  id: string
  createdAt: number
  updatedAt: number
}

export interface GradePart {
  id: string
  name: string
  /** Yüzde ağırlık, ör. 40. */
  weight: number
  /** Alınan not (0–100); henüz yoksa boş. */
  score?: number
}

export interface GradingScheme {
  parts: GradePart[]
  /** Dersi geçmek için gereken ortalama, ör. 50. */
  passing: number
  /** Son sınavdan (final/büt) alınması gereken en düşük not, varsa. */
  finalMin?: number
}

export interface Course extends Base {
  name: string
  code?: string
  term?: string
  color: string
  archived: boolean
  grading?: GradingScheme
}

export type TopicStatus = 'todo' | 'doing' | 'done'
export interface Topic extends Base {
  courseId: string
  name: string
  status: TopicStatus
  order: number
}

export type FileKind = 'sunum' | 'calisma' | 'cikmis' | 'diger'
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  sunum: 'Ders sunumu',
  calisma: 'Çalışma PDF’i',
  cikmis: 'Çıkmış sınav',
  diger: 'Diğer',
}

/** PDF olarak duran sınavlar için cevap anahtarı (optik form). */
export interface OpticalKey {
  count: number
  optionCount: number
  key: (number | null)[]
}

export interface StudyFile extends Base {
  courseId: string
  kind: FileKind
  title: string
  mime: string
  size: number
  blobId: string
  pageCount?: number
  lastPage?: number
  optical?: OpticalKey
}

/** İkili veri (PDF, görsel). ArrayBuffer olarak saklanır: her tarayıcıda güvenilir. */
export interface BlobRec extends Base {
  mime: string
  data: ArrayBuffer
}

export interface Bookmark extends Base {
  fileId: string
  courseId: string
  page: number
  note: string
}

export type SetKind = 'cikmis' | 'calisma'
export type ExamType = 'vize' | 'final' | 'but' | 'quiz' | 'diger'
export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  vize: 'Vize',
  final: 'Final',
  but: 'Bütünleme',
  quiz: 'Quiz',
  diger: 'Diğer',
}

export interface QuestionSet extends Base {
  courseId: string
  title: string
  kind: SetKind
  year?: number
  term?: string
  examType?: ExamType
  description?: string
  /** Sınav modunda süre (dakika). */
  durationMin?: number
}

export type QuestionType = 'mcq' | 'tf' | 'fill' | 'open' | 'code'
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: 'Çoktan seçmeli',
  tf: 'Doğru / Yanlış',
  fill: 'Boşluk doldurma',
  open: 'Klasik',
  code: 'Kod',
}

export interface CodeTest {
  stdin: string
  expected: string
}

export interface Question extends Base {
  setId: string
  courseId: string
  order: number
  type: QuestionType
  prompt: string
  explanation?: string
  topic?: string
  difficulty?: number
  starred: boolean
  note?: string
  // mcq
  options?: string[]
  answerIndex?: number
  // tf
  answerBool?: boolean
  // fill
  answers?: string[]
  tolerance?: number
  // open + code
  solution?: string
  // code
  pythonVersion?: string
  starter?: string
  tests?: CodeTest[]
}

export type Result = 'correct' | 'wrong' | 'blank' | 'partial'
export type AttemptMode = 'calisma' | 'sinav' | 'yanlis' | 'karisik' | 'optik'
export const MODE_LABEL: Record<AttemptMode, string> = {
  calisma: 'Çalışma modu',
  sinav: 'Sınav modu',
  yanlis: 'Yanlışlarım',
  karisik: 'Karışık test',
  optik: 'Optik form',
}

export interface OpticalSheet {
  count: number
  optionCount: number
  key: (number | null)[]
  responses: (number | null)[]
}

export interface Attempt extends Base {
  courseId: string
  setId?: string
  fileId?: string
  title: string
  mode: AttemptMode
  /** Her sorudan sonra anında geri bildirim verilir mi. */
  instant: boolean
  questionIds: string[]
  /** Şıkların karıştırılmış sırası: soru kimliği -> özgün şık indeksleri. */
  optionOrder?: Record<string, number[]>
  currentIndex: number
  startedAt: number
  finishedAt?: number
  durationSec: number
  /** Sınav modunda süre sınırı (saniye). */
  limitSec?: number
  correct: number
  wrong: number
  blank: number
  partial: number
  optical?: OpticalSheet
}

export interface Answer extends Base {
  attemptId: string
  questionId: string
  courseId: string
  type: QuestionType
  topic?: string
  /** mcq: özgün şık indeksi; tf: boolean; fill/open: metin; code: yazılan kod. */
  response: unknown
  result: Result
  /** Sınav modunda yazılan klasik/kod cevabı: kullanıcı sonradan kendisi değerlendirir. */
  needsReview?: boolean
  /** Kod sorularında geçen / toplam test. */
  passed?: number
  total?: number
}

export interface Deck extends Base {
  courseId: string
  title: string
  description?: string
}

/** ts-fsrs kart durumunun tarihleri sayıya çevrilmiş hali. */
export interface FsrsState {
  due: number
  stability: number
  difficulty: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: number
}

export interface Card extends Base {
  deckId: string
  courseId: string
  front: string
  back: string
  hint?: string
  topic?: string
  starred: boolean
  /** Bir sonraki gösterim zamanı (fsrs.due ile aynı; sorgu için ayrı alan). */
  due: number
  fsrs: FsrsState
}

export interface Review extends Base {
  cardId: string
  courseId: string
  /** 1 Tekrar, 2 Zor, 3 İyi, 4 Kolay. */
  rating: number
  mode: 'fsrs' | 'cram'
  at: number
}

export interface Snippet extends Base {
  courseId?: string
  title: string
  code: string
  stdin: string
  pythonVersion: string
}

export interface Exam extends Base {
  courseId: string
  type: ExamType
  date: number
  topics?: string
  note?: string
}

export type SessionKind = 'pomodoro' | 'test' | 'kart' | 'pdf' | 'kod'
export interface StudySession extends Base {
  courseId?: string
  kind: SessionKind
  startedAt: number
  durationSec: number
}

/** Ders notu: Markdown, formül ve kod destekli. Sabitlenenler sınav öncesi özet olarak öne çıkar. */
export interface Note extends Base {
  courseId: string
  title: string
  body: string
  pinned: boolean
}

export interface Setting {
  id: string
  value: unknown
  updatedAt: number
}

/** Silinen kayıtların izi: birleştirmede silinen şey geri gelmesin diye. */
export interface Tombstone {
  id: string
  table: string
  deletedAt: number
}

export const TABLES = [
  'courses',
  'topics',
  'files',
  'blobs',
  'bookmarks',
  'questionSets',
  'questions',
  'attempts',
  'answers',
  'decks',
  'cards',
  'reviews',
  'snippets',
  'exams',
  'studySessions',
  'notes',
  'settings',
  'tombstones',
] as const
export type TableName = (typeof TABLES)[number]

export const SCHEMA_VERSION = 2

export const COURSE_COLORS = [
  '#2747d4',
  '#0e8f7a',
  '#c2410c',
  '#8a3ffc',
  '#be185d',
  '#0369a1',
  '#4d7c0f',
  '#b45309',
]
