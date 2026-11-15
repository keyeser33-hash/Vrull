import { dayDetail, plannedWorkout } from './day-detail'
import { createDatabase } from './db'
import { saveDailyState } from './daily-state'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { addWater } from './water'

// Fleta e ditës te Sot (V57, SPEC §0.3f): çdo datë e javës preket. E kaluara: seanca, ushqimi, uji, gjendja; e ardhmja:
// stërvitja e planifikuar (vetëm për t'u parë).
const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

async function setup() {
  let clock = at(25, 10, 9)
  const store = createLocalStore(createDatabase(`day-detail-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  await completeOnboarding(store, PROFILE, () => clock)
  return { store, setClock: (date: Date) => (clock = date) }
}

async function train(context: Awaited<ReturnType<typeof setup>>, date: Date) {
  context.setClock(date)
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  for (const setNumber of [1, 2]) await saveSet(context.store, { sessionId, slot: first, setNumber, weightKg: 50, reps: 12, rir: 2 })
  context.setClock(new Date(date.getTime() + 64 * 60_000))
  await finishWorkout(context.store, sessionId)
  return sessionId
}

describe('dayDetail', () => {
  it('dita e kaluar me seancë: stërvitja, ushqimi i arritur, uji që nuk u arrit, gjendja', async () => {
    const context = await setup()
    const sessionId = await train(context, at(26, 10, 17, 15))
    const { store } = context
    await store.put('diary_entries', { date: '2026-10-26', meal: 'lunch', food_id: null, grams: 100, kcal: 3200, protein_g: 180, carbs_g: 300, fat_g: 100, logged_at: at(26, 10, 13).toISOString() })
    await addWater(store, '2026-10-26', at(26, 10, 12))
    await saveDailyState(store, '2026-10-26', { mood: 3, energy: 3, sleepMinutes: 450, sleepQuality: 3, soreness: 0, soreGroups: [] })
    context.setClock(at(29, 10, 12))
    const detail = await dayDetail(store, '2026-10-26')
    expect(detail.session).toMatchObject({ id: sessionId, dayNumber: 1, dayName: 'Gjoks, triceps, pulpa', workSets: 2, minutes: 64, records: 0 })
    expect(detail.session?.exercises).toBe(1)
    expect(detail.food).toMatchObject({ kcal: 3200, proteinG: 180, reached: true })
    expect(detail.food?.targetKcal).toBeGreaterThan(0)
    expect(detail.water).toMatchObject({ ml: 250, reached: false })
    expect(detail.water.targetMl).toBeGreaterThan(250)
    expect(detail.readiness).toMatchObject({ percent: expect.any(Number), level: expect.stringMatching(/low|normal|high/) })
  })

  it('dita pa seancë dhe pa regjistrime: seanca null, ushqimi me 0, pa gjendje', async () => {
    const context = await setup()
    context.setClock(at(29, 10, 12))
    const detail = await dayDetail(context.store, '2026-10-28')
    expect(detail.session).toBeNull()
    expect(detail.food).toMatchObject({ kcal: 0, proteinG: 0, reached: false })
    expect(detail.water).toMatchObject({ ml: 0, reached: false })
    expect(detail.readiness).toBeNull()
  })

  it('pa peshë dhe pa objektiva: "arritur" nuk gjykohet (null)', async () => {
    const store = createLocalStore(createDatabase(`day-detail-${crypto.randomUUID()}`), { userId: () => USER, now: () => at(29, 10, 12) })
    const detail = await dayDetail(store, '2026-10-28')
    expect(detail.food?.reached ?? null).toBeNull()
    expect(detail.water.reached).toBeNull()
  })
})

describe('plannedWorkout', () => {
  it('stërvitja e radhës dhe ato pas saj sipas programit: emri, ushtrimet me setet, kohëzgjatja', async () => {
    const context = await setup()
    context.setClock(at(26, 10, 9))
    const first = await plannedWorkout(context.store, 0)
    expect(first).toMatchObject({ plan: { dayNumber: 1, dayName: 'Gjoks, triceps, pulpa' }, minutes: expect.any(Number) })
    expect(first?.exercises.length).toBeGreaterThan(3)
    expect(first?.exercises[0]).toEqual({ name: expect.any(String), sets: expect.any(Number) })
    const third = await plannedWorkout(context.store, 2)
    expect(third?.plan.dayNumber).toBe(3)
    expect(third?.plan.dayName).not.toBe(first?.plan.dayName)
  })

  it('pa program aktiv: null', async () => {
    const store = createLocalStore(createDatabase(`day-detail-${crypto.randomUUID()}`), { userId: () => USER })
    expect(await plannedWorkout(store, 0)).toBeNull()
  })
})
