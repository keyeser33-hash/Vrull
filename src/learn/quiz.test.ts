import { exerciseFacts, factById, foodFacts, RECOVERY_FACTS } from './facts'
import type { SeenFact } from './pick'
import { QUIZ_SIZE, quizAchievement, quizFacts, quizScore, quizStreak, type QuizWeek } from './quiz'

// Kuizi i së dielës (SPEC §0.3e): 5 pyetje, së pari nga faktet e para atë javë (e hëna–e diela), pastaj nga faktet e
// ushtrimeve të seancave dhe të ushqimeve të regjistruara; me më pak se 5 fakte nuk hapet. Vargu: javët njëra pas
// tjetrës me kuizin e mbyllur, një javë pa kuiz (pa 5 fakte) nuk e ndërpret. Arritja "Kuizi 4 javë": dita kur u mbyll
// kuizi i katërt.

const MONDAY = '2026-11-09'
const seen = (factId: string, date: string, place: SeenFact['place'] = 'today'): SeenFact => ({ factId, date, place })
const ids = (list: readonly { id: string }[] | null) => list?.map((fact) => fact.id) ?? null

describe('quizFacts', () => {
  it('me më pak se 5 fakte nuk hapet', () => {
    expect(quizFacts({ monday: MONDAY, seen: [seen('oatmeal-1', '2026-11-10', 'food')], exercises: [], foods: ['protein'] })).toBeNull()
  })

  it('së pari faktet e para atë javë, me radhën kur u panë; jashtë javës nuk numërohen', () => {
    const recovery = RECOVERY_FACTS.slice(0, 2).map((fact) => fact.id)
    const week = [seen(recovery[1], '2026-11-12'), seen('oatmeal-1', '2026-11-10', 'food'), seen(recovery[0], '2026-11-15'), seen(recovery[0], '2026-11-16')]
    const before = seen(RECOVERY_FACTS[5].id, '2026-11-08')
    const facts = ids(quizFacts({ monday: MONDAY, seen: [...week, before], exercises: ['Bench Press', 'Leg Press'], foods: [] }))
    expect(facts).toHaveLength(QUIZ_SIZE)
    expect(facts!.slice(0, 3)).toEqual(['oatmeal-1', recovery[1], recovery[0]])
    expect(facts).not.toContain(RECOVERY_FACTS[5].id)
    // Të tjerat nga ushtrimet e seancave, pa dyfishim.
    const rest = new Set([...exerciseFacts('Bench Press'), ...exerciseFacts('Leg Press')].map((fact) => fact.id))
    expect(facts!.slice(3).every((id) => rest.has(id))).toBe(true)
  })

  it('pa fakte të para: nga ushtrimet dhe ushqimet e javës; e njëjta javë jep të njëjtat pyetje', () => {
    const input = { monday: MONDAY, seen: [], exercises: ['Bench Press', 'Incline Bench Press', 'Leg Press'], foods: ['oatmeal', 'protein', 'egg'] }
    const first = ids(quizFacts(input))
    expect(first).toHaveLength(QUIZ_SIZE)
    expect(new Set(first).size).toBe(QUIZ_SIZE)
    expect(ids(quizFacts(input))).toEqual(first)
    const pool = new Set([...['Bench Press', 'Incline Bench Press', 'Leg Press'].flatMap(exerciseFacts), ...['oatmeal', 'protein', 'egg'].flatMap(foodFacts)].map((fact) => fact.id))
    expect(first!.every((id) => pool.has(id))).toBe(true)
  })

  it('me më shumë se 5 fakte të para merren 5 prej tyre, me radhën kur u panë', () => {
    const list = RECOVERY_FACTS.slice(0, 8).map((fact, index) => seen(fact.id, `2026-11-${String(9 + (index % 7)).padStart(2, '0')}`))
    const facts = quizFacts({ monday: MONDAY, seen: list, exercises: [], foods: [] })!
    expect(facts).toHaveLength(QUIZ_SIZE)
    const dates = facts.map((fact) => list.find((entry) => entry.factId === fact.id)!.date)
    expect([...dates].sort()).toEqual(dates)
  })
})

describe('quizScore', () => {
  it('numëron përgjigjet e sakta', () => {
    const facts = ['oatmeal-1', 'egg-1'].map((id) => factById(id)!)
    expect(quizScore(facts, [facts[0].quiz.correct, facts[1].quiz.correct])).toBe(2)
    expect(quizScore(facts, [facts[0].quiz.correct, (facts[1].quiz.correct + 1) % 3])).toBe(1)
  })
})

const week = (monday: string, doneOn: string | null, available = true): QuizWeek => ({ monday, doneOn, available })

describe('vargu i kuizit', () => {
  it('javët rresht me kuizin e mbyllur', () => {
    const weeks = [week('2026-10-19', '2026-10-25'), week('2026-10-26', '2026-11-01'), week('2026-11-02', '2026-11-08')]
    expect(quizStreak(weeks, null)).toBe(3)
  })

  it('një javë pa kuiz (pa 5 fakte) nuk e ndërpret; një javë me kuiz të pabërë e ndërpret', () => {
    expect(quizStreak([week('2026-10-19', '2026-10-25'), week('2026-10-26', null, false), week('2026-11-02', '2026-11-08')], null)).toBe(2)
    expect(quizStreak([week('2026-10-19', '2026-10-25'), week('2026-10-26', null), week('2026-11-02', '2026-11-08')], null)).toBe(1)
    expect(quizStreak([week('2026-11-02', null)], null)).toBe(0)
  })

  it('java e hapur (e diela 20:00 deri të hënën) pa kuiz ende nuk e ndërpret; me kuizin e bërë e rrit', () => {
    const before = [week('2026-10-26', '2026-11-01'), week('2026-11-02', '2026-11-08')]
    expect(quizStreak([...before, week('2026-11-09', null)], '2026-11-09')).toBe(2)
    expect(quizStreak([...before, week('2026-11-09', '2026-11-15')], '2026-11-09')).toBe(3)
  })
})

describe('arritja "Kuizi 4 javë"', () => {
  it('data është dita kur u mbyll kuizi i katërt rresht', () => {
    const weeks = [week('2026-10-19', '2026-10-25'), week('2026-10-26', '2026-11-02'), week('2026-11-02', null, false), week('2026-11-09', '2026-11-15'), week('2026-11-16', '2026-11-23')]
    expect(quizAchievement(weeks, null)).toEqual({ met: { date: '2026-11-23' }, progress: { current: 4, target: 4 } })
  })

  it('pa 4 rresht: progresi është vargu i tanishëm; një ndërprerje e nis nga e para', () => {
    const weeks = [week('2026-10-12', '2026-10-18'), week('2026-10-19', '2026-10-25'), week('2026-10-26', '2026-11-01'), week('2026-11-02', null), week('2026-11-09', '2026-11-15')]
    expect(quizAchievement(weeks, '2026-11-09')).toEqual({ met: null, progress: { current: 1, target: 4 } })
  })

  it('pasi u fitua mbetet, edhe kur vargu ndërpritet më vonë', () => {
    const weeks = [week('2026-10-12', '2026-10-18'), week('2026-10-19', '2026-10-25'), week('2026-10-26', '2026-11-01'), week('2026-11-02', '2026-11-09'), week('2026-11-09', null)]
    expect(quizAchievement(weeks, null)).toEqual({ met: { date: '2026-11-09' }, progress: { current: 4, target: 4 } })
  })
})
