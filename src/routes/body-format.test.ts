import { DEEP_ENTRIES } from '@/body/layers'
import { SHAPE_MEASURES } from '@/body/body-shape'
import { i18nFor } from '@/i18n'
import { sq as catalog } from '@/i18n/sq'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { agoText, cardRecovery, cardWeek, LEVEL_STYLE, levelLabel, modeStyle, programSummary, RECOVERY_STYLE, setsText, sinceText, volumeNote } from './body-format'

const sq = i18nFor('sq')
const en = i18nFor('en')

// Modeli 3D merr të njëjtat ngjyra si figura 2D dhe legjenda: tokeni dhe opaciteti i klasës `fill-…`.
function fromClass(fill: string) {
  const match = /^fill-([a-z0-9-]+)(?:\/(\d+))?$/.exec(fill)
  if (!match) throw new Error(fill)
  return { token: `--${match[1]}`, alpha: match[2] ? Number(match[2]) / 100 : 1 }
}

describe('ngjyrat e Trupit', () => {
  it('rikuperimi: toni 3D i çdo gjendjeje përputhet me klasën e figurës 2D dhe të legjendës', () => {
    for (const [status, style] of Object.entries(RECOVERY_STYLE)) {
      expect(style.tone, status).toMatchObject(fromClass(style.fill))
      expect(style.swatch, status).toBe(style.fill.replace('fill-', 'bg-'))
    }
    expect(RECOVERY_STYLE.i_lodhur.tone).toMatchObject({ token: '--ember', alpha: 1 })
  })

  it('shkëlqimi (V53): i lodhur ndriçon plotësisht, pothuajse gati pak, gati jo', () => {
    expect(RECOVERY_STYLE.i_lodhur.tone.glow).toBe(1)
    expect(RECOVERY_STYLE.pothuajse_gati.tone.glow).toBe(0.4)
    expect(RECOVERY_STYLE.gati.tone.glow ?? 0).toBe(0)
    // Volumi: sa më shumë sete, aq më shumë dritë; "Pa sete" nuk ndriçon.
    expect(LEVEL_STYLE.map((style) => style.tone.glow ?? 0)).toEqual([0, 0.12, 0.45, 1])
  })

  it('volumi: "pa sete" me `subtle`, pastaj tokenat volume-1…3 të temës, të plotë', () => {
    LEVEL_STYLE.forEach((style) => expect(style.tone).toMatchObject(fromClass(style.fill)))
    expect(LEVEL_STYLE.map((style) => style.tone.token)).toEqual(['--subtle', '--volume-1', '--volume-2', '--volume-3'])
    expect(LEVEL_STYLE.every((style) => style.tone.alpha === 1)).toBe(true)
  })
})

describe('tekstet e Trupit', () => {
  it('një pamje, e njëjta vlerë te figura, modeli, teksti dhe rreshti i listës', () => {
    const entry = { recovery: 'pothuajse_gati' as const, level: 1 as const, load: 7.5, hours: 50 }
    expect(modeStyle(sq, 'rikuperimi', entry)).toEqual({ ...RECOVERY_STYLE.pothuajse_gati, text: 'Pothuajse gati', value: 'Pothuajse gati', detail: 'Para 2 ditësh' })
    expect(modeStyle(sq, 'volumi', entry)).toEqual({ ...LEVEL_STYLE[1], text: '7,5 sete · nën objektiv', value: '7,5 sete', detail: 'Nën objektiv' })
    expect(modeStyle(sq, 'volumi', { ...entry, level: 2, load: 14 }).text).toBe('14 sete · në objektiv')
    // Pa sete: vlera e thotë një herë, rreshti shton vetëm objektivin.
    expect(modeStyle(sq, 'volumi', { ...entry, level: 0, load: 0 })).toMatchObject({ text: 'Pa sete', value: 'Pa sete', detail: 'Nën objektiv' })
    expect(modeStyle(en, 'volumi', entry)).toMatchObject({ text: '7.5 sets · below target', value: '7.5 sets', detail: 'Below target' })
    expect(modeStyle(en, 'rikuperimi', entry)).toMatchObject({ value: 'Almost ready', detail: '2 days ago' })
  })

  it('setet me presje dhjetore; zero është "Pa sete"', () => {
    expect([0, 0.5, 1, 1.5, 12].map((load) => setsText(sq, load))).toEqual(['Pa sete', '0,5 sete', '1 set', '1,5 sete', '12 sete'])
    expect([0, 0.5, 1, 21.5].map((load) => setsText(en, load))).toEqual(['No sets', '0.5 sets', '1 set', '21.5 sets'])
  })

  it('koha nga stërvitja: e shkurtër te lista, e plotë te fleta', () => {
    expect([null, 0, 1, 20, 30, 50].map((hours) => agoText(sq, hours))).toEqual(['Pa stërvitje', 'Para 1 ore', 'Para 1 ore', 'Para 20 orësh', 'Para 1 dite', 'Para 2 ditësh'])
    expect(sinceText(sq, 72)).toBe('Stërvitja e fundit para 3 ditësh')
    expect(sinceText(en, null)).toBe('No workout logged')
  })

  it('legjenda e volumit sipas objektivit 10–20', () => {
    expect([0, 1, 2, 3].map((level) => levelLabel(sq, level as 0 | 1 | 2 | 3))).toEqual(['Pa sete', 'Nën 10', '10–20 · objektivi', 'Mbi 20'])
    expect(levelLabel(en, 2)).toBe('10–20 · target')
  })

  it('shënimi i volumit: java, grupet sipas objektivit dhe dy shembuj nën të (bordi)', () => {
    const groups = [
      ['shpatullat', 21.5],
      ['barku', 18],
      ['pulpat', 17.5],
      ['tricepsi', 16],
      ['bicepsi', 15],
      ['gjoksi', 14.5],
      ['shpina', 14.5],
      ['trapezi', 11],
      ['kuadricepsi', 10],
      ['vithet', 9.5],
      ['kofshet-e-pasme', 9],
      ['mesi', 6],
      ['aduktoret', 5.5],
      ['parakrahet', 2],
      ['qafa', 0],
    ].map(([id, load]) => ({ id: id as string, load: load as number }))
    const now = new Date('2026-11-08T18:30:00')
    expect(volumeNote(sq, groups, now)).toBe(
      '2–8 nëntor, setet e punës. 15 grupe: 1 mbi objektiv, 8 në të, 6 nën të, si vithet dhe kofshët e pasme. Objektivi 10–20: Schoenfeld et al. 2017; Baz-Valle et al. 2022.',
    )
    expect(volumeNote(en, groups, now)).toBe(
      '2–8 November, working sets. 15 groups: 1 above target, 8 on it, 6 below it, such as glutes and hamstrings. Target 10–20: Schoenfeld et al. 2017; Baz-Valle et al. 2022.',
    )
    // Java që kalon mes dy muajve; asnjë grup nën objektiv.
    expect(volumeNote(sq, [{ id: 'gjoksi', load: 12 }], new Date('2026-11-01T10:00:00'))).toBe(
      '26 tetor – 1 nëntor, setet e punës. 1 grup: 0 mbi objektiv, 1 në të, 0 nën të. Objektivi 10–20: Schoenfeld et al. 2017; Baz-Valle et al. 2022.',
    )
  })

  it('karta e muskulit (V53): rikuperimi dhe java e grupit bashkë, në çdo pamje', () => {
    const chest = { recovery: 'i_lodhur' as const, level: 2 as const, load: 14.5, hours: 20 }
    expect(cardRecovery(sq, chest)).toBe('I lodhur · para 20 orësh')
    expect(cardWeek(sq, chest)).toBe('Këtë javë 14,5 sete · në objektiv')
    expect(cardRecovery(en, chest)).toBe('Fatigued · 20 hours ago')
    expect(cardWeek(en, chest)).toBe('This week 14.5 sets · on target')
    // Pa stërvitje dhe pa sete thuhet me fjalë, jo me zero.
    const calves = { recovery: 'gati' as const, level: 0 as const, load: 0, hours: null }
    expect(cardRecovery(sq, calves)).toBe('Gati · pa stërvitje')
    expect(cardWeek(sq, calves)).toBe('Këtë javë pa sete · nën objektiv')
    expect(cardWeek(en, calves)).toBe('This week no sets · below target')
  })

  it('karta e muskulit: ushtrimet e programit, i pari me emër dhe të tjerët me numër', () => {
    expect(programSummary(sq, ['Bench Press', 'Incline Bench Press', 'Incline Dumbbell Flye', 'Cable Crossover'])).toEqual({ first: 'Bench Press', others: 'dhe 3 të tjera' })
    expect(programSummary(sq, ['Bench Press', 'Cable Crossover'])).toEqual({ first: 'Bench Press', others: 'dhe 1 tjetër' })
    expect(programSummary(sq, ['Bench Press'])).toEqual({ first: 'Bench Press', others: null })
    expect(programSummary(en, ['Bench Press', 'Incline Bench Press', 'Cable Crossover'])).toEqual({ first: 'Bench Press', others: 'and 2 more' })
    expect(programSummary(en, ['Bench Press', 'Cable Crossover'])?.others).toBe('and 1 more')
    // Pa program, ose grupi nuk punon këtë javë: karta thotë vetëm "Më shumë".
    expect(programSummary(sq, [])).toBeNull()
  })

  it('katalogu ka funksionin e çdo grupi (emri vjen nga @/i18n/domain), emrin e çdo çelësi, çdo muskul të thellë dhe çdo perimetër', () => {
    const keys = new Set(Object.keys(catalog))
    for (const group of MUSCLE_GROUPS) {
      expect(keys.has(`muscle.${group.id}`), group.id).toBe(true)
      expect(keys.has(`bodyModel.role.${group.id}`), group.id).toBe(true)
      for (const key of group.keys) expect(keys.has(`bodyModel.key.${key}`), key).toBe(true)
    }
    for (const entry of DEEP_ENTRIES) {
      for (const field of ['name', 'where', 'cover', 'title', 'text', 'source']) expect(keys.has(`bodyModel.deep.${entry.id}.${field}`), `${entry.id}.${field}`).toBe(true)
    }
    for (const measure of SHAPE_MEASURES) expect(keys.has(`bodyModel.measure.${measure.id}`), measure.id).toBe(true)
  })
})
