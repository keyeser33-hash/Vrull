// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { csvObjects, readDataset } from './usda.mjs'

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const byId = (rows) => Object.fromEntries(rows.map((row) => [row.source_id, row]))

describe('leximi i CSV-ve të USDA', () => {
  it('lexon fusha me thonjëza, thonjëza të dyfishta dhe rresht të ri brenda fushës', () => {
    const rows = [...csvObjects('"a","b"\r\n"x ""y"" z","l1\nl2"\r\n"",""\n')]
    expect(rows).toEqual([
      { a: 'x "y" z', b: 'l1\nl2' },
      { a: '', b: '' },
    ])
  })
})

describe('Foundation Foods', () => {
  const { rows, dropped, adjusted } = readDataset('usda_foundation', fixture('foundation'), 7)
  const food = byId(rows)

  it('merr vetëm rreshtat foundation_food dhe i numëron të hequrit sipas arsyes', () => {
    expect(rows.map((row) => row.source_id)).toEqual(['1001', '1002', '1003', '1006', '1008'])
    expect(dropped).toEqual({ no_kcal: 1, no_macros: 1, negative_macro: 0 })
  })

  it('shkruan rreshtin e njëtrajtshëm me burim, licencë, version dhe ID', () => {
    expect(food['1001']).toEqual({
      id: 'usda-fdc-1001',
      source: 'usda_foundation',
      source_id: '1001',
      license: 'CC0-1.0',
      name_en: 'Almonds, raw',
      food_group: 'Nut and Seed Products',
      kcal: 579,
      protein_g: 21.2,
      carbs_g: 21.6,
      fat_g: 49.9,
      fiber_g: 12.5,
      portions: [
        { label_en: '1 cup', grams: 143 },
        { label_en: '2 tablespoon', grams: 28.4 },
      ],
      list_version: 7,
    })
  })

  it('energjia: Atwater specifik (2048), pastaj i përgjithshëm (2047), pastaj 1008 vetëm kur të tjerat mungojnë', () => {
    expect(food['1001'].kcal).toBe(579)
    expect(food['1002'].kcal).toBe(379)
    expect(food['1003'].kcal).toBe(52)
  })

  it('fibra që mungon është null, jo 0', () => {
    expect(food['1002'].fiber_g).toBeNull()
  })

  it('një rresht pa karbohidrate "by difference" hiqet, edhe kur ka "by summation"', () => {
    expect(food['1005']).toBeUndefined()
  })

  it('karbohidrati paksa negativ rrumbullakohet në 0 dhe numërohet', () => {
    expect(food['1006'].carbs_g).toBe(0)
    expect(food['1006'].name_en).toBe('Chicken, thigh, "skin on", raw')
    expect(adjusted).toEqual({ carbs_clamped: 1 })
  })

  it('porcionet: pa gram 0, pa të dyfishta, pa gram që rrumbullakohen në 0, pa rreshtat e tjerë', () => {
    expect(food['1001'].portions).toHaveLength(2)
    expect(food['1003'].portions).toEqual([{ label_en: '1 egg medium', grams: 182 }])
  })

  it('shënon kcal_flag kur kcal del jashtë 15 % të 4P+4K+9Y', () => {
    expect(food['1008'].kcal_flag).toBe(true)
    expect(food['1001'].kcal_flag).toBeUndefined()
  })
})

describe('SR Legacy', () => {
  const { rows, dropped } = readDataset('usda_sr_legacy', fixture('sr_legacy'))
  const food = byId(rows)

  it('merr vetëm sr_legacy_food; energjia është 1008', () => {
    expect(rows.map((row) => row.source_id)).toEqual(['2001', '2002'])
    expect(food['2001']).toMatchObject({ id: 'usda-fdc-2001', source: 'usda_sr_legacy', kcal: 717, protein_g: 0.9, fat_g: 81.1, carbs_g: 0.1, fiber_g: 0, list_version: 1 })
    expect(dropped.no_macros).toBe(1)
  })

  it('etiketat e porcioneve nga sasia, njësia dhe modifikuesi', () => {
    expect(food['2001'].portions).toEqual([
      { label_en: '1 pat (1" sq, 1/3" high)', grams: 5 },
      { label_en: '1 tbsp', grams: 14.2 },
      { label_en: '0.5 cup', grams: 113.5 },
    ])
    expect(food['2002'].portions).toEqual([{ label_en: '1 serving', grams: 28 }])
  })

  it('një ushqim me energji pa makro (vodka) hyn me kcal_flag', () => {
    expect(food['2002']).toMatchObject({ kcal: 231, food_group: 'Beverages', kcal_flag: true })
  })
})

describe('FNDDS', () => {
  const { rows, dropped } = readDataset('usda_fndds', fixture('fndds'))
  const food = byId(rows)

  it('lexon numrat e lëndëve (208, 203, 204, 205, 291), jo ID-të e SR; pa energji hiqet', () => {
    expect(rows.map((row) => row.source_id)).toEqual(['3001', '3002', '3004'])
    expect(dropped.no_kcal).toBe(1)
    expect(food['3001']).toMatchObject({ id: 'usda-fdc-3001', source: 'usda_fndds', kcal: 61, protein_g: 3.2, fat_g: 3.3, carbs_g: 4.8, fiber_g: 0 })
  })

  it('grupi vjen nga kategoria WWEIA', () => {
    expect(food['3001'].food_group).toBe('Milk, whole')
    expect(food['3002'].food_group).toBe('Tea')
  })

  it('porcionet: përshkrimi si etiketë; pa "Quantity not specified" dhe pa gram 0', () => {
    expect(food['3001'].portions).toEqual([{ label_en: '1 cup', grams: 246 }])
    expect(food['3004'].portions).toEqual([{ label_en: '1 egg', grams: 50 }])
  })

  it('ID-të janë unike dhe në formën usda-fdc-<fdc_id>', () => {
    const ids = rows.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^usda-fdc-\d+$/.test(id))).toBe(true)
  })
})
