import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { currentI18n, language } from '@/i18n'
import type { NotificationAction, NotificationState, SessionNotificationPort } from '@/lib/session-notification'

// Seanca dhe njoftimi i seancës (V2-E1-08): seti i ruajtur te njoftimi del te ekrani i seancës me
// pushimin që nisi njoftimi, "Ndrysho" hap setin me vlerat e zgjedhura atje, dhe ekrani i thotë
// njoftimit cilin ushtrim tregon. Plugin-i native imitohet; store i vërtetë mbi IndexedDB në memorie.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`session-notification-${crypto.randomUUID()}`)
  let clock = Date.now()
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

async function reset() {
  await import('@/data/app-data')
  const { completeOnboarding } = await import('@/data/profile')
  await Promise.all(data.db.tables.map((table) => table.clear()))
  localStorage.clear()
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
}

/** Faza 1 · Java 2 · Stërvitja 1 me seancën e hapur; Bench Press 60 × 13 te Java 1 (pesha e javës 62,5). */
async function atPhaseOneWeekTwo() {
  const { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } = await import('@/data/training')
  const { store } = data
  for (let day = 0; day < 4; day++) await skipWorkout(store)
  const java1 = await startWorkout(store)
  const [bench] = (await trainingSnapshot(store))!.plan.slots
  await saveSet(store, { sessionId: java1, slot: bench, setNumber: 1, weightKg: 60, reps: 13 })
  await finishWorkout(store, java1)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  const sessionId = await startWorkout(store)
  const { plan } = (await trainingSnapshot(store))!
  return { sessionId, bench, plan }
}

async function renderSession(state?: unknown) {
  const { appRoutes } = await import('@/router')
  const router = createMemoryRouter(appRoutes, { initialEntries: [{ pathname: '/seanca', state }] })
  render(<RouterProvider router={router} />)
  return router
}

const setGroup = (name: string) => screen.findByRole('group', { name })

/** Njoftimi me plugin-in e imituar: radha është një listë, `tap` bën atë që bën native-i me JS-in gjallë. */
async function notificationWithFakePlugin() {
  const { createSessionNotifier } = await import('@/lib/session-notification')
  const { restControl } = await import('@/lib/use-rest-timer')
  const queue: NotificationAction[] = []
  const shown: (NotificationState | null)[] = []
  let listener: (() => void) | null = null
  const port: SessionNotificationPort = {
    show: async (state) => void shown.push(state),
    hide: async () => void shown.push(null),
    pending: async () => [...queue],
    ack: async (ids) => {
      for (const id of ids) queue.splice(queue.findIndex((action) => action.id === id), 1)
    },
    onAction(next) {
      listener = next
      return () => (listener = null)
    },
  }
  const notifier = createSessionNotifier({ store: data.store, port, rest: restControl, i18n: currentI18n })
  const stop = notifier.start()
  await waitFor(() => expect(shown.at(-1)).toBeTruthy())
  return {
    notifier,
    queue,
    stop,
    state: () => shown.at(-1)!,
    tap(action: NotificationAction) {
      queue.push(action)
      listener?.()
    },
  }
}

/** "Ruaj setin" te njoftimi për hapin e parë, me pushimin që nis native-i. */
function saveFirst(state: NotificationState, restSeconds: number): NotificationAction {
  const [step] = state.steps
  const at = Date.now()
  return {
    id: crypto.randomUUID(),
    type: 'save',
    at,
    sessionId: state.sessionId,
    key: step.key,
    slotId: step.slotId,
    exerciseId: step.exerciseId,
    position: step.position,
    setNumber: step.setNumber,
    segment: step.segment,
    technique: step.technique,
    weightKg: step.weightKg,
    reps: step.reps,
    seconds: step.seconds,
    rir: step.rir,
    restEndsAt: at + restSeconds * 1000,
    restSeconds,
  }
}

describe('seanca dhe njoftimi i seancës (V2-E1-08)', () => {
  beforeEach(reset)
  afterEach(() => language.set('sq'))

  it('seti i ruajtur te njoftimi del te seanca, me pushimin që nisi njoftimi', async () => {
    const { sessionId } = await atPhaseOneWeekTwo()
    await renderSession()
    expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    const notification = await notificationWithFakePlugin()
    expect(notification.state().steps[0]).toMatchObject({ title: 'Bench Press · Seti 1 nga 4', weight: '62,5', reps: 9 })

    await act(async () => notification.tap(saveFirst(notification.state(), 90)))
    await waitFor(() => expect(notification.queue).toHaveLength(0))
    notification.stop()

    // Pushimi i njoftimit vazhdon te ekrani, me setin e ruajtur dhe setin që vjen.
    expect(await screen.findByText('Seti 1 u ruajt: 62,5 × 9')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/^Pushimi: mbeten 1 minutë e (30|29|28) sekonda nga 1 minutë e 30 sekonda$/)
    expect(screen.getByText('Pastaj · seti 2 nga 4')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', '1 nga 30 sete')
    expect(await data.store.where('set_logs', 'session_id', sessionId)).toMatchObject([{ set_number: 1, weight_kg: 62.5, reps: 9 }])
    // Njoftimi kaloi te seti 2.
    expect(notification.state().steps[0]).toMatchObject({ setNumber: 2 })
  })

  it('anglisht: seti nga njoftimi te seanca', async () => {
    language.set('en')
    await atPhaseOneWeekTwo()
    await renderSession()
    expect(await setGroup('Set 1: 62.5 kg, 9 reps')).toBeInTheDocument()
    const notification = await notificationWithFakePlugin()
    expect(notification.state().steps[0]).toMatchObject({ title: 'Bench Press · Set 1 of 4', weight: '62.5', target: 'Target 9–11' })
    await act(async () => notification.tap(saveFirst(notification.state(), 90)))
    await waitFor(() => expect(notification.queue).toHaveLength(0))
    notification.stop()
    expect(await screen.findByText('Set 1 logged: 62.5 × 9')).toBeInTheDocument()
    expect(screen.getByText('Next · set 2 of 4')).toBeInTheDocument()
  })

  it('"Kapërce pushimin" te njoftimi e mbyll pushimin edhe te seanca', async () => {
    const { sessionId } = await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderSession()
    await user.click(await screen.findByRole('button', { name: 'Ruaj setin' }))
    expect(await screen.findByRole('timer')).toBeInTheDocument()
    const notification = await notificationWithFakePlugin()
    await act(async () => notification.tap({ id: 'kapercim', type: 'skip_rest', at: Date.now(), sessionId }))
    await waitFor(() => expect(notification.queue).toHaveLength(0))
    notification.stop()
    expect(await setGroup('Seti 2: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('"Ndrysho" te njoftimi hap setin me përsëritjet e zgjedhura atje', async () => {
    const { bench } = await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderSession({ notificationSet: { slotId: bench.slotId, setNumber: 1, values: { reps: 8 } } })
    expect(await setGroup('Seti 1: 62,5 kg, 8 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    expect(screen.getByText('Seti 1 u ruajt · 62,5 × 8')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))
    // Seti tjetër nuk merr më vlerat e njoftimit, por ato të setit të mëparshëm.
    expect(await setGroup('Seti 2: 62,5 kg, 8 përsëritje')).toBeInTheDocument()
  })

  it('"Ndrysho" për një ushtrim tjetër e hap atë; në anglisht', async () => {
    language.set('en')
    const { plan } = await atPhaseOneWeekTwo()
    const calf = plan.slots[7]
    await renderSession({ notificationSet: { slotId: calf.slotId, setNumber: 1, values: { reps: 18 } } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Standing Calf Raise' })).toBeInTheDocument()
    expect(await setGroup('Set 1: 0 kg, 18 reps')).toBeInTheDocument()
  })

  it('ekrani i thotë njoftimit cilin ushtrim tregon; pa ekran, asnjë', async () => {
    const { sessionView } = await import('@/lib/session-notification')
    const { sessionId, plan } = await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    const router = await renderSession()
    await waitFor(() => expect(sessionView.get()).toEqual({ sessionId, selected: null, dismissedSegment: null }))
    await user.click(await screen.findByRole('button', { name: /^Ushtrimet e seancës/ }))
    const list = screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })
    await user.click(within(list).getByRole('button', { name: /^Standing Calf Raise/ }))
    await waitFor(() => expect(sessionView.get()).toMatchObject({ selected: plan.slots[7].slotId }))
    await act(async () => router.navigate('/'))
    await waitFor(() => expect(sessionView.get()).toBeNull())
  })
})
