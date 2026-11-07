// Open Food Facts (SPEC §9): produktet me barkod dhe kërkimi sipas emrit. Përgjigjet kthehen në
// ushqime me makro për 100 g; një produkt pa emër ose pa makro nuk përdoret.

export interface ExternalFood {
  source: 'off' | 'usda'
  sourceId: string
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

type Json = Record<string, unknown>

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null)
const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)
const round1 = (value: number) => Math.round(value * 10) / 10

function fromProduct(product: Json): ExternalFood | null {
  const nutriments = (product.nutriments ?? {}) as Json
  const name = text(product.product_name) ?? text(product.product_name_sq) ?? text(product.product_name_en) ?? text(product.generic_name)
  const kj = num(nutriments.energy_100g)
  const kcal = num(nutriments['energy-kcal_100g']) ?? (kj === null ? null : round1(kj / 4.184))
  const proteinG = num(nutriments.proteins_100g)
  const carbsG = num(nutriments.carbohydrates_100g)
  const fatG = num(nutriments.fat_100g)
  const code = text(product.code)
  if (!name || !code || kcal === null || proteinG === null || carbsG === null || fatG === null) return null
  const serving = num(product.serving_quantity)
  return {
    source: 'off',
    sourceId: code,
    name,
    brand: text(product.brands)?.split(',')[0].trim() ?? null,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: num(nutriments.fiber_100g),
    servingG: serving && serving > 0 ? serving : null,
    servingLabel: text(product.serving_size),
  }
}

export function offProductFromJson(json: Json): ExternalFood | null {
  if (json.status !== 1 || !json.product) return null
  return fromProduct(json.product as Json)
}

export function offSearchFromJson(json: Json): ExternalFood[] {
  const products = Array.isArray(json.products) ? (json.products as Json[]) : []
  return products.map(fromProduct).filter((food): food is ExternalFood => food !== null)
}

const FIELDS = 'code,product_name,product_name_sq,product_name_en,generic_name,brands,nutriments,serving_quantity,serving_size'
const BASE = 'https://world.openfoodfacts.org'

async function getJson(url: string, signal?: AbortSignal): Promise<Json> {
  const timeout = AbortSignal.timeout(10_000)
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: 'application/json' } })
  if (!response.ok && response.status !== 404) throw new Error(`Open Food Facts: ${response.status}`)
  return (await response.json()) as Json
}

/** Produkti sipas barkodit; null kur nuk gjendet. */
export async function offProduct(code: string, signal?: AbortSignal) {
  return offProductFromJson(await getJson(`${BASE}/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`, signal))
}

/** Kërkimi sipas emrit, 20 produktet e para. */
export async function offSearch(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '20', fields: FIELDS })
  return offSearchFromJson(await getJson(`${BASE}/cgi/search.pl?${params}`, signal))
}
