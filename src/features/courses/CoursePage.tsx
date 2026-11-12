import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, Pencil, Share2, Trash2 } from 'lucide-react'
import { db, deleteCourse, patch } from '../../db/db'
import { cx } from '../../lib/format'
import { BackLink } from '../../ui/Layout'
import { useFeedback } from '../../ui/feedback'
import { Dot, Empty, IconButton, PageHeader } from '../../ui/kit'
import { CourseForm } from './CourseForm'
import { OverviewTab } from './OverviewTab'
import { TopicsTab } from './TopicsTab'
import { MaterialsTab } from '../materials/MaterialsTab'
import { QuizzesTab } from '../quizzes/QuizzesTab'
import { DecksTab } from '../flashcards/DecksTab'
import { CodeTab } from '../code/CodeTab'
import { CourseStats } from '../stats/CourseStats'
import { NotesTab } from '../notes/NotesTab'

const TABS = [
  { id: 'genel', label: 'Genel bakış' },
  { id: 'materyaller', label: 'Materyaller' },
  { id: 'notlar', label: 'Notlar' },
  { id: 'testler', label: 'Testler' },
  { id: 'kartlar', label: 'Kartlar' },
  { id: 'kod', label: 'Kod' },
  { id: 'konular', label: 'Konular' },
  { id: 'istatistik', label: 'İstatistik' },
] as const

export default function CoursePage() {
  const { id = '', tab = 'genel' } = useParams()
  const nav = useNavigate()
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState(false)
  const course = useLiveQuery(() => db.courses.get(id).then((c) => c ?? null), [id])

  if (course === undefined) return null
  if (course === null)
    return (
      <Empty title="Bu ders bulunamadı">
        Silinmiş olabilir. <NavLink to="/dersler" className="font-semibold text-pen">Derslere dön</NavLink>
      </Empty>
    )

  const remove = async () => {
    const ok = await confirm({
      title: `“${course.name}” silinsin mi?`,
      body: 'Dersin PDF’leri, testleri, kartları ve tüm çalışma geçmişi kalıcı olarak silinir. Bu işlem geri alınamaz.',
      action: 'Dersi sil',
      danger: true,
    })
    if (!ok) return
    await deleteCourse(db, course.id)
    toast('Ders silindi')
    nav('/dersler')
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/dersler">Dersler</BackLink>}
        title={
          <span className="flex items-center gap-2.5">
            <Dot color={course.color} />
            {course.name}
          </span>
        }
        subtitle={[course.code, course.term].filter(Boolean).join(', ') || undefined}
        actions={
          <>
            <IconButton label="Dersi düzenle" onClick={() => setEditing(true)}>
              <Pencil size={19} />
            </IconButton>
            <IconButton label="Dersi paylaş (yedek dosyası)" onClick={() => nav(`/yedek?ders=${course.id}`)}>
              <Share2 size={19} />
            </IconButton>
            <IconButton
              label={course.archived ? 'Arşivden çıkar' : 'Arşivle'}
              onClick={async () => {
                await patch(db.courses, course.id, { archived: !course.archived })
                toast(course.archived ? 'Ders arşivden çıkarıldı' : 'Ders arşivlendi')
              }}
            >
              {course.archived ? <ArchiveRestore size={19} /> : <Archive size={19} />}
            </IconButton>
            <IconButton label="Dersi sil" onClick={remove}>
              <Trash2 size={19} />
            </IconButton>
          </>
        }
      />

      <nav aria-label="Ders bölümleri" className="no-scrollbar -mx-4 mb-5 overflow-x-auto overflow-y-hidden border-b border-line px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-5">
          {TABS.map((t) => (
            <NavLink
              key={t.id}
              to={`/ders/${course.id}/${t.id}`}
              replace
              className={cx(
                'border-b-2 pt-1 pb-2.5 text-[15px] font-semibold whitespace-nowrap transition-colors',
                tab === t.id ? 'border-pen text-ink' : 'border-transparent text-soft hover:text-ink',
              )}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {tab === 'genel' && <OverviewTab course={course} />}
      {tab === 'materyaller' && <MaterialsTab course={course} />}
      {tab === 'notlar' && <NotesTab course={course} />}
      {tab === 'testler' && <QuizzesTab course={course} />}
      {tab === 'kartlar' && <DecksTab course={course} />}
      {tab === 'kod' && <CodeTab course={course} />}
      {tab === 'konular' && <TopicsTab course={course} />}
      {tab === 'istatistik' && <CourseStats courseId={course.id} />}

      <CourseForm open={editing} onClose={() => setEditing(false)} course={course} />
    </>
  )
}
