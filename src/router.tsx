import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { AppGate } from '@/routes/gate'
import { LoginPage } from '@/routes/login'
import { OnboardingPage } from '@/routes/onboarding'
import { AddFoodPage } from '@/routes/add-food'
import { NutritionPage } from '@/routes/nutrition'
import { BodyPage, ProgressPage } from '@/routes/placeholders'
import { ExercisePage, ProgramPage, WorkoutPage } from '@/routes/program'
import { DayEditorPage, ProgramEditorPage, ProgramsPage } from '@/routes/program-editor'
import { SessionPage } from '@/routes/session'
import { SettingsPage } from '@/routes/settings'
import { SlotEditorPage } from '@/routes/slot-editor'
import { TodayPage } from '@/routes/today'

// Ekranet e app-it pas hyrjes (testet i përdorin pa portën).
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'programi', element: <ProgramPage /> },
      { path: 'programi/:blockId/:week/:dayId', element: <WorkoutPage /> },
      { path: 'ushtrimi/:exerciseId', element: <ExercisePage /> },
      { path: 'programet', element: <ProgramsPage /> },
      { path: 'programi/editori/:programId', element: <ProgramEditorPage /> },
      { path: 'programi/editori/:programId/dita/:dayId', element: <DayEditorPage /> },
      { path: 'programi/editori/:programId/sloti/:slotId', element: <SlotEditorPage /> },
      { path: 'ushqimi', element: <NutritionPage /> },
      { path: 'ushqimi/shto/:meal', element: <AddFoodPage /> },
      { path: 'progresi', element: <ProgressPage /> },
      { path: 'trupi', element: <BodyPage /> },
      { path: 'cilesimet', element: <SettingsPage /> },
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
]
