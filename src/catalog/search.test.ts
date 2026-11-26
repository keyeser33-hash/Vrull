import { buildIndex, commonPortion, normalize, searchCatalog } from './search'
import type { CatalogFood } from './types'

const food = (overrides: Partial<CatalogFood> & { id: string; nameEn: string }): CatalogFood => ({
  nameSq: null,
  nameSqChecked: false,
  group: 'G',
  source: 'usda_sr_legacy',
  license: 'CC0-1.0',
  kcal: 100,
  proteinG: 5,
  carbsG: 10,
  fatG: 2,
  fiberG: null,
  portions: [],
  alsoIn: [],
  commonRank: null,
  dish: null,
  ...overrides,
})

const egg = food({ id: 'usda-fdc-1', nameEn: 'Egg, whole, raw, fresh', nameSq: 'Vezë', commonRank: 3 })
const eggBoiled = food({ id: 'usda-fdc-2', nameEn: 'Egg, whole, cooked, hard-boiled', nameSq: 'Vezë e zier', commonRank: 4 })
const eggWhiteFrench = food({ id: 'ciqual-1', source: 'ciqual', nameEn: 'Egg white, raw' })
const eggnog = food({ id: 'usda-fdc-3', nameEn: 'Eggnog' })
const cheese = food({ id: 'usda-fdc-4', nameEn: 'Cheese, feta', nameSq: 'Djathë i bardhë', commonRank: 10 })
const cheddar = food({ id: 'usda-fdc-5', nameEn: 'Cheese, cheddar', nameSq: 'Djathë çedar', commonRank: 11 })
const chicken = food({ id: 'usda-fdc-6', nameEn: 'Chicken, breast, raw', nameSq: 'Gjoks pule', commonRank: 1 })
const chickpeas = food({ id: 'usda-fdc-7', nameEn: 'Chickpeas, cooked', nameSq: 'Qiqra e gatuar', commonRank: 50 })
const yoghurt = food({ id: 'usda-fdc-8', nameEn: 'Yogurt, plain, whole milk', nameSq: 'Kos', commonRank: 5 })
const kosher = food({ id: 'usda-fdc-9', nameEn: 'Kosher salt' })
const oats = food({ id: 'usda-fdc-10', nameEn: 'Oats', nameSq: 'Tërshërë', commonRank: 7 })
const oatsFndds = food({ id: 'usda-fdc-11', source: 'usda_fndds', nameEn: 'Oatmeal, cooked, made with water' })
const all = [eggnog, eggWhiteFrench, kosher, chickpeas, oatsFndds, cheddar, cheese, egg, eggBoiled, chicken, yoghurt, oats]
const index = buildIndex(all)
const ids = (query: string, options?: Parameters<typeof searchCatalog>[2]) => searchCatalog(index, query, options).map((item) => item.id)

const dish = (overrides: Partial<CatalogFood> = {}) =>
  food({
    id: 'vrull-dish-byrek-me-spinaq',
    source: 'vrull_recipe',
    license: 'Vrull-recipe',
    nameEn: 'Spinach byrek',
    nameSq: 'Byrek me spinaq',
    nameSqChecked: true,
    commonRank: 914,
    portions: [{ label: '1 piece', grams: 136 }],
    dish: { ingredients: [], source: { label: 'x', title: 'y', url: null }, estimates: [], estimate: true, readers: false, note: { sq: 'a', en: 'b' }, portion: { sq: '1 copë', en: '1 piece' } },
    ...overrides,
  })

describe('pjatat shqiptare te kërkimi', () => {
  const dishes = [
    dish(),
    dish({ id: 'vrull-dish-tave-kosi', nameEn: 'Baked lamb with yoghurt', nameSq: 'Tavë kosi', commonRank: 915 }),
    dish({ id: 'vrull-dish-fasule', nameEn: 'White bean stew', nameSq: 'Fasule', commonRank: 916 }),
    dish({ id: 'vrull-dish-flija', nameEn: 'Flija', nameSq: 'Flija', commonRank: 917 }),
    egg,
    cheese,
  ]
  const dishIndex = buildIndex(dishes)
  const found = (query: string) => searchCatalog(dishIndex, query).map((item) => item.id)

  it('"byrek", "tave kosi" (pa ë), "fasule" dhe "flija" i gjejnë pjatat, edhe me emrin anglisht', () => {
    expect(found('byrek')).toEqual(['vrull-dish-byrek-me-spinaq'])
    expect(found('tave kosi')).toEqual(['vrull-dish-tave-kosi'])
    expect(found('FASULE')).toEqual(['vrull-dish-fasule'])
    expect(found('flija')).toEqual(['vrull-dish-flija'])
    expect(found('lamb yoghurt')).toEqual(['vrull-dish-tave-kosi'])
  })

  it('emri që është saktësisht kërkesa del i pari, para ushqimeve më të zakonshme që e kanë fjalën', () => {
    const beans = food({ id: 'usda-fdc-90', nameEn: 'Beans, white, cooked', nameSq: 'Fasule të bardha, të ziera', commonRank: 20 })
    const list = buildIndex([beans, dish({ id: 'vrull-dish-fasule', nameEn: 'White bean stew', nameSq: 'Fasule', commonRank: 916 })])
    expect(searchCatalog(list, 'fasule').map((item) => item.id)).toEqual(['vrull-dish-fasule', 'usda-fdc-90'])
    expect(searchCatalog(list, 'Fasulë').map((item) => item.id)).toEqual(['vrull-dish-fasule', 'usda-fdc-90'])
    expect(searchCatalog(list, 'white bean stew').map((item) => item.id)).toEqual(['vrull-dish-fasule'])
  })

  it('pjata që fillon me kërkesën del para përbërësit me të njëjtën fjalë: "byrek" jep byrekët para petës', () => {
    const pastry = food({ id: 'usda-fdc-91', nameEn: 'Phyllo dough', nameSq: 'Petë byreku (filo)', commonRank: 300 })
    const list = buildIndex([pastry, dish(), dish({ id: 'vrull-dish-byrek-me-mish', nameEn: 'Minced meat byrek', nameSq: 'Byrek me mish', commonRank: 920 })])
    expect(searchCatalog(list, 'byrek').map((item) => item.id)).toEqual(['vrull-dish-byrek-me-spinaq', 'vrull-dish-byrek-me-mish', 'usda-fdc-91'])
    expect(searchCatalog(list, 'pete').map((item) => item.id)).toEqual(['usda-fdc-91'])
  })

  it('porcioni i pjatës ndjek gjuhën, edhe kur etiketa nuk fillon me "1 njësi" të shkurtër', () => {
    expect(commonPortion(dish(), 'sq')).toEqual({ label: '1 copë', grams: 136 })
    expect(commonPortion(dish(), 'en')).toEqual({ label: '1 piece', grams: 136 })
    const japrak = dish({ portions: [{ label: '1 serving (6 rolls)', grams: 295 }], dish: { ...dish().dish!, portion: { sq: '1 porcion (6 japrak)', en: '1 serving (6 rolls)' } } })
    expect(commonPortion(japrak, 'sq')).toEqual({ label: '1 porcion (6 japrak)', grams: 295 })
  })
})

describe('normalizimi', () => {
  it('heq diakritikat dhe shkronjat e mëdha: ë, ç, é', () => {
    expect(normalize('Vezë')).toBe('veze')
    expect(normalize('DJATHË')).toBe('djathe')
    expect(normalize('Çedar')).toBe('cedar')
    expect(normalize('Crème brûlée')).toBe('creme brulee')
  })

  it('shenjat e pikësimit bëhen hapësira dhe hapësirat e shumta një', () => {
    expect(normalize('  Egg,  whole -raw ')).toBe('egg whole raw')
  })
})

describe('kërkimi', () => {
  it('"veze" gjen "Vezë" dhe "djath" gjen "Djathë", pa diakritika dhe me fjalë të pjesshme', () => {
    expect(ids('veze')).toContain(egg.id)
    expect(ids('vezë')).toContain(egg.id)
    expect(ids('djath')).toEqual([cheese.id, cheddar.id])
  })

  it('gjen edhe me emrin anglisht', () => {
    expect(ids('chicken')).toEqual([chicken.id])
    expect(ids('oats')[0]).toBe(oats.id)
    expect(ids('chick')).toEqual([chicken.id, chickpeas.id])
  })

  it('çdo fjalë e kërkesës duhet të gjendet, në çdo radhë', () => {
    expect(ids('veze zier')).toEqual([eggBoiled.id])
    expect(ids('zier veze')).toEqual([eggBoiled.id])
    expect(ids('cheese feta')).toEqual([cheese.id])
    expect(ids('veze banane')).toEqual([])
  })

  it('të zakonshmet para të tjerave, sipas radhës; pastaj fillimi i emrit', () => {
    expect(ids('egg')).toEqual([egg.id, eggBoiled.id, eggnog.id, eggWhiteFrench.id])
    // "Kos" i zakonshëm para "Kosher salt" (që e ka "kos" vetëm si fillim të fjalës pa qenë i zakonshëm).
    expect(ids('kos')).toEqual([yoghurt.id, kosher.id])
  })

  it('një fjalë që fillon me kërkesën shkon para asaj që e ka brenda', () => {
    const inside = food({ id: 'usda-fdc-20', nameEn: 'Pork sausage' })
    const starts = food({ id: 'usda-fdc-21', nameEn: 'Sausage, pork' })
    const other = buildIndex([inside, starts])
    expect(searchCatalog(other, 'sausage').map((item) => item.id)).toEqual([starts.id, inside.id])
    expect(searchCatalog(other, 'ausage')).toHaveLength(2)
  })

  it('pa kërkim ose me hapësira nuk kthen asgjë; kufiri i rezultateve respektohet', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
    expect(ids('e', { limit: 2 })).toHaveLength(2)
  })

  it('hiq ushqimet që përdoruesi i ka tashmë (id të përjashtuara)', () => {
    expect(ids('veze', { exclude: new Set([egg.id]) })).toEqual([eggBoiled.id])
  })

  it('burimi i preferuar para te njëjtat emra të mbetur (USDA para FNDDS)', () => {
    expect(ids('oat')).toEqual([oats.id, oatsFndds.id])
  })
})

describe('porcioni i zakonshëm', () => {
  const portions = (...items: [string, number][]) => items.map(([label, grams]) => ({ label, grams }))

  it('i pari me një njësi; pa porcione 100 g', () => {
    expect(commonPortion(food({ id: 'usda-fdc-30', nameEn: 'x', portions: portions(['1 large', 50], ['1 cup', 243]) }))).toEqual({ label: '1 large', grams: 50 })
    expect(commonPortion(food({ id: 'usda-fdc-31', nameEn: 'x' }))).toEqual({ label: null, grams: 100 })
  })

  it('"2 tablespoon", etiketat e gjata dhe gramët e pavlefshme anashkalohen', () => {
    const skipped = portions(['2 tablespoon', 33.9], ['1 cup (4.86 large eggs)', 243], ['1 bad', 0], ['1 tub', 5000], ['1 slice', 30])
    expect(commonPortion(food({ id: 'usda-fdc-32', nameEn: 'x', portions: skipped }))).toEqual({ label: '1 slice', grams: 30 })
    expect(commonPortion(food({ id: 'usda-fdc-33', nameEn: 'x', portions: portions(['2 tablespoon', 33.9]) }))).toEqual({ label: null, grams: 100 })
  })
})
