import { createDatabase } from '@/data/db'
import { completeOnboarding } from '@/data/profile'
import { createLocalStore, type LocalStore } from '@/data/store'
import { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } from '@/data/training'
import { changeWeekWeight, weekWeightsView, workoutWeights } from '@/data/week-weights'
import { currentI18n, language } from '@/i18n'
import {
  applyNotificationAction,
  createSessionNotifier,
  type NativeStep,
  type NotificationAction,
  type NotificationState,
  openedSet,
  openState,
  type SessionNotificationPort,
  sessionView,
} from './session-notification'

// Seti nga njoftimi (V2-E1-08). Plugin-i native imitohet: radha e veprimeve (SharedPreferences te
// telefoni) është një listë këtu, dhe `tap` bën atë që bën SessionActionReceiver.java kur JS-i jeton
// (shton veprimin dhe njofton). Store-i është i vërtetë, mbi IndexedDB në memorie.

const USER = '11111111-1111-4111-8111-111111111111'
const profile = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

/** Shortcut to Size te Faza 1 · Java 2 · Stërvitja 1 me seancën e hapur; Bench Press 60 × 13 te Java 1. */
async function openSessionAtWeekTwo() {
  let clock = new Date(2026, 10, 2, 18, 0)
  const store = createLocalStore(createDatabase(`session-notification-${crypto.randomUUID()}`), {
    userId: () => USER,
    now: () => (clock = new Date(clock.getTime() + 1000)),
  })
  await completeOnboarding(store, profile, () => clock)
  for (let day = 0; day < 4; day++) await skipWorkout(store) // Java 0
  const first = await startWorkout(store)
  const [bench] = (await trainingSnapshot(store))!.plan.slots
  await saveSet(store, { sessionId: first, slot: bench, setNumber: 1, weightKg: 60, reps: 13 })
  await finishWorkout(store, first)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  clock = new Date(2026, 10, 8, 17, 15)
  const sessionId = await startWorkout(store)
  return { store, sessionId, bench }
}

function fakePort(initial: NotificationAction[] = []) {
  const queue = [...initial]
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
  return {
    port,
    queue,
    shown,
    last: () => shown.at(-1) ?? null,
    /** Prekja e një butoni te njoftimi me JS-in gjallë: veprimi hyn te radha dhe JS-i njoftohet. */
    tap(action: NotificationAction) {
      queue.push(action)
      listener?.()
    },
  }
}

function restSpy() {
  const adopted: { sessionId: string; endsAt: number; seconds: number }[] = []
  const skipped: string[] = []
  return {
    adopted,
    skipped,
    rest: (sessionId: string) => ({
      adopt: (endsAt: number, seconds: number) => void adopted.push({ sessionId, endsAt, seconds }),
      skip: () => void skipped.push(sessionId),
    }),
  }
}

let ids = 0
/** Veprimi "Ruaj setin" që ndërton plugin-i native nga hapi në njoftim, me vlerat e treguara. */
function saveFrom(state: NotificationState, step: NativeStep, changes: Partial<Extract<NotificationAction, { type: 'save' }>> = {}): NotificationAction {
  return {
    id: `veprimi-${++ids}`,
    type: 'save',
    at: Date.UTC(2026, 10, 8, 16, 25),
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
    restEndsAt: null,
    restSeconds: null,
    ...changes,
  }
}

const setsOf = async (store: LocalStore, sessionId: string) =>
  (await store.where('set_logs', 'session_id', sessionId)).sort((a, b) => String(a.logged_at).localeCompare(String(b.logged_at)))

function notifier(store: LocalStore, port: SessionNotificationPort, rest = restSpy().rest) {
  return createSessionNotifier({ store, port, rest, i18n: currentI18n })
}

afterEach(() => language.set('sq'))

describe('njoftimi i seancës: çfarë tregon', () => {
  it('seti i radhës me peshën e javës (workoutWeights) dhe përsëritjet e propozuara, si te bordi', async () => {
    const { store, sessionId, bench } = await openSessionAtWeekTwo()
    const fake = fakePort()
    await notifier(store, fake.port).sync()
    const state = fake.last()!
    const weekWeight = (await workoutWeights(store, (await trainingSnapshot(store))!.plan)).get(bench.slotId)!.weightKg
    expect(weekWeight).toBe(62.5)
    expect(state.sessionId).toBe(sessionId)
    expect(state.steps[0]).toMatchObject({
      slotId: bench.slotId,
      setNumber: 1,
      weightKg: weekWeight,
      reps: 9,
      title: 'Bench Press · Seti 1 nga 4',
      weight: '62,5',
      target: 'Synimi 9–11',
      restAfter: 90,
      canSave: true,
    })
    expect(state.texts).toMatchObject({ save: 'Ruaj setin', edit: 'Ndrysho', skipRest: 'Kapërce pushimin', restEnds: 'Pushimi mbaron për %s' })
  })

  it('pesha e ndryshuar te "Peshat e javës" është pesha e njoftimit', async () => {
    const { store, bench } = await openSessionAtWeekTwo()
    const { week } = (await weekWeightsView(store))!
    await changeWeekWeight(store, week, bench.slotId, 65)
    const fake = fakePort()
    await notifier(store, fake.port).sync()
    expect(fake.last()!.steps[0]).toMatchObject({ weightKg: 65, weight: '65' })
  })

  it('setet që vijnë, si të ruhen me vlerat e propozuara: pushimi, rest-pause dhe segmenti', async () => {
    const { store } = await openSessionAtWeekTwo()
    const fake = fakePort()
    await notifier(store, fake.port).sync()
    const steps = fake.last()!.steps
    expect(steps.slice(0, 6).map((step) => [step.setNumber, step.segment, step.technique, step.weightKg, step.reps, step.restAfter])).toEqual([
      [1, null, 'none', 62.5, 9, 90],
      [2, null, 'none', 62.5, 9, 90],
      [3, null, 'none', 62.5, 9, 90],
      // Seti i fundit me rest-pause: 15 s pushim, pastaj segmenti me një të tretën e përsëritjeve.
      [4, null, 'rest_pause', 62.5, 9, 15],
      [4, 'rest_pause', 'rest_pause', 62.5, 3, 90],
      // Incline Bench Press s'ka histori: pesha zgjidhet te app-i.
      [1, null, 'none', 0, 9, 90],
    ])
    expect(steps[1].inherit).toEqual({ key: steps[0].key, divisor: 1 })
    expect(steps[4]).toMatchObject({ inherit: { key: steps[3].key, divisor: 3 }, title: 'Bench Press · Seti 4 · rest-pause', target: 'Deri në dështim' })
    expect(steps[5]).toMatchObject({ canSave: false, weight: null, target: 'Zgjidh peshën ku mbyll 9–11 përsëritje' })
  })

  it('setet e ruajtura te app-i nuk dalin më; seti i radhës mban përsëritjet e setit të fundit', async () => {
    const { store, sessionId, bench } = await openSessionAtWeekTwo()
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 11 })
    const fake = fakePort()
    await notifier(store, fake.port).sync()
    expect(fake.last()!.steps[0]).toMatchObject({ setNumber: 2, weightKg: 62.5, reps: 11 })
  })

  it('ushtrimi i zgjedhur te seanca del i pari te njoftimi', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const plan = (await trainingSnapshot(store))!.plan
    const fake = fakePort()
    const notify = notifier(store, fake.port)
    notify.setView({ sessionId, selected: plan.slots[7].slotId, dismissedSegment: null })
    await notify.sync()
    // Standing Calf Raise s'ka peshë jave (pa histori): pesha zgjidhet te app-i, njoftimi s'shkon më tej.
    expect(fake.last()!.steps).toMatchObject([{ slotId: plan.slots[7].slotId, title: 'Standing Calf Raise · Seti 1 nga 4', canSave: false }])
    // Zgjedhja e një seance tjetër nuk vlen.
    notify.setView({ sessionId: 'tjeter', selected: plan.slots[7].slotId, dismissedSegment: null })
    await notify.sync()
    expect(fake.last()!.steps[0]).toMatchObject({ slotId: plan.slots[0].slotId })
  })

  it('në anglisht, me numrat sipas gjuhës', async () => {
    language.set('en')
    const { store } = await openSessionAtWeekTwo()
    const fake = fakePort()
    await notifier(store, fake.port).sync()
    const state = fake.last()!
    expect(state.steps[0]).toMatchObject({ title: 'Bench Press · Set 1 of 4', weight: '62.5', target: 'Target 9–11' })
    expect(state.texts).toMatchObject({ save: 'Log set', skipRest: 'Skip rest', repsOne: 'rep', repsOther: 'reps', restEnds: 'Rest ends in %s' })
  })

  it('pa seancë të hapur njoftimi hiqet', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const fake = fakePort()
    const notify = notifier(store, fake.port)
    await notify.sync()
    await finishWorkout(store, sessionId)
    await notify.sync()
    expect(fake.last()).toBeNull()
  })

  it('i njëjti njoftim nuk dërgohet dy herë', async () => {
    const { store } = await openSessionAtWeekTwo()
    const fake = fakePort()
    const notify = notifier(store, fake.port)
    await notify.sync()
    await notify.sync()
    expect(fake.shown).toHaveLength(1)
  })
})

describe('veprimet e njoftimit', () => {
  it('zbatimi kur JS-i jeton: "Ruaj setin" ruan setin me vlerat e propozuara dhe njoftimi kalon te seti tjetër', async () => {
    const { store, sessionId, bench } = await openSessionAtWeekTwo()
    const fake = fakePort()
    const notify = notifier(store, fake.port)
    const stop = notify.start()
    await vi.waitFor(() => expect(fake.last()).not.toBeNull())
    const state = fake.last()!
    fake.tap(saveFrom(state, state.steps[0]))
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    const [saved] = await setsOf(store, sessionId)
    expect(saved).toMatchObject({ slot_id: bench.slotId, set_number: 1, weight_kg: 62.5, reps: 9, technique: 'none', logged_at: '2026-11-08T16:25:00.000Z' })
    expect(fake.last()!.steps[0]).toMatchObject({ setNumber: 2 })
  })

  it('zbatimi pas nisjes: veprimet e ruajtura kur procesi ishte vrarë zbatohen në nisjen e radhës', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    const fake = fakePort([saveFrom(state, state.steps[0], { reps: 10 })])
    const stop = notifier(store, fake.port).start()
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    expect(await setsOf(store, sessionId)).toMatchObject([{ set_number: 1, weight_kg: 62.5, reps: 10 }])
  })

  it('radha e veprimeve: zbatohen me radhë, edhe segmenti pas setit të vet', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    const [one, two, three, four, segment] = state.steps
    const at = (minute: number) => Date.UTC(2026, 10, 8, 16, minute)
    const queue = [
      saveFrom(state, one, { at: at(20) }),
      saveFrom(state, two, { at: at(23), reps: 8 }),
      saveFrom(state, three, { at: at(26), reps: 8 }),
      saveFrom(state, four, { at: at(29), reps: 7 }),
      saveFrom(state, segment, { at: at(30), reps: 2 }),
    ]
    const fake = fakePort(queue)
    const stop = notifier(store, fake.port).start()
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    const sets = await setsOf(store, sessionId)
    expect(sets.map((set) => [set.set_number, set.reps, set.technique])).toEqual([
      [1, 9, 'none'],
      [2, 8, 'none'],
      [3, 8, 'none'],
      [4, 7, 'rest_pause'],
    ])
    expect(sets[3].segments).toEqual([{ weight_kg: 62.5, reps: 2 }])
    // Pas Bench Press, njoftimi tregon ushtrimin tjetër.
    expect(fake.last()!.steps[0]).toMatchObject({ title: 'Incline Bench Press · Seti 1 nga 3' })
  })

  it('set i dyfishtë: e njëjta prekje dy herë (ose dy prekje mbi të njëjtin set) ruan një set', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    const tap = saveFrom(state, state.steps[0])
    const fake = fakePort([tap, tap, saveFrom(state, state.steps[0], { reps: 12 })])
    const stop = notifier(store, fake.port).start()
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    expect(await setsOf(store, sessionId)).toMatchObject([{ set_number: 1, reps: 9 }])
    expect(await applyNotificationAction(store, tap)).toBe('duplicate')
  })

  it('një set i ruajtur te app-i nuk mbishkruhet nga një prekje e vjetër te njoftimi', async () => {
    const { store, sessionId, bench } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 65, reps: 8 })
    expect(await applyNotificationAction(store, saveFrom(state, state.steps[0]))).toBe('duplicate')
    expect(await setsOf(store, sessionId)).toMatchObject([{ weight_kg: 65, reps: 8 }])
  })

  it('seanca e mbyllur ndërkohë: veprimi hidhet, asnjë set nuk shtohet dhe njoftimi hiqet', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    await finishWorkout(store, sessionId)
    const fake = fakePort([saveFrom(state, state.steps[0]), { id: 'kapercim', type: 'skip_rest', at: Date.UTC(2026, 10, 8, 16, 26), sessionId }])
    const spy = restSpy()
    const stop = notifier(store, fake.port, spy.rest).start()
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    expect(await setsOf(store, sessionId)).toHaveLength(0)
    expect(fake.last()).toBeNull()
    expect(spy.skipped).toEqual([])
  })

  it('segmenti pa setin e vet nuk ruhet', async () => {
    const { store } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    expect(await applyNotificationAction(store, saveFrom(state, state.steps[4]))).toBe('stale')
  })

  it('pushimi i nisur te njoftimi vazhdon te seanca; "Kapërce pushimin" e ndal', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    const endsAt = Date.now() + 90_000
    const fake = fakePort([
      saveFrom(state, state.steps[0], { restEndsAt: endsAt, restSeconds: 90 }),
      { id: 'kapercim', type: 'skip_rest', at: Date.now(), sessionId },
    ])
    const spy = restSpy()
    const stop = notifier(store, fake.port, spy.rest).start()
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    expect(spy.adopted).toEqual([{ sessionId, endsAt, seconds: 90 }])
    expect(spy.skipped).toEqual([sessionId])
  })

  it('një pushim që ka mbaruar ndërkohë nuk rifillon te seanca', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const before = fakePort()
    await notifier(store, before.port).sync()
    const state = before.last()!
    const fake = fakePort([saveFrom(state, state.steps[0], { restEndsAt: Date.now() - 1000 })])
    const spy = restSpy()
    const stop = notifier(store, fake.port, spy.rest).start()
    await vi.waitFor(() => expect(fake.queue).toHaveLength(0))
    stop()
    expect(await setsOf(store, sessionId)).toHaveLength(1)
    expect(spy.adopted).toEqual([])
  })

  it('pas `stop` një prekje nuk zbatohet më nga ky dëgjues', async () => {
    const { store, sessionId } = await openSessionAtWeekTwo()
    const fake = fakePort()
    const stop = notifier(store, fake.port).start()
    await vi.waitFor(() => expect(fake.last()).not.toBeNull())
    stop()
    const state = fake.last()!
    fake.tap(saveFrom(state, state.steps[0]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fake.queue).toHaveLength(1)
    expect(await setsOf(store, sessionId)).toHaveLength(0)
  })
})

describe('"Ndrysho" dhe ekrani i seancës', () => {
  const request = { sessionId: 's', slotId: 'bench', setNumber: 3, segment: false, reps: 8, seconds: null }

  it('"Ndrysho" hap setin me përsëritjet e zgjedhura te njoftimi', () => {
    const state = openState(request)
    expect(state).toEqual({ notificationSet: { slotId: 'bench', setNumber: 3, values: { reps: 8 } } })
    expect(openedSet(state)).toEqual({ slotId: 'bench', setNumber: 3, values: { reps: 8 } })
    expect(openState({ ...request, reps: null, seconds: 45 })?.notificationSet.values).toEqual({ seconds: 45 })
  })

  it('segmenti hapet pa zgjedhje: seanca e tregon vetë', () => {
    expect(openState({ ...request, segment: true })).toBeUndefined()
  })

  it('një gjendje navigimi tjetër nuk lexohet si set nga njoftimi', () => {
    expect(openedSet(null)).toBeNull()
    expect(openedSet({ from: '/' })).toBeNull()
    expect(openedSet({ notificationSet: { slotId: 'bench' } })).toBeNull()
  })

  it('ekrani i seancës njofton vetëm kur ndryshon ajo që tregon', () => {
    const listener = vi.fn()
    const stop = sessionView.subscribe(listener)
    sessionView.set({ sessionId: 's', selected: 'bench', dismissedSegment: null })
    sessionView.set({ sessionId: 's', selected: 'bench', dismissedSegment: null })
    sessionView.set(null)
    stop()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(sessionView.get()).toBeNull()
  })
})
