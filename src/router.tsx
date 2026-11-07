import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { AppGate } from '@/routes/gate'
import { LoginPage } from '@/routes/login'
import { OnboardingPage } from '@/routes/onboarding'
import { BodyPage, NutritionPage, ProgramPage, ProgressPage } from '@/routes/placeholders'
import { SettingsPage } from '@/routes/settings'
import { TodayPage } from '@/routes/today'

// Ekranet e app-it pas hyrjes (testet i përdorin pa portën).
export const appRoutes: RouteObject[] = [
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
