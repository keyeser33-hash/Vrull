import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'
import { localDate, shiftDate } from '@/lib/calendar'

// Seanca më e lehtë (V50, V2-E3-06; bordi "Seanca më e lehtë"): sugjerimi në krye të seancës para setit të parë,
// shiriti "Seanca më e lehtë sot · …" me "Kthe si zakonisht", "ishte 62,5 kg" pranë peshës, dhe "Shtyje për nesër".
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`session-lighter-${crypto.randomUUID()}`)
  // Ora e fiksuar (e hëna 9 nëntor, 12:00): dita e ushqimit ndërrohet 3 orë para zgjimit, ndaj ora e vërtetë e bënte provën të binte mes 00:00 dhe 04:00.
  let clock = new Date(2026, 10, 9, 12, 0, 0).getTime()
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date((clock += 1000)) })
  data.store = store
  data.db = db
  return {
    store,
    useAppUpdate: () => ({ status: 'idle' }),
    updater: {},
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const LOW = { mood: 4, energy: 3, sleepMinutes: 300, sleepQuality: 3, soreness: 3, soreGroups: ['gjoksi'] } as const

async function reset() {
  await import('@/data/app-data')
  const { completeOnboarding } = await import('@/data/profile')
  await Promise.all(data.db.tables.map((table) => table.clear()))
  localStorage.clear()
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
}

/** Faza 1 · Java 2 · Stërvitja 1 (Bench Press 62,5), me seancën të hapur dhe gjendjen e ditës të ulët. */
async function lowReadinessSession() {
  const { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } = await import('@/data/training')
  const { saveDailyState } = await import('@/data/daily-state')
  const { store } = data
  for (let day = 0; day < 4; day++) await skipWorkout(store)
  const java1 = await startWorkout(store)
  const snapshot = (await trainingSnapshot(store))!
  const bench = snapshot.plan.slots.find((slot) => snapshot.exercises[slot.exerciseId].name === 'Bench Press')!
  for (const [setNumber, reps] of [[1, 13], [2, 12], [3, 11], [4, 10]]) await saveSet(store, { sessionId: java1, slot: bench, setNumber, weightKg: 60, reps })
  await finishWorkout(store, java1)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  // Seancat e mëparshme janë të djeshme: një ditë me seancë më të lehtë ka vetëm seancën e sotme.
  const yesterday = shiftDate(localDate(store.now()), -1)
  for (const row of await store.all('workout_sessions')) await store.put('workout_sessions', { id: row.id, date: yesterday })
  const sessionId = await startWorkout(store)
  const date = String((await store.get('workout_sessions', sessionId))!.date)
  await saveDailyState(store, date, { ...LOW, soreGroups: [...LOW.soreGroups] }, { recovery: 'gati', soreTrained: true })
  const plan = (await trainingSnapshot(store))!.plan
  return { sessionId, date, plan }
}

async function renderApp(path = '/seanca') {
  const { appRoutes } = await import('@/router')
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const choice = async (date: string) => (await data.store.where('daily_choices', 'date', date))[0]?.choice ?? null
const suggestion = () => screen.findByRole('region', { name: /^(Sugjerim për sot|Suggestion for today)$/ })

describe('seanca më e lehtë', () => {
  beforeEach(reset)
  afterEach(() => language.set('sq'))

  it('karta para setit të parë; "Seanca më e lehtë" sjell shiritin, setet më pak dhe "ishte 62,5 kg"; "Kthe si zakonisht" kthen gjithçka', async () => {
    const { date, plan } = await lowReadinessSession()
    const user = userEvent.setup()
    await renderApp()

    const card = await suggestion()
    expect(card).toHaveTextContent('Sot më lehtë?')
    const total = plan.slots.reduce((sum, slot) => sum + slot.sets, 0)
    const fewer = plan.slots.filter((slot, index) => index >= 2 && slot.sets > 1).length
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', `0 nga ${total} sete`)
    expect(await screen.findByRole('group', { name: 'Seti 1: 62,5 kg, 9 përsëritje' })).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: /^Seanca më e lehtë/ }))
    await waitFor(async () => expect(await choice(date)).toBe('lighter'))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull())
    const bar = await screen.findByText('Seanca më e lehtë sot · −1 set, pesha −10%')
    expect(bar.closest('[role="status"]')).toContainElement(screen.getByRole('button', { name: 'Kthe si zakonisht' }))
    await waitFor(() => expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toContain('Seti 1: 55 kg, 9 përsëritje'))
    expect(screen.getByText('ishte 62,5 kg')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', `0 nga ${total - fewer} sete`)

    await user.click(screen.getByRole('button', { name: 'Kthe si zakonisht' }))
    await waitFor(() => expect(screen.queryByText('Seanca më e lehtë sot · −1 set, pesha −10%')).toBeNull())
    await waitFor(async () => expect(await choice(date)).toBe('normal'))
    expect(await screen.findByRole('group', { name: 'Seti 1: 62,5 kg, 9 përsëritje' })).toBeInTheDocument()
    expect(screen.queryByText('ishte 62,5 kg')).toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', `0 nga ${total} sete`)
  })

  it('në anglisht: shiriti dhe "was 62.5 kg"', async () => {
    await lowReadinessSession()
    language.set('en')
    const user = userEvent.setup()
    await renderApp()
    await user.click(within(await suggestion()).getByRole('button', { name: /^Lighter session/ }))
    expect(await screen.findByText('Lighter session today · −1 set, weight −10%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to usual' })).toBeInTheDocument()
    expect(await screen.findByText('was 62.5 kg')).toBeInTheDocument()
  })

  it('pas setit të parë nuk del më karta e sugjerimit', async () => {
    await lowReadinessSession()
    const user = userEvent.setup()
    await renderApp()
    await suggestion()
    await user.click(await screen.findByRole('button', { name: 'Ruaj setin' }))
    await screen.findByRole('timer')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sugjerim për sot' })).toBeNull())
  })

  it('"Shtyje për nesër" nga seanca: seanca e zbrazët hiqet dhe app-i kthehet te Sot', async () => {
    const { date } = await lowReadinessSession()
    const user = userEvent.setup()
    const router = await renderApp()
    await user.click(within(await suggestion()).getByRole('button', { name: 'Shtyje për nesër' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await waitFor(async () => expect(await choice(date)).toBe('tomorrow'))
    const { trainingSnapshot } = await import('@/data/training')
    expect((await trainingSnapshot(data.store))!.session).toBeNull()
  })
})
