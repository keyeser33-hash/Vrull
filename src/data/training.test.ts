import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import {
  ensureShortcutToSize,
  finishWorkout,
  replaceExerciseForBlock,
  restartProgram,
  saveSet,
  skipWorkout,
  startWorkout,
  switchProgram,
  programView,
  setExerciseVideo,
  trainingHistory,
  trainingSnapshot,
} from './training'

const USER = '11111111-1111-4111-8111-111111111111'

// Ora lokale e telefonit, e njëjtë në çdo zonë kohore: e hënë 07.12.2026, 18:00.
const START = new Date(2026, 11, 7, 18, 0)
const minutesAfterStart = (minutes: number) => new Date(START.getTime() + minutes * 60_000).toISOString()

function setup() {
  const db = createDatabase(`training-${crypto.randomUUID()}`)
  let clock = START
  const store = createLocalStore(db, { userId: () => USER, now: () => clock })
  return { db, store, now: () => clock, advanceMinutes: (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000)) }
}

const profile = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

async function onboarded() {
  const context = setup()
  await completeOnboarding(context.store, profile, context.now)
  return context
}

const names = (snapshot: Awaited<ReturnType<typeof trainingSnapshot>>) =>
  snapshot?.plan.slots.map((slot) => snapshot.exercises[slot.exerciseId].name)

describe('programi i plotë pas hyrjes së parë', () => {
  it('Shortcut to Size me ushtrimet, te Java 0 · Stërvitja 1', async () => {
    const { store } = await onboarded()
    const snapshot = await trainingSnapshot(store)
    expect(snapshot).toMatchObject({ programName: 'Shortcut to Size', label: 'Java 0', completed: false, session: null })
    expect(snapshot?.plan).toMatchObject({ dayNumber: 1, dayName: 'Gjoks, triceps, pulpa' })
    expect(names(snapshot)).toEqual([
      'Bench Press',
      'Incline Bench Press',
      'Incline Dumbbell Flye',
      'Cable Crossover',
      'Triceps Pressdown',
      'Lying Triceps Extension',
      'Cable Overhead Triceps Extension',
      'Standing Calf Raise',
      'Seated Calf Raise',
    ])
    expect(snapshot?.exercises[snapshot.plan.slots[0].exerciseId]).toMatchObject({
      equipment: 'barbell',
      tracking: 'weight_reps',
      primary: ['pectoralis_major_sternocostal'],
    })
  })

  it('plotëson skeletin e versionit 0.2.0 pa dyfishuar blloqet, ditët ose treguesin', async () => {
    const { store, db } = setup()
    const program = await store.put('programs', { name: 'Shortcut to Size', source: 'shortcut_to_size' })
    const blocks = []
    for (const [position, [name, weeks]] of ([['Java 0', 1], ['Faza 1', 4], ['Faza 2', 4], ['Faza 3', 4]] as const).entries()) {
      blocks.push(await store.put('program_blocks', { program_id: program.id, position, name, weeks }))
    }
    const days = []
    for (const [position, name] of ['Gjoks, triceps, pulpa', 'Shpinë, biceps, bark', 'Shpatulla, trapez, pulpa', 'Këmbë, bark'].entries()) {
      days.push(await store.put('program_days', { program_id: program.id, position, name }))
    }
    await store.put('program_state', { program_id: program.id, run: 1, block_id: blocks[1].id, week: 2, day_id: days[2].id })
    await store.put('user_settings', { active_program_id: program.id, onboarded_at: '2026-12-01T10:00:00.000Z' })
    const mine = await store.put('exercises', { name: 'dumbbell shoulder press', equipment: 'dumbbell', primary_muscles: ['deltoid_anterior'] })

    await ensureShortcutToSize(store)
    await ensureShortcutToSize(store)

    expect(await db.program_blocks.count()).toBe(4)
    expect(await db.program_days.count()).toBe(4)
    expect(await db.program_state.count()).toBe(1)
    expect(await db.program_slots.count()).toBe(34)
    const snapshot = await trainingSnapshot(store)
    expect(snapshot).toMatchObject({ label: 'Faza 1 · Java 2', plan: { dayNumber: 3 } })
    expect(snapshot?.plan.slots[0].exerciseId).toBe(mine.id)
    expect(await db.exercises.count()).toBe(66)
  })
})

describe('një stërvitje', () => {
  it('nis, regjistron setet dhe vazhdon pas ndërprerjes', async () => {
    const { store, advanceMinutes } = await onboarded()
    const sessionId = await startWorkout(store)
    expect(await startWorkout(store)).toBe(sessionId)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    advanceMinutes(3)
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 47.5, reps: 13, rir: 2 })

    const snapshot = await trainingSnapshot(store)
    expect(snapshot?.session).toMatchObject({ id: sessionId, startedAt: minutesAfterStart(0) })
    expect(snapshot?.session?.sets).toEqual([
      expect.objectContaining({ slotId: bench.slotId, setNumber: 1, weightKg: 47.5, reps: 13, rir: 2, technique: 'none' }),
    ])
  })

  it('i njëjti set i ruajtur dy herë (p.sh. dy prekje) mbetet një set', async () => {
    const { store } = await onboarded()
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 2, weightKg: 50, reps: 12 })
    await saveSet(store, { sessionId, slot: bench, setNumber: 2, weightKg: 52.5, reps: 11 })
    const sets = (await trainingSnapshot(store))!.session!.sets
    expect(sets.map((set) => [set.setNumber, set.weightKg, set.reps])).toEqual([[2, 52.5, 11]])
  })

  it('setet dalin sipas kohës kur u bënë', async () => {
    const { store, advanceMinutes } = await onboarded()
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    for (const setNumber of [1, 2, 3]) {
      advanceMinutes(2)
      await saveSet(store, { id: `00000000-0000-4000-8000-00000000000${4 - setNumber}`, sessionId, slot: bench, setNumber, weightKg: 50, reps: 12 })
    }
    expect((await trainingSnapshot(store))!.session!.sets.map((set) => set.setNumber)).toEqual([1, 2, 3])
  })

  it('një set i ndryshuar nuk krijon set të dytë; segmentet ruhen te seti', async () => {
    const { store, advanceMinutes } = await onboarded()
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    const set = await saveSet(store, { sessionId, slot: bench, setNumber: 3, weightKg: 50, reps: 9, technique: 'drop_set' })
    advanceMinutes(1)
    await saveSet(store, { id: set.id, sessionId, slot: bench, setNumber: 3, weightKg: 50, reps: 9, technique: 'drop_set', segments: [{ weightKg: 40, reps: 5 }] })
    const sets = (await trainingSnapshot(store))!.session!.sets
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ technique: 'drop_set', segments: [{ weightKg: 40, reps: 5 }], loggedAt: set.loggedAt })
  })

  it('mbyllja e çon treguesin te stërvitja tjetër dhe seanca mbetet në histori', async () => {
    const { store, db, advanceMinutes } = await onboarded()
    const sessionId = await startWorkout(store)
    advanceMinutes(55)
    await finishWorkout(store, sessionId)
    const snapshot = await trainingSnapshot(store)
    expect(snapshot).toMatchObject({ label: 'Java 0', plan: { dayNumber: 2 }, session: null })
    expect(await db.workout_sessions.get(sessionId)).toMatchObject({
      status: 'completed',
      date: '2026-12-07',
      ended_at: minutesAfterStart(55),
      week: 1,
      run: 1,
    })
  })

  it('"Kapërce këtë stërvitje" kalon përpara dhe e shënon si të kapërcyer', async () => {
    const { store, db } = await onboarded()
    await skipWorkout(store)
    expect((await trainingSnapshot(store))?.plan.dayNumber).toBe(2)
    expect((await db.workout_sessions.toArray()).map((session) => session.status)).toEqual(['skipped'])
  })
})

describe('fundi i programit dhe programet e tjera', () => {
  it('pas stërvitjes së fundit: "Përfunduar"; rinisja nga Faza 1 hap një xhiro të re', async () => {
    const { store } = await onboarded()
    for (let workout = 0; workout < 13 * 4; workout++) await skipWorkout(store)
    const done = await trainingSnapshot(store)
    expect(done).toMatchObject({ completed: true, session: null })
    const faza1 = done!.blocks.find((block) => block.name === 'Faza 1')!
    await restartProgram(store, faza1.id)
    expect(await trainingSnapshot(store)).toMatchObject({ completed: false, label: 'Faza 1 · Java 1', plan: { run: 2, dayNumber: 1 } })
  })

  it('ndërrimi i programit ruan treguesin e secilit', async () => {
    const { store } = await onboarded()
    await skipWorkout(store)
    const sts = (await trainingSnapshot(store))!.programId
    const other = await store.put('programs', { name: 'Forca', source: 'custom' })
    const block = await store.put('program_blocks', { program_id: other.id, position: 0, name: 'Blloku 1', weeks: 4 })
    await store.put('program_days', { program_id: other.id, position: 0, name: 'Dita A' })
    void block
    await switchProgram(store, other.id)
    expect(await trainingSnapshot(store)).toMatchObject({ programName: 'Forca', label: 'Blloku 1 · Java 1', plan: { dayName: 'Dita A' } })
    await switchProgram(store, sts)
    expect(await trainingSnapshot(store)).toMatchObject({ programName: 'Shortcut to Size', plan: { dayNumber: 2 } })
  })
})

describe('"Ndrysho ushtrimin për këtë fazë"', () => {
  it('vlen për të gjitha javët e bllokut, jo për blloqet e tjera', async () => {
    const { store } = await onboarded()
    const before = (await trainingSnapshot(store))!
    const incline = before.plan.slots[1]
    await replaceExerciseForBlock(store, { plan: before.plan, slotId: incline.slotId, library: { id: 'Smith_Machine_Incline_Bench_Press', name: 'Smith Machine Incline Bench Press', equipment: 'machine', primary: ['chest'], secondary: ['shoulders', 'triceps'] } })
    const after = (await trainingSnapshot(store))!
    const replaced = after.exercises[after.plan.slots[1].exerciseId]
    expect(replaced).toMatchObject({
      name: 'Smith Machine Incline Bench Press',
      libraryId: 'Smith_Machine_Incline_Bench_Press',
      tracking: 'weight_reps',
      primary: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor'],
    })
    // Java 0 është blloku i tanishëm; Faza 1 mban ushtrimin e programit.
    for (let workout = 0; workout < 4; workout++) await skipWorkout(store)
    const faza1 = (await trainingSnapshot(store))!
    expect(faza1.label).toBe('Faza 1 · Java 1')
    expect(faza1.exercises[faza1.plan.slots[1].exerciseId].name).toBe('Incline Bench Press')
  })

  it('te barku, ku ushtrimi ndryshon çdo javë, vlen vetëm për javët ku ishte ushtrimi', async () => {
    const { store } = await onboarded()
    for (let workout = 0; workout < 4 + 4 + 4 + 3; workout++) await skipWorkout(store) // Faza 1 · Java 3 · Stërvitja 4
    const week3 = (await trainingSnapshot(store))!
    expect(week3).toMatchObject({ label: 'Faza 1 · Java 3', plan: { dayNumber: 4 } })
    const woodchopper = week3.plan.slots[7]
    expect(week3.exercises[woodchopper.exerciseId].name).toBe('Cable Woodchopper')
    await replaceExerciseForBlock(store, { plan: week3.plan, slotId: woodchopper.slotId, exerciseId: week3.plan.slots[6].exerciseId })
    expect(names(await trainingSnapshot(store))?.[7]).toBe('Cable Crunch')
    for (let workout = 0; workout < 4; workout++) await skipWorkout(store)
    expect(names(await trainingSnapshot(store))?.[7]).toBe('Plank')
  })
})

describe('historia për peshat dhe rikuperimin', () => {
  it('setet me bllokun dhe javën e tyre; seancat e mbyllura me muskujt kryesorë', async () => {
    const { store, advanceMinutes } = await onboarded()
    const sessionId = await startWorkout(store)
    const [bench, incline] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 47.5, reps: 12, rir: 3 })
    await saveSet(store, { sessionId, slot: incline, setNumber: 1, weightKg: 30, reps: 13 })
    advanceMinutes(50)
    await finishWorkout(store, sessionId)
    await skipWorkout(store)
    const open = await startWorkout(store)
    const [row] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId: open, slot: row, setNumber: 1, weightKg: 20, reps: 12 })

    const history = await trainingHistory(store)
    expect(history.sets.find((entry) => entry.exerciseId === bench.exerciseId)).toMatchObject({
      sessionId,
      run: 1,
      blockPosition: 0,
      blockName: 'Java 0',
      blockWeeks: 1,
      week: 1,
      setNumber: 1,
      weightKg: 47.5,
      reps: 12,
      rir: 3,
      isWarmup: false,
    })
    expect(history.sets).toHaveLength(3)
    // Radha e muskujve nuk ka rëndësi; dy setet u ruajtën në të njëjtin moment.
    expect(history.worked.map((session) => ({ ...session, primaryKeys: [...session.primaryKeys].sort() }))).toEqual([
      {
        endedAt: minutesAfterStart(50),
        primaryKeys: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal'],
      },
    ])
    expect(history.weightSteps).toMatchObject({})
    expect(history.overrides).toEqual({})
  })
})

describe('pamja e programit dhe ushtrimet', () => {
  it('java e parë me gjendjen e çdo stërvitjeje dhe ecuria e xhiros', async () => {
    const { store } = await onboarded()
    const sessionId = await startWorkout(store)
    await finishWorkout(store, sessionId)
    await skipWorkout(store)
    const view = await programView(store)
    expect(view?.programName).toBe('Shortcut to Size')
    expect(view?.overview.weeks[0].days.map((day) => day.status)).toEqual(['done', 'skipped', 'next', 'upcoming'])
    expect(view?.overview).toMatchObject({ currentWeek: 0, doneWorkouts: 1, totalWorkouts: 52 })
    const plan = view!.plan(view!.overview.weeks[1].blockId, 1, view!.overview.weeks[1].days[0].dayId)
    expect(view!.exercises[plan.slots[0].exerciseId].name).toBe('Bench Press')
    expect(plan.slots[0].sets).toBe(4)
  })

  it('videoja e ushtrimit ruhet dhe hiqet', async () => {
    const { store } = await onboarded()
    const view = (await programView(store))!
    const bench = Object.values(view.exercises).find((exercise) => exercise.name === 'Bench Press')!
    await setExerciseVideo(store, bench.id, 'https://youtu.be/dQw4w9WgXcQ')
    expect((await programView(store))!.exercises[bench.id].videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ')
    await setExerciseVideo(store, bench.id, null)
    expect((await programView(store))!.exercises[bench.id].videoUrl).toBeNull()
  })
})
