import { buildAppFiles, FIELDS as TOOL_FIELDS } from '../../tools/food-catalog/app-file.mjs'
import { decodeFile, decodeRows, FIELDS } from './decode'
import type { CatalogFile } from './types'

// Rrethi i plotë: rreshtat e ndërtimit → skedari i app-it (tools/food-catalog/app-file.mjs) → rreshtat e telefonit.
const base = {
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
}
const rows = [
  { ...base, name_sq: 'Vezë', name_sq_checked: false, also_in: ['ciqual-22000'], common_rank: 3 },
  { ...base, id: 'ciqual-22000', source: 'ciqual', source_id: '22000', license: 'etalab-2.0', name_en: 'Egg, raw', fiber_g: null, portions: [] },
]

describe('dekodimi i skedarit të app-it', () => {
  it('radha e fushave është e njëjtë me ndërtuesin', () => {
    expect([...FIELDS]).toEqual(TOOL_FIELDS)
  })

  const built = buildAppFiles(rows)

  it('rreshti i zakonshëm merr emrin shqip, burimin, licencën dhe "edhe te"', () => {
    const [egg] = decodeFile(built.common as CatalogFile)
    expect(egg).toEqual({
      id: 'usda-fdc-171287',
      nameEn: 'Egg, whole, raw, fresh',
      nameSq: 'Vezë',
      nameSqChecked: false,
      group: 'Dairy and Egg Products',
      source: 'usda_sr_legacy',
      license: 'CC0-1.0',
      kcal: 143,
      proteinG: 12.6,
      carbsG: 0.7,
      fatG: 9.5,
      fiberG: 0,
      portions: [{ label: '1 large', grams: 50 }],
      alsoIn: ['ciqual-22000'],
      commonRank: 3,
    })
  })

  it('rreshti me bisht të shkurtuar merr vlerat bosh: pa emër shqip, pa fibra, pa porcione, pa radhë', () => {
    const [other] = decodeFile(built.rest as CatalogFile)
    expect(other).toMatchObject({ id: 'ciqual-22000', source: 'ciqual', license: 'etalab-2.0', nameSq: null, nameSqChecked: false, fiberG: null, portions: [], alsoIn: [], commonRank: null })
  })

  it('emri shqip i kontrolluar del i kontrolluar', () => {
    const checked = buildAppFiles([{ ...rows[0], name_sq_checked: true }])
    expect(decodeFile(checked.common as CatalogFile)[0].nameSqChecked).toBe(true)
  })

  it('një skedar me fusha në radhë tjetër nuk dekodohet në heshtje', () => {
    const wrong = { ...(built.common as CatalogFile), fields: [...(built.common as CatalogFile).fields].reverse() }
    expect(() => decodeFile(wrong)).toThrow(/Fushat/)
  })

  it('rreshtat e ruajtur (pa kokë të rreshtave) dekodohen me kokën e ruajtur', () => {
    const { rows: tuples, ...header } = built.common as CatalogFile
    expect(decodeRows(header, tuples)).toEqual(decodeFile(built.common as CatalogFile))
  })
})
