// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assemble } from './build.mjs'
import { SOURCE_LICENSES, checkCatalog } from './check.mjs'
import { applyCommon, readCommonDir, validateCommon } from './common-list.mjs'

const row = (id, source, name_en, kcal, extra = {}) => ({
  id,
  source,
  source_id: id.replace(/^[a-z_]+-/, '').replace(/^fdc-/, '') + source,
  license: SOURCE_LICENSES[source],
  name_en,
  food_group: null,
  kcal,
  protein_g: 10,
  carbs_g: 5,
  fat_g: (kcal - 60) / 9,
  fiber_g: null,
  portions: [],
  list_version: 1,
  ...extra,
})
const rows = () => [
  row('usda-fdc-1', 'usda_sr_legacy', 'Egg, whole, raw', 150),
  row('ciqual-2', 'ciqual', 'Oeuf, cru', 155),
  row('cofid-3', 'cofid', 'Egg, chicken, whole, raw', 160),
  row('usda-fdc-4', 'usda_foundation', 'Rice, white, cooked', 130),
  row('livs-5', 'livsmedelsverket', 'Rice, boiled', 135),
  row('ciqual-6', 'ciqual', 'Olive oil', 880),
]
const entry = (extra = {}) => ({
  key: 'egg',
  rank: 1,
  name_sq: 'Vezë e papërpunuar',
  name_en: 'Egg, whole, raw',
  group: 'Vezë',
  preferred: 'usda-fdc-1',
  also: ['ciqual-2', 'cofid-3'],
  ...extra,
})
const rules = (result) => result.errors.map((error) => error.rule)

describe('vërtetimi i të zakonshmeve', () => {
  it('një listë e mirë nuk ka gabime', () => {
    const list = [entry(), entry({ key: 'rice', rank: 2, name_sq: 'Oriz i zier', preferred: 'usda-fdc-4', also: ['livs-5'] })]
    expect(validateCommon(list, rows())).toEqual({ errors: [], notes: [] })
  })

  it('çelësi dhe rank-u i dyfishtë bien', () => {
    const list = [entry(), entry({ preferred: 'usda-fdc-4', also: [] })]
    expect(rules(validateCommon(list, rows()))).toEqual(['key_duplicate', 'rank_duplicate'])
    expect(rules(validateCommon([entry({ key: 'Egg X' })], rows()))).toEqual(['key'])
    expect(rules(validateCommon([entry({ rank: 0 })], rows()))).toEqual(['rank'])
  })

  it('një ID që ekziston te katalogu: e panjohura dhe e dyfishta (edhe mes ushqimeve) bien', () => {
    expect(rules(validateCommon([entry({ also: ['ciqual-2', 'nuk-ka-9'] })], rows()))).toEqual(['id_missing'])
    const twice = [entry(), entry({ key: 'rice', rank: 2, preferred: 'usda-fdc-4', also: ['ciqual-2'] })]
    expect(rules(validateCommon(twice, rows()))).toEqual(['id_duplicate'])
    expect(rules(validateCommon([entry({ also: ['usda-fdc-1'] })], rows()))).toContain('id_duplicate')
  })

  it('name_sq, name_en dhe group nuk janë bosh', () => {
    expect(rules(validateCommon([entry({ name_sq: '  ' })], rows()))).toEqual(['name_sq'])
    expect(rules(validateCommon([entry({ name_en: '' })], rows()))).toEqual(['name_en'])
    expect(rules(validateCommon([entry({ group: undefined })], rows()))).toEqual(['group'])
  })

  it('preferred duhet të jetë i pari sipas radhës, ose të ketë reason', () => {
    const wrong = entry({ preferred: 'ciqual-2', also: ['usda-fdc-1', 'cofid-3'] })
    expect(rules(validateCommon([wrong], rows()))).toEqual(['order'])
    expect(validateCommon([{ ...wrong, reason: 'USDA ka vetëm të gatuarin' }], rows()).errors).toEqual([])
    expect(rules(validateCommon([{ ...wrong, reason: ' ' }], rows()))).toContain('reason')
  })

  it('shënon kur kcal e një also ndryshon mbi 25 %, jo nën të', () => {
    const near = validateCommon([entry()], rows())
    expect(near.notes).toEqual([])
    const far = rows()
    far[1].kcal = 210
    const result = validateCommon([entry()], far)
    expect(result.errors).toEqual([])
    expect(result.notes).toEqual([expect.objectContaining({ key: 'egg', rule: 'kcal_differs' })])
  })
})

describe('zbatimi i të zakonshmeve', () => {
  it('preferred merr name_sq (i pakontrolluar), also_in dhe common_rank; also hiqen; të tjerat mbeten njësoj', () => {
    const { rows: out, common, removed } = applyCommon(rows(), [entry()])
    expect(common).toBe(1)
    expect(removed).toBe(2)
    expect(out.map((r) => r.id)).toEqual(['usda-fdc-1', 'usda-fdc-4', 'livs-5', 'ciqual-6'])
    expect(out[0]).toEqual({ ...rows()[0], name_sq: 'Vezë e papërpunuar', name_sq_checked: false, also_in: ['ciqual-2', 'cofid-3'], common_rank: 1 })
    expect(out[1]).toEqual(rows()[3])
  })

  it('vlerat e burimit nuk përzihen: preferred mban kcal dhe makrot e veta', () => {
    const [first] = applyCommon(rows(), [entry()]).rows
    expect(first.kcal).toBe(150)
    expect(first.source).toBe('usda_sr_legacy')
  })

  it('assemble: numri te summary, rreshtat e hequr dalin nga skedari, roja kalon', () => {
    const parts = [{ source: 'mix', version: 't', rows: rows(), dropped: {}, adjusted: {} }]
    const { jsonl, allJsonl, summary, errors } = assemble(parts, [entry()])
    expect(errors).toEqual([])
    expect(allJsonl.trim().split('\n')).toHaveLength(6)
    expect(summary.sourceTotal).toBe(6)
    expect(summary.total).toBe(4)
    expect(summary.common).toEqual({ count: 1, removedAsDuplicates: 2, errors: 0, notes: [] })
    const out = jsonl.trim().split('\n').map((line) => JSON.parse(line))
    expect(out.map((r) => r.id)).not.toContain('ciqual-2')
    expect(checkCatalog(out).errors).toEqual([])
  })

  it('assemble: gabimet e vërtetimit hyjnë te errors; pa të zakonshme dalja nuk ndryshon', () => {
    const parts = () => [{ source: 'mix', version: 't', rows: rows(), dropped: {}, adjusted: {} }]
    expect(assemble(parts(), [entry({ name_sq: '' })]).errors.map((e) => e.rule)).toContain('common_name_sq')
    const plain = assemble(parts())
    expect(plain.summary.total).toBe(6)
    expect(plain.summary.common.count).toBe(0)
  })
})

describe('roja: fushat e të zakonshmeve', () => {
  it('name_sq i ndërtimit duhet të jetë i pakontrolluar; common_rank dhe also_in duhet të jenë të vlefshme', () => {
    const base = { ...rows()[0], name_sq: 'Vezë', name_sq_checked: false, also_in: ['ciqual-2'], common_rank: 3 }
    expect(checkCatalog([base]).errors).toEqual([])
    expect(checkCatalog([{ ...base, name_sq_checked: true }]).errors.map((e) => e.rule)).toEqual(['name_sq_checked'])
    expect(checkCatalog([{ ...base, common_rank: 0 }]).errors.map((e) => e.rule)).toEqual(['common_rank'])
    expect(checkCatalog([{ ...base, also_in: ['X Y'] }]).errors.map((e) => e.rule)).toEqual(['also_in'])
  })

  it('carbs_note: vetëm vlerat e njohura; computed kërkon fibra', () => {
    const base = { ...rows()[0], carbs_note: 'computed', fiber_g: 2 }
    expect(checkCatalog([base]).errors.map((e) => e.rule)).not.toContain('carbs_note')
    expect(checkCatalog([{ ...base, carbs_note: 'tjetër' }]).errors.map((e) => e.rule)).toContain('carbs_note')
    expect(checkCatalog([{ ...base, fiber_g: null }]).errors.map((e) => e.rule)).toContain('carbs_note')
  })
})

describe('leximi i dosjes', () => {
  it('bashkon skedarët *.json sipas emrit dhe shënon skedarin; refuzon një skedar që nuk është listë', () => {
    const dir = mkdtempSync(join(tmpdir(), 'common-'))
    writeFileSync(join(dir, '002.json'), JSON.stringify([entry({ key: 'b', rank: 2 })]))
    writeFileSync(join(dir, '001.json'), JSON.stringify([entry()]))
    writeFileSync(join(dir, 'shenime.txt'), 'jo')
    expect(readCommonDir(dir).map((item) => [item.file, item.key])).toEqual([['001.json', 'egg'], ['002.json', 'b']])
    writeFileSync(join(dir, '003.json'), '{}')
    expect(() => readCommonDir(dir)).toThrow(/listë/)
  })
})
