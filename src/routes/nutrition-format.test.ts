import { grams, kcal, macrosLine, relativeTime } from './nutrition-format'

describe('tekstet e ushqimit', () => {
  it('kcal me pikë për mijëshet, pa presje dhjetore', () => {
    expect(kcal(1487.4)).toBe('1.487')
    expect(kcal(3625)).toBe('3.625')
    expect(kcal(495.2)).toBe('495')
    expect(kcal(0)).toBe('0')
  })

  it('gramët pa zero të tepërta, me presje', () => {
    expect(grams(142)).toBe('142 g')
    expect(grams(13.5)).toBe('13,5 g')
  })

  it('makrot në një rresht', () => {
    expect(macrosLine({ kcal: 495, proteinG: 40.2, carbsG: 61.6, fatG: 9.4 })).toBe('P 40 · K 62 · Y 9 g')
  })

  it('koha relative e vaktit', () => {
    const now = new Date('2026-12-07T12:40:00')
    expect(relativeTime('13:00', now)).toBe('pas 20 min')
    expect(relativeTime('12:40', now)).toBe('tani')
    expect(relativeTime('15:30', now)).toBe('pas 2 orë 50 min')
    expect(relativeTime('14:40', now)).toBe('pas 2 orë')
    expect(relativeTime('12:10', now)).toBe('para 30 min')
  })
})
