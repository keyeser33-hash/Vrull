import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { at, trainedWeeks, USER } from './week-test-setup'

// Qëllimet e javës (V43, SPEC §0.3c, bordi "Qëllimet"; /sot/java): e diela 8 nëntor 2026, java 2–8
// nëntor me 3 nga 4 stërvitje (e diela është sot), 400 kcal sot dhe pa ujë.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))

vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

async function freshStore() {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(8, 11)
  data.store = createLocalStore(createDatabase(`week-goals-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  return { store: data.store, setClock: (date: Date) => (data.clock = date) }
}

async function renderGoals() {
  const { WeekGoalsPage } = await import('./week-goals')
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Sot</h1> },
      { path: '/sot/java', element: <WeekGoalsPage /> },
    ],
    { initialEntries: ['/', '/sot/java'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

const region = (name: string) => screen.getByRole('region', { name })

describe('Qëllimet e javës', () => {
  afterEach(() => act(() => language.set('sq')))

  it('ditët e çdo qëllimi, rregulli, dita rezervë dhe vargu; edhe në anglisht', async () => {
    await trainedWeeks(await freshStore())
    await renderGoals()
    expect(await screen.findByText('Kjo javë · 2–8 nëntor · Faza 1')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/Java [0-9]/)
    expect(screen.getByRole('heading', { level: 1, name: 'Qëllimet e javës' })).toBeInTheDocument()

    const training = region('Stërvitja')
    expect(training).toHaveTextContent('3 nga 4')
    expect(within(training).getByRole('img', { name: 'E hënë e bërë, e martë e bërë, e mërkurë pushim, e enjte e bërë, e premte pushim, e shtunë pushim, e diel sot' })).toHaveTextContent(
      '4 stërvitjet e programit',
    )

    const food = region('Ushqimi')
    expect(food).toHaveTextContent('0 nga 5 ditë')
    expect(within(food).getByRole('img', { name: /^E hënë nën kufi, 0%, .*, e diel sot, \d+% deri tani$/ })).toHaveTextContent('5 ditë nga 7')
    expect(within(food).getByText(/^Dita numërohet kur regjistron të paktën 60% të kalorive të saj\. Sot: \d+%\.$/)).toBeInTheDocument()
    // Uji: objektivi i peshës 80 kg, 3,25 L në ditë stërvitjeje dhe 2,75 L në pushim.
    expect(within(region('Uji')).getByText(/^Dita numërohet kur arrin objektivin e saj: 3,25 L në ditë stërvitjeje, 2,75 L në pushim\. Sot: 0%\.$/)).toBeInTheDocument()

    const spare = screen.getByRole('complementary', { name: 'Dita rezervë · e lirë' })
    expect(spare).toHaveTextContent(/^Dita rezervë · e lirëPo të mbyllej java sot, ajo do ta plotësonte qëllimin e stërvitjes\./)
    expect(screen.getByRole('complementary', { name: 'Vargu: 1 javë' })).toHaveTextContent('Javë rresht me qëllimin e stërvitjes.')

    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Weekly goals' })).toBeInTheDocument()
    expect(screen.getByText('This week · 2–8 Nov · Phase 1')).toBeInTheDocument()
    expect(within(region('Workouts')).getByRole('img', { name: 'Monday done, Tuesday done, Wednesday rest day, Thursday done, Friday rest day, Saturday rest day, Sunday today' })).toHaveTextContent(
      '4 programme workouts',
    )
    expect(region('Food')).toHaveTextContent('0 of 5 days')
    expect(within(region('Food')).queryByText(/3\.25 L/)).toBeNull()
    expect(screen.getByText(/3\.25 L on training days, 2\.75 L on rest days/)).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Spare day · free' })).toHaveTextContent('If the week ended today, it would complete your training goal.')
    expect(screen.getByRole('complementary', { name: 'Streak: 1 week' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[ëç]/)
  })

  it('"Sot" kthehet aty nga erdhi përdoruesi', async () => {
    await trainedWeeks(await freshStore())
    const router = await renderGoals()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mbrapa te Sot' }))
    expect(router.state.location.pathname).toBe('/')
  })
})
