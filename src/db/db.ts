import Dexie, { type Table } from 'dexie'
import type {
  Answer,
  Attempt,
  BlobRec,
  Bookmark,
  Card,
  Course,
  Deck,
  Exam,
  Note,
  Question,
  QuestionSet,
  Review,
  Setting,
  Snippet,
  StudyFile,
  StudySession,
  TableName,
  Tombstone,
  Topic,
} from './schema'

export class StudyDB extends Dexie {
  courses!: Table<Course, string>
  topics!: Table<Topic, string>
  files!: Table<StudyFile, string>
  blobs!: Table<BlobRec, string>
  bookmarks!: Table<Bookmark, string>
  questionSets!: Table<QuestionSet, string>
  questions!: Table<Question, string>
  attempts!: Table<Attempt, string>
  answers!: Table<Answer, string>
  decks!: Table<Deck, string>
  cards!: Table<Card, string>
  reviews!: Table<Review, string>
  snippets!: Table<Snippet, string>
  exams!: Table<Exam, string>
  studySessions!: Table<StudySession, string>
  notes!: Table<Note, string>
  settings!: Table<Setting, string>
  tombstones!: Table<Tombstone, string>

  constructor(name = 'ders-masasi') {
    super(name)
    this.version(1).stores({
      courses: 'id',
      topics: 'id, courseId',
      files: 'id, courseId, kind',
      blobs: 'id',
      bookmarks: 'id, fileId, courseId',
      questionSets: 'id, courseId, kind',
      questions: 'id, setId, courseId, type',
      attempts: 'id, courseId, setId, startedAt',
      answers: 'id, attemptId, questionId, courseId',
      decks: 'id, courseId',
      cards: 'id, deckId, courseId, due',
      reviews: 'id, cardId, courseId, at',
      snippets: 'id, courseId',
      exams: 'id, courseId, date',
      studySessions: 'id, courseId, startedAt',
      settings: 'id',
      tombstones: 'id',
    })
    // 2: ders notları
    this.version(2).stores({ notes: 'id, courseId' })
  }
}

export const db = new StudyDB()

export function uid(): string {
  return crypto.randomUUID()
}

/** Yeni kayıt için kimlik ve zaman damgalarını üretir. */
export function stamp<T extends object>(data: T): T & { id: string; createdAt: number; updatedAt: number } {
  const now = Date.now()
  return { id: uid(), createdAt: now, updatedAt: now, ...data }
}

/** Kaydı günceller ve güncelleme zamanını ilerletir. */
export async function patch<T extends { id: string }>(
  table: Table<T, string>,
  id: string,
  changes: Partial<T>,
): Promise<void> {
  await table.update(id, { ...changes, updatedAt: Date.now() } as never)
}

/** Kayıtları siler ve silme izi bırakır. */
export async function removeRows(d: StudyDB, table: TableName, ids: string[]): Promise<void> {
  if (!ids.length) return
  const now = Date.now()
  await d.table(table).bulkDelete(ids)
  await d.tombstones.bulkPut(ids.map((id) => ({ id, table, deletedAt: now })))
}

const ALL = (d: StudyDB) => d.tables

export async function deleteFile(d: StudyDB, fileId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const f = await d.files.get(fileId)
    if (!f) return
    const marks = await d.bookmarks.where('fileId').equals(fileId).primaryKeys()
    await removeRows(d, 'bookmarks', marks)
    await removeRows(d, 'blobs', [f.blobId])
    await removeRows(d, 'files', [fileId])
  })
}

export async function deleteSet(d: StudyDB, setId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const qs = await d.questions.where('setId').equals(setId).primaryKeys()
    const attempts = await d.attempts.where('setId').equals(setId).primaryKeys()
    const answers = await d.answers.where('questionId').anyOf(qs).primaryKeys()
    await removeRows(d, 'answers', answers)
    await removeRows(d, 'attempts', attempts)
    await removeRows(d, 'questions', qs)
    await removeRows(d, 'questionSets', [setId])
  })
}

export async function deleteQuestion(d: StudyDB, questionId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const answers = await d.answers.where('questionId').equals(questionId).primaryKeys()
    await removeRows(d, 'answers', answers)
    await removeRows(d, 'questions', [questionId])
  })
}

export async function deleteAttempt(d: StudyDB, attemptId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const answers = await d.answers.where('attemptId').equals(attemptId).primaryKeys()
    await removeRows(d, 'answers', answers)
    await removeRows(d, 'attempts', [attemptId])
  })
}

export async function deleteCard(d: StudyDB, cardId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const reviews = await d.reviews.where('cardId').equals(cardId).primaryKeys()
    await removeRows(d, 'reviews', reviews)
    await removeRows(d, 'cards', [cardId])
  })
}

export async function deleteDeck(d: StudyDB, deckId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const cards = await d.cards.where('deckId').equals(deckId).primaryKeys()
    const reviews = await d.reviews.where('cardId').anyOf(cards).primaryKeys()
    await removeRows(d, 'reviews', reviews)
    await removeRows(d, 'cards', cards)
    await removeRows(d, 'decks', [deckId])
  })
}

/** Dersi ve ona bağlı her şeyi siler. */
export async function deleteCourse(d: StudyDB, courseId: string): Promise<void> {
  await d.transaction('rw', ALL(d), async () => {
    const files = await d.files.where('courseId').equals(courseId).toArray()
    await removeRows(d, 'blobs', files.map((f) => f.blobId))
    const byCourse: TableName[] = [
      'topics',
      'files',
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
    ]
    for (const t of byCourse) {
      const keys = (await d.table(t).where('courseId').equals(courseId).primaryKeys()) as string[]
      await removeRows(d, t, keys)
    }
    await removeRows(d, 'courses', [courseId])
  })
}

export async function getSetting<T>(d: StudyDB, id: string, fallback: T): Promise<T> {
  const row = await d.settings.get(id)
  return row ? (row.value as T) : fallback
}

export async function setSetting(d: StudyDB, id: string, value: unknown): Promise<void> {
  await d.settings.put({ id, value, updatedAt: Date.now() })
}

/** Ders içindeki konu adlarını (sorular ve kartlardan gelenlerle birlikte) konu listesine ekler. */
export async function ensureTopics(d: StudyDB, courseId: string, names: (string | undefined)[]): Promise<void> {
  const wanted = [...new Set(names.map((n) => n?.trim()).filter((n): n is string => !!n))]
  if (!wanted.length) return
  const existing = await d.topics.where('courseId').equals(courseId).toArray()
  const have = new Set(existing.map((t) => t.name.toLocaleLowerCase('tr')))
  let order = existing.length
  const fresh = wanted
    .filter((n) => !have.has(n.toLocaleLowerCase('tr')))
    .map((name) => stamp({ courseId, name, status: 'todo' as const, order: order++ }))
  if (fresh.length) await d.topics.bulkAdd(fresh)
}
