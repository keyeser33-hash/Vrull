import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Sugjerimi te Sot (V50, V2-E3-06; bordet "Sot · Gatishmëria e ulët" dhe "-EN", "Sot · Stërvitja shtyhet për nesër"):
// karta "Sot më lehtë?" kur gatishmëria është e ulët, "Seanca më e lehtë", "Shtyje për nesër" dhe "Jo sot".
// Ora e telefonit është e diela 8 nëntor 2026, ditë stërvitjeje me Bench Press 62,5.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))

vi.mock('@/lib/webgl', () => ({ webglAvailable: () => false }))
vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return {
    store,
    updater: {},
    useAppUpdate: () => ({ status: 'idle' }),
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }
/** 5 orë gjumë, energji normale, dhimbje te gjoksi që stërvitet sot: gatishmëria e ulët; gjumi dhe dhimbjet janë pjesët më të ulëta. */
const LOW = { mood: 4, energy: 3, sleepMinutes: 300, sleepQuality: 3, soreness: 3, soreGroups: ['gjoksi'] } as const
const FINE = { mood: 4, energy: 4, sleepMinutes: 480, sleepQuality: 4, soreness: 0, soreGroups: [] } as const

async function setup(checkIn: typeof LOW | typeof FINE | null) {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const { completeOnboarding } = await import('@/data/profile')
  const { finishWorkout, saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
  data.clock = at(25, 10, 9)
  data.store = createLocalStore(createDatabase(`suggestion-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  await completeOnboarding(data.store, PROFILE, () => data.clock)
  const train = async (date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) => {
    data.clock = date
    const sessionId = await startWorkout(data.store)
    const [first] = (await trainingSnapshot(data.store))!.plan.slots
    for (const [index, set] of sets.entries()) await saveSet(data.store, { sessionId, slot: first, setNumber: index + 1, ...set })
    data.clock = new Date(date.getTime() + 66 * 60_000)
    await finishWorkout(data.store, sessionId)
  }
  for (const day of [25, 26, 27, 29]) await train(at(day, 10, 17, 15), [{ weightKg: 50, reps: 14, rir: 2 }])
  await train(
    at(1, 11, 17, 15),
    [60, 60, 60, 60].map((weightKg, index) => ({ weightKg, reps: 13 - index })),
  )
  for (const day of [2, 3, 5]) await train(at(day, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
  data.clock = at(8, 11)
  if (checkIn) {
    const { saveDailyState } = await import('@/data/daily-state')
    await saveDailyState(data.store, '2026-11-08', { ...checkIn, soreGroups: [...checkIn.soreGroups] }, { recovery: 'gati', soreTrained: true })
  }
  return data.store
}

async function renderToday() {
  const { TodayPage } = await import('./today')
  const router = createMemoryRouter(
    [
      { path: '/', element: <TodayPage /> },
      { path: '/seanca', element: <h1>Seanca</h1> },
      { path: '/programet', element: <h1>Programet</h1> },
      { path: '/ushqimi', element: <h1>Ushqimi</h1> },
      { path: '/kutia', element: <h1>Kutia</h1> },
      { path: '/progresi/historiku/:sessionId', element: <h1>Seanca e kaluar</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

const choice = async () => (await data.store.where('daily_choices', 'date', '2026-11-08'))[0]?.choice ?? null
const card = () => screen.findByRole('region', { name: /^(Sugjerim për sot|Suggestion for today)$/ })

describe('Sot · sugjerimi i gatishmërisë së ulët', () => {
  afterEach(() => act(() => language.set('sq')))

  it('karta: pse, tre veprimet dhe "Programi nuk ndryshon."; "Fillo stërvitjen" bëhet dytësor', async () => {
    await setup(LOW)
    await renderToday()
    const suggestion = await card()
    expect(suggestion).toHaveTextContent('Sot më lehtë? Gjumi i shkurtër dhe dhimbjet te gjoksi.')
    const primary = within(suggestion).getByRole('button', { name: /^Seanca më e lehtë/ })
    expect(primary).toHaveTextContent('−1 set nga ushtrimi i 3-të, pesha −10%')
    expect(primary.className).toContain('bg-sand')
    expect(within(suggestion).getByRole('button', { name: 'Shtyje për nesër' })).toBeInTheDocument()
    expect(within(suggestion).getByRole('button', { name: 'Jo sot' })).toBeInTheDocument()
    expect(suggestion).toHaveTextContent('Programi nuk ndryshon.')
    const start = await screen.findByRole('button', { name: 'Fillo stërvitjen' })
    await waitFor(() => expect(start.className).not.toContain('bg-ember'))
  })

  it('në anglisht: fjalitë e bordit "-EN"', async () => {
    await setup(LOW)
    act(() => language.set('en'))
    await renderToday()
    const suggestion = await card()
    expect(suggestion).toHaveTextContent('Go lighter today? Short sleep and sore chest.')
    expect(within(suggestion).getByRole('button', { name: /^Lighter session/ })).toHaveTextContent('−1 set from the 3rd exercise, weight −10%')
    expect(within(suggestion).getByRole('button', { name: 'Move to tomorrow' })).toBeInTheDocument()
    expect(within(suggestion).getByRole('button', { name: 'Not today' })).toBeInTheDocument()
    expect(suggestion).toHaveTextContent('Your programme doesn’t change.')
  })

  it('"Seanca më e lehtë" ruan vendimin, karta ikën dhe Sot tregon peshën e ulur; "Jo sot" ruan "normal"', async () => {
    await setup(LOW)
    const user = userEvent.setup()
    await renderToday()
    await user.click(within(await card()).getByRole('button', { name: /^Seanca më e lehtë/ }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull())
    expect(await choice()).toBe('lighter')
    expect(await screen.findByText(/Bench Press: synim 55 ×/)).toBeInTheDocument()
    cleanup()

    await setup(LOW)
    await renderToday()
    await user.click(within(await card()).getByRole('button', { name: 'Jo sot' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull())
    expect(await choice()).toBe('normal')
    expect(await screen.findByText(/Bench Press: synim 62,5 ×/)).toBeInTheDocument()
  })

  it('pa karta: gatishmëri normale, ose pa check-in', async () => {
    await setup(FINE)
    await renderToday()
    await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull()
    cleanup()

    await setup(null)
    await renderToday()
    await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull()
  })

  it('"Shtyje për nesër": ditë pushimi sot, objektivat e ditës së pushimit, dhe "Ktheje për sot"', async () => {
    await setup(LOW)
    const user = userEvent.setup()
    await renderToday()
    await user.click(within(await card()).getByRole('button', { name: 'Shtyje për nesër' }))
    const postponed = await screen.findByRole('region', { name: 'Ditë pushimi sot' })
    expect(postponed).toHaveTextContent('Sot · stërvitja u shty')
    expect(postponed).toHaveTextContent('Stërvitja 1 · Gjoks, triceps, pulpa kalon nesër, e hënë 9 nëntor.')
    expect(postponed).toHaveTextContent(/Objektivat e sotme janë të ditës së pushimit: [\d\s]+ kcal\./)
    expect(postponed).toHaveTextContent('Ritëm i butë sot.')
    expect(postponed).toHaveTextContent('Vlen deri në setin e parë.')
    expect(await choice()).toBe('tomorrow')
    expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull()
    // Vetëm karta e shtyrë, si te bordi: pa kartën e stërvitjes, pa "Kapërce" dhe pa fjalinë e ditës dy herë.
    expect(screen.queryByRole('region', { name: 'Stërvitja e sotme' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).toBeNull()
    expect(screen.getAllByText('Ritëm i butë sot.')).toHaveLength(1)

    await user.click(within(postponed).getByRole('button', { name: 'Ktheje për sot' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Ditë pushimi sot' })).toBeNull())
    expect(await choice()).toBeNull()
    // Gatishmëria është ende e ulët dhe vendimi s'ka mbetur: karta e sugjerimit kthehet.
    expect(await card()).toHaveTextContent('Sot më lehtë?')
  })

  it('stërvitja e shtyrë në anglisht', async () => {
    await setup(LOW)
    act(() => language.set('en'))
    const user = userEvent.setup()
    await renderToday()
    await user.click(within(await card()).getByRole('button', { name: 'Move to tomorrow' }))
    const postponed = await screen.findByRole('region', { name: 'Rest day today' })
    expect(postponed).toHaveTextContent('Workout 1 · Chest, triceps, calves moves to tomorrow, Monday 9 November.')
    expect(postponed).toHaveTextContent(/Today’s targets are rest-day targets: [\d,]+ kcal\./)
    expect(within(postponed).getByRole('button', { name: 'Move it back to today' })).toBeInTheDocument()
  })
})
