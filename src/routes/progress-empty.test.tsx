import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Bordi "Gjendje · Bosh": Progresi pas hapave të parë, para setit të parë, me programin aktiv.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`progress-empty-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    photos: { timeline: async () => [] },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

async function renderProgress() {
  const { ProgressPage } = await import('./progress')
  const router = createMemoryRouter(
    [
      { path: '/progresi', element: <ProgressPage /> },
      { path: '/seanca', element: <h1>Seanca</h1> },
    ],
    { initialEntries: ['/progresi'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Progresi bosh', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterEach(() => act(() => language.set('sq')))

  it('katër gjërat që vijnë, pesha e sotme dhe stërvitja e parë si veprimi kryesor; edhe në anglisht', async () => {
    await renderProgress()
    expect(await screen.findByRole('heading', { level: 2, name: 'Grafikët nisin me setin e parë' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('banner')).toHaveTextContent(/· Java 0Progresi/))
    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual([
      '01Forca · e1RMPër çdo ushtrim, që nga seti i parë.',
      '02Volumi javorSetet për çdo grup muskujsh, kundrejt objektivit\u00A010–\u206020.',
      '03Trupi 3DMuskujt që punove dhe rikuperimi i tyre.',
      '04Pesha dhe matjet80,0 kg sot. Perimetrat dhe fotot i shton kur të duash.',
    ])
    expect(screen.getByRole('button', { name: 'Fillo stërvitjen e parë' })).toBeInTheDocument()
    expect(screen.getByText(/^Java 0 · Stërvitja 1 · /)).toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 2, name: 'Charts start with your first set' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start your first workout' })).toBeInTheDocument()
    expect(screen.getByText(/^80\.0\skg today\./)).toBeInTheDocument()
  })

  it('"Fillo stërvitjen e parë" nis seancën', async () => {
    const user = userEvent.setup()
    const router = await renderProgress()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen e parë' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    expect(await data.store.all('workout_sessions')).toEqual([expect.objectContaining({ status: 'in_progress', week: 1 })])
  })
})
