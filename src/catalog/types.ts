// Lista e Vrullit në telefon (V59, V61, SPEC §0.3h): rreshti i dekoduar që përdor kërkimi. Skedari i app-it
// (`data/foods-*.json`) vjen nga `tools/food-catalog/app-file.mjs`; vlerat janë për 100 g pjesë të ngrënshme.

export const CATALOG_SOURCES = ['usda_foundation', 'usda_sr_legacy', 'usda_fndds', 'ciqual', 'cofid', 'livsmedelsverket', 'vrull_recipe'] as const
export type CatalogSource = (typeof CATALOG_SOURCES)[number]

/** Një porcion i burimit ("1 large" · 50 g); etiketa mbetet siç e ka burimi (anglisht). */
export interface CatalogPortion {
  label: string
  grams: number
}

/**
 * Receta e një pjate shqiptare (V65): përbërësit si te burimi me gramët dhe ID e Listës, burimi me lidhje, çfarë është vlerësim.
 * Makrot e rreshtit janë llogaritur nga përbërësit (`tools/food-catalog/dishes.mjs`).
 */
export interface CatalogDish {
  /** Përbërësit si i thotë burimi ("500 gr miell"), me gramët e pjesës së ngrënshme dhe ID e rreshtit të Listës. */
  ingredients: { text: string; grams: number; id: string }[]
  source: { label: string; title: string; url: string | null }
  /** Çfarë është vlerësuar nga Vrulli (vaji, uji, porcioni); tekst shqip, siç e shkruan receta. */
  estimates: string[]
  /** true kur pesha e gatshme mungon ose ka vlerësime: app-i e tregon "vlerësim". */
  estimate: boolean
  /** true kur burimi është recetë e lexuesve (flija, V65). */
  readers: boolean
  note: { sq: string; en: string }
  /** Etiketa e porcionit në të dy gjuhët ("1 copë", "1 porcion (6 japrak)"). */
  portion: { sq: string; en: string }
}

export interface CatalogFood {
  /** ID e qëndrueshme: "usda-fdc-171287", "ciqual-22000". */
  id: string
  nameEn: string
  /** Emri shqip; null kur ushqimi nuk është i zakonshëm (pa përkthim). */
  nameSq: string | null
  /** false = përkthim i pakontrolluar: emri anglisht del krahas (SPEC §0.3h). */
  nameSqChecked: boolean
  group: string
  source: CatalogSource
  license: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number | null
  portions: CatalogPortion[]
  /** ID të burimeve të tjera ku del i njëjti ushqim ("edhe te"). */
  alsoIn: string[]
  /** 1 = më i zakonshmi; null jashtë të zakonshmeve. */
  commonRank: number | null
  /** Receta kur rreshti është pjatë shqiptare (burimi `vrull_recipe`); null për çdo ushqim tjetër. */
  dish: CatalogDish | null
}

/** Kokët e skedarit (të përbashkëta për çdo pjesë) që duhen për të dekoduar rreshtat e ruajtur te Dexie. */
export interface CatalogHeader {
  version: number
  sources: string[]
  licenses: string[]
  idPrefixes: string[]
  groups: string[]
  fields: string[]
}

/** Një skedar i app-it siç është te disku: kokët, numri dhe rreshtat e ngjeshur. */
export interface CatalogFile extends CatalogHeader {
  part: 'common' | 'rest'
  count: number
  rows: unknown[][]
}

/** Numrat dhe madhësitë e ndërtimit (`data/foods-meta.json`). */
export interface CatalogMeta {
  version: number
  total: number
  common: { count: number; bytes: number; gzipBytes: number }
  rest: { count: number; bytes: number; gzipBytes: number }
  bySource: Record<CatalogSource, number>
  /** Versioni i të dhënave të çdo burimi (p.sh. "2018-04"), nga summary.json i ndërtimit. */
  sourceVersions: Partial<Record<CatalogSource, string>>
}
