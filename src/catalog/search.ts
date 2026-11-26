import { portionSq } from './portion-sq'
import { CATALOG_SOURCES, type CatalogFood } from './types'

// Kërkimi pa internet te Lista e Vrullit (SPEC §0.3h): shqip dhe anglisht, pa diakritika, me fjalë të pjesshme.
// Logjikë pa UI. Çdo fjalë e kërkesës duhet të jetë në emër (shqip ose anglisht); rendi: të zakonshmet të parat,
// sipas radhës së tyre (pjatat shqiptare kanë radhën 100), pastaj ata që e kanë kërkesën në fillim të një fjale, pastaj emrat më të shkurtër.

/** Tekst pa shenja dhe pa dallim shkronjash: "Vezë" → "veze", "Çedar" → "cedar"; pikësimi bëhet hapësirë. */
export function normalize(value: string): string {
  let text = value.toLowerCase()
  // NFD vetëm kur ka shkronja jashtë ASCII-t: shumica e emrave anglisht kalojnë pa të.
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-\u007f]/.test(text)) text = text.normalize('NFD').replace(/\p{M}/gu, '')
  return text.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export interface CatalogIndex {
  foods: readonly CatalogFood[]
  /** Teksti i normalizuar i çdo rreshti: emri shqip dhe anglisht, me hapësirë në fillim që "fillimi i fjalës" të gjendet me " fjala". */
  haystack: readonly string[]
}

export function buildIndex(foods: readonly CatalogFood[]): CatalogIndex {
  return { foods, haystack: foods.map((item) => ` ${normalize(item.nameSq ? `${item.nameSq} ${item.nameEn}` : item.nameEn)}`) }
}

export interface SearchOptions {
  /** Sa rezultate maksimum (parazgjedhje 40). */
  limit?: number
  /** ID që nuk duhen (ushqimet që përdoruesi i ka tashmë te të tijat). */
  exclude?: ReadonlySet<string>
}

const SOURCE_ORDER = new Map<string, number>(CATALOG_SOURCES.map((source, index) => [source, index]))

/** Cilësia e përputhjes së një fjale: 0 fillimi i emrit, 1 fillimi i një fjale tjetër, 2 brenda një fjale; -1 pa përputhje. */
function quality(haystack: string, word: string): number {
  if (haystack.startsWith(` ${word}`)) return 0
  if (haystack.includes(` ${word}`)) return 1
  return haystack.includes(word) ? 2 : -1
}

interface Hit {
  food: CatalogFood
  score: number
  /** 1 kur një fjalë e kërkesës gjendet vetëm brenda një fjale tjetër. */
  inside: number
}

export function searchCatalog(index: CatalogIndex, query: string, options: SearchOptions = {}): CatalogFood[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const limit = options.limit ?? 40
  const hits: Hit[] = []
  for (let i = 0; i < index.foods.length; i++) {
    const text = index.haystack[i]
    let score = 0
    let inside = 0
    for (const word of words) {
      const q = quality(text, word)
      if (q < 0) {
        score = -1
        break
      }
      if (q === 2) inside = 1
      score += q
    }
    if (score < 0) continue
    const food = index.foods[i]
    if (options.exclude?.has(food.id)) continue
    hits.push({ food, score, inside })
  }
  const rank = (hit: Hit) => hit.food.commonRank ?? Number.POSITIVE_INFINITY
  hits.sort((a, b) => {
    // Një fjalë që është vetëm brenda një fjale tjetër ("ausage" te "sausage") shkon pas atyre me fillim fjale, edhe pas të zakonshmeve.
    return a.inside - b.inside || rank(a) - rank(b) || a.score - b.score || a.food.nameEn.length - b.food.nameEn.length || (SOURCE_ORDER.get(a.food.source) ?? 9) - (SOURCE_ORDER.get(b.food.source) ?? 9) || a.food.nameEn.localeCompare(b.food.nameEn)
  })
  return hits.slice(0, limit).map((hit) => hit.food)
}

/**
 * Porcioni i zakonshëm i rreshtit: i pari që fillon me "1 " (një njësi, p.sh. "1 large", "1 cup"), me etiketë të shkurtër dhe gramë të
 * arsyeshme; "2 tablespoon" ose "1 cup (4.86 large eggs)" nuk hyjnë, sepse etiketa do të gënjente për njësinë. Pa të: 100 g pa etiketë.
 */
export function commonPortion(food: CatalogFood, language: 'sq' | 'en' = 'en'): { label: string | null; grams: number } {
  // Pjata shqiptare (V65): porcioni është një i vetëm, i recetës, me etiketën në gjuhën e kërkuar ("1 copë" / "1 piece").
  if (food.dish && food.portions[0]?.grams > 0) return { label: food.dish.portion[language], grams: food.portions[0].grams }
  const usable = food.portions.filter((item) => /^1 \S/.test(item.label) && item.label.length <= 20 && item.grams > 0 && item.grams <= 1000)
  if (language === 'en') return usable[0] ? { label: usable[0].label, grams: usable[0].grams } : { label: null, grams: 100 }
  // Në shqip: porcioni i parë që përkthehet i plotë (`portionSq`); "1 oz" e të ngjashmet kapërcehen, dhe pa asnjë mbeten 100 g.
  for (const item of usable) {
    const label = portionSq(item.label)
    if (label) return { label, grams: item.grams }
  }
  return { label: null, grams: 100 }
}
