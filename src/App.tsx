import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes, useParams } from 'react-router-dom'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { FeedbackProvider } from './ui/feedback'
import { Shell } from './ui/Layout'
import { Empty } from './ui/kit'
import { PomodoroProvider } from './features/planner/pomodoro-context'
import Dashboard from './features/dashboard/Dashboard'
import CoursesPage from './features/courses/CoursesPage'
import CoursePage from './features/courses/CoursePage'
import ReviewPage from './features/flashcards/ReviewPage'
import DeckPage from './features/flashcards/DeckPage'
import StudyCards from './features/flashcards/StudyCards'
import SetPage from './features/quizzes/SetPage'
import QuizRunner from './features/quizzes/QuizRunner'
import QuizResult from './features/quizzes/QuizResult'
import ImportPage from './features/content-import/ImportPage'
import TemplatePage from './features/content-import/TemplatePage'
import BackupPage from './features/backup/BackupPage'
import ExamsPage from './features/planner/ExamsPage'
import PomodoroPage from './features/planner/PomodoroPage'
import StatsPage from './features/stats/StatsPage'
import SearchPage from './features/search/SearchPage'
import SettingsPage from './features/settings/SettingsPage'
import MorePage from './features/settings/MorePage'
import NotePage from './features/notes/NotePage'
import SummaryPage from './features/notes/SummaryPage'
import GradesPage from './features/grades/GradesPage'

// Ağır sayfalar (PDF motoru, kod editörü) ilk kullanımda yüklenir.
const PdfViewerPage = lazy(() => import('./features/materials/PdfViewerPage'))
const PlaygroundPage = lazy(() => import('./features/code/PlaygroundPage'))

// Başka bir denemeye geçince sayaç ve soru sırası sıfırdan kurulsun.
function QuizRoute() {
  const { id } = useParams()
  return <QuizRunner key={id} />
}

const Loading = () => <p className="p-6 text-center text-soft">Yükleniyor…</p>

export default function App() {
  return (
    <ErrorBoundary>
    <HashRouter>
      <FeedbackProvider>
        <PomodoroProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<Dashboard />} />
                <Route path="dersler" element={<CoursesPage />} />
                <Route path="ders/:id/:tab?" element={<CoursePage />} />
                <Route path="set/:id" element={<SetPage />} />
                <Route path="sonuc/:id" element={<QuizResult />} />
                <Route path="deste/:id" element={<DeckPage />} />
                <Route path="tekrar" element={<ReviewPage />} />
                <Route path="kod/:id?" element={<PlaygroundPage />} />
                <Route path="ice-aktar" element={<ImportPage />} />
                <Route path="sablon" element={<TemplatePage />} />
                <Route path="yedek" element={<BackupPage />} />
                <Route path="takvim" element={<ExamsPage />} />
                <Route path="pomodoro" element={<PomodoroPage />} />
                <Route path="istatistik" element={<StatsPage />} />
                <Route path="ara" element={<SearchPage />} />
                <Route path="ayarlar" element={<SettingsPage />} />
                <Route path="daha" element={<MorePage />} />
                <Route path="not/:id" element={<NotePage />} />
                <Route path="ozet/:courseId" element={<SummaryPage />} />
                <Route path="not-hesabi" element={<GradesPage />} />
                <Route path="*" element={<Empty title="Sayfa bulunamadı">Aradığın sayfa yok ya da taşınmış.</Empty>} />
              </Route>
              {/* Tam ekran çalışma sayfaları */}
              <Route path="test/:id" element={<QuizRoute />} />
              <Route path="kart-calis" element={<StudyCards />} />
              <Route path="dosya/:id" element={<PdfViewerPage />} />
            </Routes>
          </Suspense>
        </PomodoroProvider>
      </FeedbackProvider>
    </HashRouter>
    </ErrorBoundary>
  )
}
