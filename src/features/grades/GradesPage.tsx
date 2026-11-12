import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { Empty, PageHeader } from '../../ui/kit'
import { GradeCard } from './GradeCard'

export default function GradesPage() {
  const courses = useLiveQuery(() => db.courses.toArray().then((l) => l.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, 'tr'))), [])
  if (!courses) return null
  return (
    <>
      <PageHeader title="Not hesabı" subtitle="Vize notuna göre finalden kaç alman gerektiğini gör." />
      {!courses.length ? (
        <Empty title="Önce bir ders ekle" action={<Link to="/dersler" className="font-semibold text-pen">Derslere git</Link>}>
          Not hesabı her ders için ayrı tutulur.
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {courses.map((c) => (
            <GradeCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </>
  )
}
