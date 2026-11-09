import { createDatabase } from './db'
import { dayTargets } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { waterDay } from './water'
import { weekGoalsView, weekSummary } from './weekly-goals'

// Qëllimet e javës në bazë (V43, SPEC §0.3c; bordet "Qëllimet", "Java", "Java-Rezerva"): Shortcut to Size
// nga e hëna 2 nëntor, ditët e hënë, e martë, e enjte, e premte në 21:00, zgjimi 08:20 (dita e ushqimit
// ndërrohet në 05:20, V46). Java 1 (2–8 nëntor): Java 0, 4 nga 4. Java 2 (9–15): Faza 1, 3 nga 4, e
// premtja pa seancë. Java 3 (16–22) është e tanishmja.

const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`)
const PROFILE = { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }

function setup() {
  let clock = at('2026-11-02', '08:00')
  const store = createLocalStore(createDatabase(`weekly-goals-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  return { store, setClock: (date: Date) => (clock = date) }
}

type Context = ReturnType<typeof setup>

/** Një stërvitje 21:00–22:06 me setet e ushtrimit të parë. */
async function train(context: Context, date: string, sets: { weightKg: number; reps: number; rir?: number }[]) {
  context.setClock(at(date, '21:00'))
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(context.store, { sessionId, slot: first, setNumber: index + 1, ...set })
  context.setClock(at(date, '22:06'))
  await finishWorkout(context.store, sessionId)
}

const eat = (context: Context, date: string, kcal: number, proteinG: number, loggedAt = at(date, '13:00')) =>
  context.store.put('diary_entries', { date, meal: 'lunch', food_id: null, grams: 100, kcal, protein_g: proteinG, carbs_g: 0, fat_g: 0, logged_at: loggedAt.toISOString() })
const drink = (context: Context, date: string, ml: number) => context.store.put('water_logs', { date, ml, logged_at: at(date, '12:00').toISOString() })

/** Kaloritë që e bëjnë ditën të numëruar (60% e objektivit të saj), dhe pak nën to. */
async function kcalTarget(context: Context, date: string) {
  return (await dayTargets(context.store, date))!.kcal
}

async function twoWeeks() {
  const context = setup()
  await completeOnboarding(context.store, PROFILE, () => at('2026-11-02', '08:00'))
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']) await train(context, date, [{ weightKg: 50, reps: 14, rir: 2 }])
  // Faza 1 · Java 1: Bench Press 60 × 13 (rekord: e1RM 86,0 nga 76,7), pastaj dy stërvitje pa rekord.
  await train(context, '2026-11-09', [
    { weightKg: 60, reps: 13 },
    { weightKg: 60, reps: 12 },
  ])
  await train(context, '2026-11-10', [{ weightKg: 40, reps: 10 }])
  await train(context, '2026-11-12', [{ weightKg: 40, reps: 10 }])
  // Java 2: pesha 88,4 dhe 88,8 (para ushqimit, se objektivat ndjekin peshën), ushqimi 5 ditë mbi 60%, uji 4 ditë.
  await context.store.put('body_measurements', { date: '2026-11-09', weight_kg: 88.4 })
  await context.store.put('body_measurements', { date: '2026-11-14', weight_kg: 88.8 })
  for (const date of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) await eat(context, date, Math.ceil((await kcalTarget(context, date)) * 0.6), 150)
  await eat(context, '2026-11-14', 1000, 60)
  for (const date of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']) await drink(context, date, (await waterDay(context.store, date)).targetMl!)
  await drink(context, '2026-11-13', 1000)
  return context
}

describe('qëllimet e javës së tanishme', () => {
  it('e enjtja e javës 3: 2 nga 4, ditët, dita rezervë e Fazës 1 e përdorur, vargu 2 javë', async () => {
    const context = await twoWeeks()
    await train(context, '2026-11-16', [{ weightKg: 40, reps: 10 }])
    await train(context, '2026-11-17', [{ weightKg: 60, reps: 12 }])
    const target = await kcalTarget(context, '2026-11-19')
    await eat(context, '2026-11-19', Math.round(target * 0.54), 90)
    context.setClock(at('2026-11-19', '10:00'))
    const view = await weekGoalsView(context.store)
    expect(view).toMatchObject({ monday: '2026-11-16', sunday: '2026-11-22', today: '2026-11-19', foodToday: '2026-11-19', streak: 2, complete: false })
    expect(view.training).toMatchObject({ done: 2, target: 4, met: false })
    expect(view.training.days.map((day) => [day.weekday, day.day, day.state, day.today])).toEqual([
      [1, 16, 'done', false],
      [2, 17, 'done', false],
      [3, 18, 'rest', false],
      [4, 19, 'planned', true],
      [5, 20, 'planned', false],
      [6, 21, 'rest', false],
      [7, 22, 'rest', false],
    ])
    expect(view.food?.counted).toBe(0)
    expect(view.food?.days[3]).toMatchObject({ date: '2026-11-19', state: 'partial', percent: 54 })
    expect(view.water).toMatchObject({ goal: 5, counted: 0 })
    expect(view.spare).toMatchObject({ blockName: 'Faza 1', run: 1, used: { monday: '2026-11-09', date: '2026-11-13' }, wouldCover: false })
  })

  it('e shtuna e javës 2 me 3 nga 4: dita rezervë e lirë do ta mbulonte, dhe kur mbaron faza', async () => {
    const context = await twoWeeks()
    context.setClock(at('2026-11-14', '10:00'))
    const view = await weekGoalsView(context.store)
    expect(view.training).toMatchObject({ done: 3, target: 4, met: false })
    expect(view.training.days[4]).toMatchObject({ date: '2026-11-13', state: 'missed' })
    expect(view.streak).toBe(1)
    // Faza 1 ka edhe 13 stërvitje (Java 1 · Stërvitja 4, pastaj javët 2–4): e fundit e hënë 7 dhjetor.
    expect(view.spare).toMatchObject({ blockName: 'Faza 1', used: null, wouldCover: true, endsOn: '2026-12-13' })
    expect(view.food).toMatchObject({ counted: 5, met: true })
    expect(view.water).toMatchObject({ counted: 4, met: false })
  })

  it('pa profil: pa qëllimet e ushqimit dhe ujit, pa ditë rezervë', async () => {
    const context = setup()
    context.setClock(at('2026-11-11'))
    const view = await weekGoalsView(context.store)
    expect(view).toMatchObject({ food: null, water: null, spare: null, streak: 0, complete: false })
    expect(view.training).toMatchObject({ done: 0, target: 4 })
  })
})

describe('përmbledhja e javës', () => {
  it('java 2 e mbyllur: qëllimet me ditën rezervë, stërvitja, rekordet, ushqimi, uji, pesha dhe java tjetër', async () => {
    const context = await twoWeeks()
    context.setClock(at('2026-11-16', '10:00'))
    const summary = (await weekSummary(context.store, '2026-11-09'))!
    expect(summary).toMatchObject({
      monday: '2026-11-09',
      sunday: '2026-11-15',
      closed: true,
      programWeek: { blockName: 'Faza 1', blockWeeks: 4, week: 1, run: 1 },
      spare: { blockName: 'Faza 1', date: '2026-11-13' },
      streak: 2,
    })
    expect(summary.goals.training).toEqual({ done: 3, target: 4, met: true })
    expect(summary.goals.food).toMatchObject({ counted: 5, met: true })
    expect(summary.goals.water).toMatchObject({ counted: 4, met: false })
    expect(summary.goals.complete).toBe(false)
    expect(summary.trainingDays.map((day) => day.state)).toEqual(['done', 'done', 'rest', 'done', 'spare', 'rest', 'rest'])
    expect(summary.training).toMatchObject({ sessions: 3, workSets: 4, minutes: 198 })
    expect(summary.training.records.count).toBe(1)
    expect(summary.training.records.top).toHaveLength(1)
    expect(summary.training.records.top[0]).toMatchObject({ name: 'Bench Press', e1rmKg: 86 })
    expect(summary.training.records.top[0].gainKg).toBeCloseTo(86 - 50 * (1 + 16 / 30), 5)
    expect(summary.food.averageProteinG).toBe(150)
    expect(summary.food.averageKcal).toBeGreaterThan(1500)
    expect(summary.water.averageMl).toBe(Math.round((3 * 3500 + 3000 + 1000) / 5))
    expect(summary.weight).toEqual({ averageKg: 88.6, changeKg: 0.6 })
    expect(summary.next).toMatchObject({ date: '2026-11-16', time: '21:00', plan: { blockName: 'Faza 1', week: 1, dayNumber: 4 } })
    expect(summary.next?.minutes).toBeGreaterThan(0)
  })

  it('java e tanishme e dielën në mbrëmje llogaritet si do të mbyllej; java tjetër nis të hënën', async () => {
    const context = await twoWeeks()
    context.setClock(at('2026-11-15', '20:00'))
    const summary = (await weekSummary(context.store, '2026-11-09'))!
    expect(summary).toMatchObject({ closed: false, spare: { date: '2026-11-13' }, streak: 2 })
    expect(summary.goals.training.met).toBe(true)
    expect(summary.next).toMatchObject({ date: '2026-11-16', plan: { dayNumber: 4 } })
  })

  it('dita e ushqimit (V46): vakti pas mesnate i përket së dielës, që mbetet e hapur deri në 05:20', async () => {
    const context = await twoWeeks()
    // E diela 15 nëntor: 50% e objektivit gjatë ditës, pjesa tjetër e hënën 00:30, me datën e së dielës.
    const sunday = await kcalTarget(context, '2026-11-15')
    await eat(context, '2026-11-15', Math.ceil(sunday * 0.3), 20)
    context.setClock(at('2026-11-16', '01:00'))
    let summary = (await weekSummary(context.store, '2026-11-09'))!
    expect(summary.goals.food?.days[6]).toMatchObject({ date: '2026-11-15', state: 'partial' })
    let current = await weekGoalsView(context.store)
    expect(current).toMatchObject({ monday: '2026-11-16', today: '2026-11-16', foodToday: '2026-11-15' })
    expect(current.food?.days[0].state).toBe('upcoming')
    await eat(context, '2026-11-15', Math.ceil(sunday * 0.3), 20, at('2026-11-16', '00:30'))
    summary = (await weekSummary(context.store, '2026-11-09'))!
    expect(summary.goals.food).toMatchObject({ counted: 6 })
    expect(summary.goals.food?.days[6].state).toBe('counted')
    context.setClock(at('2026-11-16', '06:00'))
    current = await weekGoalsView(context.store)
    expect(current.food?.days[0].state).toBe('partial')
  })

  it('ushqimi: mesatarja në ditët e regjistruara (≥ 50%, si kontrolli javor), jo vetëm në ditët e qëllimit', async () => {
    const context = await twoWeeks()
    // Java 3: e hëna 80%, e marta 55% (e regjistruar, jo e numëruar te qëllimi), e mërkura 30% (jo).
    const kcal = { '2026-11-16': 0.8, '2026-11-17': 0.55, '2026-11-18': 0.3 } as const
    const eaten: number[] = []
    for (const [date, share] of Object.entries(kcal)) {
      eaten.push(Math.round((await kcalTarget(context, date)) * share))
      await eat(context, date, eaten.at(-1)!, date === '2026-11-18' ? 40 : 100 + eaten.length * 20)
    }
    context.setClock(at('2026-11-23', '10:00'))
    const summary = (await weekSummary(context.store, '2026-11-16'))!
    expect(summary.goals.food).toMatchObject({ counted: 1 })
    expect(summary.food).toEqual({ averageKcal: Math.round((eaten[0] + eaten[1]) / 2), averageProteinG: 130 })
  })

  it('java e ardhshme dhe java para fillimit: asnjë përmbledhje', async () => {
    const context = await twoWeeks()
    context.setClock(at('2026-11-16'))
    expect(await weekSummary(context.store, '2026-11-23')).toBeNull()
    expect(await weekSummary(context.store, '2026-10-26')).toBeNull()
    // Çdo ditë e javës vlen si e hëna e saj.
    expect((await weekSummary(context.store, '2026-11-12'))?.monday).toBe('2026-11-09')
  })
})
