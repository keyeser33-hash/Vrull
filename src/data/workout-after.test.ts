import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, sessionSummary, startWorkout, trainingHistory, trainingSnapshot } from './training'
import { saveWorkoutAfter, validAfterSet, workoutAfter } from './workout-after'

// "E bëra, po e shënoj" (V74, V75).
const USER = '11111111-1111-4111-8111-111111111111'
// E hënë 07.12.2026, 21:00.
const START = new Date(2026, 11, 7, 21, 0)

async function setup() {
  let clock = START
  const store = createLocalStore(createDatabase(`after-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => clock)
  return { store, setClock: (next: Date) => (clock = next) }
}

describe('stërvitja e shënuar më pas', () => {
  it('pa histori: çdo set vjen nga plani, pa peshë; me peshë ruhet dhe stërvitja mbyllet', async () => {
    const { store } = await setup()
    const view = (await workoutAfter(store))!
    expect(view).toMatchObject({ dayNumber: 1, dayName: 'Gjoks, triceps, pulpa' })
    expect(view.rows).toHaveLength(9)
    const bench = view.rows[0]
    expect(bench.exercise.name).toBe('Bench Press')
    expect(bench.source).toBe('plan')
    expect(bench.sets).toHaveLength(bench.slot.sets)
    expect(bench.sets[0].weightKg).toBeNull()
    expect(validAfterSet(bench.sets[0], 'weight_reps')).toBe(false)

    // Vetëm dy ushtrimet e para u bënë.
    const done = view.rows.slice(0, 2).map((row) => ({ ...row, sets: row.sets.map((set) => ({ ...set, weightKg: 40, reps: 12 })) }))
    const sessionId = await saveWorkoutAfter(store, '2026-12-07', done)
    expect(sessionId).not.toBeNull()
    const session = await store.get('workout_sessions', sessionId!)
    expect(session).toMatchObject({ status: 'completed', date: '2026-12-07' })
    const sets = await store.where('set_logs', 'session_id', sessionId!)
    expect(sets).toHaveLength(done[0].sets.length + done[1].sets.length)
    // Radha e seteve është ajo e tabelës, dhe të gjitha bien para orës së ruajtjes.
    const ordered = [...sets].sort((a, b) => String(a.logged_at).localeCompare(String(b.logged_at)))
    expect(ordered.map((set) => `${set.position}:${set.set_number}`)).toEqual(done.flatMap((row) => row.sets.map((_, index) => `${row.slot.position}:${index + 1}`)))
    expect(String(ordered.at(-1)?.logged_at) < START.toISOString()).toBe(true)
    // Treguesi kaloi te Stërvitja 2, dhe përmbledhja nuk shpik kohëzgjatje.
    expect((await trainingSnapshot(store))?.plan.dayNumber).toBe(2)
    expect((await sessionSummary(store, sessionId!))?.durationSeconds).toBeNull()
  })

  it('herën tjetër të njëjtit ushtrim vlerat janë ato të herës së kaluar', async () => {
    const { store, setClock } = await setup()
    const first = (await workoutAfter(store))!
    await saveWorkoutAfter(store, '2026-12-07', first.rows.map((row) => ({ ...row, sets: row.sets.map((set, index) => ({ ...set, weightKg: 40, reps: 12 - index })) })))
    // Tri stërvitjet e tjera të javës mbyllen, që Stërvitja 1 të vijë sërish.
    for (let day = 0; day < 3; day++) {
      setClock(new Date(2026, 11, 8 + day, 18, 0))
      const id = await startWorkout(store)
      const snapshot = (await trainingSnapshot(store))!
      await saveSet(store, { sessionId: id, slot: snapshot.plan.slots[0], setNumber: 1, weightKg: 20, reps: 10 })
      await finishWorkout(store, id)
    }
    setClock(new Date(2026, 11, 14, 21, 0))
    const again = (await workoutAfter(store))!
    expect(again.dayNumber).toBe(1)
    const bench = again.rows.find((row) => row.exercise.name === 'Bench Press')!
    expect(bench.source).toBe('last')
    expect(bench.sets.map((set) => `${set.weightKg}×${set.reps}`).slice(0, 3)).toEqual(['40×12', '40×11', '40×10'])
  })

  it('dje: seanca merr datën e djeshme dhe setet bien në mesditë', async () => {
    const { store } = await setup()
    const view = (await workoutAfter(store))!
    const sessionId = await saveWorkoutAfter(store, '2026-12-06', [{ ...view.rows[0], sets: view.rows[0].sets.map((set) => ({ ...set, weightKg: 40, reps: 12 })) }])
    const session = await store.get('workout_sessions', sessionId!)
    expect(session).toMatchObject({ status: 'completed', date: '2026-12-06' })
    expect(String(session?.ended_at).slice(0, 10)).toBe(new Date(2026, 11, 6, 12, 0).toISOString().slice(0, 10))
    expect((await trainingHistory(store)).sets.every((set) => set.loggedAt < START.toISOString())).toBe(true)
  })

  it('seanca e hapur: setet e ruajtura mbeten, të tjerat shtohen', async () => {
    const { store } = await setup()
    const id = await startWorkout(store)
    const snapshot = (await trainingSnapshot(store))!
    await saveSet(store, { sessionId: id, slot: snapshot.plan.slots[0], setNumber: 1, weightKg: 42.5, reps: 12 })
    const view = (await workoutAfter(store))!
    expect(view.rows[0].source).toBe('saved')
    expect(view.rows[0].sets[0]).toMatchObject({ weightKg: 42.5, reps: 12 })
    const sessionId = await saveWorkoutAfter(store, '2026-12-07', [{ ...view.rows[0], sets: view.rows[0].sets.map((set) => ({ ...set, weightKg: set.weightKg ?? 42.5, reps: 12 })) }])
    expect(sessionId).toBe(id)
    expect(await store.where('set_logs', 'session_id', id)).toHaveLength(view.rows[0].sets.length)
    // Edhe seanca e hapur më parë mbyllet pa kohëzgjatje të matur.
    expect((await sessionSummary(store, id))?.durationSeconds).toBeNull()
  })

  it('pa asnjë set të plotë nuk ruhet asgjë', async () => {
    const { store } = await setup()
    const view = (await workoutAfter(store))!
    expect(await saveWorkoutAfter(store, '2026-12-07', [view.rows[0]])).toBeNull()
    expect(await store.all('workout_sessions')).toHaveLength(0)
  })
})
