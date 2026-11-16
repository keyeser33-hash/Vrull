// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAppFiles, encodeRow, FIELDS, SOURCES, sourceVersions, writeAppFiles } from './app-file.mjs'

const row = (overrides = {}) => ({
  id: 'usda-fdc-171287',
  source: 'usda_sr_legacy',
  source_id: '171287',
  license: 'CC0-1.0',
  name_en: 'Egg, whole, raw, fresh',
  food_group: 'Dairy and Egg Products',
  kcal: 143,
  protein_g: 12.6,
  carbs_g: 0.7,
  fat_g: 9.5,
  fiber_g: 0,
  portions: [{ label_en: '1 large', grams: 50 }],
  list_version: 1,
  ...overrides,
})
const common = (overrides = {}) => row({ name_sq: 'Vezë', name_sq_checked: false, also_in: ['ciqual-22000'], common_rank: 3, ...overrides })

describe('skedari i app-it', () => {
  it('rreshti kodohet sipas FIELDS dhe bishti bosh shkurtohet', () => {
    const groups = []
    expect(encodeRow(row({ portions: [], fiber_g: undefined }), groups)).toEqual(['171287', 'Egg, whole, raw, fresh', SOURCES.indexOf('usda_sr_legacy'), 0, 143, 12.6, 0.7, 9.5])
    expect(groups).toEqual(['Dairy and Egg Products'])
    const full = encodeRow(common(), groups)
    expect(full).toHaveLength(FIELDS.length)
    expect(full.slice(9)).toEqual([[['1 large', 50]], 'Vezë', 0, ['ciqual-22000'], 3])
  })

  it('emri shqip i kontrolluar vihet 1, i pakontrolluari 0', () => {
    expect(encodeRow(common({ name_sq_checked: true }), [])[FIELDS.indexOf('name_sq_checked')]).toBe(1)
    expect(encodeRow(common({ name_sq_checked: false }), [])[FIELDS.indexOf('name_sq_checked')]).toBe(0)
  })

  it('ID që nuk del nga burimi, licenca që nuk i përket burimit dhe burimi i panjohur ndalojnë kodimin', () => {
    expect(() => encodeRow(row({ id: 'usda-fdc-1' }), [])).toThrow(/ID nuk del/)
    expect(() => encodeRow(row({ license: 'CC-BY-4.0' }), [])).toThrow(/Licenca/)
    expect(() => encodeRow(row({ source: 'frida' }), [])).toThrow(/Burim i panjohur/)
  })

  it('të zakonshmet dalin sipas radhës, pjesa tjetër mbetet, grupet ndahen mes dy skedarëve', () => {
    const rows = [
      row({ id: 'usda-fdc-2', source_id: '2', food_group: 'Fruits' }),
      common({ id: 'usda-fdc-3', source_id: '3', common_rank: 2 }),
      common({ id: 'usda-fdc-4', source_id: '4', common_rank: 1, food_group: 'Fruits' }),
    ]
    const built = buildAppFiles(rows)
    expect(built.common.rows.map((tuple) => tuple[0])).toEqual(['4', '3'])
    expect(built.rest.rows.map((tuple) => tuple[0])).toEqual(['2'])
    expect(built.common.groups).toEqual(['Fruits', 'Dairy and Egg Products'])
    expect(built.rest.groups).toBe(built.common.groups)
    expect(built.rest.rows[0][FIELDS.indexOf('group')]).toBe(0)
    expect(built.total).toBe(3)
  })

  it('versione të përziera të listës nuk kodohen', () => {
    expect(() => buildAppFiles([row(), row({ id: 'usda-fdc-2', source_id: '2', list_version: 2 })])).toThrow(/versione/)
  })

  it('shkruan tre skedarët me versionin, numrat dhe madhësitë', () => {
    const dir = mkdtempSync(join(tmpdir(), 'food-app-'))
    const meta = writeAppFiles([row(), common({ id: 'usda-fdc-9', source_id: '9' })], dir)
    expect(meta).toMatchObject({ version: 1, total: 2, common: { count: 1 }, rest: { count: 1 } })
    expect(meta.common.gzipBytes).toBeGreaterThan(0)
    expect(meta.sourceVersions).toEqual({})
    expect(JSON.parse(readFileSync(join(dir, 'foods-meta.json'), 'utf8'))).toEqual(meta)
    expect(JSON.parse(readFileSync(join(dir, 'foods-common.json'), 'utf8')).part).toBe('common')
    expect(JSON.parse(readFileSync(join(dir, 'foods-rest.json'), 'utf8')).part).toBe('rest')
  })

  it('versionet e burimeve vijnë nga summary.json i ndërtimit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'food-app-'))
    const summary = join(dir, 'summary.json')
    writeFileSync(summary, JSON.stringify({ bySource: { usda_sr_legacy: { rows: 1, version: '2018-04' }, ciqual: { rows: 1, version: '2025-11-03' }, cofid: { rows: 1 } } }))
    expect(sourceVersions(summary)).toEqual({ usda_sr_legacy: '2018-04', ciqual: '2025-11-03' })
    expect(sourceVersions(join(dir, 'mungon.json'))).toEqual({})
    expect(writeAppFiles([row()], dir, summary).sourceVersions).toEqual({ usda_sr_legacy: '2018-04', ciqual: '2025-11-03' })
  })
})
