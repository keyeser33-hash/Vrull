import { createDatabase } from './db'
import { createCustomFood, recentFoods, saveExternalFood, searchFoods } from './foods'
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
  })
})
