import { createDatabase } from './db'
import { mealAsPlanItems, moveDiaryEntries, saveMealAsUsual } from './meal-move'
import { myPlan } from './my-plan'
import { logFood, logTemplateMeal, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'

// Zhvendosja e një vakti dhe "ruaje si të zakonshmin" (V73).
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

async function setup() {
  const store = createLocalStore(createDatabase(`meal-move-${crypto.randomUUID()}`), { userId: () => USER })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => at('2026-12-01', '08:00'))
  return store
}
const slot = async (store: Awaited<ReturnType<typeof setup>>, date: string, meal: string) => (await nutritionDay(store, date, at(date, '21:00'))).meals.find((entry) => entry.meal === meal)!

describe('zhvendosja e një vakti', () => {
  it('te një vakt tjetër i së njëjtës ditë, dhe "Zhbëj" e kthen', async () => {
    const store = await setup()
    await logTemplateMeal(store, '2026-12-09', 'lunch')
    const lunch = await slot(store, '2026-12-09', 'lunch')
    const { undo } = await moveDiaryEntries(store, lunch.entries.map((entry) => entry.id), { date: '2026-12-09', meal: 'dinner' })
    expect((await slot(store, '2026-12-09', 'lunch')).entries).toHaveLength(0)
    const dinner = await slot(store, '2026-12-09', 'dinner')
    expect(dinner.entries).toHaveLength(lunch.entries.length)
    expect(Math.round(dinner.totals.kcal)).toBe(Math.round(lunch.totals.kcal))
    await undo()
    expect((await slot(store, '2026-12-09', 'lunch')).entries).toHaveLength(lunch.entries.length)
    expect((await slot(store, '2026-12-09', 'dinner')).entries).toHaveLength(0)
  })

  it('te dita e djeshme, i njëjti vakt', async () => {
    const store = await setup()
    await logTemplateMeal(store, '2026-12-09', 'lunch')
    const lunch = await slot(store, '2026-12-09', 'lunch')
    await moveDiaryEntries(store, lunch.entries.map((entry) => entry.id), { date: '2026-12-08', meal: 'lunch' })
    expect((await slot(store, '2026-12-09', 'lunch')).status).not.toBe('done')
    expect((await slot(store, '2026-12-08', 'lunch')).status).toBe('done')
  })
})

describe('ruaje si të zakonshmin', () => {
  it('regjistrimet e vaktit bëhen Plani im i atij vakti; vaktet e tjera mbeten si ishin', async () => {
    const store = await setup()
    const food = await store.put('foods', { source: 'custom', source_id: null, name: 'Byrek me djathë', kcal: 326, protein_g: 11.3, carbs_g: 30, fat_g: 18 })
    await logFood(store, { date: '2026-12-09', meal: 'lunch', foodId: food.id, grams: 150 })
    const day = await nutritionDay(store, '2026-12-09', at('2026-12-09', '21:00'))
    const before = await myPlan(store, 'rest', day.meals.map((meal) => meal.meal), null)
    const lunch = day.meals.find((meal) => meal.meal === 'lunch')!
    const items = await mealAsPlanItems(store, '2026-12-09', lunch)
    expect(items.map((item) => `${item.name} ${item.grams}`)).toEqual(['Byrek me djathë 150'])
    expect(Math.round(items[0].per100.kcal)).toBe(326)

    const saved = await saveMealAsUsual(store, day, lunch)
    expect(saved.count).toBe(1)
    const after = await myPlan(store, 'rest', day.meals.map((meal) => meal.meal), null)
    expect(after.custom).toBe(true)
    expect(after.meals.find((meal) => meal.meal === 'lunch')?.items.map((item) => item.name)).toEqual(['Byrek me djathë'])
    expect(after.meals.find((meal) => meal.meal === 'dinner')?.items.map((item) => item.food)).toEqual(before.meals.find((meal) => meal.meal === 'dinner')?.items.map((item) => item.food))
    // Nesër (ditë stërvitjeje) plani i drekës nuk ndryshon: ruhet vetëm për llojin e ditës.
    const tomorrow = await nutritionDay(store, '2026-12-10', at('2026-12-10', '09:00'))
    expect(tomorrow.meals.find((meal) => meal.meal === 'lunch')?.template.some((line) => line.name === 'Byrek me djathë')).toBe(false)
    // Pasnesër nuk ka: e mërkura tjetër (pushim) e ka.
    const nextRest = await nutritionDay(store, '2026-12-16', at('2026-12-16', '09:00'))
    expect(nextRest.meals.find((meal) => meal.meal === 'lunch')?.template.map((line) => line.name)).toEqual(['Byrek me djathë'])
    // "Zhbëj" e kthen planin e Jimit.
    await saved.undo()
    expect((await myPlan(store, 'rest', day.meals.map((meal) => meal.meal), null)).custom).toBe(false)
  })

  it('vakti i ngrënë "si në plan" e mban planin me njësitë e veta', async () => {
    const store = await setup()
    await logTemplateMeal(store, '2026-12-09', 'lunch')
    const day = await nutritionDay(store, '2026-12-09', at('2026-12-09', '21:00'))
    const before = (await myPlan(store, 'rest', day.meals.map((meal) => meal.meal), null)).meals.find((meal) => meal.meal === 'lunch')!.items
    await saveMealAsUsual(store, day, day.meals.find((meal) => meal.meal === 'lunch')!)
    const after = (await myPlan(store, 'rest', day.meals.map((meal) => meal.meal), null)).meals.find((meal) => meal.meal === 'lunch')!.items
    expect(after.map((item) => [item.food, item.unit, item.grams])).toEqual(before.map((item) => [item.food, item.unit, item.grams]))
  })
})
