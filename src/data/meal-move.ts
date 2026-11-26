import type { MealKey } from '@/nutrition/meals'
import { type MyPlanItem, myPlan, resetMyPlan, saveMyPlanMeal, userFoodItem } from './my-plan'
import { dayTypeFor, type MealSlot, type NutritionDay, planFoodId, saveTargets } from './nutrition'
import { readProfile } from './profile'
import type { LocalStore } from './store'
import { isSupplementSource } from './supplements'
import type { LocalRow } from './tables'

// Zhvendosja e një vakti të regjistruar dhe "ruaje si të zakonshmin" (V73). Regjistrimet nuk
// kopjohen: ndryshon vetëm data dhe vakti i tyre, kështu makrot e ruajtura mbeten siç u shënuan.

/** I çon regjistrimet te një vakt ose ditë tjetër; `undo` i kthen ku ishin. */
export async function moveDiaryEntries(store: LocalStore, ids: readonly string[], to: { date: string; meal: MealKey }): Promise<{ moved: number; undo: () => Promise<void> }> {
  const rows: LocalRow[] = []
  for (const id of ids) {
    const row = await store.get('diary_entries', id)
    if (row) rows.push(row)
  }
  if (rows.length === 0) return { moved: 0, undo: async () => {} }
  // Dita ku shkojnë mban objektivat e veta, si në çdo regjistrim tjetër.
  const profile = await readProfile(store)
  const { dayType } = await dayTypeFor(store, to.date, profile.trainingDays)
  await saveTargets(store, to.date, dayType, false)
  for (const row of rows) await store.put('diary_entries', { id: row.id, date: to.date, meal: to.meal })
  return {
    moved: rows.length,
    undo: async () => {
      for (const row of rows) await store.put('diary_entries', { id: row.id, date: row.date, meal: row.meal })
    },
  }
}

/**
 * Regjistrimet e një vakti si artikuj të Planit tim, në gramë. Mbeten jashtë suplementet (V39),
 * makrot e shpejta pa gramë dhe ushqimet që nuk gjenden më.
 */
export async function mealAsPlanItems(store: LocalStore, date: string, meal: Pick<MealSlot, 'meal'>): Promise<MyPlanItem[]> {
  const rows = (await store.where('diary_entries', 'date', date))
    .filter((row) => row.meal === meal.meal)
    .sort((a, b) => String(a.logged_at).localeCompare(String(b.logged_at)))
  const items: MyPlanItem[] = []
  for (const row of rows) {
    const grams = Number(row.grams ?? 0)
    const food = row.food_id ? await store.get('foods', String(row.food_id)) : undefined
    const sourceId = (food?.source_id as string | null | undefined) ?? null
    if (!food || grams <= 0 || isSupplementSource(sourceId)) continue
    const per100 = { kcal: Number(food.kcal ?? 0), proteinG: Number(food.protein_g ?? 0), carbsG: Number(food.carbs_g ?? 0), fatG: Number(food.fat_g ?? 0) }
    const item = userFoodItem({ id: food.id, name: String(food.name), sourceId, per100 }, grams)
    // I njëjti ushqim i shënuar dy herë bëhet një artikull.
    const same = items.find((entry) => entry.food === item.food)
    if (same) Object.assign(same, userFoodItem({ id: food.id, name: String(food.name), sourceId, per100 }, same.grams + grams))
    else items.push(item)
  }
  return items
}

/**
 * E bën vaktin e sotëm planin e atij vakti për këtë lloj dite. `count` 0 = asgjë për të ruajtur;
 * `undo` e kthen planin si ishin: të Jimit (pa rreshta) ose artikujt e mëparshëm të vaktit.
 */
export async function saveMealAsUsual(store: LocalStore, day: Pick<NutritionDay, 'date' | 'dayType' | 'meals' | 'targets' | 'targetsSource'>, meal: Pick<MealSlot, 'meal'>): Promise<{ count: number; undo: () => Promise<void> }> {
  const items = await mealAsPlanItems(store, day.date, meal)
  if (items.length === 0) return { count: 0, undo: async () => {} }
  const current = await myPlan(store, day.dayType, day.meals.map((entry) => entry.meal), day.targetsSource === 'personal' ? day.targets : null)
  const before = current.meals.find((entry) => entry.meal === meal.meal)?.items ?? []
  // Një artikull i ngrënë siç ishte në plan mban njësinë e vet ("1 kanoçe"), jo gramët.
  const kept = new Map<string, MyPlanItem>()
  for (const item of before) kept.set(`food:${await planFoodId(store, item.food)}`, item)
  const next = items.map((item) => {
    const same = kept.get(item.food)
    // Gramët e ditarit rrumbullakohen me hapin 10 g: deri 5 g larg është e njëjta sasi.
    return same && Math.abs(same.grams - item.grams) <= 5 ? same : item
  })
  await saveMyPlanMeal(store, day.dayType, current.meals, meal.meal, next)
  return {
    count: items.length,
    undo: async () => {
      if (!current.custom) return resetMyPlan(store, day.dayType)
      await saveMyPlanMeal(store, day.dayType, current.meals, meal.meal, before)
    },
  }
}
