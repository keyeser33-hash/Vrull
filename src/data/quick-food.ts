import { createCustomFood } from './foods'
import { logFood, logServing } from './nutrition'
import type { LocalStore } from './store'
import { isSupplementSource } from './supplements'
import type { LocalRow } from './tables'
import { macrosFor } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import type { Macros } from '@/nutrition/targets'

// Ushqimi më i shpejtë (V2-E2-16; SPEC §9 "Ushqimi më i shpejtë"; bordet V22-Vakti-Shpejt, V22-Makrot):
// "Si dje" kopjon vaktin e djeshëm me të njëjtin emër, të fundit dhe të preferuarat regjistrohen me
// porcionin e tyre me një prekje, makrot e shpejta ruajnë një porcion pa gramë. Gjithçka pa internet.

/** Një porcion gati për një prekje: me gramë, ose një porcion pa gramë (makrot e shpejta). */
export interface Portion {
  foodId: string
  name: string
  sourceId: string | null
  grams: number | null
  servings: number | null
  kcal: number
  proteinG: number
}

const pad = (value: number) => String(value).padStart(2, '0')
const previousDate = (date: string) => {
  const day = new Date(`${date}T12:00:00`)
  day.setDate(day.getDate() - 1)
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}
const per100 = (food: LocalRow): Macros => ({ kcal: Number(food.kcal), proteinG: Number(food.protein_g), carbsG: Number(food.carbs_g), fatG: Number(food.fat_g) })
const byLogged = (a: LocalRow, b: LocalRow) => String(a.logged_at).localeCompare(String(b.logged_at))
/** Ushqimi i një suplementi (pluhuri që numërohet te ushqimi) regjistrohet nga suplementet, jo nga këtu. */
const isFoodRow = (food: LocalRow | undefined): food is LocalRow => !!food && !isSupplementSource(food.source_id as string | null)

function portionOf(entry: LocalRow, food: LocalRow): Portion {
  return {
    foodId: food.id,
    name: String(food.name),
    sourceId: (food.source_id as string | null | undefined) ?? null,
    grams: entry.grams === null || entry.grams === undefined ? null : Number(entry.grams),
    servings: entry.grams === null || entry.grams === undefined ? Number(entry.servings ?? 1) : null,
    kcal: Number(entry.kcal),
    proteinG: Number(entry.protein_g),
  }
}

/** Vakti i djeshëm me të njëjtin emër: artikujt dhe kaloritë; null kur dje ky vakt ishte bosh. */
export async function yesterdayMeal(store: LocalStore, date: string, meal: MealKey): Promise<{ items: Portion[]; kcal: number } | null> {
  const [entries, foods] = await Promise.all([store.where('diary_entries', 'date', previousDate(date)), store.all('foods')])
  const byId = new Map(foods.map((food) => [food.id, food]))
  const items = entries
    .filter((entry) => entry.meal === meal && entry.food_id)
    .sort(byLogged)
    .flatMap((entry) => {
      const food = byId.get(String(entry.food_id))
      return isFoodRow(food) ? [portionOf(entry, food)] : []
    })
  if (items.length === 0) return null
  return { items, kcal: items.reduce((sum, item) => sum + item.kcal, 0) }
}

/** "Si dje": i njëjti vakt i djeshëm sot, me porcionet e tij. Kthen sa artikuj u regjistruan. */
export async function copyYesterdayMeal(store: LocalStore, date: string, meal: MealKey): Promise<number> {
  const yesterday = await yesterdayMeal(store, date, meal)
  if (!yesterday) return 0
  for (const item of yesterday.items) await logPortion(store, { date, meal, portion: item })
  return yesterday.items.length
}

/** Të fundit: ushqimet e regjistruara së fundi, secili me porcionin e fundit (pa suplementet). */
export async function recentPortions(store: LocalStore, limit = 5): Promise<Portion[]> {
  const [entries, foods] = await Promise.all([store.all('diary_entries'), store.all('foods')])
  const byId = new Map(foods.map((food) => [food.id, food]))
  const seen = new Set<string>()
  const result: Portion[] = []
  for (const entry of [...entries].sort(byLogged).reverse()) {
    const food = byId.get(String(entry.food_id))
    if (!isFoodRow(food) || seen.has(food.id)) continue
    seen.add(food.id)
    result.push(portionOf(entry, food))
    if (result.length === limit) break
  }
  return result
}

/** Të preferuarat: ushqimet me `favorite_g`; makrot e shpejta (`source_id` "quick") janë një porcion. */
export async function favoriteFoods(store: LocalStore): Promise<Portion[]> {
  return (await store.all('foods'))
    .filter((food) => food.favorite_g !== null && food.favorite_g !== undefined && Number(food.favorite_g) > 0)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((food) => {
      const quick = food.source_id === QUICK
      const grams = quick ? null : Number(food.favorite_g)
      const macros = quick ? per100(food) : macrosFor(per100(food), grams!)
      return { foodId: food.id, name: String(food.name), sourceId: (food.source_id as string | null | undefined) ?? null, grams, servings: quick ? 1 : null, kcal: Math.round(macros.kcal), proteinG: Math.round(macros.proteinG * 10) / 10 }
    })
}

/** Shton ose heq një ushqim nga të preferuarat; porcioni është ai që regjistrohet me një prekje. */
export async function setFavorite(store: LocalStore, foodId: string, grams: number | null) {
  await store.put('foods', { id: foodId, favorite_g: grams })
}

/** Një prekje: porcioni i të fundit ose i të preferuarit te vakti. */
export async function logPortion(store: LocalStore, input: { date: string; meal: MealKey; portion: Portion }) {
  const { portion } = input
  if (portion.grams !== null) {
    await logFood(store, { date: input.date, meal: input.meal, foodId: portion.foodId, grams: portion.grams })
    return
  }
  const food = await store.get('foods', portion.foodId)
  if (!food) return
  await logServing(store, { date: input.date, meal: input.meal, foodId: portion.foodId, servings: portion.servings ?? 1, macros: per100(food) })
}

/** Ushqimi i makrove të shpejta: një porcion, vlerat e tij ruhen si "për 100 g" me `serving_g` 100. */
const QUICK = 'quick'

export interface QuickMacros {
  kcal: number | null
  proteinG: number
  carbsG: number
  fatG: number
}

/** Kaloritë e shkruara ruhen; pa to, 4·P + 4·K + 9·Y (SPEC §9). `fromMacros` për rreshtin që krahason. */
export function quickMacrosKcal(input: QuickMacros): { kcal: number; fromMacros: number } {
  const fromMacros = Math.round(4 * input.proteinG + 4 * input.carbsG + 9 * input.fatG)
  return { kcal: input.kcal ?? fromMacros, fromMacros }
}

/** Makrot e shpejta te vakti (bordi V22-Makrot): një porcion me emrin e dhënë, i preferuar kur kërkohet. */
export async function logQuickMacros(store: LocalStore, input: QuickMacros & { date: string; meal: MealKey; name: string; favorite: boolean }) {
  const { kcal } = quickMacrosKcal(input)
  const macros = { kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG }
  const foodId = await createCustomFood(store, { name: input.name, ...macros, servingG: 100 })
  await store.put('foods', { id: foodId, source_id: QUICK, favorite_g: input.favorite ? 100 : null })
  await logServing(store, { date: input.date, meal: input.meal, foodId, servings: 1, macros })
  return foodId
}
