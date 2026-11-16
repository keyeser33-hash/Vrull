import { normalize } from '@/catalog/search'
import type { ExternalFood } from '@/nutrition/off'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { numberOrNull } from '@/lib/number'

// Produktet e grupit (V59, SPEC §0.3h, V2-E3-27): produkti me barkod që skanon dikush (Open Food Facts ose etiketa) ruhet te `food_products`
// dhe sinkronizohet për të gjithë grupin; barkodi kërkohet së pari këtu, pastaj te Open Food Facts. Kush e shtoi nuk lexohet kurrë
// (`added_by` ekziston vetëm te serveri). Produktet e Open Food Facts mbahen të pandryshuara, me licencën ODbL dhe atribuimin më poshtë.

/** Atribuimi që kërkon ODbL (SPEC §0.3h): del te produkti dhe te faqja "Burimet". */
export const OFF_ATTRIBUTION = 'Contains data from Open Food Facts, available under the Open Database License'

export interface GroupProduct {
  id: string
  barcode: string
  source: 'open_food_facts' | 'label'
  name: string
  brand: string | null
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number | null
  servingG: number | null
  servingLabel: string | null
}

const BARCODE = /^[0-9]{6,14}$/
const round1 = (value: number) => Math.round(value * 10) / 10
const within = (value: number, max: number) => Number.isFinite(value) && value >= 0 && round1(value) <= max

/**
 * Rreshti për `food_products` nga një produkt i Open Food Facts, ose null kur serveri do ta refuzonte (barkodi 6–14 shifra, kcal deri 950,
 * makrot deri 100 g, gjatësitë dhe porcioni sipas `check`-eve të migrimit): lokalisht do të pranohej, por sinkronizimi do ta refuzonte përgjithmonë.
 */
export function productRowFrom(food: ExternalFood): Record<string, unknown> | null {
  if (food.source !== 'off' || !BARCODE.test(food.sourceId)) return null
  const name = food.name.trim()
  if (name.length < 1 || name.length > 200 || (food.brand?.length ?? 0) > 120 || (food.servingLabel?.length ?? 0) > 80) return null
  if (!within(food.kcal, 950) || !within(food.proteinG, 100) || !within(food.carbsG, 100) || !within(food.fatG, 100)) return null
  if (food.fiberG !== null && !within(food.fiberG, 100)) return null
  if (food.servingG !== null && !(food.servingG > 0 && round1(food.servingG) > 0 && round1(food.servingG) < 1_000_000)) return null
  return {
    barcode: food.sourceId,
    source: 'open_food_facts',
    license: 'ODbL-1.0',
    name,
    brand: food.brand,
    kcal: round1(food.kcal),
    protein_g: round1(food.proteinG),
    carbs_g: round1(food.carbsG),
    fat_g: round1(food.fatG),
    fiber_g: food.fiberG === null ? null : round1(food.fiberG),
    serving_g: food.servingG === null ? null : round1(food.servingG),
    serving_label: food.servingLabel,
  }
}

function toProduct(row: LocalRow): GroupProduct {
  return {
    id: row.id,
    barcode: String(row.barcode),
    source: row.source === 'label' ? 'label' : 'open_food_facts',
    name: String(row.name),
    brand: (row.brand as string | null | undefined) ?? null,
    kcal: Number(row.kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    fiberG: numberOrNull(row.fiber_g),
    servingG: numberOrNull(row.serving_g),
    servingLabel: (row.serving_label as string | null | undefined) ?? null,
  }
}

/** Produkti i grupit sipas barkodit (edhe ai që e shtoi një tjetër); null kur grupi nuk e ka. Punon pa internet. */
export async function findProduct(store: LocalStore, barcode: string): Promise<GroupProduct | null> {
  const [row] = await store.where('food_products', 'barcode', barcode)
  return row ? toProduct(row) : null
}

/**
 * Ndan një produkt të skanuar të Open Food Facts me grupin: rresht i ri te `food_products` (dërgohet me sinkronizimin). Asgjë kur grupi e ka
 * tashmë barkodin, kur produkti nuk është nga Open Food Facts, ose kur serveri do ta refuzonte. Kthen id-në e rreshtit ose null.
 */
export async function shareProduct(store: LocalStore, food: ExternalFood): Promise<string | null> {
  const row = productRowFrom(food)
  if (!row || (await findProduct(store, food.sourceId))) return null
  return (await store.put('food_products', row)).id
}

/** Kërkimi te produktet e grupit: çdo fjalë e kërkesës te emri ose marka, pa diakritika; fillimi i emrit i pari. */
export async function searchProducts(store: LocalStore, query: string, limit = 20): Promise<GroupProduct[]> {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const products = (await store.all('food_products')).map(toProduct)
  const text = (product: GroupProduct) => normalize(`${product.name} ${product.brand ?? ''}`)
  return products
    .filter((product) => words.every((word) => text(product).includes(word)))
    .sort((a, b) => Number(!normalize(a.name).startsWith(words[0])) - Number(!normalize(b.name).startsWith(words[0])) || a.name.localeCompare(b.name, 'sq'))
    .slice(0, limit)
}

/**
 * Produkti i grupit te ushqimet e tua (një herë sipas burimit dhe kodit): Open Food Facts si `off` me barkodin (që atribuimi dhe etiketa "Produkt"
 * vlejnë), etiketa si ushqim i yti me `label:<barkodi>`. Kthen id-në e ushqimit.
 */
export async function saveProductFood(store: LocalStore, product: GroupProduct): Promise<string> {
  const source = product.source === 'open_food_facts' ? 'off' : 'custom'
  const sourceId = product.source === 'open_food_facts' ? product.barcode : `label:${product.barcode}`
  const [existing] = await store.where('foods', '[source+source_id]', [source, sourceId])
  const row = await store.put('foods', {
    id: existing?.id,
    source,
    source_id: sourceId,
    name: product.name,
    brand: product.brand,
    kcal: product.kcal,
    protein_g: product.proteinG,
    carbs_g: product.carbsG,
    fat_g: product.fatG,
    fiber_g: product.fiberG,
    serving_g: product.servingG,
    serving_label: product.servingLabel,
  })
  return row.id
}
