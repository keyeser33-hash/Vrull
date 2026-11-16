import { factById } from '@/learn/facts'
import { shiftDate } from '@/lib/calendar'
import { pullOnce } from '@/test/fake-remote'
import { achievementsView } from './achievements'
import { createDatabase } from './db'
import { dismissFact, factEventId, factsEnabled, foodFact, learnPage, markFactSeen, quizEventId, quizView, restFact, saveQuiz, setFactsEnabled, todayFact } from './learn'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { todayView } from './today'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'

// Mëso në bazë (V56, V57, SPEC §0.3e): Shortcut to Size nga e hëna 2 nëntor 2026, ditët e stërvitjes e hënë, e
// martë, e enjte, e premte. "A e dije?" një në ditë ushqimi në secilin vend; kuizi e diela 20:00 – e hëna.

const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`)
const PROFILE = { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }

async function setup() {
  let clock = at('2026-11-02', '10:00')
  const db = createDatabase(`learn-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => USER, now: () => clock })
  await pullOnce(db, USER)
  await completeOnboarding(store, PROFILE, () => at('2026-11-01', '08:00'))
  return { store, db, setClock: (date: Date) => (clock = date) }
}

type Context = Awaited<ReturnType<typeof setup>>

/** Një stërvitje 21:00–22:00 me një set të ushtrimit të parë. */
async function train(context: Context, date: string) {
  context.setClock(at(date, '21:00'))
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  await saveSet(context.store, { sessionId, slot: first, setNumber: 1, weightKg: 50, reps: 14, rir: 2 })
  context.setClock(at(date, '22:00'))
  await finishWorkout(context.store, sessionId)
}

/** Një ushqim i shabllonit të Jimit (`jim:<çelësi>`) i regjistruar në atë datë. */
async function eat(context: Context, date: string, key: string, time = '09:00') {
  context.setClock(at(date, time))
  const [existing] = (await context.store.all('foods')).filter((row) => row.source_id === `jim:${key}`)
  const food = existing ?? (await context.store.put('foods', { name: key, source: 'template', source_id: `jim:${key}`, kcal_100g: 100, protein_100g: 10, carbs_100g: 10, fat_100g: 1 }))
  await context.store.put('diary_entries', { date, meal: 'breakfast_1', food_id: food.id, grams: 100, kcal: 100, protein_g: 10, carbs_g: 10, fat_g: 1, logged_at: at(date, time).toISOString() })
}

const factRows = async (context: Context) => (await context.store.where('learn_events', 'kind', 'fact')).sort((a, b) => `${a.date}${a.place}`.localeCompare(`${b.date}${b.place}`))

describe('çelësi "A e dije?"', () => {
  it('i ndezur si parazgjedhje; i fikur nuk jep fakt te Sot, pushimi dhe ushqimi', async () => {
    const context = await setup()
    expect(await factsEnabled(context.store)).toBe(true)
    await setFactsEnabled(context.store, false)
    expect((await context.store.all('user_settings'))[0].learn_facts).toBe(false)
    expect(await factsEnabled(context.store)).toBe(false)
    expect(await todayFact(context.store, await todayView(context.store))).toBeNull()
    expect(await restFact(context.store, '2026-11-02', 'Bench Press')).toBeNull()
    await eat(context, '2026-11-02', 'oatmeal')
    expect(await foodFact(context.store, '2026-11-02')).toBeNull()
    await setFactsEnabled(context.store, true)
    expect(await factsEnabled(context.store)).toBe(true)
  })
})

describe('"A e dije?" te Sot', () => {
  it('ditë stërvitjeje: fakt i ushtrimeve të sotme; i njëjti gjatë ditës, pa u shënuar deri sa hapet story', async () => {
    const context = await setup()
    const fact = await todayFact(context.store, await todayView(context.store))
    expect(fact).toMatchObject({ place: 'today', date: '2026-11-02', seen: false, dismissed: false })
    expect(fact!.fact.id).toBe('bench-press-1')
    expect(await factRows(context)).toEqual([])
    await markFactSeen(context.store, 'today', '2026-11-02', fact!.fact.id)
    await markFactSeen(context.store, 'today', '2026-11-02', fact!.fact.id)
    const rows = await factRows(context)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: await factEventId(USER, '2026-11-02', 'today'), kind: 'fact', date: '2026-11-02', place: 'today', fact_id: 'bench-press-1', dismissed: false })
    expect(await todayFact(context.store, await todayView(context.store))).toMatchObject({ seen: true, fact: { id: 'bench-press-1' } })
  })

  it('ditë pushimi: fakt rikuperimi; të nesërmen (stërvitje) nuk përsëritet ai i djeshmi i Sot-it', async () => {
    const context = await setup()
    context.setClock(at('2026-11-04', '10:00'))
    const rest = await todayFact(context.store, await todayView(context.store))
    expect(rest!.fact.topic.kind).toBe('recovery')
    expect(rest!.fact.id).toBe('rest-1')
    // E hëna me Bench Press-in e parë të parë; e martja me ushtrimet e Stërvitjes 1 përsëri (seanca nuk u bë).
    await markFactSeen(context.store, 'today', '2026-11-02', 'bench-press-1')
    context.setClock(at('2026-11-03', '10:00'))
    expect((await todayFact(context.store, await todayView(context.store)))!.fact.id).toBe('bench-press-2')
  })

  it('pas seancës (e mbyllur sot): faktet e ushtrimeve të saj, jo të stërvitjes së radhës', async () => {
    const context = await setup()
    await train(context, '2026-11-02')
    context.setClock(at('2026-11-02', '22:30'))
    const view = await todayView(context.store)
    expect(view.mode).toBe('done')
    expect((await todayFact(context.store, view))!.fact.id).toBe('bench-press-1')
  })
})

describe('"A e dije?" gjatë pushimit', () => {
  it('fakt i ushtrimit aktual; pas faktit të ditës, ushtrimet e tjera nuk marrin kartë; "×" e mbyll për sot', async () => {
    const context = await setup()
    expect(await restFact(context.store, '2026-11-02', 'Incline Cable Flye')).toBeNull()
    const first = await restFact(context.store, '2026-11-02', 'Bench Press')
    expect(first).toMatchObject({ seen: false, fact: { id: 'bench-press-1' } })
    await markFactSeen(context.store, 'rest', '2026-11-02', 'bench-press-1')
    expect(await restFact(context.store, '2026-11-02', 'Incline Bench Press')).toBeNull()
    expect(await restFact(context.store, '2026-11-02', 'Bench Press')).toMatchObject({ seen: true, dismissed: false })
    await dismissFact(context.store, 'rest', '2026-11-02')
    expect(await restFact(context.store, '2026-11-02', 'Bench Press')).toMatchObject({ seen: true, dismissed: true })
    // Vendi ka historinë e vet: te Sot Bench Press-i i parë del ende.
    expect((await todayFact(context.store, await todayView(context.store)))!.fact.id).toBe('bench-press-1')
    // Dita tjetër: Bench Press me faktin e dytë.
    expect((await restFact(context.store, '2026-11-03', 'Bench Press'))!.fact.id).toBe('bench-press-2')
  })

  it('një rresht i fshirë për atë ditë dhe vend kthehet (revive), pa një rresht të dytë', async () => {
    const context = await setup()
    await markFactSeen(context.store, 'rest', '2026-11-02', 'bench-press-1')
    const id = await factEventId(USER, '2026-11-02', 'rest')
    await context.store.remove('learn_events', id)
    await markFactSeen(context.store, 'rest', '2026-11-02', 'bench-press-2')
    const rows = await context.db.learn_events.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id, fact_id: 'bench-press-2', deleted_at: null })
  })
})

describe('"A e dije?" pas ushqimit', () => {
  it('fakt i ushqimit të regjistruar i fundit; ushqimet pa fakte nuk japin kartë', async () => {
    const context = await setup()
    await eat(context, '2026-11-02', 'apple', '08:30')
    expect(await foodFact(context.store, '2026-11-02')).toBeNull()
    await eat(context, '2026-11-02', 'protein', '09:00')
    await eat(context, '2026-11-02', 'oatmeal', '09:05')
    const found = await foodFact(context.store, '2026-11-02')
    expect(found).toMatchObject({ food: 'oatmeal', seen: false, fact: { id: 'oatmeal-1' } })
    await markFactSeen(context.store, 'food', '2026-11-02', 'oatmeal-1')
    // Një në ditë: një ushqim tjetër nuk e ndërron.
    await eat(context, '2026-11-02', 'egg', '13:00')
    expect(await foodFact(context.store, '2026-11-02')).toMatchObject({ food: 'oatmeal', seen: true })
    // Të nesërmen tërshëra s'përsëritet para proteinës.
    await eat(context, '2026-11-03', 'oatmeal', '09:00')
    await eat(context, '2026-11-03', 'protein', '08:00')
    expect((await foodFact(context.store, '2026-11-03'))!.fact.topic).toEqual({ kind: 'food', food: 'protein' })
  })
})

/** Faktet e para të javës 9–15 nëntor: 5 vende-ditë. */
async function weekOfFacts(context: Context) {
  await markFactSeen(context.store, 'today', '2026-11-09', 'bench-press-1')
  await markFactSeen(context.store, 'rest', '2026-11-09', 'bench-press-2')
  await markFactSeen(context.store, 'food', '2026-11-10', 'oatmeal-1')
  await markFactSeen(context.store, 'today', '2026-11-11', 'sleep-1')
  await markFactSeen(context.store, 'today', '2026-11-12', 'protein-1')
}

describe('kuizi i së dielës', () => {
  it('hapet nga e diela 20:00 deri të hënën; me më pak se 5 fakte nuk hapet', async () => {
    const context = await setup()
    context.setClock(at('2026-11-15', '19:59'))
    expect(await quizView(context.store)).toBeNull()
    context.setClock(at('2026-11-15', '20:30'))
    expect(await quizView(context.store)).toMatchObject({ monday: '2026-11-09', facts: null, done: null })
    context.setClock(at('2026-11-17', '09:00'))
    expect(await quizView(context.store)).toBeNull()
  })

  it('pyetjet së pari nga faktet e para; rezultati ruhet me javën, një herë; vargu', async () => {
    const context = await setup()
    await weekOfFacts(context)
    context.setClock(at('2026-11-15', '20:30'))
    const view = (await quizView(context.store))!
    expect(view.facts!.map((fact) => fact.id)).toEqual(['bench-press-1', 'bench-press-2', 'oatmeal-1', 'sleep-1', 'protein-1'])
    expect(view).toMatchObject({ streakBefore: 0, streak: 0, done: null, achievement: { earnedOn: null, current: 0, target: 4 } })
    expect(view.dots.map((dot) => dot.state)).toEqual(['open', 'ahead', 'ahead', 'ahead'])
    const chosen = view.facts!.map((fact, index) => (index === 2 ? (fact.quiz.correct + 1) % fact.quiz.options.length : fact.quiz.correct))
    await saveQuiz(context.store, '2026-11-09', view.facts!, chosen)
    await saveQuiz(context.store, '2026-11-09', view.facts!, [0, 0, 0, 0, 0])
    const rows = await context.store.where('learn_events', 'kind', 'quiz')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: await quizEventId(USER, '2026-11-09'), date: '2026-11-09', score: 4, closed_on: '2026-11-15', place: null, fact_id: null })
    expect(rows[0].answers).toEqual(view.facts!.map((fact, index) => ({ fact: fact.id, chosen: chosen[index] })))
    const done = (await quizView(context.store))!
    expect(done).toMatchObject({ done: { score: 4, closedOn: '2026-11-15' }, streak: 1, streakBefore: 0 })
    expect(done.facts!.map((fact) => fact.id)).toEqual(view.facts!.map((fact) => fact.id))
    expect(done.dots.map((dot) => [dot.sunday, dot.state])).toEqual([
      ['2026-11-15', 'done'],
      ['2026-11-22', 'ahead'],
      ['2026-11-29', 'ahead'],
      ['2026-12-06', 'ahead'],
    ])
  })

  it('rreshtat që serveri pranon (migrimi learn_events): fakti pa përgjigje, kuizi të hënën me 5 përgjigje', async () => {
    const context = await setup()
    await weekOfFacts(context)
    context.setClock(at('2026-11-16', '08:00'))
    const view = (await quizView(context.store))!
    await saveQuiz(context.store, view.monday, view.facts!, [9, -1, 0, 1, 2])
    for (const row of await context.store.all('learn_events')) {
      expect(['fact', 'quiz']).toContain(row.kind)
      if (row.kind === 'fact') {
        expect(row).toMatchObject({ answers: null, score: null, closed_on: null })
        expect(String(row.fact_id)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        expect(['today', 'rest', 'food']).toContain(row.place)
      } else {
        expect(new Date(`${row.date}T12:00:00`).getDay()).toBe(1)
        expect(String(row.closed_on) >= String(row.date)).toBe(true)
        expect(row.answers).toHaveLength(5)
        for (const [index, answer] of (row.answers as { fact: string; chosen: number }[]).entries()) {
          expect(answer.chosen).toBeGreaterThanOrEqual(0)
          expect(answer.chosen).toBeLessThan(factById(view.facts![index].id)!.quiz.options.length)
        }
        expect(row.score).toBeGreaterThanOrEqual(0)
        expect(row.score).toBeLessThanOrEqual(5)
      }
    }
  })

  it('arritja "Kuizi 4 javë" me ditën kur u mbyll kuizi i katërt; një javë pa kuiz nuk e ndërpret', async () => {
    const context = await setup()
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-23', '2026-11-30']
    for (const [index, monday] of weeks.entries()) {
      for (const [offset, id] of ['rest-1', 'rest-2', 'sleep-1', 'sleep-2', 'protein-1'].entries()) await markFactSeen(context.store, 'today', shiftDate(monday, offset), id)
      // Kuizi i javës së dytë mbyllet të hënën.
      context.setClock(index === 1 ? at('2026-11-16', '12:00') : at(shiftDate(monday, 6), '21:00'))
      const view = (await quizView(context.store))!
      expect(view.monday).toBe(monday)
      await saveQuiz(context.store, monday, view.facts!, view.facts!.map((fact) => fact.quiz.correct))
    }
    const quiz = (await achievementsView(context.store)).achievements.find((entry) => entry.key === 'quiz_4')
    expect(quiz).toMatchObject({ earnedOn: '2026-12-06' })
    expect((await context.store.all('achievements')).find((row) => row.key === 'quiz_4')).toMatchObject({ earned_on: '2026-12-06' })
    expect(await learnPage(context.store)).toMatchObject({ streak: 4, achievement: { earnedOn: '2026-12-06', current: 4, target: 4 } })
  })
})

describe('faqja Mëso', () => {
  it('bosh: pa fakte dhe pa kuize', async () => {
    const context = await setup()
    expect(await learnPage(context.store)).toMatchObject({ seen: [], quizzes: [], streak: 0, openQuiz: null })
  })

  it('faktet e para më të rejat sipër, një herë secili; kuizet me javën dhe rezultatin; kuizi i hapur', async () => {
    const context = await setup()
    await weekOfFacts(context)
    await markFactSeen(context.store, 'today', '2026-11-13', 'bench-press-1')
    context.setClock(at('2026-11-15', '20:30'))
    const before = await learnPage(context.store)
    expect(before.openQuiz).toBe('2026-11-09')
    expect(before.seen.map((entry) => [entry.fact.id, entry.date, entry.place])).toEqual([
      ['bench-press-1', '2026-11-13', 'today'],
      ['protein-1', '2026-11-12', 'today'],
      ['sleep-1', '2026-11-11', 'today'],
      ['oatmeal-1', '2026-11-10', 'food'],
      ['bench-press-2', '2026-11-09', 'rest'],
    ])
    const view = (await quizView(context.store))!
    await saveQuiz(context.store, view.monday, view.facts!, view.facts!.map((fact) => fact.quiz.correct))
    const after = await learnPage(context.store)
    expect(after).toMatchObject({ openQuiz: null, streak: 1, quizzes: [{ monday: '2026-11-09', score: 5, closedOn: '2026-11-15', programWeek: null }] })
  })
})
