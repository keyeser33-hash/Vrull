import { useEffect, useSyncExternalStore } from 'react'
import { db } from '@/data/app-data'
import { catalogFiles } from './files'
import { createCatalogLoader } from './state'

// Lista e Vrullit për ekranet: `useCatalog()` nis ngarkimin kur hapet një ekran që kërkon dhe kthen gjendjen e indeksit.
export const catalogLoader = createCatalogLoader(db, catalogFiles)

export function useCatalog() {
  useEffect(() => {
    void catalogLoader.start()
  }, [])
  return useSyncExternalStore(catalogLoader.subscribe, catalogLoader.getState)
}
