import { JIM_FOODS, type JimFoodKey, type PortionUnit } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import { jimFoodItem, jimPlan, jimSwaps, matchingGrams, type PlanItem, type PlanMeal, planTotals, roundToPortion, scalePlan, stepFor } from '@/nutrition/my-plan'
import type { DayType, Macros } from '@/nutrition/targets'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Plani im (V34, V2-E2-05): vaktet e përdoruesit për ditën e stërvitjes dhe të pushimit. Pa
// ndryshime, plani i Jimit i shkallëzuar te objektivat e ditës (`scalePlan`); ndryshimi i parë e
// ruan gjithë ditën te `meal_templates` (një rresht për vakt, artikujt si jsonb), që vaktet e tjera
// të mos lëvizin më vetë. "Kthe planin e Jimit" i heq rreshtat.

export const MY_PLAN = 'my_plan'

/** Artikulli i ruajtur: ushqimi i Jimit (çelësi) ose i përdoruesit (`food:<id>`), me vlerat për 100 g. */
export interface MyPlanItem extends PlanItem {
  name: string
  /** `jim:<çelësi>` ose kodi i produktit; null për ushqimet pa burim. */
  sourceId: string | null
}

export interface MyPlanMeal {
  meal: MealKey
  items: MyPlanItem[]
}

const isJimKey = (food: string): food is JimFoodKey => Object.hasOwn(JIM_FOODS, food)

function named(meals: PlanMeal[]): MyPlanMeal[] {
  return meals.map((meal) => ({
    meal: meal.meal,
    items: meal.items.map((item) => ({ ...item, name: isJimKey(item.food) ? JIM_FOODS[item.food].name : item.food, sourceId: isJimKey(item.food) ? `jim:${item.food}` : null })),
  }))
}

const rowsFor = async (store: LocalStore, dayType: DayType) =>
  (await store.all('meal_templates')).filter((row) => row.name === MY_PLAN && row.day_type === dayType)

function itemsOf(row: LocalRow): MyPlanItem[] {
  return Array.isArray(row.items) ? (row.items as MyPlanItem[]).filter((item) => typeof item?.food === 'string' && typeof item?.grams === 'number') : []
}

/** Vaktet e planit për një lloj dite; `custom` kur përdoruesi e ka ndryshuar. */
export async function myPlan(store: LocalStore, dayType: DayType, meals: readonly MealKey[], targets: Macros | null): Promise<{ meals: MyPlanMeal[]; custom: boolean }> {
  const rows = await rowsFor(store, dayType)
  if (rows.length > 0) {
    const byMeal = new Map(rows.map((row) => [row.meal as MealKey, itemsOf(row)]))
    return { meals: meals.map((meal) => ({ meal, items: byMeal.get(meal) ?? [] })), custom: true }
  }
  const base = jimPlan(meals)
  return { meals: named(targets ? scalePlan(base, targets).meals : base), custom: false }
}

export const myPlanTotals = (meals: readonly MyPlanMeal[]): Macros => planTotals(meals)

/**
 * Ruan artikujt e një vakti. Ndryshimi i parë ruan edhe vaktet e tjera të ditës siç janë tani, që
 * plani të mos ndryshojë vetë kur ndryshojnë objektivat.
 */
export async function saveMyPlanMeal(store: LocalStore, dayType: DayType, current: readonly MyPlanMeal[], meal: MealKey, items: MyPlanItem[]) {
  const rows = await rowsFor(store, dayType)
  const byMeal = new Map(rows.map((row) => [row.meal as MealKey, row]))
  for (const entry of current) {
    if (entry.meal !== meal && byMeal.has(entry.meal)) continue
    const next = entry.meal === meal ? items : entry.items
    await store.put('meal_templates', { id: byMeal.get(entry.meal)?.id, name: MY_PLAN, meal: entry.meal, day_type: dayType, items: next, position: 0 })
  }
}

export async function resetMyPlan(store: LocalStore, dayType: DayType) {
  for (const row of await rowsFor(store, dayType)) await store.remove('meal_templates', row.id)
}

/** Një ushqim i përdoruesit si artikull i planit, në gramë (hapi 10 g). */
export function userFoodItem(food: { id: string; name: string; sourceId: string | null; per100: Macros }, grams: number): MyPlanItem {
  const step = stepFor('gram' as PortionUnit, 1)
  const rounded = roundToPortion(grams, step)
  return { food: `food:${food.id}`, unit: 'gram', per100: food.per100, name: food.name, sourceId: food.sourceId, ...step, ...rounded }
}

/**
 * Ushqimet e përdoruesit (jo të shabllonit), të filtruara me kërkimin. Si ndërrim i një artikulli
 * (V34): porcioni që mban proteinën ose kaloritë, 6 më të afërtat sipas pjesës së proteinës; për
 * "Shto ushqim" (pa artikull): 100 g, sipas emrit.
 */
export async function userFoodOptions(store: LocalStore, item: MyPlanItem | null, query = ''): Promise<MyPlanItem[]> {
  const fold = (text: string) => text.toLocaleLowerCase('sq').normalize('NFD').replace(/\p{M}/gu, '')
  const needle = fold(query.trim())
  const rows = (await store.all('foods')).filter((row) => row.source !== 'template' && Number(row.kcal) > 0 && (!needle || fold(String(row.name)).includes(needle)))
  const ratio = (per100: Macros) => (per100.kcal > 0 ? (per100.proteinG * 4) / per100.kcal : 0)
  const options = rows.map((row) => {
    const per100 = { kcal: Number(row.kcal), proteinG: Number(row.protein_g ?? 0), carbsG: Number(row.carbs_g ?? 0), fatG: Number(row.fat_g ?? 0) }
    const food = { id: row.id, name: String(row.name), sourceId: (row.source_id as string | null) ?? null, per100 }
    return { option: userFoodItem(food, item ? matchingGrams(item, per100) : 100), distance: item ? Math.abs(ratio(per100) - ratio(item.per100)) : 0 }
  })
  if (!item) return options.map((entry) => entry.option).sort((a, b) => a.name.localeCompare(b.name, 'sq')).slice(0, 12)
  return options
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6)
    .map((entry) => entry.option)
}

const withName = (item: PlanItem): MyPlanItem => ({ ...item, name: JIM_FOODS[item.food as JimFoodKey].name, sourceId: `jim:${item.food}` })

/** Ndërrimet nga plani i Jimit për një artikull, ose (pa artikull) çdo ushqim i Jimit me një njësi. */
export function jimFoodOptions(item: MyPlanItem | null): MyPlanItem[] {
  if (item) return jimSwaps(item).map(withName)
  return (Object.keys(JIM_FOODS) as JimFoodKey[]).map((food) => withName(jimFoodItem(food)))
}
