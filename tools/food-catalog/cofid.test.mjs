// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { parseValue, readCofid } from './cofid.mjs'
import { readSheet, sheetList, sharedStrings } from './xlsx.mjs'

const fixture = fileURLToPath(new URL('./fixtures/cofid/cofid-mini.xlsx', import.meta.url))
const byId = (rows) => Object.fromEntries(rows.map((row) => [row.source_id, row]))

describe('lexuesi XLSX', () => {
  it('lista e fletëve sipas workbook.xml, vargjet e përbashkëta dhe vargjet brenda qelizës', () => {
    expect(sheetList(fixture).map((sheet) => sheet.name)).toEqual(['List of tables', '1.3 Proximates'])
    expect(sharedStrings(fixture)).toContain('Oats, rolled')
    const rows = readSheet(fixture, '1.3 Proximates')
    const ackee = rows.find((entry) => entry.cells.A === '11-002').cells
    expect(ackee).toMatchObject({ B: 'Ackee & co', C: 'Test', K: 15.2, J: '2.9' })
  })

  it('një fletë që nuk ekziston është gabim', () => {
    expect(() => readSheet(fixture, 'Nuk ka')).toThrow(/Nuk ka/)
  })
})

describe('vlerat e CoFID', () => {
  it('tekst, numër, "Tr" (gjurmë) dhe "N" (pa vlerë të besueshme)', () => {
    expect(parseValue('76.7')).toEqual({ value: 76.7, kind: 'number' })
    expect(parseValue(151)).toEqual({ value: 151, kind: 'number' })
    expect(parseValue('0.0')).toEqual({ value: 0, kind: 'number' })
    expect(parseValue('Tr')).toEqual({ value: 0, kind: 'trace' })
    expect(parseValue('N')).toEqual({ value: null, kind: 'no_value' })
    expect(parseValue(undefined)).toEqual({ value: null, kind: 'missing' })
    expect(parseValue(' ')).toEqual({ value: null, kind: 'missing' })
  })
})

describe('leximi i CoFID', () => {
  const { rows, dropped, adjusted } = readCofid(fixture, 5)
  const food = byId(rows)

  it('shkruan rreshtin e njëtrajtshëm me burim, licencë, version, ID, emër dhe grup', () => {
    expect(food['11-001']).toEqual({
      id: 'cofid-11-001',
      source: 'cofid',
      source_id: '11-001',
      license: 'OGL-3.0',
      name_en: 'Oats, rolled',
      name_source: null,
      food_group: 'Cereals and cereal products',
      kcal: 375,
      protein_g: 11,
      carbs_g: 60,
      fat_g: 9,
      fiber_g: 8,
      portions: [],
      list_version: 5,
    })
  })

  it('energjia është KCALS (qelizë tekst ose numër); fibra është vetëm AOAC, pa të bie në null (jo NSP)', () => {
    expect(food['11-002']).toMatchObject({ kcal: 151, protein_g: 2.9, fat_g: 15.2, carbs_g: 0.8, fiber_g: null })
  })

  it('"Tr" bëhet 0 dhe numërohet', () => {
    expect(food['11-003']).toMatchObject({ carbs_g: 0, fiber_g: 0, kcal: 16 })
    expect(adjusted.trace_to_zero).toBe(2)
  })

  it('karbohidratet në ekuivalent monosaharidi: 100–106 g bëhen 100 (e numëruar), mbi 106 hiqet', () => {
    expect(food['11-009']).toMatchObject({ carbs_g: 100, kcal: 394 })
    expect(adjusted.carbs_clamped).toBe(1)
  })

  it('"N" te energjia ose te një makro e heq rreshtin; pijet për 100 ml dhe kodet e dyfishta hiqen', () => {
    expect(rows.map((row) => row.source_id)).toEqual(['11-001', '11-002', '11-003', '11-009', '11-008'])
    expect(dropped).toEqual({ no_kcal: 1, no_macros: 1, per_100ml: 1, duplicate_code: 2, carbs_over_limit: 1 })
  })

  it('asnjë rresht i fixture nuk kërkon kcal_flag; grupi i mishit vjen nga shkronja e parë', () => {
    expect(rows.some((row) => row.kcal_flag)).toBe(false)
    expect(food['11-008'].food_group).toBe('Meat and meat products')
  })

  it('një skedar që nuk ekziston është gabim', () => {
    expect(() => readCofid(fixture.replace('cofid-mini', 'nuk-ekziston'))).toThrow()
  })
})
