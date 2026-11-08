import { muscleName, programBlockName, programDayName, programWeekLabel } from './domain'
import { i18nFor } from './index'

// Emrat e domenit për çdo ekran: grupet e muskujve dhe emrat e Shortcut to Size sipas gjuhës.

const sq = i18nFor('sq').t
const en = i18nFor('en').t

describe('emrat e domenit', () => {
  it('grupet e muskujve sipas id-së; një id e panjohur mbetet siç është', () => {
    expect(muscleName(sq, 'kofshet-e-pasme')).toBe('Kofshët e pasme')
    expect(muscleName(en, 'kofshet-e-pasme')).toBe('Hamstrings')
    expect(muscleName(en, 'pulpat')).toBe('Calves')
    expect(muscleName(en, 'krahet-e-reja')).toBe('krahet-e-reja')
  })

  it('ditët e Shortcut to Size përkthehen; emri i përdoruesit jo', () => {
    expect(programDayName(sq, 'Gjoks, triceps, pulpa')).toBe('Gjoks, triceps, pulpa')
    expect(programDayName(en, 'Gjoks, triceps, pulpa')).toBe('Chest, triceps, calves')
    expect(programDayName(en, 'Këmbë, bark')).toBe('Legs, abs')
    expect(programDayName(en, 'Dita ime')).toBe('Dita ime')
    expect(programDayName(en, null)).toBe('')
  })

  it('blloqet, javët dhe xhirot', () => {
    expect(programBlockName(en, 'Java 0')).toBe('Week 0')
    expect(programBlockName(en, 'Faza 2')).toBe('Phase 2')
    expect(programBlockName(en, 'Blloku im')).toBe('Blloku im')
    expect(programBlockName(sq, null)).toBe('Pa program')
    expect(programWeekLabel(sq, { blockName: 'Faza 1', blockWeeks: 4, week: 2, run: 1 })).toBe('Faza 1 · Java 2')
    expect(programWeekLabel(en, { blockName: 'Java 0', blockWeeks: 1, week: 1, run: 2 })).toBe('Week 0 · Round 2')
  })
})
