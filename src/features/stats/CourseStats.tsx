import { StatsView } from './StatsView'

export function CourseStats({ courseId }: { courseId: string }) {
  return <StatsView courseId={courseId} />
}
