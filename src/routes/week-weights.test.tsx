import { act, configure, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { sampleWeek, type TestClock, TODAY } from './programme-test-setup'

// Leximet e bibliotekës dhe të historisë zgjasin kur provat ecin paralelisht.
configure({ asyncUtilTimeout: 5000 })

// Peshat e javës (bordi "Sugjerimi", V2-E1-09; SPEC §7, V23): propozimet me llogarinë, "Ndrysho",
// "Prano peshat" dhe "Më vonë". Mostra: Java 1 u mbyll, Java 2 nis sot; Bench Press 60 × 13 → 62,5 kg.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: { date: new Date() } as TestClock }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`week-weights-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
    now: () => data.clock.date,
  })
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

async function renderWeights() {
  const { WeekWeightsPage } = await import('./week-weights')
  const router = createMemoryRouter(
    [
      { path: '/programi', element: <h1>Programi</h1> },
      { path: '/programi/peshat', element: <WeekWeightsPage /> },
    ],
    { initialEntries: ['/programi', '/programi/peshat'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  await screen.findByRole('region', { name: /^Stërvitja 1|^Workout 1/ })
  return router
}

async function decisions() {
  return (await data.store.all('week_weights')).map((row) => [row.status, Number(row.weight_kg)])
}

describe('Peshat e javës', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    await sampleWeek(data.store, data.clock)
  })
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
    for (const row of await data.store.all('week_weights')) await data.store.remove('week_weights', row.id)
  })
  afterEach(() => {
    vi.useRealTimers()
    act(() => language.set('sq'))
  })

  it('java, llogaria dhe propozimi i çdo ushtrimi si te bordi', async () => {
    await renderWeights()
    expect(screen.getByRole('heading', { level: 1, name: 'Peshat e javës' })).toBeInTheDocument()
    expect(screen.getByText(/Faza 1 · Java 2, nga 8 nëntor\./).parentElement).toHaveTextContent(
      'Faza 1 · Java 2, nga 8 nëntor. 9–11 përsëritje, rest-pause te seti i fundit.',
    )
    expect(screen.getByText('Java 1 u mbyll. Peshat e propozuara për Javën 2: asgjë nuk ndryshon pa ty.')).toBeInTheDocument()
    expect(
      screen.getByText('Pesha = 1RM aktuale (më e larta e 28 ditëve) ÷ (1 + 11/30), poshtë te hapi: shufër 2,5 kg.'),
    ).toBeInTheDocument()

    const day = screen.getByRole('region', { name: 'Stërvitja 1 · Gjoks, triceps, pulpa' })
    expect(within(day).getByRole('heading', { name: 'Stërvitja 1 · e diel' })).toBeInTheDocument()
    expect(day).toHaveTextContent('1 rritet · 8 pa sugjerim')
    const bench = within(day).getByRole('listitem', { name: 'Bench Press: nga 60 në 62,5 kg' })
    expect(bench).toHaveTextContent('60→62,5kg+2,5 kg')
    expect(bench).toHaveTextContent('86,0 ÷ 1,367 = 62,9 → 62,5 · 1RM më 1 nëntor')
    expect(day).toHaveTextContent('Pa sugjerim: ende pa sete. Te seanca: zgjidh peshën ku mbyll 9–11.')
    expect(day).toHaveTextContent('Pa sugjerim: ende pa sete. Te seanca: zgjidh peshën ku mbyll 15–20.')

    // Ditët e tjera mbyllur, me numrin e peshave.
    expect(screen.getByRole('button', { name: 'Stërvitja 2, Shpinë, biceps, bark: 9 pesha' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Më vonë: seancat nisin me peshat e Javës 1.')).toBeInTheDocument()
  })

  it('"Ndrysho" vendos peshën me hapin e pajisjes dhe e thotë', async () => {
    const user = userEvent.setup()
    await renderWeights()
    await user.click(screen.getByRole('button', { name: 'Ndrysho peshën e Bench Press' }))
    const sheet = screen.getByRole('dialog', { name: 'Bench Press' })
    await user.click(within(sheet).getByRole('button', { name: 'Rrit me 2,5 kg' }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj peshën' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const bench = await screen.findByRole('listitem', { name: 'Bench Press: nga 60 në 65 kg' })
    expect(bench).toHaveTextContent('E ndryshove ti · propozimi 62,5 kg')
    expect(await decisions()).toEqual([['changed', 65]])
  })

  it('"Prano peshat" i ruan dhe kthehet te programi; "Më vonë" mban peshën e fundit', async () => {
    const user = userEvent.setup()
    await renderWeights()
    await user.click(screen.getByRole('button', { name: 'Prano peshat' }))
    expect(await screen.findByRole('heading', { name: 'Programi' })).toBeInTheDocument()
    expect(await decisions()).toEqual([['accepted', 62.5]])

    for (const row of await data.store.all('week_weights')) await data.store.remove('week_weights', row.id)
    await renderWeights()
    await user.click(screen.getAllByRole('button', { name: 'Më vonë' }).at(-1)!)
    await waitFor(async () => expect(await decisions()).toEqual([['postponed', 60]]))
  })

  it('anglisht', async () => {
    act(() => language.set('en'))
    await renderWeights()
    expect(screen.getByRole('heading', { level: 1, name: 'Week weights' })).toBeInTheDocument()
    expect(screen.getByText('Week 1 is done. Proposed weights for Week 2: nothing changes without you.')).toBeInTheDocument()
    const day = screen.getByRole('region', { name: 'Workout 1 · Chest, triceps, calves' })
    expect(within(day).getByRole('heading', { name: 'Workout 1 · Sunday' })).toBeInTheDocument()
    expect(day).toHaveTextContent('1 goes up · 8 without a suggestion')
    expect(within(day).getByRole('listitem', { name: 'Bench Press: from 60 to 62.5 kg' })).toHaveTextContent('86.0 ÷ 1.367 = 62.9 → 62.5 · 1RM on 1 November')
    expect(screen.getByRole('button', { name: 'Accept weights' })).toBeInTheDocument()
    expect(screen.getByText('Later: sessions start with the Week 1 weights.')).toBeInTheDocument()
  })
})
