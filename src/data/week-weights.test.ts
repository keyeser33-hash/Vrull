import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { programmeHome } from './programme'
import { createLocalStore } from './store'
import { todayView } from './today'
import { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } from './training'
import { acceptWeekWeights, changeWeekWeight, postponeWeekWeights, weekWeightsView, workoutWeights } from './week-weights'

const USER = '11111111-1111-4111-8111-111111111111'
const profile = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

/** Shortcut to Size te Faza 1 · Java 2 · Stërvitja 1, me Bench Press 60 × 13 te Java 1. */
async function atPhaseOneWeekTwo() {
  let clock = new Date(2026, 10, 2, 18, 0)
  const store = createLocalStore(createDatabase(`week-weights-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  await completeOnboarding(store, profile, () => clock)
  for (let day = 0; day < 4; day++) await skipWorkout(store) // Java 0
  const sessionId = await startWorkout(store)
  const [bench] = (await trainingSnapshot(store))!.plan.slots
  await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 60, reps: 13 })
  await finishWorkout(store, sessionId)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  clock = new Date(2026, 10, 8, 18, 0)
  return { store, bench }
}

describe('peshat e javës në telefon (V23)', () => {
  it('java që shqyrtohet për programin aktiv, me peshat e propozuara', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const view = await weekWeightsView(store)
    expect(view).toMatchObject({ label: 'Faza 1 · Java 2', run: 1 })
    expect(view?.rows.find((row) => row.slotId === bench.slotId)).toMatchObject({ weightKg: 62.5, target: { min: 9, max: 11 }, decision: null })
  })

  it('"Prano të gjitha" ruhet: java mban peshat e pranuara', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const { week } = (await weekWeightsView(store))!
    await acceptWeekWeights(store, week)
    const row = (await weekWeightsView(store, week))?.rows.find((candidate) => candidate.slotId === bench.slotId)
    expect(row).toMatchObject({ weightKg: 62.5, decision: { status: 'accepted', weightKg: 62.5 } })
  })

  it('një peshë e ndryshuar mbetet pas "Prano të gjitha", me një rresht për slotin', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const { week } = (await weekWeightsView(store))!
    await acceptWeekWeights(store, week)
    await changeWeekWeight(store, week, bench.slotId, 65)
    await acceptWeekWeights(store, week)
    const row = (await weekWeightsView(store, week))?.rows.find((candidate) => candidate.slotId === bench.slotId)
    expect(row).toMatchObject({ weightKg: 65, proposal: { weightKg: 62.5 }, decision: { status: 'changed' } })
    expect((await store.all('week_weights')).filter((saved) => saved.slot_id === bench.slotId)).toHaveLength(1)
  })

  it('"Më vonë" mban peshën e javës së kaluar; vendimi vlen vetëm për atë javë', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const { week } = (await weekWeightsView(store))!
    await postponeWeekWeights(store, week)
    const benchOf = async (at: typeof week) => (await weekWeightsView(store, at))?.rows.find((candidate) => candidate.slotId === bench.slotId)
    expect(await benchOf(week)).toMatchObject({ weightKg: 60, proposal: { weightKg: 62.5 }, decision: { status: 'postponed' } })
    expect(await benchOf({ ...week, week: 3 })).toMatchObject({ decision: null })
  })

  it('vendimi vlen vetëm për bllokun e vet, jo për të njëjtën javë të bllokut tjetër', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const { week } = (await weekWeightsView(store))!
    await acceptWeekWeights(store, week)
    const phaseTwo = [...(await trainingSnapshot(store))!.blocks].sort((a, b) => a.position - b.position)[2]
    const row = (await weekWeightsView(store, { blockId: phaseTwo.id, week: 2 }))?.rows.find((candidate) => candidate.slotId === bench.slotId)
    expect(row).toMatchObject({ decision: null })
  })

  it('pa program aktiv ose me një bllok që s\'ekziston: asnjë javë', async () => {
    const empty = createLocalStore(createDatabase(`week-weights-${crypto.randomUUID()}`), { userId: () => USER })
    expect(await weekWeightsView(empty)).toBeNull()
    const { store } = await atPhaseOneWeekTwo()
    expect(await weekWeightsView(store, { blockId: 'nuk-ekziston', week: 1 })).toBeNull()
  })

  it('një slot që s\'është në javë nuk ndryshohet', async () => {
    const { store } = await atPhaseOneWeekTwo()
    const { week } = (await weekWeightsView(store))!
    await expect(changeWeekWeight(store, week, 'nuk-ekziston', 50)).rejects.toThrow('Ushtrimi nuk është në këtë javë.')
  })

  it('vendimi i një xhiroje tjetër të programit (pas rinisjes) nuk vlen', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const view = (await weekWeightsView(store))!
    await store.put('week_weights', {
      program_id: view.programId,
      run: 2,
      block_id: view.week.blockId,
      week: view.week.week,
      slot_id: bench.slotId,
      exercise_id: bench.exerciseId,
      weight_kg: 40,
      status: 'accepted',
    })
    expect((await weekWeightsView(store))?.rows.find((row) => row.slotId === bench.slotId)).toMatchObject({ weightKg: 62.5, decision: null })
  })
})

describe('një peshë e javës për slotin: Sot, seanca, Programi dhe Peshat e javës (V2-E1-18)', () => {
  /** Pesha e javës e slotit sipas çdo leximi, me kohëzgjatjen e stërvitjes. */
  async function readings(store: Awaited<ReturnType<typeof atPhaseOneWeekTwo>>['store'], slotId: string) {
    const snapshot = (await trainingSnapshot(store))!
    const [today, home, session, review] = await Promise.all([
      todayView(store),
      programmeHome(store, store.now()),
      workoutWeights(store, snapshot.plan),
      weekWeightsView(store, { blockId: snapshot.plan.blockId, week: snapshot.plan.week }),
    ])
    return {
      today: today.workout?.first?.weightKg,
      programme: home?.next?.first?.weightKg,
      session: session.get(slotId)?.weightKg,
      review: review?.rows.find((row) => row.slotId === slotId)?.weightKg,
      minutes: { today: today.workout?.minutes, programme: home?.days.find((day) => day.dayId === snapshot.plan.dayId)?.minutes },
    }
  }

  it('pa vendim: propozimi i §7 kudo, me të njëjtën kohëzgjatje', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    expect(await readings(store, bench.slotId)).toEqual({ today: 62.5, programme: 62.5, session: 62.5, review: 62.5, minutes: { today: 65, programme: 65 } })
  })

  it('me vendim "changed": pesha e ndryshuar kudo; sloti pa vendim mban propozimin', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const plan = (await trainingSnapshot(store))!.plan
    await changeWeekWeight(store, { blockId: plan.blockId, week: plan.week }, bench.slotId, 65)
    expect(await readings(store, bench.slotId)).toMatchObject({ today: 65, programme: 65, session: 65, review: 65 })
    const incline = plan.slots[1]
    const weights = await workoutWeights(store, plan)
    expect(weights.get(incline.slotId)).toMatchObject({ decision: null })
    expect(weights.get(incline.slotId)?.weightKg).toBe((await weekWeightsView(store, { blockId: plan.blockId, week: plan.week }))?.rows.find((row) => row.slotId === incline.slotId)?.weightKg)
  })

  it('vetëm slotet me peshë të stërvitjes së dhënë', async () => {
    const { store } = await atPhaseOneWeekTwo()
    const { plan, exercises } = (await trainingSnapshot(store))!
    const weighted = plan.slots.filter((slot) => exercises[slot.exerciseId]?.tracking === 'weight_reps').map((slot) => slot.slotId)
    expect([...(await workoutWeights(store, plan)).keys()]).toEqual(weighted)
  })

  it('seanca e hapur nuk e lëviz peshën e javës: Sot dhe Programi thonë atë që tha seti i parë', async () => {
    const { store, bench } = await atPhaseOneWeekTwo()
    const sessionId = await startWorkout(store)
    // 62,5 × 13 jep e1RM 89,6: pa këtë rregull propozimi do të bëhej 65 kg në mes të seancës.
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 13 })
    expect(await readings(store, bench.slotId)).toMatchObject({ today: 62.5, programme: 62.5, session: 62.5, review: 62.5 })
    await finishWorkout(store, sessionId)
    // Pas mbylljes seti hyn te historia: Java 3 (6–8) nis nga e1RM 89,6 → 70,7 → 70 kg.
    const next = (await weekWeightsView(store))!
    expect(next.label).toBe('Faza 1 · Java 3')
    expect(next.rows.find((row) => row.slotId === bench.slotId)?.weightKg).toBe(70)
  })
})
