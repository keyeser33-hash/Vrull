import { achievementId, achievementsView, awardAchievements, newAchievements, sessionAchievements } from './achievements'
import { createDatabase } from './db'
import { dayTargets } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } from './training'
import { waterDay } from './water'

// Arritjet në bazë (V43, SPEC §0.3c): Shortcut to Size nga e hëna 2 nëntor, ditët e hënë, e martë, e
// enjte, e premte. Java 0 (2–8 nëntor) 4 nga 4 me ushqimin dhe ujin 5 ditë; Faza 1 · Java 1 nis më 9
// nëntor me Bench Press 60 × 13 (rekordi i parë: e1RM 86,0 nga 76,7 e Javës 0).

const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`)
const PROFILE = { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }

function setup() {
  let clock = at('2026-11-02', '08:00')
  const store = createLocalStore(createDatabase(`achievements-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  return { store, setClock: (date: Date) => (clock = date) }
}

type Context = ReturnType<typeof setup>

/** Një stërvitje 21:00–22:06 me setet e ushtrimit të parë; kthen id-në e seancës. */
async function train(context: Context, date: string, sets: { weightKg: number; reps: number; rir?: number }[]) {
  context.setClock(at(date, '21:00'))
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(context.store, { sessionId, slot: first, setNumber: index + 1, ...set })
  context.setClock(at(date, '22:06'))
  await finishWorkout(context.store, sessionId)
  return sessionId
}

const eat = (context: Context, date: string, kcal: number) =>
  context.store.put('diary_entries', { date, meal: 'lunch', food_id: null, grams: 100, kcal, protein_g: 100, carbs_g: 0, fat_g: 0, logged_at: at(date, '13:00').toISOString() })
const drink = (context: Context, date: string, ml: number) => context.store.put('water_logs', { date, ml, logged_at: at(date, '12:00').toISOString() })

async function started() {
  const context = setup()
  await completeOnboarding(context.store, PROFILE, () => at('2026-11-01', '08:00'))
  await context.store.put('body_measurements', { date: '2026-11-01', weight_kg: 88 })
  return context
}

/** Java 0 e plotë: 4 nga 4; ushqimi mbi 60% dhe uji i plotë 2–6 nëntor (uji i fundit të shtunën). */
async function weekZero() {
  const context = await started()
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']) await train(context, date, [{ weightKg: 50, reps: 14, rir: 2 }])
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) {
    await eat(context, date, Math.ceil((await dayTargets(context.store, date))!.kcal * 0.6))
  }
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07']) await drink(context, date, (await waterDay(context.store, date)).targetMl!)
  return context
}

const live = async (context: Context) => (await context.store.all('achievements')).sort((a, b) => String(a.key).localeCompare(String(b.key)))

describe('dhënia e arritjeve', () => {
  it('seanca e kapërcyer nuk jep "Seanca e parë"; e para e mbyllur e jep me datën e saj, një herë', async () => {
    const context = await started()
    context.setClock(at('2026-11-02', '21:00'))
    await skipWorkout(context.store)
    expect(await awardAchievements(context.store)).toEqual([])
    await train(context, '2026-11-03', [{ weightKg: 50, reps: 14, rir: 2 }])
    context.setClock(at('2026-11-04', '09:00'))
    expect(await awardAchievements(context.store)).toEqual(['first_session'])
    expect(await awardAchievements(context.store)).toEqual([])
    const rows = await live(context)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: await achievementId(USER, 'first_session'), key: 'first_session', earned_on: '2026-11-03', user_id: USER })
  })

  it('rreshtat që serveri pranon: çelësi sipas formës, data YYYY-MM-DD, një rresht për çelës', async () => {
    const context = await weekZero()
    await train(context, '2026-11-09', [{ weightKg: 60, reps: 13 }])
    context.setClock(at('2026-11-10', '09:00'))
    await awardAchievements(context.store)
    const rows = await live(context)
    expect(rows.map((row) => row.key)).toEqual(['first_record', 'first_session', 'full_week'])
    for (const row of rows) {
      expect(String(row.key)).toMatch(/^[a-z0-9_]{1,40}$/)
      expect(String(row.earned_on)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(row.id).toBe(await achievementId(USER, row.key as never))
    }
  })

  it('java e plotë: data kur u arrit qëllimi i fundit (uji të shtunën), jo dita e dhënies', async () => {
    const context = await weekZero()
    context.setClock(at('2026-11-12', '09:00'))
    await awardAchievements(context.store)
    const rows = await live(context)
    expect(rows.find((row) => row.key === 'full_week')).toMatchObject({ earned_on: '2026-11-07' })
    // Java 0 s'ka rekord: e1RM-ja e parë e ushtrimit s'ka me çfarë të krahasohet.
    expect(rows.map((row) => row.key)).not.toContain('first_record')
  })

  it('një arritje e dhënë mbetet dhe s\'ri-datohet kur historia ndryshon', async () => {
    const context = await started()
    const sessionId = await train(context, '2026-11-02', [{ weightKg: 50, reps: 14, rir: 2 }])
    await awardAchievements(context.store)
    await context.store.remove('workout_sessions', sessionId)
    await train(context, '2026-11-05', [{ weightKg: 50, reps: 14, rir: 2 }])
    expect(await awardAchievements(context.store)).toEqual([])
    expect((await live(context))[0]).toMatchObject({ key: 'first_session', earned_on: '2026-11-02' })
  })

  it('id nga çelësi: një rresht i fshirë kthehet në vend që të dyfishohet', async () => {
    const context = await started()
    await train(context, '2026-11-02', [{ weightKg: 50, reps: 14, rir: 2 }])
    await awardAchievements(context.store)
    const id = await achievementId(USER, 'first_session')
    await context.store.remove('achievements', id)
    expect(await awardAchievements(context.store)).toEqual(['first_session'])
    const rows = await context.store.all('achievements')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id, deleted_at: null, earned_on: '2026-11-02' })
  })

  it('dy dhënie njëkohësisht shkruajnë një rresht', async () => {
    const context = await started()
    await train(context, '2026-11-02', [{ weightKg: 50, reps: 14, rir: 2 }])
    const [first, second] = await Promise.all([awardAchievements(context.store), awardAchievements(context.store)])
    expect([...first, ...second]).toEqual(['first_session'])
    expect(await live(context)).toHaveLength(1)
  })
})

describe('listat për ekranet', () => {
  it('Progresi › Arritjet: 3 nga 10, të fituarat e para, progresi i të tjerave', async () => {
    const context = await weekZero()
    await train(context, '2026-11-09', [{ weightKg: 60, reps: 13 }])
    context.setClock(at('2026-11-12', '09:00'))
    const view = await achievementsView(context.store)
    expect(view).toMatchObject({ today: '2026-11-12', earned: 3, total: 10, programmeName: 'Shortcut to Size' })
    expect(view.achievements.map((entry) => [entry.key, entry.earnedOn, entry.isNew])).toEqual([
      ['first_record', '2026-11-09', true],
      ['full_week', '2026-11-07', true],
      ['first_session', '2026-11-02', false],
      ['streak_4', null, false],
      ['records_10', null, false],
      ['phase_1', null, false],
      ['sessions_25', null, false],
      ['food_7', null, false],
      ['water_7', null, false],
      ['programme', null, false],
    ])
    const progress = Object.fromEntries(view.achievements.map((entry) => [entry.key, entry.progress]))
    expect(progress).toMatchObject({
      streak_4: { current: 1, target: 4 },
      records_10: { current: 1, target: 10 },
      phase_1: { current: 1, target: 16 },
      sessions_25: { current: 5, target: 25 },
      food_7: { current: 5, target: 7 },
      water_7: { current: 5, target: 7 },
      programme: { current: 1, target: 13 },
      full_week: { current: 3, target: 3 },
    })
    expect(view.achievements.find((entry) => entry.key === 'streak_4')?.weeks).toEqual([{ monday: '2026-11-02', done: 4, target: 4, spare: false }])
  })

  it('përmbledhja e javës: arritjet e fituara brenda javës', async () => {
    const context = await weekZero()
    await train(context, '2026-11-09', [{ weightKg: 60, reps: 13 }])
    context.setClock(at('2026-11-15', '20:30'))
    expect((await newAchievements(context.store, { since: '2026-11-09', until: '2026-11-15' })).map((entry) => entry.key)).toEqual(['first_record'])
    expect((await newAchievements(context.store, { since: '2026-11-02', until: '2026-11-08' })).map((entry) => entry.key)).toEqual(['full_week', 'first_session'])
    expect((await newAchievements(context.store, { since: '2026-11-10' })).map((entry) => entry.key)).toEqual([])
  })

  it('mbyllja: arritja që i plotësoi kjo seancë, ose më e afërta', async () => {
    const context = await weekZero()
    const record = await train(context, '2026-11-09', [{ weightKg: 60, reps: 13 }])
    expect(await sessionAchievements(context.store, record)).toMatchObject({ earned: [{ key: 'first_record', earnedOn: '2026-11-09', sessionId: record }], nearest: null })
    const plain = await train(context, '2026-11-10', [{ weightKg: 40, reps: 10 }])
    const close = await sessionAchievements(context.store, plain)
    expect(close.earned).toEqual([])
    // Më afër tani: vargu 1 nga 4 dhe 25 seanca 6 nga 25 mbeten pas ushqimit dhe ujit 5 nga 7.
    expect(close.nearest).toMatchObject({ key: 'food_7', progress: { current: 5, target: 7 } })
  })
})
