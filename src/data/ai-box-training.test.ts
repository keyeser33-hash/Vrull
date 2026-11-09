import { closestName, logSets, resolveSets, workoutContext } from './ai-box-training'
import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { i18nFor } from '@/i18n'

// Setet nga kutia e AI-së (V2-E2-14; bordi V22-Kutia-Setet): stërvitjet e kontekstit, rekordi dhe regjistrimi.
const USER = '11111111-1111-4111-8111-111111111111'
const sq = i18nFor('sq')

async function setup() {
  let now = new Date('2026-11-16T21:00:00')
  const store = createLocalStore(createDatabase(`ai-box-sets-${crypto.randomUUID()}`), { userId: () => USER, now: () => now })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => now)
  // E hëna: Stërvitja 1 me një set bench 57,5 × 10, e mbyllur.
  const sessionId = await startWorkout(store)
  const first = (await trainingSnapshot(store))!.plan.slots[0]
  await saveSet(store, { sessionId, slot: first, setNumber: 1, weightKg: 57.5, reps: 10 })
  await finishWorkout(store, sessionId)
  now = new Date('2026-11-17T22:40:00')
  return { store, sessionId, first, setNow: (date: Date) => (now = date) }
}

describe('stërvitjet e kontekstit', () => {
  it('e radha pa seancë dhe seanca e djeshme me ushtrimet e saj', async () => {
    const { store, sessionId } = await setup()
    const { workouts, refs } = await workoutContext(store, '2026-11-17', sq)
    expect(workouts.map((workout) => [workout.ref, workout.date, workout.status])).toEqual([
      ['w1', null, 'next'],
      ['w2', '2026-11-16', 'done'],
    ])
    expect(workouts[1].label).toMatch(/^Stërvitja 1 · /)
    expect(workouts[1].exercises.length).toBeGreaterThan(3)
    expect(refs.workouts.get('w2')).toMatchObject({ sessionId, date: '2026-11-16' })
    // Referencat e ushtrimeve janë të njëjta në gjithë listën.
    expect(new Set(workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.ref))).size).toBe(workouts.reduce((sum, workout) => sum + workout.exercises.length, 0))
  })

  it('emri më i afërt: i njëjti, pastaj ai që fillon me të, pastaj me të gjitha fjalët', () => {
    const items = [{ name: 'Ring Dips' }, { name: 'Dips - Triceps Version' }, { name: 'Dips - Chest Version' }, { name: 'Barbell Bench Press' }]
    expect(closestName(items, 'dips')?.name).toBe('Dips - Chest Version')
    expect(closestName(items, 'Bench Press')?.name).toBe('Barbell Bench Press')
    expect(closestName(items, 'Squat')).toBeNull()
  })
})

describe('setet', () => {
  it('bench dje: rekordi kundrejt historisë, setet vazhdojnë pas setit të ruajtur; dips pret "Po, si shtesë"', async () => {
    const { store, sessionId, first } = await setup()
    const { workouts, refs } = await workoutContext(store, '2026-11-17', sq)
    const bench = workouts[1].exercises.find((exercise) => refs.exercises.get(exercise.ref)!.slotId === first.slotId)!
    const { exercises, unmatched } = await resolveSets(
      store,
      [
        { said: 'bench 3×10 me 60 kg', workoutRef: 'w2', exerciseRef: bench.ref, exerciseName: bench.name, sets: [1, 2, 3].map(() => ({ reps: 10, weightKg: 60, rir: null })), day: -1 },
        { said: 'dips 3×12', workoutRef: 'w2', exerciseRef: null, exerciseName: 'Dips', sets: [1, 2, 3].map(() => ({ reps: 12, weightKg: null, rir: null })), day: -1 },
        { said: 'xyz', workoutRef: 'w2', exerciseRef: null, exerciseName: 'Qwerty Lift', sets: [{ reps: 5, weightKg: 20, rir: null }], day: -1 },
      ],
      refs,
      '2026-11-17',
    )
    expect(unmatched).toEqual(['xyz'])
    const [benchRow, dips] = exercises
    // 60 × (1 + 10/30) = 80,0 kg; ishte 57,5 × (1 + 10/30) = 76,7 kg.
    expect(benchRow).toMatchObject({ date: '2026-11-16', e1rmKg: 80, previousBestKg: 76.7, record: true })
    expect(dips).toMatchObject({ slot: null, extra: false, exerciseName: 'Dips - Chest Version', e1rmKg: null })

    // Pa "Po, si shtesë", dips nuk regjistrohet.
    expect(await logSets(store, exercises, refs)).toBe(3)
    const rows = await store.where('set_logs', 'session_id', sessionId)
    expect(rows.filter((row) => row.slot_id === first.slotId).map((row) => Number(row.set_number)).sort()).toEqual([1, 2, 3, 4])
    expect(rows.some((row) => row.slot_id == null)).toBe(false)

    expect(await logSets(store, [{ ...dips, extra: true }], refs)).toBe(3)
    // Radha e `where` nuk është garantuar (id të rastit): renditet sipas setit.
    const extras = (await store.where('set_logs', 'session_id', sessionId)).filter((row) => row.slot_id == null).sort((a, b) => Number(a.set_number) - Number(b.set_number))
    expect(extras.map((row) => [Number(row.set_number), Number(row.reps), row.weight_kg ?? null])).toEqual([
      [1, 12, null],
      [2, 12, null],
      [3, 12, null],
    ])
    const exercise = await store.get('exercises', String(extras[0].exercise_id))
    expect(exercise?.name).toBe('Dips - Chest Version')
  })

  it('stërvitja e radhës dje: seanca me datën e djeshme mbyllet dhe programi kalon te e radha', async () => {
    const { store, setNow } = await setup()
    setNow(new Date('2026-11-19T09:00:00'))
    const before = (await trainingSnapshot(store))!.pointer
    const { workouts, refs } = await workoutContext(store, '2026-11-19', sq)
    const next = workouts.find((workout) => workout.status === 'next')!
    const { exercises } = await resolveSets(store, [{ said: 'dje', workoutRef: next.ref, exerciseRef: next.exercises[0].ref, exerciseName: next.exercises[0].name, sets: [{ reps: 8, weightKg: 40, rir: 2 }], day: -1 }], refs, '2026-11-19')
    expect(exercises[0].date).toBe('2026-11-18')
    expect(await logSets(store, exercises, refs)).toBe(1)
    const session = (await store.all('workout_sessions')).find((row) => row.date === '2026-11-18')!
    expect(session).toMatchObject({ status: 'completed', day_id: before.dayId })
    expect((await trainingSnapshot(store))!.pointer.dayId).not.toBe(before.dayId)
  })
})
