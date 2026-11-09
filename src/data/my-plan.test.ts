import { createDatabase } from './db'
import { resetMyPlan, saveMyPlanMeal, userFoodItem } from './my-plan'
import { logTemplateMeal, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { EMPTY_TARGETS_PROFILE, saveTargetsProfile } from './targets-profile'

// Plani im (V34, V2-E2-05) në bazë: shkallëzimi me objektivat personale, ndryshimi i një vakti,
// "Kthe planin e Jimit" dhe regjistrimi nga plani.
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)
const WEDNESDAY = '2026-12-09'

async function setup(personal = true) {
  const store = createLocalStore(createDatabase(`my-plan-${crypto.randomUUID()}`), { userId: () => USER, now: () => at(WEDNESDAY, '09:00') })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () =>
    at('2026-12-01', '08:00'),
  )
  if (personal) await saveTargetsProfile(store, { ...EMPTY_TARGETS_PROFILE, sex: 'male', heightCm: 185, activity: 'sedentary', goal: 'gain' }, '2026-12-01')
  return store
}

const lunch = async (store: Awaited<ReturnType<typeof setup>>) =>
  (await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))).meals.find((meal) => meal.meal === 'lunch')!

describe('Plani im', () => {
  it('me objektivat e Jimit plani mbetet si në PDF', async () => {
    const store = await setup(false)
    expect((await lunch(store)).template.map((item) => `${item.food} ${item.portion.count}`)).toEqual(['tuna 1', 'wheat_bread 2', 'light_mayo 1', 'apple 1'])
  })

  it('me objektivat personale porcionet shkallëzohen dhe dita bie te objektivat', async () => {
    const store = await setup()
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))
    expect((await lunch(store)).template.find((item) => item.food === 'tuna')?.portion).toEqual({ count: 0.5, unit: 'can' })
    const kcal = day.meals.reduce((total, meal) => total + meal.templateTotals.kcal, 0)
    expect(Math.abs(kcal - day.targets!.kcal) / day.targets!.kcal).toBeLessThanOrEqual(0.05)
  })

  it('ndryshimi i drekës ruan edhe vaktet e tjera; "Kthe planin e Jimit" e rikthen', async () => {
    const store = await setup()
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))
    const current = day.meals.map((meal) => ({ meal: meal.meal, items: meal.template.map((line) => line.item) }))
    const chicken = userFoodItem({ id: 'f-chicken', name: 'Gjoks pule', sourceId: null, per100: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 } }, 64)
    await saveMyPlanMeal(store, 'rest', current, 'lunch', [chicken])
    expect((await lunch(store)).template).toMatchObject([{ food: 'food:f-chicken', name: 'Gjoks pule', grams: 60, portion: { count: 60, unit: 'gram' } }])
    expect((await store.all('meal_templates')).filter((row) => row.day_type === 'rest')).toHaveLength(day.meals.length)
    // Dita e stërvitjes nuk preket.
    expect((await nutritionDay(store, '2026-12-07', at('2026-12-07', '09:00'))).meals.find((meal) => meal.meal === 'lunch')?.template[0].food).toBe('tuna')

    await resetMyPlan(store, 'rest')
    expect((await lunch(store)).template[0].food).toBe('tuna')
  })

  it('"Regjistro" shkruan artikujt e planit, edhe ushqimin e përdoruesit', async () => {
    const store = await setup()
    const food = await store.put('foods', { source: 'custom', name: 'Gjoks pule', kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 })
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))
    const current = day.meals.map((meal) => ({ meal: meal.meal, items: meal.template.map((line) => line.item) }))
    await saveMyPlanMeal(store, 'rest', current, 'lunch', [userFoodItem({ id: food.id, name: 'Gjoks pule', sourceId: null, per100: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 } }, 150)])
    await logTemplateMeal(store, WEDNESDAY, 'lunch')
    const entries = await store.where('diary_entries', 'date', WEDNESDAY)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ food_id: food.id, grams: 150, kcal: 247.5, protein_g: 46.5 })
  })
})
