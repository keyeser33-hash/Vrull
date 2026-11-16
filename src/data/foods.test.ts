import { createDatabase } from './db'
import type { CatalogFood } from '@/catalog/types'
import { createCustomFood, foodById, recentFoods, saveCatalogFood, saveExternalFood, searchFoods } from './foods'
import { logFood, logTemplateMeal, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'
const DAY = '2026-12-09'

async function setup() {
  let clock = Date.parse('2026-12-09T08:00:00')
  const store = createLocalStore(createDatabase(`foods-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date((clock += 1000)) })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => new Date('2026-12-01T08:00:00'))
  return store
}

const OFF = {
  source: 'off' as const,
  sourceId: '3017620422003',
  name: 'Nutella',
  brand: 'Ferrero',
  kcal: 539,
  proteinG: 6.3,
  carbsG: 57.5,
  fatG: 30.9,
  fiberG: 0,
  servingG: 15,
  servingLabel: '15 g',
}

describe('ushqimet', () => {
  it('ushqimi i ri gjendet me kërkim, edhe pa ë dhe ç', async () => {
    const store = await setup()
    await createCustomFood(store, { name: '  Bukë e zezë ', kcal: 250, proteinG: 9, carbsG: 45, fatG: 3, servingG: 40 })
    await createCustomFood(store, { name: 'Çaj', kcal: 1, proteinG: 0, carbsG: 0.2, fatG: 0 })
    expect((await searchFoods(store, 'buke')).map((food) => food.name)).toEqual(['Bukë e zezë'])
    expect((await searchFoods(store, 'ZEZE BUK')).map((food) => food.name)).toEqual(['Bukë e zezë'])
    expect((await searchFoods(store, 'caj')).map((food) => [food.name, food.source])).toEqual([['Çaj', 'custom']])
    expect(await searchFoods(store, '')).toEqual([])
  })

  it('produkti i Open Food Facts ruhet një herë sipas barkodit dhe përditësohet', async () => {
    const store = await setup()
    const first = await saveExternalFood(store, OFF)
    const second = await saveExternalFood(store, { ...OFF, kcal: 540 })
    expect(second).toBe(first)
    expect(await store.where('foods', '[source+source_id]', ['off', OFF.sourceId])).toEqual([expect.objectContaining({ kcal: 540, brand: 'Ferrero', serving_g: 15 })])
  })

  it('regjistrimi me gramë: makrot sipas sasisë; të përdorurat dalin nga më e fundit', async () => {
    const store = await setup()
    const nutella = await saveExternalFood(store, OFF)
    const bread = await createCustomFood(store, { name: 'Bukë e zezë', kcal: 250, proteinG: 9, carbsG: 45, fatG: 3 })
    await logFood(store, { date: DAY, meal: 'snack_am', foodId: nutella, grams: 30 })
    await logFood(store, { date: DAY, meal: 'snack_am', foodId: bread, grams: 80 })
    await logFood(store, { date: DAY, meal: 'snack_pm', foodId: nutella, grams: 15 })
    const day = await nutritionDay(store, DAY, new Date('2026-12-09T09:00:00'))
    const snack = day.meals.find((meal) => meal.meal === 'snack_am')!
    expect(snack.entries.map((entry) => [entry.name, entry.grams, Math.round(entry.kcal)])).toEqual([
      ['Nutella', 30, 162],
      ['Bukë e zezë', 80, 200],
    ])
    expect((await recentFoods(store)).map((food) => food.name)).toEqual(['Nutella', 'Bukë e zezë'])
    expect(await store.where('nutrition_targets', 'date', DAY)).toHaveLength(1)
  })

  it('ushqimet e shabllonit të Jimit dalin te kërkimi dhe te të përdorurat', async () => {
    const store = await setup()
    await logTemplateMeal(store, DAY, 'lunch')
    expect((await searchFoods(store, 'buke')).map((food) => food.name)).toEqual(['Bukë integrale'])
    expect((await recentFoods(store)).map((food) => food.name)).toContain('Bukë integrale')
    expect((await recentFoods(store)).find((food) => food.name === 'Mollë')).toMatchObject({ source: 'template', sourceId: 'jim:apple' })
  })

  it('kërkimi gjen edhe emrin që sheh përdoruesi (shablloni në anglisht), dhe e rendit sipas tij', async () => {
    const store = await setup()
    await logTemplateMeal(store, DAY, 'lunch')
    const english: Record<string, string> = { 'Bukë integrale': 'Wholemeal bread', Mollë: 'Apple', 'Majonezë light': 'Light mayonnaise' }
    const shown = (food: { name: string }) => english[food.name] ?? food.name
    expect((await searchFoods(store, 'whole', shown)).map((food) => food.name)).toEqual(['Bukë integrale'])
    expect((await searchFoods(store, 'buke', shown)).map((food) => food.name)).toEqual(['Bukë integrale'])
    // Fillimi i emrit që shihet del i pari; pastaj sipas emrit që shihet.
    expect((await searchFoods(store, 'l', shown)).map(shown)).toEqual(['Light mayonnaise', 'Apple', 'Ton albacore në ujë', 'Wholemeal bread'])
  })

  it('ushqimi i Listës së Vrullit ruhet një herë me porcionin e burimit dhe emrin e gjuhës', async () => {
    const store = await setup()
    const egg: CatalogFood = {
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
      portions: [{ label: '2 tablespoon', grams: 30 }, { label: '1 large', grams: 50 }],
      alsoIn: [],
      commonRank: 3,
    }
    const id = await saveCatalogFood(store, egg, 'sq')
    expect(await saveCatalogFood(store, egg, 'en')).toBe(id)
    const rows = (await store.all('foods')).filter((row) => row.source === 'catalog')
    expect(rows).toHaveLength(1)
    expect(await foodById(store, id)).toMatchObject({ source: 'catalog', sourceId: 'usda-fdc-171287', name: 'Egg, whole, raw, fresh', kcal: 143, proteinG: 12.6, servingG: 50, servingLabel: '1 large' })
    const noPortion = await saveCatalogFood(store, { ...egg, id: 'ciqual-22000', portions: [], nameSq: null }, 'sq')
    expect(await foodById(store, noPortion)).toMatchObject({ name: 'Egg, whole, raw, fresh', servingG: null, servingLabel: null })
  })
})
