import type { DailyState } from '@/data/daily-state'
import { answeredQuestions, completeAnswers, draftOf, firstOpenQuestion, QUESTIONS } from './checkin-flow'

// Rrjedha e gjendjes së ditës si 4 story + e 5-ta (V57, SPEC §0.3f): cila pyetje ka përgjigje, cila hapet e para, dhe kur
// përgjigjet mjaftojnë për një rresht të plotë të `daily_states`. Pa UI dhe pa bazë.

const FULL = { mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 0, soreGroups: [] } as const

describe('rrjedha e gjendjes së ditës', () => {
  it('katër pyetje, në radhën e bordeve', () => {
    expect(QUESTIONS).toEqual(['mood', 'energy', 'sleep', 'soreness'])
  })

  it('pa përgjigje hapet pyetja e parë; secila përgjigje e çon te tjetra', () => {
    expect(firstOpenQuestion({})).toBe(0)
    expect(firstOpenQuestion({ mood: 4 })).toBe(1)
    expect(firstOpenQuestion({ mood: 4, energy: 3 })).toBe(2)
    expect(firstOpenQuestion({ mood: 4, energy: 3, sleepMinutes: 420, sleepQuality: 3 })).toBe(3)
  })

  it('gjumi ka përgjigje vetëm me orët dhe cilësinë bashkë', () => {
    expect(answeredQuestions({ mood: 4, energy: 3, sleepMinutes: 420 })).toEqual({ mood: true, energy: true, sleep: false, soreness: false })
    expect(firstOpenQuestion({ mood: 4, energy: 3, sleepQuality: 3 })).toBe(2)
  })

  it('një gjendje e plotësuar pjesërisht hapet te pyetja e parë pa përgjigje, edhe kur një e mëparshme mungon', () => {
    expect(firstOpenQuestion({ energy: 3, sleepMinutes: 420, sleepQuality: 3, soreness: 0 })).toBe(0)
  })

  it('pas të katërtave hapet story i 5-të (indeksi 4)', () => {
    expect(firstOpenQuestion(FULL)).toBe(4)
  })

  it('"Pa dhimbje" mjafton për përgjigjen e katërt, edhe pa grupe', () => {
    expect(answeredQuestions({ soreness: 0 }).soreness).toBe(true)
  })

  it('rreshti plotësohet vetëm kur të katër kanë përgjigje; përgjigjet normalizohen si te fleta e vjetër', () => {
    expect(completeAnswers({ mood: 4, energy: 3, sleepMinutes: 420, sleepQuality: 3 })).toBeNull()
    expect(completeAnswers({ ...FULL, soreness: 0, soreGroups: ['gjoksi'] })).toEqual({ ...FULL, soreGroups: [] })
    expect(completeAnswers({ ...FULL, sleepMinutes: 400 })?.sleepMinutes).toBe(390)
  })

  it('dhimbje pa grupe ruhen si zgjedhje e hapur: grupet vijnë më pas', () => {
    expect(completeAnswers({ ...FULL, soreness: 2 })).toMatchObject({ soreness: 2, soreGroups: [] })
  })

  it('rreshti i ruajtur ka përparësi mbi skicën e telefonit', () => {
    const state = { ...FULL, date: '2026-11-08', readiness: 50, recovery: null, soreTrained: false } as DailyState
    expect(draftOf(state, { mood: 1 })).toEqual({ mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 0, soreGroups: [] })
    expect(draftOf(null, { mood: 1 })).toEqual({ mood: 1 })
  })
})
