import {
  foodName,
  mealName,
  muscleName,
  nameInSentence,
  portionText,
  programBlockName,
  programDayName,
  programWeekLabel,
  supplementDose,
  supplementEvidence,
  supplementName,
} from './domain'
import { i18nFor } from './index'

// Emrat e domenit për çdo ekran: grupet e muskujve dhe emrat e Shortcut to Size sipas gjuhës.

const sq = i18nFor('sq').t
const en = i18nFor('en').t

describe('emrat e ushqimit', () => {
  it('vaktet sipas çelësit', () => {
    expect(mealName(sq, 'snack_am')).toBe('Snack paradite')
    expect(mealName(en, 'snack_am')).toBe('Morning snack')
    expect(mealName(en, 'post_workout')).toBe('Post-workout')
  })

  it('ushqimet e shabllonit përkthehen kur emri është ende ai i planit; të tjerët mbeten siç janë', () => {
    expect(foodName(sq, { name: 'Tërshërë e gatuar', sourceId: 'jim:oatmeal' })).toBe('Tërshërë e gatuar')
    expect(foodName(en, { name: 'Tërshërë e gatuar', sourceId: 'jim:oatmeal' })).toBe('Cooked oats')
    expect(foodName(en, { name: 'Bukë integrale', sourceId: 'jim:wheat_bread' })).toBe('Wholemeal bread')
    // Një emër tjetër te i njëjti burim, Open Food Facts, USDA dhe ushqimet e përdoruesit: siç vijnë.
    expect(foodName(en, { name: 'Tërshëra ime', sourceId: 'jim:oatmeal' })).toBe('Tërshëra ime')
    expect(foodName(en, { name: 'Hazelnuts, raw', sourceId: '171477' })).toBe('Hazelnuts, raw')
    expect(foodName(en, { name: 'Bukë e zezë', sourceId: null })).toBe('Bukë e zezë')
    expect(foodName(en, { name: 'Vezë', sourceId: 'jim:nuk-ekziston' })).toBe('Vezë')
    // Ushqimi që nuk gjendet më.
    expect(foodName(sq, { name: null, sourceId: null })).toBe('Ushqim')
    expect(foodName(en, { name: null, sourceId: null })).toBe('Food')
  })

  it('sasitë e shabllonit me shumësin e gjuhës; gramët me hapësirë që nuk thyhet', () => {
    const { fmt: sqFmt } = i18nFor('sq')
    const { fmt: enFmt } = i18nFor('en')
    expect(portionText(sq, sqFmt, { count: 2, unit: 'slice' })).toBe('2 feta')
    expect(portionText(sq, sqFmt, { count: 1, unit: 'slice' })).toBe('1 fetë')
    expect(portionText(en, enFmt, { count: 2, unit: 'slice' })).toBe('2 slices')
    expect(portionText(en, enFmt, { count: 1, unit: 'cup' })).toBe('1 cup')
    expect(portionText(sq, sqFmt, { count: 1, unit: 'halfMelon' })).toBe('½ pjepër')
    expect(portionText(en, enFmt, { count: 2, unit: 'scoopShake' })).toBe('2 scoops in a shake')
    expect(portionText(en, enFmt, { count: 227, unit: 'gram' })).toBe('227 g')
  })

  it('emri brenda fjalisë: me shkronjë të vogël, përveç shkurtimeve', () => {
    expect(nameInSentence('Pluhur proteine', 'sq')).toBe('pluhur proteine')
    expect(nameInSentence('Creatine', 'en')).toBe('creatine')
    expect(nameInSentence('ZMA', 'en')).toBe('ZMA')
    expect(nameInSentence('BCAA', 'sq')).toBe('BCAA')
    expect(nameInSentence('Clif Bar', 'en')).toBe('clif bar')
  })

  it('suplementet e planit: emri, doza dhe evidenca; një emër ose dozë e ndryshuar mbetet', () => {
    expect(supplementName(en, 'Kreatinë')).toBe('Creatine')
    expect(supplementName(sq, 'Kreatinë')).toBe('Kreatinë')
    expect(supplementName(en, 'Omega 3')).toBe('Omega 3')
    expect(supplementDose(en, 'Kreatinë', '1,5–5 g')).toBe('1.5–5 g')
    expect(supplementDose(en, 'Multivitaminë', '1 dozë')).toBe('1 dose')
    expect(supplementDose(en, 'Kreatinë', '3 g')).toBe('3 g')
    expect(supplementDose(en, 'Omega 3', '2 kapsula')).toBe('2 kapsula')
    expect(supplementEvidence(en, 'ZMA', 'weak')).toBe('Weak without a deficiency')
    expect(supplementEvidence(sq, 'ZMA', 'weak')).toBe('E dobët pa mungesë')
    expect(supplementEvidence(en, 'Omega 3', 'moderate')).toBe('Moderate')
  })
})

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
