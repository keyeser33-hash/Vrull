import type { CatalogMeta, CatalogSource } from './types'

// Burimet e ushqimeve që kërkon secila licencë (SPEC §0.3h; docs/research/food-sources.md; tools/food-catalog/README.md › Licenca dhe atribuimi).
// Teksti i atribuimit mbetet siç e kërkon licenca (anglisht); përshkrimi dhe emri i licencës përkthehen te katalogu `sources.<id>.*`.

export type FoodSourceId = 'usda' | 'ciqual' | 'cofid' | 'livsmedelsverket' | 'off'

export interface FoodSourceInfo {
  id: FoodSourceId
  name: string
  /** Burimet e Listës që hyjnë te kjo pjesë (Open Food Facts nuk është te lista, vetëm te produktet). */
  datasets: readonly CatalogSource[]
  url: string
  licenseUrl: string
}

export const FOOD_SOURCES: readonly FoodSourceInfo[] = [
  { id: 'usda', name: 'USDA FoodData Central', datasets: ['usda_foundation', 'usda_sr_legacy', 'usda_fndds'], url: 'https://fdc.nal.usda.gov/', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { id: 'ciqual', name: 'ANSES Ciqual', datasets: ['ciqual'], url: 'https://ciqual.anses.fr/', licenseUrl: 'https://spdx.org/licenses/etalab-2.0.html' },
  {
    id: 'cofid',
    name: 'McCance and Widdowson’s CoFID',
    datasets: ['cofid'],
    url: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
    licenseUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  },
  { id: 'livsmedelsverket', name: 'Livsmedelsverket', datasets: ['livsmedelsverket'], url: 'https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data/', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  { id: 'off', name: 'Open Food Facts', datasets: [], url: 'https://world.openfoodfacts.org/', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/' },
]

export interface SourceFacts {
  /** Sa rreshta të Listës vijnë nga ky burim. */
  rows: number
  /** Versionet e të dhënave (një për dataset), p.sh. ["2026-04-30", "2018-04", "2024-10-31"]. */
  versions: string[]
}

/** Numri i rreshtave dhe versionet e secilit burim, nga meta e ndërtimit. */
export function sourceFacts(meta: CatalogMeta, source: FoodSourceInfo): SourceFacts {
  return {
    rows: source.datasets.reduce((sum, dataset) => sum + (meta.bySource[dataset] ?? 0), 0),
    versions: [...new Set(source.datasets.map((dataset) => meta.sourceVersions[dataset]).filter((version): version is string => !!version))],
  }
}
