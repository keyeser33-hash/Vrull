// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { parseTeneur, readCiqual } from './ciqual.mjs'

const fixture = fileURLToPath(new URL('./fixtures/ciqual', import.meta.url))
const byId = (rows) => Object.fromEntries(rows.map((row) => [row.source_id, row]))

describe('vlerat e `teneur` të Ciqual', () => {
  it('numrat me presje, "traces", "< x" dhe "-"', () => {
    expect(parseTeneur('59,7')).toEqual({ value: 59.7, kind: 'number' })
    expect(parseTeneur(' 1 140 ')).toEqual({ value: 1140, kind: 'number' })
    expect(parseTeneur('0')).toEqual({ value: 0, kind: 'number' })
    expect(parseTeneur('traces')).toEqual({ value: 0, kind: 'traces' })
    expect(parseTeneur('< 0,5')).toEqual({ value: 0, kind: 'below_limit' })
    expect(parseTeneur('<0,01')).toEqual({ value: 0, kind: 'below_limit' })
    expect(parseTeneur('-')).toEqual({ value: null, kind: 'missing' })
    expect(parseTeneur(null)).toEqual({ value: null, kind: 'missing' })
    expect(parseTeneur('abc')).toEqual({ value: null, kind: 'missing' })
  })
})

describe('leximi i Ciqual', () => {
  const { rows, dropped, adjusted } = readCiqual(fixture, 4)
  const food = byId(rows)

  it('shkruan rreshtin e njëtrajtshëm me burim, licencë, version, ID, emër anglisht dhe emër frëngjisht', () => {
    expect(food['100']).toEqual({
      id: 'ciqual-100',
      source: 'ciqual',
      source_id: '100',
      license: 'etalab-2.0',
      name_en: 'Almond, dried',
      name_source: 'Amande, sèche',
      food_group: 'fruits, vegetables, pulses and nuts',
      kcal: 612,
      protein_g: 21.2,
      carbs_g: 5.2,
      fat_g: 52.5,
      fiber_g: 12.5,
      portions: [],
      list_version: 4,
    })
  })

  it('energjia vjen nga 328 (Rregullorja 1169/2011), jo nga 327 (kJ) as 333 (Jones); proteina nga 25003', () => {
    expect(food['100'].kcal).toBe(612)
    expect(food['100'].protein_g).toBe(21.2)
  })

  it('proteina bie te 25000 kur 25003 mungon', () => {
    expect(food['104']).toMatchObject({ protein_g: 2.5, kcal: 50, fiber_g: 1.1 })
  })

  it('"traces" dhe "< x" bëhen 0, "-" te fibrat bëhet null', () => {
    expect(food['101']).toMatchObject({ fat_g: 0, fiber_g: 0, carbs_g: 2.6 })
    expect(food['102']).toMatchObject({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: null })
    expect(adjusted).toEqual({ traces_to_zero: 5, below_limit_to_zero: 1 })
  })

  it('pa energji ose pa makro hiqet dhe numërohet sipas arsyes', () => {
    expect(food['103']).toBeUndefined()
    expect(food['105']).toBeUndefined()
    expect(dropped).toEqual({ no_kcal: 1, no_macros: 1, no_name: 0 })
    expect(rows.map((row) => row.source_id)).toEqual(['100', '101', '102', '104', '106'])
  })

  it('emri frëngjisht del vetëm kur ndryshon; entitetet XML dekodohen', () => {
    expect(food['106'].name_source).toBeNull()
    expect(food['104'].name_en).toBe('Tomato sauce & basil')
  })

  it('kcal jashtë 15 % të 4P+4K+9Y merr kcal_flag (alkooli)', () => {
    expect(food['106'].kcal_flag).toBe(true)
    expect(food['100'].kcal_flag).toBeUndefined()
  })

  it('grupi vjen nga alim_grp_nom_eng; asnjë porcion', () => {
    expect(food['102'].food_group).toBe('water')
    expect(rows.every((row) => row.portions.length === 0)).toBe(true)
  })
})
