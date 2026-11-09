import { createDatabase } from './db'
import { createCustomFood } from './foods'
import { logFood, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { copyYesterdayMeal, favoriteFoods, logPortion, logQuickMacros, quickMacrosKcal, recentPortions, setFavorite, yesterdayMeal } from './quick-food'
import { createLocalStore } from './store'

// Ushqimi më i shpejtë (V2-E2-16; bordet V22-Vakti-Shpejt, V22-Makrot): "Si dje", të fundit, të preferuarat
// dhe makrot e shpejta, secila me një prekje pas hapjes së vaktit.
const USER = '11111111-1111-4111-8111-111111111111'
const TODAY = '2026-11-18'
const YESTERDAY = '2026-11-17'

async function setup() {
  let now = new Date('2026-11-17T14:30:00')
  const store = createLocalStore(createDatabase(`quick-${crypto.randomUUID()}`), { userId: () => USER, now: () => now })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => now)
  const chicken = await createCustomFood(store, { name: 'Gjoks pule', kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2.6 })
  const rice = await createCustomFood(store, { name: 'Oriz kaf', kcal: 123, proteinG: 2.7, carbsG: 25.6, fatG: 1 })
  await logFood(store, { date: YESTERDAY, meal: 'lunch', foodId: chicken, grams: 200 })
  await logFood(store, { date: YESTERDAY, meal: 'lunch', foodId: rice, grams: 250 })
  now = new Date('2026-11-18T14:20:00')
  return { store, chicken, rice }
}

describe('Si dje', () => {
  it('vakti i djeshëm me të njëjtin emër: përmbledhja dhe kopja me një prekje', async () => {
    const { store } = await setup()
    const yesterday = await yesterdayMeal(store, TODAY, 'lunch')
    // Të dy u regjistruan në të njëjtin milisekondë: radha nuk ka rëndësi.
    expect(yesterday!.items.map((item) => [item.name, item.grams]).sort()).toEqual([
      ['Gjoks pule', 200],
      ['Oriz kaf', 250],
    ])
    expect(yesterday!.kcal).toBeCloseTo(240 + 307.5, 1)
    expect(await yesterdayMeal(store, TODAY, 'dinner')).toBeNull()
    expect(await copyYesterdayMeal(store, TODAY, 'lunch')).toBe(2)
    const lunch = (await nutritionDay(store, TODAY, store.now())).meals.find((slot) => slot.meal === 'lunch')!
    expect(lunch.entries.map((entry) => [entry.name, entry.grams]).sort()).toEqual([
      ['Gjoks pule', 200],
      ['Oriz kaf', 250],
    ])
  })
})

describe('të fundit dhe të preferuarat', () => {
  it('porcioni i fundit i çdo ushqimi; i preferuari me porcionin e vet; një prekje e regjistron', async () => {
    const { store, chicken, rice } = await setup()
    await logFood(store, { date: TODAY, meal: 'breakfast_1', foodId: rice, grams: 150 })
    const recent = await recentPortions(store, 5)
    expect(recent.map((item) => [item.name, item.grams])).toEqual([
      ['Oriz kaf', 150],
      ['Gjoks pule', 200],
    ])
    expect(await favoriteFoods(store)).toEqual([])
    await setFavorite(store, chicken, 200)
    expect(await favoriteFoods(store)).toEqual([expect.objectContaining({ foodId: chicken, name: 'Gjoks pule', grams: 200, kcal: 240, servings: null })])
    await logPortion(store, { date: TODAY, meal: 'dinner', portion: (await favoriteFoods(store))[0] })
    const dinner = (await nutritionDay(store, TODAY, store.now())).meals.find((slot) => slot.meal === 'dinner')!
    expect(dinner.entries.map((entry) => [entry.name, entry.grams, entry.kcal])).toEqual([['Gjoks pule', 200, 240]])
    await setFavorite(store, chicken, null)
    expect(await favoriteFoods(store)).toEqual([])
  })
})

describe('makrot e shpejta', () => {
  it('kaloritë e shkruara ruhen; pa to, 4·P + 4·K + 9·Y', () => {
    expect(quickMacrosKcal({ kcal: 650, proteinG: 40, carbsG: 60, fatG: 25 })).toEqual({ kcal: 650, fromMacros: 625 })
    expect(quickMacrosKcal({ kcal: null, proteinG: 40, carbsG: 60, fatG: 25 })).toEqual({ kcal: 625, fromMacros: 625 })
  })

  it('një porcion me makrot e vaktit; i preferuar me "1 porcion"', async () => {
    const { store } = await setup()
    await logQuickMacros(store, { date: TODAY, meal: 'lunch', name: 'Drekë jashtë', kcal: 650, proteinG: 40, carbsG: 60, fatG: 25, favorite: true })
    const lunch = (await nutritionDay(store, TODAY, store.now())).meals.find((slot) => slot.meal === 'lunch')!
    expect(lunch.entries).toEqual([expect.objectContaining({ name: 'Drekë jashtë', grams: null, kcal: 650, proteinG: 40, carbsG: 60, fatG: 25 })])
    const [favorite] = await favoriteFoods(store)
    expect(favorite).toMatchObject({ name: 'Drekë jashtë', servings: 1, grams: null, kcal: 650 })
    await logPortion(store, { date: TODAY, meal: 'dinner', portion: favorite })
    const dinner = (await nutritionDay(store, TODAY, store.now())).meals.find((slot) => slot.meal === 'dinner')!
    expect(dinner.entries.map((entry) => [entry.name, entry.kcal])).toEqual([['Drekë jashtë', 650]])
  })
})
