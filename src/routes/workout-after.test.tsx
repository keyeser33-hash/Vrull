import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// "E bëra, po e shënoj" (V74, V75), ora e stërvitjes (V76, V77) dhe vakti pas stërvitjes (V78) me store të vërtetë:
// e hënë 7 dhjetor 2026 në 21:00, ditë stërvitjeje, Java 0 · Stërvitja 1, pa histori.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`workout-after-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

function Probe() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>
}

describe('vala 2 · Stërvitja', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-07T21:00:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  it('ora e stërvitjes: "Vetëm sot" e ruan për datën, pa prekur ditën e javës', async () => {
    const user = userEvent.setup()
    const { TrainingTimeButton } = await import('./training-time')
    const { readSchedule, setTrainingTime, trainingTimeOn } = await import('@/data/schedule-settings')
    const router = createMemoryRouter([{ path: '/programi', element: <TrainingTimeButton /> }], { initialEntries: ['/programi', '/programi?ora=1'], initialIndex: 1 })
    render(<RouterProvider router={router} />)
    const sheet = await screen.findByRole('dialog', { name: 'Ora e stërvitjes' })
    expect(within(sheet).getByRole('button', { name: 'Vetëm sot' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: 'Çdo javë, e hënë' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(sheet).getByRole('button', { name: 'Nuk shkoj sot, shtyje për nesër' })).toBeInTheDocument()
    // Fusha e orës është zgjedhësi i telefonit: ora vendoset nga të dhënat, ruajtja provohet me butonin.
    await setTrainingTime(data.store, '2026-12-07', '20:30', 'day')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj orën' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const schedule = await readSchedule(data.store)
    expect(schedule.trainingTimes[1]).toBe('18:00')
    // Butoni tregon orën që vlen sot.
    await setTrainingTime(data.store, '2026-12-07', '20:30', 'day')
    expect(trainingTimeOn(await readSchedule(data.store), '2026-12-07')).toBe('20:30')
    expect(await screen.findByRole('button', { name: 'Ora e stërvitjes 20:30. Ndryshoje' })).toBeInTheDocument()
    await setTrainingTime(data.store, '2026-12-07', '18:00', 'day')
  })

  it('tabela: pa peshë nuk ruhet; me peshë ruhen ushtrimet "Bërë" dhe hapet mbyllja', async () => {
    const user = userEvent.setup()
    const { WorkoutAfterPage } = await import('./workout-after')
    const router = createMemoryRouter(
      [
        { path: '/programi/shenoje', element: <WorkoutAfterPage /> },
        { path: '/seanca/mbyllja/:sessionId', element: <Probe /> },
      ],
      { initialEntries: ['/programi/shenoje'] },
    )
    render(<RouterProvider router={router} />)
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(9)
    expect(screen.getByText('Stërvitja 1 · Gjoks, triceps, pulpa')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Ruaj dhe mbyll stërvitjen' })
    expect(save).toBeDisabled()
    expect(screen.getByText('Shkruaj peshën dhe përsëritjet te 9 ushtrime')).toBeInTheDocument()
    // Vetëm Bench Press u bë: të tjerat hiqen nga "Bërë".
    for (const row of rows.slice(1)) await user.click(within(row).getByRole('checkbox'))
    await user.type(within(rows[0]).getByRole('textbox', { name: 'Pesha në kg, Bench Press' }), '42,5')
    expect(screen.getByText('1 nga 9 ushtrime · 1 ndryshim')).toBeInTheDocument()
    expect(save).toBeEnabled()
    await user.click(save)
    const where = await screen.findByTestId('where')
    const sessionId = where.textContent!.split('/').at(-1)!
    const sets = (await data.store.where('set_logs', 'session_id', sessionId)).filter((row) => !row.deleted_at)
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every((set) => Number(set.weight_kg) === 42.5 && Number(set.reps) > 0)).toBe(true)
    expect(await data.store.get('workout_sessions', sessionId)).toMatchObject({ status: 'completed', date: '2026-12-07' })
  })

  it('vakti pas stërvitjes: "Si në plan" e shënon dhe "Zhbëj" e heq', async () => {
    const user = userEvent.setup()
    const { PostWorkoutMeal } = await import('./post-workout-meal')
    const router = createMemoryRouter([{ path: '/', element: <PostWorkoutMeal /> }], { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    const entries = async () => (await data.store.where('diary_entries', 'date', '2026-12-07')).filter((row) => !row.deleted_at && row.meal === 'post_workout')
    expect(await screen.findByRole('heading', { name: 'Vakti pas stërvitjes' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Si në plan' }))
    expect(await screen.findByText('Vakti pas stërvitjes u shënua')).toBeInTheDocument()
    expect((await entries()).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Zhbëj' }))
    await waitFor(async () => expect(await entries()).toHaveLength(0))
    expect(await screen.findByRole('button', { name: 'Më vonë' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Më vonë' }))
    expect(screen.queryByRole('heading', { name: 'Vakti pas stërvitjes' })).not.toBeInTheDocument()
  })
})
