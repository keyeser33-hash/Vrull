import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Pranimi i TH-08: një seancë e plotë e Javës 0 dhe e Fazës 1 · Java 3 (drop set) regjistrohet
// vetëm në bazën lokale, pa asnjë kërkesë rrjeti. Store i vërtetë, pa Supabase.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`session-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
  })
  data.store = store
  return {
    store,
    useAppUpdate: () => ({ status: 'idle' }),
    updater: {},
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        // Si useLocalQuery i vërtetë: një lexim i vjetër nuk mbishkruan një më të ri.
        let started = 0
        let shown = 0
        const run = () => {
          const ticket = ++started
          void query().then((result) => {
            if (ticket < shown) return
            shown = ticket
            setValue(() => result)
          })
        }
        run()
        return store.subscribe(run)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

const fetchSpy = vi.spyOn(globalThis, 'fetch')

async function reset() {
  await import('@/data/app-data')
  const { completeOnboarding } = await import('@/data/profile')
  for (const table of ['set_logs', 'workout_sessions', 'slot_prescriptions', 'program_slots', 'program_state', 'program_days', 'program_blocks', 'programs', 'exercises', 'user_settings', 'body_measurements'] as const) {
    for (const row of await data.store.all(table)) await data.store.remove(table, row.id)
  }
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
}

async function renderApp(path = '/') {
  const { appRoutes } = await import('@/router')
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

/** Ruan çdo set (dhe pjesën e dytë të drop set-it) derisa të dalë "Mbyll stërvitjen". */
async function logEverySet(user: ReturnType<typeof userEvent.setup>) {
  let saved = 0
  for (let guard = 0; guard < 80; guard++) {
    const close = screen.queryByRole('button', { name: 'Mbyll stërvitjen' })
    if (close && screen.queryByRole('heading', { name: 'Të gjitha setet u bënë' })) return saved
    const button = await screen.findByRole('button', { name: /^Ruaj (setin \d+|pjesën 2)$/ }, { timeout: 3000 }).catch(() => {
      throw new Error(`Pa buton ruajtjeje: ${document.body.textContent?.slice(0, 400)}`)
    })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    saved += 1
    await waitFor(() => expect(button).not.toBeInTheDocument())
  }
  throw new Error(`Seanca nuk mbaroi: ${document.body.textContent?.slice(0, 300)}`)
}

describe('Sot dhe seanca', () => {
  beforeEach(reset)
  afterEach(() => expect(fetchSpy).not.toHaveBeenCalled())

  it('Sot tregon stërvitjen e radhës, rikuperimin dhe ushtrimin e parë', async () => {
    await renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Stërvitja 1' })).toBeInTheDocument()
    expect(screen.getByText('Gjoks, triceps, pulpa')).toBeInTheDocument()
    expect(screen.getByText('Java 0')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Muskujt e sotëm: gjoksi, tricepsi dhe pulpat' })).toBeInTheDocument()
    const recovery = screen.getByRole('region', { name: 'Rikuperimi i muskujve të sotëm' })
    expect(within(recovery).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'GjoksiPa stërvitje endeGati',
      'TricepsiPa stërvitje endeGati',
      'PulpatPa stërvitje endeGati',
    ])
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('3 × 12–15')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fillo stërvitjen' })).toBeEnabled()
  })

  it('një seancë e plotë e Javës 0, me pesha dhe përsëritje në rezervë, pa internet', { timeout: 60_000 }, async () => {
    const user = userEvent.setup()
    const router = await renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))

    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Seti 1 nga 3 · 12–15 përsëritje')).toBeInTheDocument()
    expect(screen.getByText('Zgjidh peshën ku mbyll 12–15 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    const reps = screen.getByLabelText('Përsëritjet')
    await user.clear(reps)
    await user.type(reps, '13{enter}')
    await user.click(screen.getByRole('button', { name: 'Ruaj setin 1' }))

    // Pas setit nis pushimi dhe pesha e setit mbetet për setin tjetër.
    expect(await screen.findByRole('button', { name: 'Kapërce' })).toBeInTheDocument()
    expect(await screen.findByText('Seti 2 nga 3 · 12–15 përsëritje')).toBeInTheDocument()
    expect(screen.getByLabelText('Pesha')).toHaveValue('5')
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))

    const saved = await logEverySet(user)
    expect(saved + 1).toBe(21)
    await user.click(screen.getByRole('button', { name: 'Mbyll stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Stërvitja 2' })).toBeInTheDocument()

    const sets = await data.store.all('set_logs')
    expect(sets).toHaveLength(21)
    expect(sets.every((set) => set.rir === 2 && set.technique === 'none')).toBe(true)
    expect(sets.find((set) => set.set_number === 1 && set.weight_kg === 5)).toMatchObject({ reps: 13 })
    expect((await data.store.all('workout_sessions')).map((session) => session.status)).toEqual(['completed'])
  })

  it('Faza 1 · Java 3: seti i fundit me drop set, me peshën e javës 1, pa internet', { timeout: 60_000 }, async () => {
    const { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } = await import('@/data/training')
    for (let workout = 0; workout < 4; workout++) await skipWorkout(data.store)
    // Faza 1 · Java 1 · Stërvitja 1: Bench Press me 50 kg.
    const week1 = await startWorkout(data.store)
    const [bench] = (await trainingSnapshot(data.store))!.plan.slots
    await saveSet(data.store, { sessionId: week1, slot: bench, setNumber: 1, weightKg: 50, reps: 14 })
    await finishWorkout(data.store, week1)
    for (let workout = 0; workout < 7; workout++) await skipWorkout(data.store)
    expect(await trainingSnapshot(data.store)).toMatchObject({ label: 'Faza 1 · Java 3', plan: { dayNumber: 1 } })

    const user = userEvent.setup()
    await renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    expect(await screen.findByText('Seti 1 nga 4 · 6–8 përsëritje')).toBeInTheDocument()
    // 1RM nga 50 × 14 = 73,3; 73,3 / (1 + 8/30) = 57,9 → 57,5 me hapin e shufrës.
    expect(screen.getByText(/sugjeruar 57,5 kg/)).toBeInTheDocument()
    for (const setNumber of [1, 2, 3, 4]) {
      await user.click(await screen.findByRole('button', { name: `Ruaj setin ${setNumber}` }))
    }
    expect(await screen.findByText('Seti 4 nga 4 · pjesa 2, drop set')).toBeInTheDocument()
    expect(screen.getByLabelText('Pesha')).toHaveValue('50')
    await user.click(screen.getByRole('button', { name: 'Ruaj pjesën 2' }))
    await logEverySet(user)
    await user.click(screen.getByRole('button', { name: 'Mbyll stërvitjen' }))

    const session = await vi.waitFor(async () => {
      const found = (await data.store.all('workout_sessions')).find((row) => row.week === 3 && row.status === 'completed')
      if (!found) throw new Error('Seanca e Javës 3 ende pa u mbyllur')
      return found
    })
    const sets = await data.store.where('set_logs', 'session_id', session.id)
    const benchSets = sets.filter((set) => set.exercise_id === bench.exerciseId).sort((a, b) => Number(a.set_number) - Number(b.set_number))
    expect(benchSets.map((set) => [set.set_number, set.weight_kg, set.technique])).toEqual([
      [1, 57.5, 'none'],
      [2, 57.5, 'none'],
      [3, 57.5, 'none'],
      [4, 57.5, 'drop_set'],
    ])
    expect(benchSets[3].segments).toEqual([{ weight_kg: 50, reps: 2 }])
    // Çdo ushtrim i ditës mbyll setin e fundit me drop set (barku dhe pulpat përfshirë).
    const lastSets = sets.filter((set) => set.technique === 'drop_set')
    expect(lastSets).toHaveLength(9)
    expect(lastSets.every((set) => Array.isArray(set.segments) && set.segments.length === 1)).toBe(true)
  })
})
