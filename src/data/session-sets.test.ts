import { notificationSteps } from '@/lib/session-notification'
import { pendingSegment } from '@/program/next-set'
import { previewEdit } from '@/progress/history'
import { sessionSetRecords } from '@/progress/records'
import { createDatabase } from './db'
import { editSet } from './history'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, skipWorkout, startWorkout, trainingHistory, trainingSnapshot, undoSet } from './training'
import { workoutWeights } from './week-weights'

// Setet e seancës së re (SPEC §0.3g, V58): "Zhbëj" heq setin e sapo ruajtur (ose vetëm segmentin e tij),
// rekordet dhe njoftimi i seancës e rillogarisin nga setet; çdo set i një ushtrimi tjetër ndryshohet
// gjatë seancës dhe rekordet e atij ushtrimi ndjekin ndryshimin. Store i vërtetë mbi IndexedDB në memorie.

const USER = '11111111-1111-4111-8111-111111111111'
const profile = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

/** Faza 1 · Java 2 · Stërvitja 1 me seancën e hapur; Java 1: Bench Press 60 × 13, Incline Bench Press 50 × 12. */
async function openSession() {
  let clock = new Date(2026, 10, 2, 18, 0)
  const store = createLocalStore(createDatabase(`session-sets-${crypto.randomUUID()}`), {
    userId: () => USER,
    now: () => (clock = new Date(clock.getTime() + 1000)),
  })
  await completeOnboarding(store, profile, () => clock)
  for (let day = 0; day < 4; day++) await skipWorkout(store)
  const first = await startWorkout(store)
  const [bench, incline] = (await trainingSnapshot(store))!.plan.slots
  await saveSet(store, { sessionId: first, slot: bench, setNumber: 1, weightKg: 60, reps: 13 })
  await saveSet(store, { sessionId: first, slot: incline, setNumber: 1, weightKg: 50, reps: 12 })
  await finishWorkout(store, first)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  clock = new Date(2026, 10, 8, 17, 15)
  const sessionId = await startWorkout(store)
  return { store, sessionId, bench, incline }
}

async function steps(store: Awaited<ReturnType<typeof openSession>>['store']) {
  const snapshot = (await trainingSnapshot(store))!
  const history = await trainingHistory(store)
  const weights = await workoutWeights(store, snapshot.plan)
  return notificationSteps({ snapshot: { ...snapshot, session: snapshot.session! }, history, weights }).steps
}

describe('"Zhbëj" te seanca', () => {
  it('heq setin: seanca, rekordet dhe njoftimi e kthejnë te seti që u zhbë; fshirja e butë arrin serverin', async () => {
    const { store, sessionId, bench } = await openSession()
    const saved = await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    expect(sessionSetRecords((await trainingHistory(store)).sets, sessionId).has(saved.id)).toBe(true)
    expect((await steps(store))[0]).toMatchObject({ slotId: bench.slotId, setNumber: 2 })

    await undoSet(store, saved.id)

    expect((await trainingSnapshot(store))!.session!.sets).toEqual([])
    expect(sessionSetRecords((await trainingHistory(store)).sets, sessionId).size).toBe(0)
    expect((await steps(store))[0]).toMatchObject({ slotId: bench.slotId, setNumber: 1, weightKg: 62.5 })
    expect(await store.get('set_logs', saved.id, { deleted: true })).toMatchObject({ deleted_at: expect.any(String) })
  })

  it('pas "Zhbëj", seti tjetër me të njëjtat vlera është rekordi i ri, si të mos ishte bërë i pari', async () => {
    const { store, sessionId, bench } = await openSession()
    const first = await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    await undoSet(store, first.id)
    const again = await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    expect(again.id).not.toBe(first.id)
    const records = sessionSetRecords((await trainingHistory(store)).sets, sessionId)
    expect(records.get(again.id)).toMatchObject({ kind: 'e1rm', e1rmKg: expect.closeTo(87.5, 5) })
  })

  it('pas segmentit "Zhbëj" heq vetëm segmentin: seti mbetet dhe pret segmentin përsëri', async () => {
    const { store, sessionId, bench } = await openSession()
    for (const setNumber of [1, 2, 3]) await saveSet(store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps: 10 })
    const last = await saveSet(store, { sessionId, slot: bench, setNumber: 4, weightKg: 62.5, reps: 10, technique: 'rest_pause' })
    await saveSet(store, { id: last.id, sessionId, slot: bench, setNumber: 4, weightKg: 62.5, reps: 10, technique: 'rest_pause', segments: [{ weightKg: 62.5, reps: 4 }] })

    await undoSet(store, last.id, { segment: true })

    const { plan, session } = (await trainingSnapshot(store))!
    expect(session!.sets).toHaveLength(4)
    expect(session!.sets.at(-1)).toMatchObject({ id: last.id, reps: 10, segments: [] })
    expect(pendingSegment(plan, session!.sets)?.set.id).toBe(last.id)
    expect((await steps(store))[0]).toMatchObject({ setNumber: 4, segment: 'rest_pause' })
  })

  it('një set që s\'ekziston më nuk prish asgjë', async () => {
    const { store } = await openSession()
    await expect(undoSet(store, 'nuk-ekziston')).resolves.toBeUndefined()
  })

  it('"Ruaj setin" me id të dhënë nga ekrani (që seti të shfaqet para bazës) e mban atë id', async () => {
    const { store, sessionId, bench } = await openSession()
    const saved = await saveSet(store, { newId: 'nga-ekrani', sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 9 })
    expect(saved.id).toBe('nga-ekrani')
    // Një set që ekziston (p.sh. nga njoftimi) ndryshohet, nuk dyfishohet: id-ja e re nuk përdoret.
    const twice = await saveSet(store, { newId: 'e-dyta', sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 10 })
    expect(twice.id).toBe('nga-ekrani')
    expect(await store.where('set_logs', 'session_id', sessionId)).toHaveLength(1)
  })
})

describe('ndryshimi i një seti të një ushtrimi tjetër gjatë seancës', () => {
  it('rekordi i ushtrimit të kaluar rillogaritet; ushtrimi në ekran nuk preket', async () => {
    const { store, sessionId, bench, incline } = await openSession()
    // Bench Press i bërë: seti 1 rekord (62,5 × 12 → e1RM 87,5 > 86,0), seti 2 jo.
    const record = await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    const second = await saveSet(store, { sessionId, slot: bench, setNumber: 2, weightKg: 62.5, reps: 10 })
    // Incline Bench Press në ekran, seti 1 rekord (52,5 × 12 → 73,5 > 70,0).
    const current = await saveSet(store, { sessionId, slot: incline, setNumber: 1, weightKg: 52.5, reps: 12 })
    let history = (await trainingHistory(store)).sets
    expect([...sessionSetRecords(history, sessionId).keys()].sort()).toEqual([current.id, record.id].sort())

    // Parapamja e fletës "Ndrysho setin" (si te historiku): 60 × 10 nuk është më rekord.
    expect(previewEdit(history, record.id, { weightKg: 60, reps: 10, rir: null })).toEqual({ e1rmKg: expect.closeTo(80, 5), record: null })
    await editSet(store, record.id, { weightKg: 60, reps: 10, rir: null })

    history = (await trainingHistory(store)).sets
    const records = sessionSetRecords(history, sessionId)
    expect(records.has(record.id)).toBe(false)
    expect(records.get(current.id)).toMatchObject({ kind: 'e1rm', e1rmKg: expect.closeTo(73.5, 5) })
    // Seti 2 (62,5 × 10) nuk ishte rekord pas 62,5 × 12; tani është pesha më e madhe për 10 përsëritje (§6).
    expect(records.get(second.id)).toEqual({ kind: 'weight', weightKg: 62.5, reps: 10 })
    expect(records.size).toBe(2)
  })

  it('ndryshimi i ngre setin te rekordi: parapamja dhe rekordet e seancës e thonë njësoj', async () => {
    const { store, sessionId, bench } = await openSession()
    const set = await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 60, reps: 10 })
    const history = (await trainingHistory(store)).sets
    expect(previewEdit(history, set.id, { weightKg: 65, reps: 10, rir: null }).record).toMatchObject({ e1rmKg: expect.closeTo(86.67, 2), gainKg: expect.closeTo(0.67, 2) })
    await editSet(store, set.id, { weightKg: 65, reps: 10, rir: null })
    expect(sessionSetRecords((await trainingHistory(store)).sets, sessionId).get(set.id)).toMatchObject({ kind: 'e1rm' })
  })
})
