import { i18nFor } from '@/i18n'
import { weekHeading } from './week-format'

// F10: "Kjo javë · 9–15 nëntor" për javën e sotme; një javë tjetër: vetëm datat; kurrë "Java N".
describe('weekHeading', () => {
  it('java e sotme me "Kjo javë", një javë tjetër vetëm me datat; anglisht me muaj të shkurtër', () => {
    const sq = i18nFor('sq')
    const en = i18nFor('en')
    expect(weekHeading(sq, '2026-11-09', '2026-11-12')).toBe('Kjo javë · 9–15 nëntor')
    expect(weekHeading(en, '2026-11-09', '2026-11-15')).toBe('This week · 9–15 Nov')
    expect(weekHeading(sq, '2026-11-02', '2026-11-12')).toBe('2–8 nëntor')
    expect(weekHeading(en, '2026-10-26', '2026-11-12')).toBe('26 Oct – 1 Nov')
    expect(weekHeading(sq, '2026-11-09', '2026-11-12')).not.toMatch(/Java \d/)
  })
})
