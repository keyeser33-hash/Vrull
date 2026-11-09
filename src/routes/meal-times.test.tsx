import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi › Oraret e vakteve (V2-E2-06): zgjimi 08:20, gjumi 01:00, stërvitja 21:00, e hënë.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`times-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

describe('Oraret e vakteve', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-07T10:00:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderPage() {
    const { MealTimesPage } = await import('./meal-times')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi', element: <p>Ushqimi</p> },
        { path: '/ushqimi/oraret', element: <MealTimesPage /> },
      ],
      { initialEntries: ['/ushqimi', '/ushqimi/oraret'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    return router
  }
  const times = () => within(screen.getByRole('list', { name: 'Vaktet' })).getAllByRole('listitem').map((item) => item.textContent)

  it('nëntë vakte me stërvitjen; një më pak heq snack-un e paraditës; ora e drekës lëviz', async () => {
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByText('9 vakte')).toBeInTheDocument()
    expect(screen.getByText('Pas mesnate: vakti i fundit i përket ditës që mbaron')).toBeInTheDocument()
    expect(screen.getByLabelText('Ora e vaktit Para gjumit')).toHaveValue('00:30')
    await user.click(screen.getByRole('button', { name: 'Një vakt më pak' }))
    expect(screen.getByText('8 vakte')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ora e vaktit Snack paradite')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rikthe Snack paradite' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Ora e vaktit Dreka'), { target: { value: '14:00' } })
    expect(screen.getByText(/E lëvizur nga ti, ishte 14:20/)).toBeInTheDocument()
    expect(times().slice(-3)).toEqual(['20:45Para stërvitjes15 min para stërvitjes, lëviz me të', '22:30Pas stërvitjes90 min pas fillimit, lëviz me të', 'Para gjumit'])

    await user.click(screen.getByRole('button', { name: 'Ruaj oraret' }))
    expect(await screen.findByText('Ushqimi')).toBeInTheDocument()
    const { readSchedule } = await import('@/data/schedule-settings')
    expect((await readSchedule(data.store)).plan).toMatchObject({ removed: ['snack_am'], times: { lunch: '14:00' }, from: '2026-12-08' })
  })

  it('në anglisht', async () => {
    language.set('en')
    await renderPage()
    // Kreu del edhe gjatë leximit: prit fillimisht pjesën që vjen nga baza.
    expect(await screen.findByRole('radio', { name: 'Training at 21:00' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Meal times' })).toBeInTheDocument()
    expect(screen.getByLabelText('Time of Lunch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save times' })).toBeEnabled()
  })
})
