// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAppFiles, FIELDS, ID_PREFIX, SOURCES } from './app-file.mjs'
import { SOURCE_LICENSES, checkCatalog } from './check.mjs'
import { DISH_ID_PREFIX, DISH_SOURCE, dishLookup, dishRow, dishRows, loadDishFiles, validateDishes } from './dishes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dishDir = join(here, 'dishes')
const dataDir = join(here, '..', '..', 'src', 'catalog', 'data')

/** Ushqimet e Listës nga skedarët e app-it (që e kanë çdo përbërës të recetave), pa pjatat vetë. */
function appCatalogRows() {
  const rows = []
  for (const name of ['foods-common.json', 'foods-rest.json']) {
    const file = JSON.parse(readFileSync(join(dataDir, name), 'utf8'))
    const col = Object.fromEntries(file.fields.map((field, index) => [field, index]))
    for (const tuple of file.rows) {
      const source = file.sources[tuple[col.source]]
      if (source === DISH_SOURCE) continue
      rows.push({
        id: file.idPrefixes[tuple[col.source]] + tuple[col.source_id],
        source,
        kcal: tuple[col.kcal],
        protein_g: tuple[col.protein_g],
        carbs_g: tuple[col.carbs_g],
        fat_g: tuple[col.fat_g],
        fiber_g: tuple[col.fiber_g] ?? null,
      })
    }
  }
  return rows
}

const dishes = loadDishFiles(dishDir)
const lookup = dishLookup(appCatalogRows())
const rows = dishRows(dishes, lookup, { listVersion: 1, firstRank: 100 })
const byId = (id) => rows.find((row) => row.source_id === id)

describe('pjatat shqiptare te Lista e Vrullit', () => {
  it('30 pjata, nga tri skedarët, me ID unike', () => {
    expect(dishes).toHaveLength(30)
    expect(new Set(rows.map((row) => row.id)).size).toBe(30)
    expect(validateDishes(dishes, lookup)).toEqual([])
  })

  // Vlerat e `node check.mjs <skedari>` të hapit të recetave (16.11.2026): për 100 g, pastaj porcioni.
  it.each([
    ['byrek-me-spinaq', 193.8, 6.6, 23.5, 7.5, 136, 264],
    ['flija', 258.8, 4.6, 23.8, 15.7, 150, 388],
    ['fasule', 99.8, 5.1, 10.3, 3.0, 470, 469],
    ['tave-kosi', 153.5, 8.8, 4.0, 11.2, 554, 850],
  ])('makrot e %s dalin si te check.mjs (±0,5)', (id, kcal, protein, carbs, fat, portionG, portionKcal) => {
    const row = byId(id)
    expect(Math.abs(row.kcal - kcal)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(row.protein_g - protein)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(row.carbs_g - carbs)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(row.fat_g - fat)).toBeLessThanOrEqual(0.5)
    expect(row.portions[0].grams).toBe(portionG)
    expect(Math.abs((row.kcal * row.portions[0].grams) / 100 - portionKcal)).toBeLessThanOrEqual(1)
  })

  it('pesha e gatshme (flija 6 300 g) zëvendëson shumën e përbërësve; pa të, shuma e përbërësve', () => {
    const flija = dishes.find((dish) => dish.id === 'flija')
    const sum = flija.ingredients.reduce((total, item) => total + item.grams, 0)
    expect(sum).not.toBe(6300)
    const withoutYield = dishRow({ ...flija, cooked_weight_g: null }, lookup, { listVersion: 1, rank: 1 })
    expect(withoutYield.kcal).not.toBe(byId('flija').kcal)
  })

  it('rreshti ka burimin Vrull, recetë, emrat sq/en të kontrolluar dhe radhën pas të zakonshmeve', () => {
    expect(byId('byrek-me-spinaq')).toMatchObject({
      id: 'vrull-dish-byrek-me-spinaq',
      source: 'vrull_recipe',
      license: SOURCE_LICENSES.vrull_recipe,
      name_sq: 'Byrek me spinaq',
      name_en: 'Spinach byrek',
      name_sq_checked: true,
      common_rank: 100,
      list_version: 1,
    })
    expect(rows.map((item) => item.common_rank)).toEqual(Array.from({ length: 30 }, () => 100))
    expect(rows[0].id.startsWith(DISH_ID_PREFIX)).toBe(true)
  })

  it('burimi i pjatës ruhet me lidhjen, përbërësit si te burimi me gramët dhe ID e Listës', () => {
    const { dish } = byId('byrek-me-spinaq')
    expect(dish.source.url).toMatch(/^https:\/\/shqiptarja\.com\//)
    expect(dish.source.label).toMatch(/Shqiptarja/)
    expect(dish.ingredients[0]).toEqual(['500 gr miell', 500, 'usda-fdc-168894'])
    expect(dish.estimates.length).toBeGreaterThan(0)
  })

  it('"vlerësim" kur pesha e gatshme mungon ose ka estimates; flija mban "recetë e lexuesve"', () => {
    const spinach = dishes.find((dish) => dish.id === 'byrek-me-spinaq')
    const make = (extra) => dishRow({ ...spinach, ...extra }, lookup, { listVersion: 1, rank: 1 }).dish.estimate
    expect(byId('byrek-me-spinaq').dish.estimate).toBe(true)
    expect(make({ estimates: [], cooked_weight_g: 1600 })).toBe(false)
    expect(make({ estimates: [] })).toBe(true)
    expect(byId('flija').dish.readers).toBe(true)
    expect(byId('byrek-me-spinaq').dish.readers).toBe(false)
  })

  it('porcioni që nuk fillon me "1" merr formën "1 porcion", ai me "1" mbetet', () => {
    expect(byId('japrak').dish.portion).toEqual({ sq: '1 porcion', en: '1 serving' })
    expect(byId('japrak').portions).toEqual([{ label_en: '1 serving', grams: 295 }])
    expect(byId('byrek-me-spinaq').dish.portion).toEqual({ sq: '1 copë', en: '1 piece' })
    expect(byId('byrek-me-spinaq').portions).toEqual([{ label_en: '1 piece', grams: 136 }])
  })

  it('një përbërës që nuk është te Lista ndalon ndërtimin', () => {
    const broken = { ...dishes[0], ingredients: [...dishes[0].ingredients, { catalog_id: 'usda-fdc-0', as_in_source: 'asgjë', grams: 10 }] }
    expect(() => dishRow(broken, lookup, { listVersion: 1, rank: 1 })).toThrow(/usda-fdc-0/)
    expect(validateDishes([broken], lookup).join('\n')).toMatch(/usda-fdc-0/)
  })

  it('roja e Listës i pranon rreshtat (kcal brenda 15 % të 4P+4K+9Y, ID, licenca)', () => {
    expect(checkCatalog(rows).errors).toEqual([])
  })

  it('skedari i app-it: pjatat hyjnë te të zakonshmet, me fushën `dish`; rreshtat e tjerë e shkurtojnë', () => {
    const egg = { id: 'usda-fdc-1', source: 'usda_sr_legacy', source_id: '1', license: 'CC0-1.0', name_en: 'Egg', food_group: 'Dairy', kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5, fiber_g: 0, portions: [], list_version: 1 }
    const built = buildAppFiles([egg, ...rows])
    expect(built.common.rows).toHaveLength(30)
    expect(built.rest.rows).toHaveLength(1)
    expect(built.rest.rows[0].length).toBeLessThanOrEqual(FIELDS.indexOf('dish'))
    const [first] = built.common.rows
    expect(first[FIELDS.indexOf('dish')]).toEqual(byId('byrek-me-spinaq').dish)
    expect(first[FIELDS.indexOf('source')]).toBe(SOURCES.indexOf('vrull_recipe'))
    expect(ID_PREFIX.vrull_recipe).toBe(DISH_ID_PREFIX)
    expect(built.common.groups).toContain('Albanian dishes')
  })
})
