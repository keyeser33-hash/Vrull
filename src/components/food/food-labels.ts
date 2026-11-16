import { sourceLabelOfId } from '@/catalog/names'
import { isQuickFood } from '@/data/quick-food'
import { isSupplementSource } from '@/data/supplements'
import type { BasketItem } from '@/data/basket'
import type { I18n, MessageKey } from '@/i18n'
import { gramsText } from '@/routes/nutrition-format'

// Etiketat e rreshtave të kërkimit dhe të shportës (V59, SPEC §0.3h): burimi i shkurtër ("USDA", "Plani im"),
// njësia e porcionit ("vezë e madhe" nga "1 vezë e madhe") dhe porcioni si tekst ("2 vezë e madhe", "150 g").

type Texts = Pick<I18n, 't' | 'fmt'>

const CATALOG_SOURCE_KEYS = {
  usda: 'foodsearch.source.usda',
  ciqual: 'foodsearch.source.ciqual',
  cofid: 'foodsearch.source.cofid',
  livsmedelsverket: 'foodsearch.source.livsmedelsverket',
} as const

/** Burimi i shkurtër i një rreshti të Listës së Vrullit ("USDA", "Ciqual", "CoFID", "Livsmedelsverket"). */
export const catalogSourceKey = (label: keyof typeof CATALOG_SOURCE_KEYS): MessageKey => CATALOG_SOURCE_KEYS[label]

/** Burimi i shkurtër pranë emrit: Plani im, USDA, Produkt (Open Food Facts), Makro, suplementi, ose "I yti". */
export function sourceKey(food: { source: string | null; sourceId: string | null }): MessageKey {
  const id = food.sourceId
  if (food.source === 'template' || id?.startsWith('jim:') || id?.startsWith('pdf:')) return 'foodsearch.source.plan'
  if (isQuickFood(id)) return 'foodsearch.source.quick'
  if (id?.startsWith('label:')) return 'foodsearch.source.label'
  if (isSupplementSource(id)) return 'foodsearch.source.supplement'
  if (food.source === 'catalog') return catalogSourceKey(sourceLabelOfId(id ?? '') ?? 'usda')
  if (food.source === 'usda') return 'foodsearch.source.usda'
  if (food.source === 'off') return 'foodsearch.source.product'
  return 'foodsearch.source.mine'
}

/** "vezë e madhe" nga "1 vezë e madhe"; null kur etiketa është vetëm gramë ("15 g") ose mungon. */
export function unitNoun(label: string | null | undefined): string | null {
  if (!label) return null
  const noun = label.replace(/^[\d.,/½¼¾\s]+/, '').trim()
  return noun === '' || /^g$/i.test(noun) ? null : noun
}

/** Numri i porcioneve kur gramët janë shumëfish i gjysmës së porcionit (150 g me porcion 50 g = 3), përndryshe null. */
export function servingCount(grams: number, servingG: number | null): number | null {
  if (!servingG || servingG <= 0) return null
  const count = grams / servingG
  const halves = Math.round(count * 2)
  return halves > 0 && Math.abs(count * 2 - halves) < 0.001 ? halves / 2 : null
}

/** Porcioni si tekst: "2 vezë e madhe" kur ushqimi ka njësi, "1 porcion" për makrot e shpejta, përndryshe gramët. */
export function portionLabel(i18n: Texts, portion: { grams: number | null; servings: number | null; servingG: number | null; servingLabel: string | null }): string {
  if (portion.grams === null) return i18n.t('foodsearch.unit.quick', { count: portion.servings ?? 1 })
  const noun = unitNoun(portion.servingLabel)
  const count = noun ? servingCount(portion.grams, portion.servingG) : null
  return noun && count !== null ? `${i18n.fmt.number(count)} ${noun}` : gramsText(i18n, portion.grams)
}

/** Sasia te çipi: numri i porcioneve kur ushqimi ka njësi ("2"), përndryshe gramët ose "1" për makrot e shpejta. */
export function chipQuantity(i18n: Texts, item: BasketItem): string {
  if (item.grams === null) return i18n.fmt.number(item.servings ?? 1)
  const count = unitNoun(item.servingLabel) ? servingCount(item.grams, item.servingG) : null
  return count !== null ? i18n.fmt.number(count) : gramsText(i18n, item.grams)
}
