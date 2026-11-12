import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Printer } from 'lucide-react'
import { db } from '../../db/db'
import { BackLink } from '../../ui/Layout'
import { Markdown } from '../../ui/Markdown'
import { Button, Empty, PageHeader } from '../../ui/kit'

/** Sabitlenen notların tek sayfalık özeti; yazdırılabilir (kopya kâğıdı). */
export default function SummaryPage() {
  const { courseId = '' } = useParams()
  const data = useLiveQuery(async () => {
    const course = await db.courses.get(courseId)
    const notes = (await db.notes.where('courseId').equals(courseId).toArray()).filter((n) => n.pinned).sort((a, b) => a.createdAt - b.createdAt)
    return { course, notes }
  }, [courseId])
  if (!data) return null
  if (!data.course) return <Empty title="Ders bulunamadı">Silinmiş olabilir.</Empty>

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={<BackLink to={`/ders/${courseId}/notlar`}>Notlar</BackLink>}
          title={`${data.course.name}: sınav öncesi özet`}
          subtitle="Sabitlediğin notlar tek sayfada."
          actions={
            data.notes.length > 0 && (
              <Button icon={<Printer size={18} />} onClick={() => window.print()}>
                Yazdır ya da PDF kaydet
              </Button>
            )
          }
        />
      </div>
      <h1 className="print-only mb-3 text-xl font-bold">{data.course.name}</h1>
      {!data.notes.length ? (
        <Empty title="Sabitlenmiş not yok">Bir notu açıp iğne simgesine dokununca burada görünür.</Empty>
      ) : (
        <div className="summary-sheet space-y-5">
          {data.notes.map((n) => (
            <section key={n.id} className="break-inside-avoid rounded-xl border border-line bg-surface p-4 print:border-0 print:p-0">
              <h2 className="mb-2 text-lg font-semibold">{n.title || 'Adsız not'}</h2>
              <Markdown className="text-[15px]">{n.body}</Markdown>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
