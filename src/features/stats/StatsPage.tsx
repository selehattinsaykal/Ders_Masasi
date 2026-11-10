import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { PageHeader, Select } from '../../ui/kit'
import { StatsView } from './StatsView'

export default function StatsPage() {
  const courses = useLiveQuery(() => db.courses.toArray(), [], [])
  const [courseId, setCourseId] = useState('')
  return (
    <>
      <PageHeader
        title="İstatistik"
        actions={
          courses.length > 1 && (
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Ders" className="!w-auto">
              <option value="">Tüm dersler</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )
        }
      />
      <StatsView courseId={courseId || undefined} />
    </>
  )
}
