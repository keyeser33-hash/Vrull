import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Biblioteka (bordi "Biblioteka", V2-E1-09): free-exercise-db me ushtrimet e telefonit, kërkimi, filtrat
// "Muskujt" dhe "Pajisja", "I yti" për ushtrimin e përdoruesit.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`library-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        let alive = true
        const run = () => void query().then((result) => alive && setValue(() => result))
        run()
        const stop = store.subscribe(run)
        return () => {
          alive = false
          stop()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

async function renderLibrary(path = '/programi/biblioteka') {
  const { LibraryPage } = await import('./library')
  const router = createMemoryRouter(
    [
      { path: '/programi/biblioteka', element: <LibraryPage /> },
      { path: '/programi/biblioteka/krijo', element: <h1>Krijo ushtrim</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const rows = () => within(screen.getByRole('region', { name: /A–Z/ })).queryAllByRole('link')

describe('Biblioteka', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' })
    const { createExercise } = await import('@/data/exercises')
    await createExercise(data.store, {
      name: 'Landmine Press',
      equipment: 'barbell',
      tracking: 'weight_reps',
      primaryGroups: ['shpatullat'],
      secondaryGroups: ['gjoksi', 'tricepsi'],
      videoUrl: null,
    })
  })
  afterEach(() => act(() => language.set('sq')))

  it('lista A–Z me 60 ushtrimet e para dhe "Shfaq edhe"', async () => {
    const user = userEvent.setup()
    await renderLibrary()
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteka' })).toBeInTheDocument()
    expect(await screen.findByText(/^\d+ ushtrime nga free-exercise-db, plus të tuat$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Krijo ushtrimin tënd' })).toHaveAttribute('href', '/programi/biblioteka/krijo')
    expect(screen.getByRole('heading', { name: 'Të gjitha · A–Z' })).toBeInTheDocument()
    expect(rows()).toHaveLength(60)
    await user.click(screen.getByRole('button', { name: 'Shfaq edhe 60' }))
    expect(rows()).toHaveLength(120)
  })

  it('filtrat: muskujt dhe pajisja, me titullin e listës dhe "Hiq filtrat"', async () => {
    const user = userEvent.setup()
    await renderLibrary()
    await screen.findByText(/ushtrime nga free-exercise-db/)
    const muscles = screen.getByRole('group', { name: 'Grupi i muskujve' })
    await user.click(within(muscles).getByRole('button', { name: 'Shpatullat' }))
    await user.click(within(screen.getByRole('group', { name: 'Pajisja' })).getByRole('button', { name: 'Dumbbell' }))
    expect(within(muscles).getByRole('button', { name: 'Shpatullat' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Shpatullat · Dumbbell · A–Z' })).toBeInTheDocument()
    // Foto e një ushtrimi jashtë programit merret kur rreshti duket; ushtrimi i Shortcut to Size e ka në app.
    expect(screen.getByRole('link', { name: /^Arnold Dumbbell Press/ })).toHaveTextContent(/^Arnold Dumbbell PressShpatullat · tricepsi$/)
    expect(screen.getByRole('link', { name: /^Arnold Dumbbell Press/ })).toHaveAttribute('href', '/ushtrimi/Arnold_Dumbbell_Press')
    // Ushtrimi i Shortcut to Size del me emrin e PDF-së dhe hap faqen me ID-në në telefon.
    const press = screen.getByRole('link', { name: /^Dumbbell Shoulder Press/ })
    expect(press).toHaveTextContent(/^Dumbbell Shoulder PressShpatullat · trapezi, tricepsi$/)
    expect(press.getAttribute('href')).toMatch(/^\/ushtrimi\/[0-9a-f-]{36}$/)

    await user.click(screen.getByRole('button', { name: 'Hiq filtrat' }))
    expect(screen.getByRole('heading', { name: 'Të gjitha · A–Z' })).toBeInTheDocument()
  })

  it('kërkimi gjen ushtrimin e përdoruesit me "I yti"; pa rezultat e thotë', async () => {
    const user = userEvent.setup()
    await renderLibrary()
    await user.type(await screen.findByLabelText('Kërko ushtrim'), 'landmine pr')
    // Ushtrimi i përdoruesit vjen nga një lexim i telefonit: lista pas shkrimit mund të mos e ketë ende (CI, 26.11.2026).
    await waitFor(() => expect(rows()[0]).toHaveTextContent('Landmine PressShpatullat · gjoksi, tricepsiI yti'))
    await user.type(screen.getByLabelText('Kërko ushtrim'), 'zzz')
    expect(screen.getByText('Asnjë ushtrim me këtë kërkim dhe këta filtra.')).toBeInTheDocument()
  })

  it('filtrat mbeten në adresë, që kthimi nga ushtrimi t’i gjejë', async () => {
    await renderLibrary('/programi/biblioteka?muskujt=legs&pajisja=barbell&kerko=squat')
    expect(await screen.findByRole('heading', { name: 'Këmbët · Shufër · A–Z' })).toBeInTheDocument()
    const squats = await screen.findAllByRole('link', { name: /^Squat/ })
    expect(squats.some((link) => /^\/ushtrimi\/[0-9a-f-]{36}$/.test(link.getAttribute('href') ?? ''))).toBe(true)
    expect(screen.getByLabelText('Kërko ushtrim')).toHaveValue('squat')
  })

  it('anglisht', async () => {
    act(() => language.set('en'))
    const user = userEvent.setup()
    await renderLibrary()
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument()
    expect(await screen.findByText(/^\d+ exercises from free-exercise-db, plus yours$/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search exercises, e.g. press')).toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Muscle group' })).getByRole('button', { name: 'Legs' }))
    expect(screen.getByRole('heading', { name: 'Legs · A–Z' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })
})
