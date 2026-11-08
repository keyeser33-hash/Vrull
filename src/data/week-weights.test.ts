import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } from './training'
import { acceptWeekWeights, changeWeekWeight, postponeWeekWeights, weekWeightsView } from './week-weights'

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
