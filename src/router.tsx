import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import type { ShellHandle, TabId } from '@/components/layout/nav-places'
import { AppGate } from '@/routes/gate'
import { LoginPage } from '@/routes/login'
import { OnboardingPage } from '@/routes/onboarding'
import { AddFoodPage } from '@/routes/add-food'
import { NutritionPage } from '@/routes/nutrition'
import { BodyPage } from '@/routes/body'
import { FriendsPage } from '@/routes/friends'
import { HistoryPage, PastSessionPage } from '@/routes/history'
import { Moved } from '@/routes/moved'
import { PhotosPage } from '@/routes/photos'
import { MeasurementPage, MetricPage, ProgressPage } from '@/routes/progress'
import { ExercisePage } from '@/routes/exercise'
import { CreateExercisePage } from '@/routes/exercise-create'
import { LibraryPage } from '@/routes/library'
import { ProgramPage, WorkoutPage } from '@/routes/program'
import { WeekWeightsPage } from '@/routes/week-weights'
import { DayEditorPage, ProgramEditorPage, ProgramsPage } from '@/routes/program-editor'
import { SessionPage } from '@/routes/session'
import { SettingsPage } from '@/routes/settings'
import { AppearancePage } from '@/routes/settings-appearance'
import { RemindersPage } from '@/routes/settings-reminders'
import { SlotEditorPage } from '@/routes/slot-editor'
import { TodayPage } from '@/routes/today'

/** Tab-i aktiv i një rruge te korniza; `null` pa tab-bar (cilësimet, editorët, shtimi). */
const tab = (id: TabId | null): { handle: ShellHandle } => ({ handle: { tab: id } })

// Ekranet e app-it pas hyrjes (testet i përdorin pa portën). Pesë tab-et: Sot, Programi, Ushqimi,
// Progresi, Miqtë; Trupi jeton brenda Progresit që nga v2 (V2-E1-05).
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage />, ...tab('today') },
      { path: 'programi', element: <ProgramPage />, ...tab('programme') },
      { path: 'programi/biblioteka', element: <LibraryPage />, ...tab('programme') },
      { path: 'programi/biblioteka/krijo', element: <CreateExercisePage />, ...tab(null) },
      { path: 'programi/peshat', element: <WeekWeightsPage />, ...tab(null) },
      { path: 'programi/:blockId/:week/:dayId', element: <WorkoutPage />, ...tab('programme') },
      { path: 'ushtrimi/:exerciseId', element: <ExercisePage />, ...tab('programme') },
      { path: 'programet', element: <ProgramsPage />, ...tab('programme') },
      { path: 'programi/editori/:programId', element: <ProgramEditorPage />, ...tab(null) },
      { path: 'programi/editori/:programId/dita/:dayId', element: <DayEditorPage />, ...tab(null) },
      { path: 'programi/editori/:programId/sloti/:slotId', element: <SlotEditorPage />, ...tab(null) },
      { path: 'ushqimi', element: <NutritionPage />, ...tab('food') },
      { path: 'ushqimi/shto/:meal', element: <AddFoodPage />, ...tab(null) },
      { path: 'progresi', element: <ProgressPage />, ...tab('progress') },
      { path: 'progresi/matja', element: <MeasurementPage />, ...tab(null) },
      { path: 'progresi/fotot', element: <PhotosPage />, ...tab('progress') },
      { path: 'progresi/trupi', element: <BodyPage />, ...tab('progress') },
      { path: 'progresi/historiku', element: <HistoryPage />, ...tab('progress') },
      { path: 'progresi/historiku/:sessionId', element: <PastSessionPage />, ...tab('progress') },
      { path: 'progresi/:metric', element: <MetricPage />, ...tab('progress') },
      { path: 'trupi', element: <Moved to="/progresi/trupi" />, ...tab('progress') },
      { path: 'miqte', element: <FriendsPage />, ...tab('friends') },
      { path: 'cilesimet', element: <SettingsPage />, ...tab(null) },
      { path: 'cilesimet/pamja', element: <AppearancePage />, ...tab(null) },
      { path: 'cilesimet/rikujtuesit', element: <RemindersPage />, ...tab(null) },
    ],
  },
  // Seanca e stërvitjes zë gjithë ekranin, pa navigimin poshtë.
  { path: '/seanca', element: <SessionPage /> },
]

// E gjithë app-i: porta vendos nëse shfaqet hyrja, hapat e para apo ekranet e mësipërme.
export const routes: RouteObject[] = [
  {
    element: <AppGate />,
    children: [
      { path: '/hyrja', element: <LoginPage /> },
      { path: '/fillimi', element: <OnboardingPage /> },
      ...appRoutes,
    ],
  },
  // Faqja e brendshme e sistemit Vrull: pa lidhje nga app-i, jashtë portës (pa të dhëna), e ngarkuar
  // vetëm kur hapet.
  { path: '/dev/ds', lazy: async () => ({ Component: (await import('@/routes/dev-ds')).DesignSystemPage }) },
]
