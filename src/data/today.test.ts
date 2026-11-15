import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { calendarWeek, mainGroup, nextTrainingDate, todayView } from './today'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'

const USER = '11111111-1111-4111-8111-111111111111'

// Ora lokale e telefonit, e njëjtë në çdo zonë kohore (bordi "Sot": e diel 8 nëntor 2026).
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const SUNDAY = at(8, 11)

describe('java kalendarike te Sot', () => {
  it('nga e hëna te e diela: e bërë, pushim sipas ditëve të stërvitjes, sot e shënuar', () => {
    const done = [
      { date: '2026-11-02', id: 'h' },
      { date: '2026-11-03', id: 'm' },
      { date: '2026-11-05', id: 'e' },
      { date: '2026-10-29', id: 'java-e-kaluar' },
    ]
    const week = calendarWeek(SUNDAY, [7, 1, 2, 4], done)
    expect(week.map((day) => [day.date, day.weekday, day.day, day.state, day.today, day.sessionId])).toEqual([
      ['2026-11-02', 1, 2, 'done', false, 'h'],
      ['2026-11-03', 2, 3, 'done', false, 'm'],
      ['2026-11-04', 3, 4, 'rest', false, null],
      ['2026-11-05', 4, 5, 'done', false, 'e'],
      ['2026-11-06', 5, 6, 'rest', false, null],
      ['2026-11-07', 6, 7, 'rest', false, null],
      ['2026-11-08', 7, 8, 'planned', true, null],
    ])
  })

  it('një seancë e bërë në ditë pushimi del e bërë; java nis të hënën edhe kur sot është e hënë', () => {
    // Dy seanca në të njëjtën ditë: dita hap të fundit.
    const week = calendarWeek(at(9, 11), [1], [
      { date: '2026-11-11', id: 'e-para' },
      { date: '2026-11-11', id: 'e-fundit' },
    ])
    expect(week[2].sessionId).toBe('e-fundit')
    expect(week[0]).toMatchObject({ date: '2026-11-09', state: 'planned', today: true })
    expect(week[2]).toMatchObject({ date: '2026-11-11', state: 'done', today: false })
    expect(week[6]).toMatchObject({ date: '2026-11-15', state: 'rest' })
  })

  it('llojet e ditëve me dorë (stërvitja e shtyrë, dita e humbur) mbizotërojnë ditët e profilit; seanca e bërë dhe dita e humbur mbizotërojnë llojin', () => {
    // Sot e diel është ditë stërvitjeje e profilit, por u shty: sot pushim, e mërkura (pushim në profil) stërvitje.
    const moved = calendarWeek(SUNDAY, [7, 1, 2, 4], [], () => false, { '2026-11-08': 'rest', '2026-11-04': 'training' })
    expect(moved.map((day) => [day.date, day.state])).toEqual([
      ['2026-11-02', 'planned'],
      ['2026-11-03', 'planned'],
      ['2026-11-04', 'planned'],
      ['2026-11-05', 'planned'],
      ['2026-11-06', 'rest'],
      ['2026-11-07', 'rest'],
      ['2026-11-08', 'rest'],
    ])
    const done = calendarWeek(SUNDAY, [7], [{ date: '2026-11-08', id: 's' }], (date) => date === '2026-11-03', { '2026-11-08': 'rest', '2026-11-03': 'training' })
    expect(done[6]).toMatchObject({ state: 'done', sessionId: 's' })
    expect(done[1].state).toBe('missed')
  })

  it('dita e radhës e stërvitjes pas sotme; pa ditë stërvitjeje, asnjë', () => {
    expect(nextTrainingDate(at(7, 11), [7, 1, 2, 4])).toBe('2026-11-08')
    expect(nextTrainingDate(SUNDAY, [7, 1, 2, 4])).toBe('2026-11-09')
    expect(nextTrainingDate(at(5, 11), [4])).toBe('2026-11-12')
    expect(nextTrainingDate(SUNDAY, [])).toBeNull()
  })
})

describe('grupi kryesor i stërvitjes', () => {
  const exercises = {
    bench: { primary: ['pectoralis_major_sternocostal'] },
    incline: { primary: ['pectoralis_major_clavicular'] },
    pressdown: { primary: ['triceps_brachii'] },
    mystery: { primary: ['nuk_ekziston'] },
  }
  const slots = (...ids: string[]) => ids.map((exerciseId) => ({ exerciseId }))

  it('grupi i ushtrimit të parë, me çelësat kryesorë të gjithë stërvitjes brenda tij', () => {
    expect(mainGroup(slots('bench', 'incline', 'pressdown'), exercises)).toEqual({
      group: expect.objectContaining({ id: 'gjoksi' }),
      keys: ['pectoralis_major_sternocostal', 'pectoralis_major_clavicular'],
    })
  })

  it('kapërcen ushtrimin pa muskuj të njohur; pa asnjë, null', () => {
    expect(mainGroup(slots('mystery', 'pressdown'), exercises)?.group.id).toBe('tricepsi')
    expect(mainGroup(slots('mystery'), exercises)).toBeNull()
    expect(mainGroup([], exercises)).toBeNull()
  })
})

// Programi i bordit: Shortcut to Size nga e diela 25 tetor, me ditët D, H, M, E.
function setup() {
  const db = createDatabase(`today-${crypto.randomUUID()}`)
  let clock = SUNDAY
  const store = createLocalStore(db, { userId: () => USER, now: () => clock })
  return { store, setClock: (date: Date) => (clock = date) }
}

const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

/** Një stërvitje e plotë në një datë: setet e ushtrimit të parë, pastaj mbyllja. */
async function train(context: ReturnType<typeof setup>, date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) {
  context.setClock(date)
  const { store } = context
  const sessionId = await startWorkout(store)
  const snapshot = await trainingSnapshot(store)
  const [first] = snapshot!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(store, { sessionId, slot: first, setNumber: index + 1, ...set })
  context.setClock(new Date(date.getTime() + 66 * 60_000))
  await finishWorkout(store, sessionId)
}

/** Java 0 dhe Java 1 e Fazës 1, si te bordi: Bench Press 60 × 13 → e1RM 86,0. */
async function boardWeek() {
  const context = setup()
  context.setClock(at(25, 10, 9))
  await completeOnboarding(context.store, PROFILE, () => at(25, 10, 9))
  const java0 = [{ weightKg: 50, reps: 14, rir: 2 }]
  for (const day of [25, 26, 27, 29]) await train(context, at(day, 10, 17, 15), java0)
  await train(context, at(1, 11, 17, 15), [
    { weightKg: 60, reps: 13 },
    { weightKg: 60, reps: 12 },
    { weightKg: 60, reps: 11 },
    { weightKg: 60, reps: 10 },
  ])
  for (const day of [2, 3, 5]) await train(context, at(day, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
  context.setClock(SUNDAY)
  return context
}

describe('pamja e Sot nga baza lokale', () => {
  it('dita e stërvitjes së bordit: Faza 1 · Java 2 · Stërvitja 1, java, pesha e Bench Press dhe proteina', async () => {
    const { store } = await boardWeek()
    await store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_1', food_id: null, grams: 100, kcal: 300, protein_g: 20, carbs_g: 30, fat_g: 10, logged_at: SUNDAY.toISOString() })
    await store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_2', food_id: null, grams: 100, kcal: 200, protein_g: 18, carbs_g: 10, fat_g: 5, logged_at: SUNDAY.toISOString() })
    const view = await todayView(store)
    expect(view.mode).toBe('train')
    expect(view.firstEver).toBe(false)
    expect(view.snapshot?.plan).toMatchObject({ blockName: 'Faza 1', week: 2, dayNumber: 1, dayName: 'Gjoks, triceps, pulpa' })
    expect(view.workout).toMatchObject({
      theme: 'chest',
      exercises: 9,
      sets: 30,
      minutes: 65,
      loggedSets: 0,
      focus: { group: expect.objectContaining({ id: 'gjoksi' }), keys: ['pectoralis_major_sternocostal', 'pectoralis_major_clavicular'] },
      recovery: 'gati',
      first: { name: 'Bench Press', tracking: 'weight_reps', weightKg: 62.5, target: expect.objectContaining({ kind: 'reps', min: 9, max: 11 }) },
    })
    expect(view.week.map((day) => day.state)).toEqual(['done', 'done', 'rest', 'done', 'rest', 'rest', 'planned'])
    const sessions = await store.all('workout_sessions')
    expect(view.week[0].sessionId).toBe(sessions.find((row) => row.date === '2026-11-02')?.id)
    expect(view.week[6].today).toBe(true)
    expect(view.nextDate).toBe('2026-11-09')
    expect(view.protein.eatenG).toBe(38)
    expect(view.protein.targetG).toBeGreaterThan(0)
  })

  it('ritmi i ditës: vaktet e orarit me orët, të ngrënat me kcal dhe proteinë, zgjimi, gjumi dhe çasti i tanishëm', async () => {
    const { store } = await boardWeek()
    await store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_1', food_id: null, grams: 100, kcal: 300, protein_g: 20, carbs_g: 30, fat_g: 10, logged_at: SUNDAY.toISOString() })
    await store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_1', food_id: null, grams: 100, kcal: 100, protein_g: 8, carbs_g: 10, fat_g: 5, logged_at: SUNDAY.toISOString() })
    const view = await todayView(store)
    expect(view.wakeTime).toBe('07:00')
    expect(view.sleepTime).toBe('23:00')
    // 10:00 nga mesnata e ditës së ushqimit.
    expect(view.nowMinutes).toBe(600)
    // Ditë stërvitjeje 17:15: vakti para 15 min më parë, pas stërvitjes 15 min pas mbarimit, darka 1 orë pas tij (V62).
    expect(view.meals.map((meal) => `${meal.time} ${meal.meal}`)).toEqual([
      '07:00 breakfast_1',
      '07:45 breakfast_2',
      '10:30 snack_am',
      '13:00 lunch',
      '15:30 snack_pm',
      '17:00 pre_workout',
      '18:35 post_workout',
      '19:35 dinner',
      '22:30 bedtime',
    ])
    expect(view.meals[0]).toEqual({ meal: 'breakfast_1', time: '07:00', minutes: 420, eaten: true, kcal: 400, proteinG: 28 })
    expect(view.meals.filter((meal) => meal.eaten)).toHaveLength(1)
  })

  it('pesha e javës e zgjedhur nga përdoruesi vlen para propozimit', async () => {
    const { store } = await boardWeek()
    const { changeWeekWeight } = await import('./week-weights')
    const snapshot = await trainingSnapshot(store)
    await changeWeekWeight(store, { blockId: snapshot!.plan.blockId, week: 2 }, snapshot!.plan.slots[0].slotId, 65)
    expect((await todayView(store)).workout?.first?.weightKg).toBe(65)
  })

  it('e shtuna pa stërvitje: ditë pushimi, e radhës e diela', async () => {
    const context = await boardWeek()
    context.setClock(at(7, 11))
    const view = await todayView(context.store)
    expect(view.mode).toBe('rest')
    expect(view.nextDate).toBe('2026-11-08')
    expect(view.week[5]).toMatchObject({ date: '2026-11-07', state: 'rest', today: true })
    expect(view.workout?.first?.name).toBe('Bench Press')
  })

  it('seanca e hapur: setet e ruajtura dhe ushtrimi ku mbeti', async () => {
    const context = await boardWeek()
    const { store } = context
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    let view = await todayView(store)
    expect(view.mode).toBe('session')
    expect(view.workout).toMatchObject({ loggedSets: 1, sets: 30, first: { name: 'Bench Press' } })
    // Vetëm një seancë e mbyllur e bën ditën të bërë.
    expect(view.week[6]).toMatchObject({ state: 'planned', today: true })
    for (const setNumber of [2, 3, 4]) await saveSet(store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps: 10 })
    view = await todayView(store)
    expect(view.workout).toMatchObject({ loggedSets: 4, first: { name: 'Incline Bench Press' } })
  })

  it('pas mbylljes së sotme: e kryer për sot, dita e sotme e bërë, e radhës e hëna', async () => {
    const context = await boardWeek()
    await train(context, at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    context.setClock(at(8, 11, 19, 0))
    const view = await todayView(context.store)
    expect(view.mode).toBe('done')
    expect(view.week[6]).toMatchObject({ state: 'done', today: true })
    expect(view.snapshot?.plan.dayNumber).toBe(2)
    expect(view.nextDate).toBe('2026-11-09')
    // Gjoksi u punua sot: i lodhur deri pas 48 orësh.
    expect(view.workout).toMatchObject({ theme: 'back', focus: { group: expect.objectContaining({ id: 'shpina' }) } })
  })

  it('dita e humbur pyet pas ndërrimit të ditës së ushqimit (V46), jo në mesnatë', async () => {
    const context = await boardWeek()
    await train(context, at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    await train(context, at(9, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
    // E mërkura 02:30: zgjimi 07:00, dita e ushqimit ndërrohet në 04:00; e marta ende po vazhdon.
    context.setClock(at(11, 11, 2, 30))
    let view = await todayView(context.store)
    expect(view.missed).toBeNull()
    expect(view.week[1]).toMatchObject({ date: '2026-11-10' })
    expect(view.week[1].state).not.toBe('missed')
    context.setClock(at(11, 11, 4, 30))
    view = await todayView(context.store)
    expect(view.missed).toMatchObject({ date: '2026-11-10' })
    expect(view.week[1].state).toBe('missed')
  })

  it('para setit të parë: Java 0, pa peshë të sugjeruar', async () => {
    const context = setup()
    await completeOnboarding(context.store, PROFILE, () => SUNDAY)
    const view = await todayView(context.store)
    expect(view.mode).toBe('train')
    expect(view.firstEver).toBe(true)
    expect(view.snapshot?.label).toBe('Java 0')
    expect(view.workout).toMatchObject({ exercises: 9, first: { name: 'Bench Press', weightKg: null, target: expect.objectContaining({ min: 12, max: 15 }) } })
    expect(view.week.every((day) => day.state !== 'done')).toBe(true)
  })

  it('programi i përfunduar dhe pa program aktiv', async () => {
    const context = await boardWeek()
    const [state] = await context.store.all('program_state')
    await context.store.put('program_state', { id: state.id, completed_at: SUNDAY.toISOString() })
    expect((await todayView(context.store)).mode).toBe('completed')

    const empty = setup()
    const view = await todayView(empty.store)
    expect(view).toMatchObject({ mode: 'none', snapshot: null, workout: null, firstEver: true })
    expect(view.week).toHaveLength(7)
  })
})
