import { isMissed, type MissedInput, missedYesterday } from './missed-day'

// Dita e humbur (V38, V2-E2-09): stërvitje të hënën, të martën, të enjten dhe të premten; programi
// nisi të hënën 16 nëntor 2026.
const base: MissedInput = { trainingDays: [1, 2, 4, 5], startedOn: '2026-11-16', sessionDates: ['2026-11-16'], dayTypes: {} }

describe('dita e humbur', () => {
  it('e martë pa seancë: e humbur; e mërkurë pyet', () => {
    expect(isMissed(base, '2026-11-17', '2026-11-18')).toBe(true)
    expect(isMissed(base, '2026-11-16', '2026-11-18')).toBe(false)
    expect(missedYesterday(base, '2026-11-18')).toEqual({ date: '2026-11-17', streak: 1 })
  })

  it('dita e sotme dhe ditët para programit nuk janë të humbura', () => {
    expect(isMissed(base, '2026-11-17', '2026-11-17')).toBe(false)
    expect(isMissed(base, '2026-11-13', '2026-11-18')).toBe(false)
  })

  it('kapërcimi me dorë ka seancë: nuk është i humbur', () => {
    expect(missedYesterday({ ...base, sessionDates: ['2026-11-16', '2026-11-17'] }, '2026-11-18')).toBeNull()
  })

  it('kur sot është ditë stërvitjeje nuk pyet: stërvitja e humbur është ajo e sotme', () => {
    // E hëna 16 e humbur, e marta 17 është ditë stërvitjeje.
    expect(missedYesterday({ ...base, sessionDates: [], startedOn: '2026-11-15' }, '2026-11-17')).toBeNull()
  })

  it('dy ditë rresht: e enjtja dhe e premtja, e shtuna pyet me dy', () => {
    const input = { ...base, sessionDates: ['2026-11-16', '2026-11-17'] }
    expect(missedYesterday(input, '2026-11-21')).toEqual({ date: '2026-11-20', streak: 2 })
  })

  it('e shtuna e humbur me javën që mbyllet: e diela pyet', () => {
    const input = { ...base, trainingDays: [1, 3, 6], sessionDates: ['2026-11-16', '2026-11-18'] }
    expect(missedYesterday(input, '2026-11-22')).toEqual({ date: '2026-11-21', streak: 1 })
  })

  it('"Po" ose "Jo" për sot e mbyll pyetjen; dita e ndryshuar në pushim nuk është e humbur', () => {
    expect(missedYesterday({ ...base, dayTypes: { '2026-11-18': 'training' } }, '2026-11-18')).toBeNull()
    expect(missedYesterday({ ...base, dayTypes: { '2026-11-18': 'rest' } }, '2026-11-18')).toBeNull()
    expect(isMissed({ ...base, dayTypes: { '2026-11-17': 'rest' } }, '2026-11-17', '2026-11-18')).toBe(false)
  })

  it('dita e sjellë sot me "Po" dhe e humbur sërish pyet të nesërmen', () => {
    const input = { ...base, dayTypes: { '2026-11-18': 'training' as const } }
    expect(missedYesterday(input, '2026-11-19')).toBeNull()
    // E enjtja është ditë stërvitjeje; të shtunën pyet për të premten, me tri ditë rresht (17, 18, 20... jo 19).
    expect(missedYesterday({ ...input, sessionDates: ['2026-11-16', '2026-11-19'] }, '2026-11-21')).toEqual({ date: '2026-11-20', streak: 1 })
    expect(missedYesterday(input, '2026-11-21')).toEqual({ date: '2026-11-20', streak: 4 })
  })
})
