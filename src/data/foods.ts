import type { ExternalFood } from '@/nutrition/off'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { numberOrNull } from '@/lib/number'

// Ushqimet e përdoruesit (SPEC §9, TH-15): të krijuara me dorë, nga Open Food Facts ose USDA, dhe
// ato të shabllonit të Jimit. Makrot janë për 100 g. Çdo produkt i jashtëm ruhet lokalisht, që
// pa internet të gjenden ushqimet e përdorura më parë.

export interface Food {
  id: string
  source: 'off' | 'usda' | 'custom' | 'template'
  /** `jim:<çelësi>` për shabllonin, kodi i produktit për Open Food Facts dhe USDA; null për të tuat. */
  sourceId: string | null
  name: string
  brand: string | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  servingG: number | null
  servingLabel: string | null
}


function toFood(row: LocalRow): Food {
  return {
    id: row.id,
    source: row.source as Food['source'],
    sourceId: (row.source_id as string | null | undefined) ?? null,
    name: String(row.name),
    brand: (row.brand as string | null | undefined) ?? null,
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    servingG: numberOrNull(row.serving_g),
    servingLabel: (row.serving_label as string | null | undefined) ?? null,
  }
}

/** Tekst pa shenja dhe pa dallim shkronjash: "Bukë" → "buke", "Çaj" → "caj". */
const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Kërkimi lokal: çdo fjalë e kërkesës duhet të jetë në emër ose në markë; fillimi i emrit del i pari.
 * `shown` jep emrin që sheh përdoruesi (ushqimet e shabllonit në anglisht), që të gjendet edhe ai.
 */
export async function searchFoods(store: LocalStore, query: string, shown: (food: Food) => string = (food) => food.name): Promise<Food[]> {
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const foods = (await store.all('foods')).map(toFood)
  const names = (food: Food) => (shown(food) === food.name ? food.name : `${shown(food)} ${food.name}`)
  const haystack = (food: Food) => plain(`${names(food)} ${food.brand ?? ''}`)
  const starts = (food: Food) => (plain(shown(food)).startsWith(words[0]) || plain(food.name).startsWith(words[0]) ? 0 : 1)
  return foods
    .filter((food) => words.every((word) => haystack(food).includes(word)))
    .sort((a, b) => starts(a) - starts(b) || shown(a).localeCompare(shown(b), 'sq'))
    .slice(0, 30)
}

/** Ushqimet sipas përdorimit të fundit në ditar, pa përsëritje. */
export async function recentFoods(store: LocalStore, limit = 20): Promise<Food[]> {
  const [entries, foods] = await Promise.all([store.all('diary_entries'), store.all('foods')])
  const byId = new Map(foods.map((row) => [row.id, row]))
  const seen = new Set<string>()
  const result: Food[] = []
  for (const entry of [...entries].sort((a, b) => String(b.logged_at).localeCompare(String(a.logged_at)))) {
    const id = String(entry.food_id)
    const row = byId.get(id)
    if (!row || seen.has(id)) continue
    seen.add(id)
    result.push(toFood(row))
    if (result.length === limit) break
  }
  return result
}

export interface CustomFoodInput {
  name: string
  brand?: string | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  servingG?: number | null
  servingLabel?: string | null
}

export async function createCustomFood(store: LocalStore, input: CustomFoodInput): Promise<string> {
  const row = await store.put('foods', {
    source: 'custom',
    source_id: null,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    kcal: input.kcal,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
    serving_g: input.servingG ?? null,
    serving_label: input.servingLabel ?? null,
  })
  return row.id
}

/** Produkti i jashtëm ruhet një herë sipas burimit dhe kodit; vlerat e reja e përditësojnë. */
export async function saveExternalFood(store: LocalStore, food: ExternalFood): Promise<string> {
  const [existing] = await store.where('foods', '[source+source_id]', [food.source, food.sourceId])
  const row = await store.put('foods', {
    id: existing?.id,
    source: food.source,
    source_id: food.sourceId,
    name: food.name,
    brand: food.brand,
    kcal: food.kcal,
    protein_g: food.proteinG,
    carbs_g: food.carbsG,
    fat_g: food.fatG,
    fiber_g: food.fiberG,
    serving_g: food.servingG,
    serving_label: food.servingLabel,
  })
  return row.id
}

export async function foodById(store: LocalStore, id: string): Promise<Food | null> {
  const row = await store.get('foods', id)
  return row ? toFood(row) : null
}
