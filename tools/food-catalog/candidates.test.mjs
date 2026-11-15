// @vitest-environment node
import { findCandidates, formatCandidate, queryTerms } from './candidates.mjs'

const row = (id, source, name_en, kcal = 100) => ({ id, source, name_en, kcal, protein_g: 1, carbs_g: 2, fat_g: 3 })
const rows = [
  row('ciqual-1', 'ciqual', 'Egg, whole, raw'),
  row('usda-fdc-2', 'usda_fndds', 'Egg, whole, cooked, fried'),
  row('usda-fdc-3', 'usda_foundation', 'Eggs, Grade A, Large, egg whole'),
  row('usda-fdc-4', 'usda_sr_legacy', 'Egg, white, raw, fresh'),
  row('usda-fdc-5', 'usda_foundation', 'Eggplant, raw'),
  row('cofid-6', 'cofid', 'Café au lait'),
]

describe('candidates', () => {
  it('fjalët janë fillime fjalësh: "egg" nuk gjen "eggplant" kur ka fjalë tjetër, por e gjen vetë', () => {
    expect(findCandidates(rows, 'egg whole').map((r) => r.id)).toEqual(['usda-fdc-3', 'usda-fdc-2', 'ciqual-1'])
    expect(findCandidates(rows, 'egg').map((r) => r.id)).toContain('usda-fdc-5')
  })

  it('pa dallim shkronjash dhe theksash; "-fjalë" përjashton', () => {
    expect(findCandidates(rows, 'CAFE').map((r) => r.id)).toEqual(['cofid-6'])
    expect(findCandidates(rows, 'egg -fried -eggplant -white').map((r) => r.id)).toEqual(['usda-fdc-3', 'ciqual-1'])
    expect(queryTerms('a -b')).toEqual({ include: ['a'], exclude: ['b'] })
  })

  it('radha: burimi sipas preferencës, pastaj emri më i shkurtër; --source dhe --limit', () => {
    expect(findCandidates(rows, 'egg')[0].source).toBe('usda_foundation')
    expect(findCandidates(rows, 'egg', { source: 'ciqual' }).map((r) => r.id)).toEqual(['ciqual-1'])
    expect(findCandidates(rows, 'egg', { limit: 2 })).toHaveLength(2)
  })

  it('pa fjalë ose pa përputhje jep listë bosh; formati ka id, burimin, emrin dhe vlerat', () => {
    expect(findCandidates(rows, '')).toEqual([])
    expect(findCandidates(rows, 'zzz')).toEqual([])
    expect(formatCandidate(rows[0])).toBe('ciqual-1\tciqual\tEgg, whole, raw\t100 kcal  P 1  K 2  Y 3')
  })
})
