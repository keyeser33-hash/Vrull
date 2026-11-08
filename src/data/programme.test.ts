import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { programmeHome, weekReview } from './programme'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } from './training'
import { acceptWeekWeights } from './week-weights'

// Ekrani Programi (bordi "Programi"): blloqet me javët, java e treguesit me ditët, datat dhe kohën,
// ushtrimi i parë me peshën e javës, dhe peshat e javës që presin vendimin. Mostra: e diel 8 nëntor,
// Faza 1 · Java 2 · Stërvitja 1, ditët e stërvitjes e diel, e hënë, e martë, e enjte.

const USER = '11111111-1111-4111-8111-111111111111'
const profile = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

async function atPhaseOneWeekTwo() {
  let clock = new Date(2026, 9, 25, 17, 0)
  const store = createLocalStore(createDatabase(`programme-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  await completeOnboarding(store, profile, () => clock)
  for (let day = 0; day < 4; day++) await skipWorkout(store) // Java 0
  clock = new Date(2026, 10, 1, 17, 0)
  const sessionId = await startWorkout(store)
  const [bench] = (await trainingSnapshot(store))!.plan.slots
  await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 60, reps: 13 })
  await finishWorkout(store, sessionId)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  clock = new Date(2026, 10, 8, 9, 0)
  return { store, now: () => clock, setClock: (date: Date) => (clock = date) }
}

describe('Programi', () => {
  it('blloqet me javët e bëra dhe java e treguesit', async () => {
    const { store, now } = await atPhaseOneWeekTwo()
    const home = (await programmeHome(store, now()))!
    expect(home).toMatchObject({ programName: 'Shortcut to Size', source: 'shortcut_to_size', completed: false, weekNumber: 3, totalWeeks: 13 })
    expect(home.blocks.map((block) => [block.name, block.weeks, block.doneWeeks, block.currentWeek])).toEqual([
      ['Java 0', 1, 1, null],
      ['Faza 1', 4, 1, 2],
      ['Faza 2', 4, 0, null],
      ['Faza 3', 4, 0, null],
    ])
    expect(home.week).toMatchObject({ blockName: 'Faza 1', blockWeeks: 4, week: 2 })
    expect(home.doneDays).toBe(0)
  })

  it('ditët e javës me datat, kohën dhe ushtrimet që i hapin', async () => {
    const { store, now } = await atPhaseOneWeekTwo()
    const home = (await programmeHome(store, now()))!
    const dates = home.days.map((day) => day.date?.toDateString())
    expect(dates).toEqual([new Date(2026, 10, 8), new Date(2026, 10, 9), new Date(2026, 10, 10), new Date(2026, 10, 12)].map((date) => date.toDateString()))
    expect(home.days.map((day) => [day.dayNumber, day.name, day.status])).toEqual([
      [1, 'Gjoks, triceps, pulpa', 'next'],
      [2, 'Shpinë, biceps, bark', 'upcoming'],
      [3, 'Shpatulla, trapez, pulpa', 'upcoming'],
      [4, 'Këmbë, bark', 'upcoming'],
    ])
    expect(home.days[0].minutes).toBe(65)
    expect(home.days[1].lead).toEqual(['Dumbbell Bent-Over Row', 'Barbell Curl'])
    expect(home.days[2].lead).toEqual(['Dumbbell Shoulder Press', 'Dumbbell Shrug'])
    expect(home.days[3].lead).toEqual(['Squat', 'Romanian Deadlift'])
    expect(home.days[0].exercises).toHaveLength(9)
  })

  it('stërvitja e radhës: ushtrimi i parë me setet, intervalin dhe peshën e javës', async () => {
    const { store, now } = await atPhaseOneWeekTwo()
    const home = (await programmeHome(store, now()))!
    expect(home.next).toMatchObject({ dayId: home.days[0].dayId, inProgress: false })
    expect(home.next?.first).toMatchObject({ name: 'Bench Press', sets: 4, target: { kind: 'reps', min: 9, max: 11 }, weightKg: 62.5 })
  })

  it('pas stërvitjes së sotme, e radha bie nesër; seanca e nisur thuhet', async () => {
    const { store, now, setClock } = await atPhaseOneWeekTwo()
    const sessionId = await startWorkout(store)
    expect((await programmeHome(store, now()))!.next?.inProgress).toBe(true)
    await finishWorkout(store, sessionId)
    setClock(new Date(2026, 10, 8, 19, 0))
    const home = (await programmeHome(store, now()))!
    expect(home.doneDays).toBe(1)
    expect(home.days[0]).toMatchObject({ status: 'done' })
    expect(home.days[1].date?.toDateString()).toBe(new Date(2026, 10, 9).toDateString())
  })

  it('peshat e javës që shqyrtohet: presin vendimin, pastaj pranuar', async () => {
    const { store, now } = await atPhaseOneWeekTwo()
    const review = (await programmeHome(store, now()))!.review!
    expect(review).toMatchObject({ week: { week: 2 }, status: 'pending', startsOn: expect.any(Date) })
    expect(review.startsOn?.toDateString()).toBe(new Date(2026, 10, 8).toDateString())
    await acceptWeekWeights(store, review.week)
    expect((await programmeHome(store, now()))!.review?.status).toBe('accepted')
  })

  it('peshat e javës për ekranin: java, e kaluara, ditët me datat, ushtrimet dhe historia', async () => {
    const { store, now } = await atPhaseOneWeekTwo()
    const review = (await weekReview(store, now()))!
    expect(review).toMatchObject({
      week: { week: 2 },
      block: { blockName: 'Faza 1', blockWeeks: 4, week: 2 },
      previous: { blockName: 'Faza 1', blockWeeks: 4, week: 1 },
      closed: true,
      headline: { target: { kind: 'reps', min: 9, max: 11 }, technique: { type: 'rest_pause' } },
    })
    expect(review.days.map((day) => [day.dayNumber, day.name, day.date?.getDate()])).toEqual([
      [1, 'Gjoks, triceps, pulpa', 8],
      [2, 'Shpinë, biceps, bark', 9],
      [3, 'Shpatulla, trapez, pulpa', 10],
      [4, 'Këmbë, bark', 12],
    ])
    const bench = review.rows.find((row) => review.exercises[row.exerciseId]?.name === 'Bench Press')!
    expect(bench).toMatchObject({ previousKg: 60, weightKg: 62.5, proposal: { basis: { kind: 'one_rm', reps: 11 } } })
    expect(review.exercises[bench.exerciseId]).toMatchObject({ equipment: 'barbell', libraryId: 'Barbell_Bench_Press_-_Medium_Grip' })
    expect(review.history.filter((set) => set.exerciseId === bench.exerciseId)).toHaveLength(1)
  })

  it('java pas treguesit: dita e parë e saj vjen pas ditëve që mbeten', async () => {
    const { store, now, setClock } = await atPhaseOneWeekTwo()
    await finishWorkout(store, await startWorkout(store))
    setClock(new Date(2026, 10, 9, 9, 0))
    const review = (await weekReview(store, now()))!
    expect(review).toMatchObject({ block: { week: 3 }, previous: { week: 2 }, closed: false, headline: { target: { min: 6, max: 8 }, technique: { type: 'drop_set' } } })
    expect(review.days[0].date?.toDateString()).toBe(new Date(2026, 10, 15).toDateString())
  })

  it('pa program aktiv: null', async () => {
    const store = createLocalStore(createDatabase(`programme-${crypto.randomUUID()}`), { userId: () => USER })
    expect(await programmeHome(store, new Date())).toBeNull()
  })
})
