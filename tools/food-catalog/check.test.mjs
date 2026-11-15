// @vitest-environment node
import { checkCatalog, kcalWithinTolerance } from './check.mjs'

const good = () => ({
  id: 'usda-fdc-1',
  source: 'usda_sr_legacy',
  source_id: '1',
  license: 'CC0-1.0',
  name_en: 'Butter, salted',
  food_group: 'Dairy and Egg Products',
  kcal: 717,
  protein_g: 0.9,
  carbs_g: 0.1,
  fat_g: 81.1,
  fiber_g: 0,
  portions: [{ label_en: '1 tbsp', grams: 14.2 }],
  list_version: 1,
})
const rules = (rows) => checkCatalog(rows).errors.map((error) => error.rule)

describe('roja e listës', () => {
  it('një rresht i mirë kalon pa gabime dhe pa shënime', () => {
    expect(checkCatalog([good()])).toEqual({ errors: [], notes: [] })
  })

  it('ID e dyfishtë dhe ID me formë të gabuar', () => {
    expect(rules([good(), good()])).toContain('id_duplicate')
    expect(rules([{ ...good(), id: 'USDA 1' }])).toContain('id_format')
  })

  it('burimi, licenca dhe versioni mungojnë ose nuk përputhen', () => {
    expect(rules([{ ...good(), source: undefined }])).toContain('source')
    expect(rules([{ ...good(), license: undefined }])).toContain('license')
    expect(rules([{ ...good(), license: 'CC-BY-4.0' }])).toContain('license')
    expect(rules([{ ...good(), list_version: undefined }])).toContain('list_version')
  })

  it('kcal brenda 15 % të 4P+4K+9Y kalon; jashtë tij pa kcal_flag është gabim; me kcal_flag është shënim', () => {
    expect(kcalWithinTolerance({ kcal: 100, protein_g: 5, carbs_g: 15, fat_g: 2 })).toBe(true)
    const off = { ...good(), kcal: 400 }
    expect(rules([off])).toContain('kcal_mismatch')
    const flagged = checkCatalog([{ ...off, kcal_flag: true }])
    expect(flagged.errors).toEqual([])
    expect(flagged.notes.map((note) => note.rule)).toEqual(['kcal_flag'])
  })

  it('kcal 0 pa makro kalon, kcal mbi 0 pa makro kërkon shenjën', () => {
    const water = { ...good(), kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: null }
    expect(rules([water])).toEqual([])
    expect(rules([{ ...water, kcal: 5 }])).toContain('kcal_mismatch')
  })

  it('vlera negative dhe mbi 100 g për 100 g', () => {
    expect(rules([{ ...good(), carbs_g: -0.1 }])).toContain('negative')
    expect(rules([{ ...good(), kcal: -1 }])).toContain('kcal_range')
    expect(rules([{ ...good(), fat_g: 100.5, kcal_flag: true }])).toContain('over_100g')
    expect(rules([{ ...good(), fiber_g: 101 }])).toContain('over_100g')
  })

  it('yndyra e pastër me 902 kcal kalon; mbi 950 jo', () => {
    const fat = { ...good(), kcal: 902, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: null }
    expect(rules([fat])).toEqual([])
    expect(rules([{ ...fat, kcal: 951, kcal_flag: true }])).toContain('kcal_range')
  })

  it('porcionet duhet të kenë etiketë dhe gram > 0', () => {
    expect(rules([{ ...good(), portions: [{ label_en: '1 cup', grams: 0 }] }])).toContain('portion_grams')
    expect(rules([{ ...good(), portions: [{ label_en: '', grams: 5 }] }])).toContain('portion_label')
    expect(rules([{ ...good(), portions: 'x' }])).toContain('portions')
  })

  it('emri dhe source_id brenda kufijve të migrimit', () => {
    expect(rules([{ ...good(), name_en: '' }])).toContain('name_en')
    expect(rules([{ ...good(), name_en: 'x'.repeat(201) }])).toContain('name_en')
    expect(rules([{ ...good(), source_id: 'x'.repeat(81) }])).toContain('source_id')
  })
})
