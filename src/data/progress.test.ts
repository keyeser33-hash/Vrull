import { createDatabase } from './db'
import { logTemplateMeal } from './nutrition'
import { measurementsOn, metricHistory, progressStart, progressView, saveMeasurement, trainingProgress } from './progress'
import { completeOnboarding } from './profile'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'
const setup = () => createLocalStore(createDatabase(`progress-${crypto.randomUUID()}`), { userId: () => USER })

describe('matjet e progresit', () => {
  it('matja e një dite ruhet në një rresht; fushat e tjera mbeten; null e heq vlerën', async () => {
    const store = setup()
    await saveMeasurement(store, '2026-12-08', { weight_kg: 80.4, waist_cm: 84 })
    await saveMeasurement(store, '2026-12-08', { arm_left_cm: 38.5, waist_cm: null })
    expect(await store.where('body_measurements', 'date', '2026-12-08')).toHaveLength(1)
    expect(await measurementsOn(store, '2026-12-08')).toMatchObject({ weight_kg: 80.4, arm_left_cm: 38.5, waist_cm: null })
  })

  it('pamja: pesha me mesataren 7-ditore dhe ndryshimin në 4 javë; perimetrat me vlerën e fundit', async () => {
    const store = setup()
    for (const [date, weight] of [['2026-11-01', 82], ['2026-11-03', 82.4], ['2026-12-01', 80.2], ['2026-12-05', 80.6], ['2026-12-08', 80]] as const) {
      await saveMeasurement(store, date, { weight_kg: weight })
    }
    await saveMeasurement(store, '2026-11-03', { waist_cm: 86 })
    await saveMeasurement(store, '2026-12-08', { waist_cm: 84.5 })
    const view = await progressView(store)
    expect(view.weight.latest).toEqual({ date: '2026-12-08', value: 80.3 })
    expect(view.weight.change).toEqual({ from: { date: '2026-11-03', value: 82.2 }, delta: -1.9 })
    expect(view.weight.points).toHaveLength(5)
    const waist = view.metrics.find((entry) => entry.metric.key === 'waist_cm')!
    expect(waist).toMatchObject({ latest: { date: '2026-12-08', value: 84.5 }, change: { delta: -1.5 } })
    expect(view.metrics.find((entry) => entry.metric.key === 'neck_cm')).toMatchObject({ latest: null, change: null })
    expect((await metricHistory(store, 'waist_cm')).map((point) => point.value)).toEqual([86, 84.5])
  })

  it('forca, volumi dhe ushqimi nga stërvitjet dhe ditari', async () => {
    let clock = Date.parse('2026-12-07T18:00:00')
    const store = createLocalStore(createDatabase(`progress-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date((clock += 60_000)) })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))
    const sessionId = await startWorkout(store)
    const snapshot = (await trainingSnapshot(store))!
    const [first] = snapshot.plan.slots
    await saveSet(store, { sessionId, slot: first, setNumber: 1, weightKg: 60, reps: 12 })
    await saveSet(store, { sessionId, slot: first, setNumber: 2, weightKg: 62.5, reps: 10 })
    await finishWorkout(store, sessionId)
    await logTemplateMeal(store, '2026-12-07', 'lunch')
    const progress = await trainingProgress(store, new Date('2026-12-08T12:00:00'))
    expect(progress.strength).toEqual([expect.objectContaining({ name: snapshot.exercises[first.exerciseId].name, latest: { date: '2026-12-07', value: 84 }, change: null })])
    expect(progress.volume.map((row) => [row.group.name, row.thisWeek])).toEqual([['Gjoksi', 2]])
    expect(progress.compliance.map((day) => day.date)).toEqual(['2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08'])
    expect(progress.compliance[5]).toEqual({ date: '2026-12-07', kcal: 495, target: 3625 })
    expect(progress.compliance[6]).toEqual({ date: '2026-12-08', kcal: 0, target: null })
  })
})

// Bordi "Gjendje · Bosh": Progresi pa asgjë për të treguar, para setit të parë.
describe('Progresi bosh', () => {
  const onboard = (store: ReturnType<typeof setup>) =>
    completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))

  it('pa të dhëna, ose vetëm me peshën e hapave të parë, është bosh dhe e tregon peshën', async () => {
    const store = setup()
    expect(await progressStart(store)).toEqual({ empty: true, weightKg: null })
    await onboard(store)
    expect(await progressStart(store)).toEqual({ empty: true, weightKg: 80 })
    // Pesha e po asaj dite ndryshon, por mbetet një pikë: ende pa grafik.
    await saveMeasurement(store, '2026-12-01', { weight_kg: 80.4 })
    expect(await progressStart(store)).toEqual({ empty: true, weightKg: 80.4 })
  })

  it('një pikë e dytë peshe, një perimetër, një foto ose një set e mbushin', async () => {
    const withSecondWeight = setup()
    await onboard(withSecondWeight)
    await saveMeasurement(withSecondWeight, '2026-12-02', { weight_kg: 79.9 })
    expect((await progressStart(withSecondWeight)).empty).toBe(false)

    const withWaist = setup()
    await onboard(withWaist)
    await saveMeasurement(withWaist, '2026-12-01', { waist_cm: 84 })
    expect((await progressStart(withWaist)).empty).toBe(false)

    const withPhoto = setup()
    await onboard(withPhoto)
    await withPhoto.put('progress_photos', { date: '2026-12-01', pose: 'front', storage_path: `${USER}/a.jpg`, width: 1, height: 1, bytes: 1 })
    expect((await progressStart(withPhoto)).empty).toBe(false)

    const withSet = setup()
    await onboard(withSet)
    const sessionId = await startWorkout(withSet)
    const [first] = (await trainingSnapshot(withSet))!.plan.slots
    await saveSet(withSet, { sessionId, slot: first, setNumber: 1, weightKg: 60, reps: 12 })
    expect((await progressStart(withSet)).empty).toBe(false)
  })

  it('një set i fshirë nuk e mbush', async () => {
    const store = setup()
    await onboard(store)
    const sessionId = await startWorkout(store)
    const [first] = (await trainingSnapshot(store))!.plan.slots
    const set = await saveSet(store, { sessionId, slot: first, setNumber: 1, weightKg: 60, reps: 12 })
    await store.remove('set_logs', set.id)
    expect((await progressStart(store)).empty).toBe(true)
  })
})
