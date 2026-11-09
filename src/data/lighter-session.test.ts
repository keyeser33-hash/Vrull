import { currentI18n } from '@/i18n'
import { createSessionNotifier, type NotificationState, type SessionNotificationPort } from '@/lib/session-notification'
import { saveDailyState } from './daily-state'
import { chooseLighter, keepUsual, postponeWorkout, undoPostpone } from './day-choice'
import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { todayView } from './today'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { weekWeightsView, workoutWeights } from './week-weights'

// "Seanca më e lehtë" dhe "Shtyje për nesër" (V50, V2-E3-06; SPEC §0.3d): setet dhe peshat e seancës dalin nga një
// vend (`trainingSnapshot`, `workoutWeights`), ndaj Sot, njoftimi i seancës dhe seanca thonë të njëjtën gjë.

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }
const CHECK_IN = { mood: 2, energy: 2, sleepMinutes: 330, sleepQuality: 2, soreness: 3, soreGroups: ['gjoksi'] } as const

type Context = ReturnType<typeof setup>

function setup() {
  let clock = at(25, 10, 9)
  const store = createLocalStore(createDatabase(`lighter-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  return { store, setClock: (date: Date) => (clock = date) }
}

async function train(context: Context, date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) {
  context.setClock(date)
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(context.store, { sessionId, slot: first, setNumber: index + 1, ...set })
  context.setClock(new Date(date.getTime() + 66 * 60_000))
  await finishWorkout(context.store, sessionId)
}

/** Java 0 dhe Java 1 e Fazës 1 (si bordi "Sot"); seanca e fundit e enjtja 5 nëntor. Bench Press i javës: 62,5. */
async function lastTrainedThursday() {
  const context = setup()
  await completeOnboarding(context.store, PROFILE, () => at(25, 10, 9))
  for (const day of [25, 26, 27, 29]) await train(context, at(day, 10, 17, 15), [{ weightKg: 50, reps: 14, rir: 2 }])
  await train(context, at(1, 11, 17, 15), [
    { weightKg: 60, reps: 13 },
    { weightKg: 60, reps: 12 },
    { weightKg: 60, reps: 11 },
    { weightKg: 60, reps: 10 },
  ])
  for (const day of [2, 3, 5]) await train(context, at(day, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
  return context
}

const checkIn = (context: Context, date: string) => saveDailyState(context.store, date, { ...CHECK_IN, soreGroups: [...CHECK_IN.soreGroups] }, 40)

async function plan(context: Context) {
  const snapshot = (await trainingSnapshot(context.store))!
  return { snapshot, weights: await workoutWeights(context.store, snapshot.plan) }
}

async function notifiedWeight(store: Context['store']) {
  let shown: NotificationState | null = null
  const port: SessionNotificationPort = {
    show: async (state) => void (shown = state),
    hide: async () => void (shown = null),
    pending: async () => [],
    ack: async () => {},
    onAction: () => () => {},
  }
  await createSessionNotifier({ store, port, rest: () => ({ adopt() {}, skip() {} }), i18n: currentI18n }).sync()
  return (shown as NotificationState | null)?.steps[0]?.weightKg ?? null
}

describe('seanca më e lehtë: setet dhe peshat', () => {
  it('javë pa RIR: nga ushtrimi i 3-të një set më pak, pesha x 0,9 sipas hapit, e njëjtë te Sot, seanca dhe njoftimi', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(8, 11))
    await checkIn(context, '2026-11-08')
    const before = await plan(context)
    const normalSets = before.snapshot.plan.slots.map((slot) => slot.sets)
    expect(before.weights.get(before.snapshot.plan.slots[0].slotId)).toMatchObject({ weightKg: 62.5, weekKg: null })
    expect(await notifiedWeight(context.store)).toBeNull()

    await chooseLighter(context.store, '2026-11-08')
    const after = await plan(context)
    const sets = after.snapshot.plan.slots.map((slot) => slot.sets)
    expect(sets.slice(0, 2)).toEqual(normalSets.slice(0, 2))
    expect(sets.slice(2)).toEqual(normalSets.slice(2).map((count) => Math.max(1, count - 1)))
    expect(after.snapshot.plan.slots.map((slot) => slot.target)).toEqual(before.snapshot.plan.slots.map((slot) => slot.target))
    // Bench Press 62,5 → 56,25 → 55; "ishte 62,5".
    expect(after.weights.get(after.snapshot.plan.slots[0].slotId)).toMatchObject({ weightKg: 55, weekKg: 62.5 })

    const view = await todayView(context.store)
    expect(view.workout?.sets).toBe(sets.reduce((total, count) => total + count, 0))
    expect(view.workout?.first).toMatchObject({ name: 'Bench Press', weightKg: 55, weekKg: 62.5 })

    // Seanca e hapur: të njëjtat sete dhe pesha; njoftimi e thotë 55.
    await startWorkout(context.store)
    expect((await plan(context)).snapshot.plan.slots.map((slot) => slot.sets)).toEqual(sets)
    expect(await notifiedWeight(context.store)).toBe(55)
  })

  it('"Kthe si zakonisht" kthen setet dhe peshat e javës', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(8, 11))
    await checkIn(context, '2026-11-08')
    const normal = await plan(context)
    await chooseLighter(context.store, '2026-11-08')
    await startWorkout(context.store)
    await keepUsual(context.store, '2026-11-08')
    const back = await plan(context)
    expect(back.snapshot.plan.slots.map((slot) => slot.sets)).toEqual(normal.snapshot.plan.slots.map((slot) => slot.sets))
    expect(back.weights.get(back.snapshot.plan.slots[0].slotId)).toMatchObject({ weightKg: 62.5, weekKg: null })
  })

  it('javë me RIR: RIR +1, pesha mbetet', async () => {
    const context = setup()
    await completeOnboarding(context.store, PROFILE, () => at(25, 10, 9))
    context.setClock(at(25, 10, 17))
    await checkIn(context, '2026-10-25')
    const before = await plan(context)
    const first = before.snapshot.plan.slots[0]
    expect(first.target).toMatchObject({ kind: 'reps', rir: { min: 2, max: 3 } })
    const weight = before.weights.get(first.slotId)?.weightKg ?? null

    await chooseLighter(context.store, '2026-10-25')
    const after = await plan(context)
    expect(after.snapshot.plan.slots[0].target).toMatchObject({ kind: 'reps', rir: { min: 3, max: 4 } })
    expect(after.weights.get(first.slotId)?.weightKg ?? null).toBe(weight)
    expect(after.snapshot.plan.slots[2].sets).toBe(Math.max(1, before.snapshot.plan.slots[2].sets - 1))
  })

  it('"Mirë se u ktheve": pesha ulet një herë, jo dy; setet ulen', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11))
    await checkIn(context, '2026-11-12')
    const back = await plan(context)
    expect(back.weights.get(back.snapshot.plan.slots[0].slotId)).toMatchObject({ weightKg: 55, weekKg: 62.5 })

    await chooseLighter(context.store, '2026-11-12')
    const both = await plan(context)
    expect(both.weights.get(both.snapshot.plan.slots[0].slotId)).toMatchObject({ weightKg: 55, weekKg: 62.5 })
    expect(both.snapshot.plan.slots[2].sets).toBe(Math.max(1, back.snapshot.plan.slots[2].sets - 1))
  })

  it('vlen vetëm për datën e zgjedhur: të nesërmen seanca është e zakonshme', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(8, 11))
    await checkIn(context, '2026-11-08')
    await chooseLighter(context.store, '2026-11-08')
    context.setClock(at(9, 11))
    const next = await plan(context)
    expect(next.weights.get(next.snapshot.plan.slots[0].slotId)?.weekKg).toBeNull()
  })

  it('seanca më e lehtë nuk hyn te propozimet e peshës: njësoj si një seancë e dobët, ndryshe nga e zakonshmja', async () => {
    const proposals = async (context: Context) => (await weekWeightsView(context.store))?.rows.map((row) => row.proposal.weightKg)
    const run = async (choose: boolean, sets: { weightKg: number; reps: number }[]) => {
      const context = await lastTrainedThursday()
      context.setClock(at(8, 11))
      await checkIn(context, '2026-11-08')
      if (choose) await chooseLighter(context.store, '2026-11-08')
      await train(context, at(8, 11, 17, 15), sets)
      context.setClock(at(9, 11))
      return proposals(context)
    }
    // 100 × 5 do ta çonte e1RM-në shumë lart po të numërohej.
    const lighter = await run(true, [{ weightKg: 100, reps: 5 }])
    const normal = await run(false, [{ weightKg: 100, reps: 5 }])
    const weak = await run(false, [{ weightKg: 40, reps: 10 }])
    expect(normal).not.toEqual(lighter)
    expect(lighter).toEqual(weak)
  })
})

describe('shtyje për nesër', () => {
  async function thursday() {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11)) // e enjte, ditë stërvitjeje; e premtja është pushim
    await checkIn(context, '2026-11-12')
    return context
  }

  it('sot pushim, nesër stërvitja e radhës, objektivat e ushqimit ndjekin', async () => {
    const context = await thursday()
    const today = await todayView(context.store)
    const dayNumber = today.snapshot!.plan.dayNumber
    expect(today).toMatchObject({ mode: 'train', postponed: false, trainingDay: true })
    const trainingKcal = today.food.targetKcal

    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    const postponed = await todayView(context.store)
    expect(postponed).toMatchObject({ mode: 'rest', postponed: true, trainingDay: false, nextDate: '2026-11-13' })
    expect(postponed.food.targetKcal).toBeLessThan(trainingKcal!)
    expect(postponed.snapshot!.plan.dayNumber).toBe(dayNumber)
    expect(postponed.week.find((day) => day.date === '2026-11-12')?.state).toBe('rest')
    expect(postponed.week.find((day) => day.date === '2026-11-13')?.state).toBe('planned')
    expect(postponed.missed).toBeNull()

    // Nesër: e njëjta stërvitje, ditë stërvitjeje, pa pyetjen e ditës së humbur.
    context.setClock(at(13, 11))
    const tomorrow = await todayView(context.store)
    expect(tomorrow).toMatchObject({ mode: 'train', postponed: false, trainingDay: true, missed: null })
    expect(tomorrow.snapshot!.plan.dayNumber).toBe(dayNumber)
    expect(tomorrow.workout?.first?.name).toBe(today.workout?.first?.name)
    expect(tomorrow.food.targetKcal).toBe(trainingKcal)
  })

  it('"Ktheje për sot" kthen llojet e ditëve dhe vendimin', async () => {
    const context = await thursday()
    const before = await todayView(context.store)
    await postponeWorkout(context.store, '2026-11-12')
    expect(await undoPostpone(context.store, '2026-11-12')).toBe(true)
    const back = await todayView(context.store)
    expect(back).toMatchObject({ mode: 'train', postponed: false, trainingDay: true })
    expect(back.food.targetKcal).toBe(before.food.targetKcal)
    expect(back.week.find((day) => day.date === '2026-11-13')?.state).toBe('rest')
    expect((await nutritionDay(context.store, '2026-11-13', at(12, 11))).dayTypeManual).toBe(false)
    expect((await context.store.where('daily_states', 'date', '2026-11-12'))[0].choice).toBeNull()
  })

  it('vlen para setit të parë: një seancë e hapur pa sete hiqet, me sete s\'ka shtyrje', async () => {
    const context = await thursday()
    await startWorkout(context.store)
    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    expect((await trainingSnapshot(context.store))!.session).toBeNull()

    const other = await thursday()
    const sessionId = await startWorkout(other.store)
    const [slot] = (await trainingSnapshot(other.store))!.plan.slots
    await saveSet(other.store, { sessionId, slot, setNumber: 1, weightKg: 55, reps: 10 })
    expect(await postponeWorkout(other.store, '2026-11-12')).toBe(false)
    expect((await todayView(other.store)).mode).toBe('session')
    expect(await undoPostpone(other.store, '2026-11-12')).toBe(false)
  })
})
