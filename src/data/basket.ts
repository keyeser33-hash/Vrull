import { macrosFor, sumMacros } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import type { Macros } from '@/nutrition/targets'
import { safeStorage } from '@/lib/safe-storage'
import { type Food, foodById } from './foods'
import { logFood, logServing } from './nutrition'
import { isQuickFood, type Portion } from './quick-food'
import type { LocalStore } from './store'

// Shporta e ushqimit (V59, SPEC §0.3h, V2-E3-28b): disa ushqime zgjidhen para se të shkojnë te një vakt me një prekje.
// Logjika pa UI: shtimi, sasia, heqja, totalet, ruajtja në telefon (`safeStorage`) deri sa të shtohet ose të fshihet,
// dhe regjistrimi te vakti. Çdo artikull mban makrot për 100 g të ushqimit, që sasia të ndryshojë pa lexuar bazën.

/** Një ushqim në shportë. Me gramë (`grams`) ose një porcion pa gramë (`servings`, makrot e shpejta): saktësisht njëri. */
export interface BasketItem {
  foodId: string
  name: string
  /** `foods.source`; vetëm për etiketën e burimit te lista. */
  source: Food['source']
  sourceId: string | null
  /** Vlerat për 100 g të ushqimit; për një porcion pa gramë, vlerat e atij porcioni. */
  per100: Macros
  grams: number | null
  servings: number | null
  /** Porcioni i ushqimit (njësia e çipit), për numrin e porcioneve te rreshti dhe te fleta e sasisë. */
  servingG: number | null
  servingLabel: string | null
}

export const BASKET_KEY = 'vrull.basket'

type Storage = Pick<typeof safeStorage, 'getItem' | 'setItem' | 'removeItem'>

const round1 = (value: number) => Math.round(value * 10) / 10
/** Sasia e një artikulli në njësinë e vet: gramë ose porcione. */
const amountOf = (item: BasketItem) => item.grams ?? item.servings ?? 0

export function itemMacros(item: BasketItem): Macros {
  if (item.grams !== null) return macrosFor(item.per100, item.grams)
  const servings = item.servings ?? 0
  return { kcal: item.per100.kcal * servings, proteinG: item.per100.proteinG * servings, carbsG: item.per100.carbsG * servings, fatG: item.per100.fatG * servings }
}

export const basketTotals = (items: readonly BasketItem[]): Macros => sumMacros(items.map(itemMacros))

const withAmount = (item: BasketItem, amount: number): BasketItem => (item.grams !== null ? { ...item, grams: round1(amount) } : { ...item, servings: round1(amount) })

/** Shton një artikull; i njëjti ushqim bashkohet me atë që ka (sasitë mblidhen), radha e parë mbahet. */
export function addItem(items: readonly BasketItem[], item: BasketItem): BasketItem[] {
  const existing = items.find((entry) => entry.foodId === item.foodId)
  if (!existing) return [...items, item]
  return items.map((entry) => (entry === existing ? withAmount(entry, amountOf(entry) + amountOf(item)) : entry))
}

/** Sasia e re e një ushqimi (gramë ose porcione); një sasi jo pozitive e heq. */
export function setAmount(items: readonly BasketItem[], foodId: string, amount: { grams: number } | { servings: number }): BasketItem[] {
  const value = 'grams' in amount ? amount.grams : amount.servings
  if (!(value > 0)) return removeItem(items, foodId)
  return items.map((item) => (item.foodId !== foodId ? item : 'grams' in amount ? { ...item, grams: round1(value), servings: null } : { ...item, servings: round1(value), grams: null }))
}

export const removeItem = (items: readonly BasketItem[], foodId: string): BasketItem[] => items.filter((item) => item.foodId !== foodId)

/** Artikulli me sasinë e një porcioni të rreshtit (gramë ose porcione, sipas artikullit), për `stepItem`. */
export const portionOf = (item: BasketItem, amount: number): BasketItem => withAmount(item, amount)

/** "+" (1) ose "−" (−1) te një rresht: një porcion i rreshtit; kur sasia mbaron, ushqimi del nga shporta. */
export function stepItem(items: readonly BasketItem[], portion: BasketItem, direction: 1 | -1): BasketItem[] {
  if (direction === 1) return addItem(items, portion)
  const current = items.find((item) => item.foodId === portion.foodId)
  if (!current) return [...items]
  const left = amountOf(current) - amountOf(portion)
  return left > 0.0001 ? items.map((item) => (item === current ? withAmount(item, left) : item)) : removeItem(items, portion.foodId)
}

/** Sa porcione të rreshtit ka në shportë, me gjysmë porcioni (75 g me porcion 50 g = 1,5); 0 kur nuk është aty. */
export function portionCount(items: readonly BasketItem[], portion: BasketItem): number {
  const current = items.find((item) => item.foodId === portion.foodId)
  if (!current) return 0
  const unit = amountOf(portion)
  if (!(unit > 0)) return 1
  return Math.max(0.5, Math.round((amountOf(current) / unit) * 2) / 2)
}

/** Ushqimi si artikull: me porcionin e vet (ose 100 g), me `grams` të dhënë, ose një porcion kur është nga makrot e shpejta. */
export function basketItemFromFood(food: Food, grams?: number): BasketItem {
  const base = { foodId: food.id, name: food.name, source: food.source, sourceId: food.sourceId, per100: { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG }, servingG: food.servingG, servingLabel: food.servingLabel }
  if (isQuickFood(food.sourceId)) return { ...base, grams: null, servings: 1, servingG: null, servingLabel: null }
  return { ...base, grams: grams ?? food.servingG ?? 100, servings: null }
}

/** Një porcion i fundit, i preferuar ose i planit: ushqimi lexohet nga baza; null kur ushqimi nuk ekziston më. */
export async function basketItemFromPortion(store: LocalStore, portion: Portion): Promise<BasketItem | null> {
  const food = await foodById(store, portion.foodId)
  if (!food) return null
  const item = basketItemFromFood(food, portion.grams ?? undefined)
  return portion.grams === null ? { ...item, grams: null, servings: portion.servings ?? 1 } : item
}

const isMacros = (value: unknown): value is Macros => {
  const macros = value as Macros | null
  return !!macros && [macros.kcal, macros.proteinG, macros.carbsG, macros.fatG].every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0)
}
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const textOrNull = (value: unknown) => value === null || typeof value === 'string'

function isItem(value: unknown): value is BasketItem {
  const item = value as BasketItem | null
  if (!item || typeof item.foodId !== 'string' || typeof item.name !== 'string' || typeof item.source !== 'string') return false
  if (!textOrNull(item.sourceId) || !textOrNull(item.servingLabel) || !(item.servingG === null || positive(item.servingG)) || !isMacros(item.per100)) return false
  return (positive(item.grams) && item.servings === null) || (positive(item.servings) && item.grams === null)
}

/** Shporta e ruajtur; e dëmtuar ose me formë tjetër jep shportë bosh, artikujt e prishur hidhen. */
export function loadBasket(storage: Storage = safeStorage): BasketItem[] {
  try {
    const parsed = JSON.parse(storage.getItem(BASKET_KEY) ?? 'null') as { items?: unknown } | null
    if (!parsed || !Array.isArray(parsed.items)) return []
    const seen = new Set<string>()
    return parsed.items.filter((item): item is BasketItem => isItem(item) && !seen.has(item.foodId) && !!seen.add(item.foodId))
  } catch {
    return []
  }
}

/** Ruan shportën; shporta bosh nuk lë gjurmë. */
export function saveBasket(items: readonly BasketItem[], storage: Storage = safeStorage) {
  if (items.length === 0) storage.removeItem(BASKET_KEY)
  else storage.setItem(BASKET_KEY, JSON.stringify({ items }))
}

export const clearBasket = (storage: Storage = safeStorage) => storage.removeItem(BASKET_KEY)

/** Regjistron çdo artikull te vakti (gramë ose porcion); kthen sa artikuj u regjistruan. Zbrazjen e shportës e bën thirrësi. */
export async function logBasket(store: LocalStore, date: string, meal: MealKey, items: readonly BasketItem[]): Promise<number> {
  for (const item of items) {
    if (item.grams !== null) await logFood(store, { date, meal, foodId: item.foodId, grams: item.grams })
    else await logServing(store, { date, meal, foodId: item.foodId, servings: item.servings ?? 1, macros: item.per100 })
  }
  return items.length
}
