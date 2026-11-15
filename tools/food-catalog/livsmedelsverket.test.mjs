// @vitest-environment node
import { readFileSync } from 'node:fs'
import { nutrientValue, readLivsmedelsverket } from './livsmedelsverket.mjs'

const text = readFileSync(new URL('./fixtures/livsmedelsverket/livsmedelsverket.json', import.meta.url), 'utf8')
const byId = (rows) => Object.fromEntries(rows.map((row) => [row.source_id, row]))

describe('leximi i Livsmedelsverket', () => {
  const { rows, dropped, adjusted } = readLivsmedelsverket(text, 6)
  const food = byId(rows)

  it('shkruan rreshtin e njëtrajtshëm me burim, licencë, version, emër anglisht dhe suedisht', () => {
    expect(food['120']).toEqual({
      id: 'livsmedelsverket-120',
      source: 'livsmedelsverket',
      source_id: '120',
      license: 'CC-BY-4.0',
      name_en: 'Fermented milk 0.5% fat e.g. lättfil',
      name_source: 'Fil 0,5% fett',
      food_group: 'Fermented milk product',
      kcal: 39,
      protein_g: 3.5,
      carbs_g: 5,
      fat_g: 0.5,
      fiber_g: 0,
      portions: [],
      list_version: 6,
    })
  })

  it('energjia: ENERC me enhet kcal, jo kJ', () => {
    expect(food['200'].kcal).toBe(380)
    expect(food['1'].kcal).toBe(902)
  })

  it('vlera zero logjike (LZ) është 0; fibra që mungon është null, jo 0', () => {
    expect(food['1']).toMatchObject({ protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: null })
  })

  it('pa kcal, pa një makro, ose me makro jo per 100 g pjesë të ngrënshme, rreshti hiqet', () => {
    expect(rows.map((row) => row.source_id)).toEqual(['1', '120', '133', '200'])
    expect(dropped).toEqual({ no_kcal: 1, no_macros: 2, negative_macro: 0, over_100g: 1 })
    expect(nutrientValue(JSON.parse(text).foods[4], 'protein')).toBeNull()
  })

  it('yndyra 102 g (vaj) bëhet 100 dhe numërohet; mbi 105 g hiqet', () => {
    expect(food['133']).toMatchObject({ fat_g: 100, kcal: 902 })
    expect(adjusted).toEqual({ over_100_clamped: 1 })
  })

  it('emri suedisht del vetëm kur ndryshon; grupi në sentence case', () => {
    expect(food['200'].name_source).toBeNull()
    expect(food['200'].food_group).toBe('Cereal product')
  })

  it('asnjë kcal_flag te vlerat e fixture; porcione bosh', () => {
    expect(rows.some((row) => row.kcal_flag)).toBe(false)
    expect(rows.every((row) => row.portions.length === 0)).toBe(true)
  })
})
