import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import type { ShellHandle, TabId } from '@/components/layout/nav-places'
import { AppGate } from '@/routes/gate'
import { Moved } from '@/routes/moved'

/** Tab-i aktiv i një rruge te korniza; `null` pa tab-bar (cilësimet, editorët, shtimi). */
const tab = (id: TabId | null): { handle: ShellHandle } => ({ handle: { tab: id } })

/**
 * Ekrani ngarkohet kur hapet rruga (V2-E1-16a): paketa e nisjes mban kornizën, portën dhe të dhënat.
 * Skedarët janë në APK, ndaj asnjë ekran nuk pret rrjetin. Gjatë ngarkimit React Router mban ekranin e
 * mëparshëm, pa gjendje ngarkimi në mes. Në hapjen e parë korniza (kreu, tab-bar-i) vizatohet menjëherë
 * dhe vendi i ekranit mbetet bosh disa milisekonda (`hydrateFallbackElement`), pa skelet që kërcen.
 */
function screen<Module>(load: () => Promise<Module>, pick: (module: Module) => ComponentType) {
  return { lazy: async () => ({ Component: pick(await load()) }), hydrateFallbackElement: <></> }
}

const today = () => import('@/routes/today')
const program = () => import('@/routes/program')
const library = () => import('@/routes/library')
const exercise = () => import('@/routes/exercise')
const editor = () => import('@/routes/program-editor')
const history = () => import('@/routes/history')
const progress = () => import('@/routes/progress')

// Ekranet e app-it pas hyrjes (testet i përdorin pa portën). Pesë tab-et: Sot, Programi, Ushqimi,
// Progresi, Miqtë; Trupi jeton brenda Progresit që nga v2 (V2-E1-05).
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, ...screen(today, (m) => m.TodayPage), ...tab('today') },
      { path: 'programi', ...screen(program, (m) => m.ProgramPage), ...tab('programme') },
      { path: 'programi/biblioteka', ...screen(library, (m) => m.LibraryPage), ...tab('programme') },
      { path: 'programi/biblioteka/krijo', ...screen(() => import('@/routes/exercise-create'), (m) => m.CreateExercisePage), ...tab(null) },
      { path: 'programi/peshat', ...screen(() => import('@/routes/week-weights'), (m) => m.WeekWeightsPage), ...tab(null) },
      { path: 'programi/:blockId/:week/:dayId', ...screen(program, (m) => m.WorkoutPage), ...tab('programme') },
      { path: 'ushtrimi/:exerciseId', ...screen(exercise, (m) => m.ExercisePage), ...tab('programme') },
      { path: 'programet', ...screen(editor, (m) => m.ProgramsPage), ...tab('programme') },
      { path: 'programet/importo', ...screen(() => import('@/routes/program-import'), (m) => m.ProgramImportPage), ...tab(null) },
      { path: 'programi/editori/:programId', ...screen(editor, (m) => m.ProgramEditorPage), ...tab(null) },
      { path: 'programi/editori/:programId/dita/:dayId', ...screen(editor, (m) => m.DayEditorPage), ...tab(null) },
      { path: 'programi/editori/:programId/sloti/:slotId', ...screen(() => import('@/routes/slot-editor'), (m) => m.SlotEditorPage), ...tab(null) },
      { path: 'ushqimi', ...screen(() => import('@/routes/nutrition'), (m) => m.NutritionPage), ...tab('food') },
      { path: 'ushqimi/shto/:meal', ...screen(() => import('@/routes/add-food'), (m) => m.AddFoodPage), ...tab(null) },
      { path: 'ushqimi/objektivat', ...screen(() => import('@/routes/nutrition-targets'), (m) => m.TargetsPage), ...tab(null) },
      { path: 'progresi', ...screen(progress, (m) => m.ProgressPage), ...tab('progress') },
      { path: 'progresi/matja', ...screen(() => import('@/routes/body-measure'), (m) => m.MeasurePage), ...tab(null) },
      { path: 'progresi/fotot', ...screen(() => import('@/routes/photos'), (m) => m.PhotosPage), ...tab('progress') },
      { path: 'progresi/trupi', ...screen(() => import('@/routes/body'), (m) => m.BodyPage), ...tab('progress') },
      { path: 'progresi/trupi/shtresat', ...screen(() => import('@/routes/body-layers'), (m) => m.BodyLayersPage), ...tab('progress') },
      { path: 'progresi/trupi/matjet', ...screen(() => import('@/routes/body-shape'), (m) => m.BodyShapePage), ...tab('progress') },
      { path: 'progresi/historiku', ...screen(history, (m) => m.HistoryPage), ...tab('progress') },
      { path: 'progresi/historiku/:sessionId', ...screen(history, (m) => m.PastSessionPage), ...tab('progress') },
      { path: 'progresi/:metric', ...screen(progress, (m) => m.MetricPage), ...tab('progress') },
      { path: 'trupi', element: <Moved to="/progresi/trupi" />, ...tab('progress') },
      { path: 'miqte', ...screen(() => import('@/routes/friends'), (m) => m.FriendsPage), ...tab('friends') },
      { path: 'cilesimet', ...screen(() => import('@/routes/settings'), (m) => m.SettingsPage), ...tab(null) },
      { path: 'cilesimet/pamja', ...screen(() => import('@/routes/settings-appearance'), (m) => m.AppearancePage), ...tab(null) },
      { path: 'cilesimet/rikujtuesit', ...screen(() => import('@/routes/settings-reminders'), (m) => m.RemindersPage), ...tab(null) },
      { path: 'cilesimet/ai', ...screen(() => import('@/routes/settings-ai'), (m) => m.AiSettingsPage), ...tab(null) },
    ],
  },
  // Seanca e stërvitjes dhe mbyllja e saj zënë gjithë ekranin, pa navigimin poshtë.
  { path: '/seanca', ...screen(() => import('@/routes/session'), (m) => m.SessionPage) },
  { path: '/seanca/mbyllja/:sessionId', ...screen(() => import('@/routes/session-summary'), (m) => m.SessionSummaryPage) },
]

// E gjithë app-i: porta vendos nëse shfaqet hyrja, hapat e para apo ekranet e mësipërme.
export const routes: RouteObject[] = [
  {
    element: <AppGate />,
    children: [
      { path: '/hyrja', ...screen(() => import('@/routes/login'), (m) => m.LoginPage) },
      {
        path: '/fillimi',
        ...screen(() => import('@/routes/onboarding'), (m) => m.OnboardingPage),
        // "Ndërto timin" (V2-E1-10) dhe "Importo nga PDF" (V2-E1-11): ndërtuesi brenda hapave të parë, para profilit.
        children: [
          { path: 'importo', ...screen(() => import('@/routes/program-import'), (m) => m.ProgramImportPage) },
          { path: 'programi', ...screen(editor, (m) => m.BuildStartPage) },
          { path: 'programi/:programId', ...screen(editor, (m) => m.ProgramEditorPage) },
          { path: 'programi/:programId/dita/:dayId', ...screen(editor, (m) => m.DayEditorPage) },
          { path: 'programi/:programId/sloti/:slotId', ...screen(() => import('@/routes/slot-editor'), (m) => m.SlotEditorPage) },
        ],
      },
      ...appRoutes,
    ],
  },
  // Faqja e brendshme e sistemit Vrull: pa lidhje nga app-i, jashtë portës (pa të dhëna).
  { path: '/dev/ds', ...screen(() => import('@/routes/dev-ds'), (m) => m.DesignSystemPage) },
]
