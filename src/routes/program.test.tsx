import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { sampleWeek, type TestClock, TODAY } from './programme-test-setup'

// Programi (bordi "Programi", V2-E1-09) dhe stërvitja e një jave, me store të vërtetë dhe mostrën e
// bordeve: e diel 8 nëntor, Faza 1 · Java 2 · Stërvitja 1.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: { date: new Date() } as TestClock }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`program-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
    now: () => data.clock.date,
  })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})
vi.mock('@/lib/rest-alarm', () => ({ prepareRestNotifications: async () => {} }))

async function renderAt(path: string) {
  const { ProgramPage, WorkoutPage } = await import('./program')
  const router = createMemoryRouter(
    [
      { path: '/programi', element: <ProgramPage /> },
      { path: '/programi/:blockId/:week/:dayId', element: <WorkoutPage /> },
      { path: '/seanca', element: <h1>Seanca</h1> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Programi', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    await sampleWeek(data.store, data.clock)
  })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
    act(() => language.set('sq'))
  })

  it('programi aktiv me blloqet, javën dhe stërvitjen e radhës si te bordi', async () => {
    await renderAt('/programi')
    expect(await screen.findByRole('heading', { level: 1, name: 'Shortcut to Size' })).toBeInTheDocument()
    expect(screen.getByText('Programi aktiv · Jim Stoppani')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Biblioteka e ushtrimeve' })).toHaveAttribute('href', '/programi/biblioteka')
    expect(screen.getByRole('link', { name: 'Ndrysho programin' })).toHaveAttribute('href', expect.stringMatching(/^\/programi\/editori\//))

    const blocks = screen.getByRole('region', { name: 'Blloqet e programit' })
    expect(blocks).toHaveTextContent('Faza 1 · Java 2')
    expect(blocks).toHaveTextContent('java 3 nga 13')
    expect(within(blocks).getByRole('img')).toHaveAccessibleName(
      'Java 0: 1 javë e bërë nga 1. Faza 1: 1 javë e bërë nga 4. Faza 2: 0 javë të bëra nga 4. Faza 3: 0 javë të bëra nga 4. Tani: Faza 1 · Java 2',
    )

    const week = screen.getByRole('region', { name: 'Java 2 · ditët' })
    expect(week).toHaveTextContent('0 nga 4 të bëra')
    const next = within(week).getByRole('article', { name: 'Stërvitja 1, Gjoks, triceps, pulpa' })
    expect(next).toHaveTextContent('Sot · e diel, 8 nëntor · ~65 min')
    expect(next).toHaveTextContent('Bench Press · 4 × 9–11 · 62,5 kg')
    expect(next).toHaveTextContent('Incline Bench Press · Incline Dumbbell Flye')
    expect(within(next).getByRole('button', { name: 'Fillo stërvitjen' })).toBeEnabled()

    const rows = within(week).getAllByRole('link', { name: /^Stërvitja [234]/ })
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Stërvitja 2, Shpinë, biceps, bark, E hënë 9',
      'Stërvitja 3, Shpatulla, trapez, pulpa, E martë 10',
      'Stërvitja 4, Këmbë, bark, E enjte 12',
    ])
    expect(rows[0]).toHaveTextContent('Dumbbell Bent-Over Row · Barbell Curl')

    expect(screen.getByRole('link', { name: /Peshat e javës/ })).toHaveTextContent('Faza 1 · Java 2 · presin vendimin tënd')
    expect(screen.getByRole('link', { name: 'Shiko të gjitha programet' })).toHaveAttribute('href', '/programet')
    // Një veprim kryesor në ekran.
    expect(document.querySelectorAll('button.bg-ember, a.bg-ember')).toHaveLength(1)
  })

  it('anglisht: emrat e blloqeve dhe datat në anglishten britanike', async () => {
    act(() => language.set('en'))
    await renderAt('/programi')
    expect(await screen.findByText('Active programme · Jim Stoppani')).toBeInTheDocument()
    const blocks = screen.getByRole('region', { name: 'Programme blocks' })
    expect(blocks).toHaveTextContent('Phase 1 · Week 2')
    expect(blocks).toHaveTextContent('week 3 of 13')
    const week = screen.getByRole('region', { name: 'Week 2 · days' })
    expect(week).toHaveTextContent('0 of 4 done')
    expect(week).toHaveTextContent('Today · Sunday, 8 November · ~65 min')
    // Emrat e ditëve të Shortcut to Size përkthehen si te bordi "EN · Sot".
    expect(within(week).getByRole('article', { name: 'Workout 1, Chest, triceps, calves' })).toBeInTheDocument()
    expect(week).toHaveTextContent('Bench Press · 4 × 9–11 · 62.5 kg')
    expect(within(week).getByRole('link', { name: 'Workout 2, Back, biceps, abs, Monday 9' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Week weights/ })).toHaveTextContent('Phase 1 · Week 2 · waiting for you')
    expect(screen.getByRole('link', { name: 'See all programmes' })).toBeInTheDocument()
  })

  it('"Fillo stërvitjen" nis seancën e radhës', async () => {
    const user = userEvent.setup()
    const router = await renderAt('/programi')
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    expect(await screen.findByRole('heading', { name: 'Seanca' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/seanca')
    const { trainingSnapshot } = await import('@/data/training')
    expect((await trainingSnapshot(data.store))?.session).not.toBeNull()
  })

  it('stërvitja e një jave: ushtrimet me setet dhe teknikën e setit të fundit', async () => {
    const { programView } = await import('@/data/training')
    const view = (await programView(data.store))!
    const week = view.overview.weeks[1]
    await renderAt(`/programi/${week.blockId}/1/${week.days[0].dayId}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Stërvitja 1' })).toBeInTheDocument()
    expect(screen.getByText('Faza 1 · Java 1 · Gjoks, triceps, pulpa')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(9)
    expect(rows[0]).toHaveTextContent('Bench Press')
    expect(rows[0]).toHaveTextContent('4 × 12–15 · seti i fundit rest-pause')
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/ushtrimi\/.+\?blloku=/))
  })

  it('stërvitja në anglisht', async () => {
    act(() => language.set('en'))
    const { programView } = await import('@/data/training')
    const view = (await programView(data.store))!
    const week = view.overview.weeks[1]
    await renderAt(`/programi/${week.blockId}/1/${week.days[0].dayId}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Workout 1' })).toBeInTheDocument()
    expect(screen.getByText('Phase 1 · Week 1 · Chest, triceps, calves')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('4 × 12–15 · last set rest-pause')
    expect(screen.getByRole('button', { name: 'Back to programme' })).toBeInTheDocument()
  })
})
