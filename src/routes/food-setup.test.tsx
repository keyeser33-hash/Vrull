import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Nisja e Ushqimit (V68, V69) me store të vërtetë, të mërkurën 9 dhjetor në 12:40.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`food-setup-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

function Probe() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

describe('Si ha ti', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T12:40:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderPage() {
    const { FoodSetupPage } = await import('./food-setup')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi/nisja', element: <FoodSetupPage /> },
        { path: '/ushqimi/plani', element: <Probe /> },
      ],
      { initialEntries: ['/ushqimi/nisja'] },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole('button', { name: /^4 (vakte|meals)$/ })
  }

  it('në anglisht', async () => {
    language.set('en')
    await renderPage()
    expect(screen.getByRole('heading', { name: 'How you eat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In the evening, all at once' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Save and open My plan' })).toBeEnabled()
  })

  it('parazgjedh katër vakte dhe mbrëmjen; zgjedhja tregon cilat vakte mbeten dhe çfarë ndryshon', async () => {
    const user = userEvent.setup()
    await renderPage()
    expect(screen.getByRole('button', { name: '4 vakte' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Mbeten: Mëngjesi 1, Dreka, Snack pasdite, Darka.')).toBeInTheDocument()
    expect(screen.getByText(/"Mbyll ditën" del në krye të Ushqimit/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '3 vakte' }))
    expect(screen.getByText('Mbeten: Mëngjesi 1, Dreka, Darka.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gjatë ditës, vakt pas vakti' }))
    expect(screen.getByText(/Vakti i radhës mbetet në krye të ditës/)).toBeInTheDocument()
  })

  it('"Ruaj" heq vaktet e tepërta nga nesër, ruan mënyrën dhe hap Planin tim', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: '3 vakte' }))
    await user.click(screen.getByRole('button', { name: 'Ruaj dhe hap Planin tim' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/ushqimi/plani')
    const { readSchedule } = await import('@/data/schedule-settings')
    const { nutritionDay } = await import('@/data/nutrition')
    await waitFor(async () => expect((await readSchedule(data.store)).plan.logging).toBe('evening'))
    const tomorrow = await nutritionDay(data.store, '2026-12-10', new Date('2026-12-10T10:00:00'))
    expect(tomorrow.meals.map((meal) => meal.meal)).toEqual(['breakfast_1', 'lunch', 'dinner'])
  })
})
