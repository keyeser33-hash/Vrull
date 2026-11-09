import { i18nFor, NBSP } from '@/i18n'
import { gramsText, kcalText, macrosLine, parseAmount, parseGrams, relativeTime } from './nutrition-format'

// Tekstet e ushqimit në të dyja gjuhët: mijëshet sipas gjuhës (2 900 / 2,900), gramët me hapësirë që
// nuk thyhet, makrot dhe koha relative e vaktit nga katalogu.

const sq = i18nFor('sq')
const en = i18nFor('en')

describe('tekstet e ushqimit', () => {
  it('kcal pa presje dhjetore, me mijëshet e gjuhës', () => {
    expect(kcalText(sq, 1487.4)).toBe(`1${NBSP}487`)
    expect(kcalText(en, 3625)).toBe('3,625')
    expect(kcalText(sq, 495.2)).toBe('495')
    expect(kcalText(en, 0)).toBe('0')
  })

  it('gramët pa zero të tepërta, me presjen e gjuhës', () => {
    expect(gramsText(sq, 142)).toBe(`142${NBSP}g`)
    expect(gramsText(sq, 13.5)).toBe(`13,5${NBSP}g`)
    expect(gramsText(en, 13.5)).toBe(`13.5${NBSP}g`)
  })

  it('makrot në një rresht', () => {
    const macros = { kcal: 495, proteinG: 40.2, carbsG: 61.6, fatG: 9.4 }
    expect(macrosLine(sq, macros)).toBe('P 40 · K 62 · Y 9 g')
    expect(macrosLine(en, macros)).toBe('P 40 · C 62 · F 9 g')
  })

  it('koha relative e vaktit', () => {
    const now = new Date('2026-12-07T12:40:00')
    expect(relativeTime(sq, '13:00', now)).toBe('pas 20 min')
    expect(relativeTime(sq, '12:40', now)).toBe('tani')
    expect(relativeTime(sq, '15:30', now)).toBe('pas 2 orë 50 min')
    expect(relativeTime(sq, '14:40', now)).toBe('pas 2 orë')
    expect(relativeTime(sq, '12:10', now)).toBe('para 30 min')
    expect(relativeTime(en, '13:00', now)).toBe('in 20 min')
    expect(relativeTime(en, '13:40', now)).toBe('in 1 hr')
    expect(relativeTime(en, '15:30', now)).toBe('in 2 hr 50 min')
    expect(relativeTime(en, '12:10', now)).toBe('30 min ago')
    expect(relativeTime(en, '12:40', now)).toBe('now')
  })

  it('gramët e shkruar: presje ose pikë dhjetore, mijëshet e të dyja gjuhëve', () => {
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('0,0')).toBe(0)
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount('-1')).toBeNull()
    expect(parseGrams('0')).toBeNull()
    expect(parseGrams('40')).toBe(40)
    expect(parseGrams('12,5')).toBe(12.5)
    expect(parseGrams('12.5')).toBe(12.5)
    expect(parseGrams(`1${NBSP}200`)).toBe(1200)
    expect(parseGrams('1 200')).toBe(1200)
    expect(parseGrams('1,200')).toBe(1200)
    expect(parseGrams('1,200.5')).toBe(1200.5)
    expect(parseGrams('')).toBeNull()
    expect(parseGrams('abc')).toBeNull()
    expect(parseGrams('-5')).toBeNull()
  })
})
