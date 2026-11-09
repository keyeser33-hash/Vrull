import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { activeProgramHome } from './programme'
import { createLocalStore } from './store'
import { todayView } from './today'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { weekWeightsView, workoutWeights } from './week-weights'
import { setLighterFirstSession, welcomeBack } from './welcome-back'

// "Mirë se u ktheve" (V43, SPEC §0.3c, bordi "Kthimi"): pas 7 ditësh ose më shumë pa seancë, seanca e
// parë propozon 90% të peshës së javës (Bench Press 55 në vend të 62,5), e njëjtë te Sot, seanca,
// Programi dhe njoftimi (të gjithë lexojnë `workoutWeights`), derisa ajo seancë mbyllet.

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

function setup() {
  let clock = at(25, 10, 9)
  const store = createLocalStore(createDatabase(`welcome-back-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  return { store, setClock: (date: Date) => (clock = date) }
}

async function train(context: ReturnType<typeof setup>, date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) {
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

async function benchWeight(store: ReturnType<typeof setup>['store']) {
  const { plan } = (await trainingSnapshot(store))!
  return (await workoutWeights(store, plan)).get(plan.slots[0].slotId)
}

describe('mirë se u ktheve', () => {
  it('6 ditë pa stërvitje: asgjë, peshat e javës', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(11, 11))
    expect(await welcomeBack(context.store)).toBeNull()
    const view = await todayView(context.store)
    expect(view.welcomeBack).toBeNull()
    expect(view.workout?.first).toMatchObject({ name: 'Bench Press', weightKg: 62.5, weekKg: null })
  })

  it('7 ditë: karta, dhe seanca e parë me 90% të peshës së javës, e njëjtë kudo', async () => {
    const context = await lastTrainedThursday()
    const { store } = context
    context.setClock(at(12, 11))
    expect(await welcomeBack(store)).toEqual({ days: 7, lastSessionOn: '2026-11-05', lighter: true })
    const view = await todayView(store)
    expect(view.welcomeBack).toEqual({ days: 7, lastSessionOn: '2026-11-05', lighter: true })
    expect(view.workout?.first).toMatchObject({ name: 'Bench Press', weightKg: 55, weekKg: 62.5 })
    expect(await benchWeight(store)).toMatchObject({ weightKg: 55, weekKg: 62.5 })
    expect((await activeProgramHome(store, at(12, 11)))?.next?.first?.weightKg).toBe(55)
    // Peshat e javës te Programi mbeten ato të javës: vetëm seanca e parë ulet.
    const { plan } = (await trainingSnapshot(store))!
    const review = await weekWeightsView(store, { blockId: plan.blockId, week: plan.week })
    expect(review?.rows.find((row) => row.slotId === plan.slots[0].slotId)?.weightKg).toBe(62.5)

    // Gjatë seancës (seanca dhe njoftimi lexojnë `workoutWeights`) pesha mbetet e lehtë.
    const sessionId = await startWorkout(store)
    expect(await benchWeight(store)).toMatchObject({ weightKg: 55 })
    expect((await todayView(store)).welcomeBack).toMatchObject({ days: 7 })
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 55, reps: 11 })
    context.setClock(at(12, 11, 11, 6))
    await finishWorkout(store, sessionId)

    // Pas mbylljes: pa kartë, dhe stërvitja tjetër me peshat e javës.
    expect(await welcomeBack(store)).toBeNull()
    expect((await benchWeight(store))?.weekKg).toBeNull()
  })

  it('çelësi i fikur kthen peshat e javës, vetëm për atë datë; i ndezur kur s\'është prekur', async () => {
    const context = await lastTrainedThursday()
    const { store } = context
    context.setClock(at(15, 11, 9))
    let notified = 0
    store.subscribe(() => notified++)
    await setLighterFirstSession(store, false)
    expect(notified).toBe(1)
    expect((await todayView(store)).welcomeBack).toEqual({ days: 10, lastSessionOn: '2026-11-05', lighter: false })
    expect(await benchWeight(store)).toMatchObject({ weightKg: 62.5, weekKg: null })
    await setLighterFirstSession(store, true)
    expect(await benchWeight(store)).toMatchObject({ weightKg: 55, weekKg: 62.5 })
    await setLighterFirstSession(store, false)
    context.setClock(at(16, 11, 9))
    expect((await welcomeBack(store))?.lighter).toBe(true)
    expect(await benchWeight(store)).toMatchObject({ weightKg: 55 })
  })

  it('përdoruesi i ri, pa asnjë seancë të mbyllur: asnjë "Mirë se u ktheve"', async () => {
    const context = setup()
    await completeOnboarding(context.store, PROFILE, () => at(25, 10, 9))
    context.setClock(at(10, 11))
    expect(await welcomeBack(context.store)).toBeNull()
    expect((await todayView(context.store)).welcomeBack).toBeNull()
  })

  it('pa program me stërvitje Sot nuk e tregon', async () => {
    const context = await lastTrainedThursday()
    const [state] = await context.store.all('program_state')
    await context.store.put('program_state', { id: state.id, completed_at: at(6, 11).toISOString() })
    context.setClock(at(20, 11))
    expect(await welcomeBack(context.store)).toMatchObject({ days: 15 })
    expect((await todayView(context.store)).welcomeBack).toBeNull()
  })
})
