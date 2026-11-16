import meta from './data/foods-meta.json'
import type { CatalogFile, CatalogMeta } from './types'
import type { CatalogFiles } from './load'

// Skedarët e Listës së Vrullit që vijnë me app-in (`tools/food-catalog/app-file.mjs`). Importet janë të vonuara: çdo
// skedar është një pjesë e vetme e build-it, që të mos hyjë te nisja. `?raw` + JSON.parse, që tipet të mos
// nxjerrin formën e 2 MB të dhënave.

export const catalogMeta = meta as unknown as CatalogMeta

export const catalogFiles: CatalogFiles = {
  meta: catalogMeta,
  common: async () => JSON.parse((await import('./data/foods-common.json?raw')).default) as CatalogFile,
  rest: async () => JSON.parse((await import('./data/foods-rest.json?raw')).default) as CatalogFile,
}
