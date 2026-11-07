import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { BodyPage, NutritionPage, ProgramPage, ProgressPage } from '@/routes/placeholders'
import { SettingsPage } from '@/routes/settings'
import { TodayPage } from '@/routes/today'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'programi', element: <ProgramPage /> },
      { path: 'ushqimi', element: <NutritionPage /> },
      { path: 'progresi', element: <ProgressPage /> },
      { path: 'trupi', element: <BodyPage /> },
      { path: 'cilesimet', element: <SettingsPage /> },
    ],
  },
]
