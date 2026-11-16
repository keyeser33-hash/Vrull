import type { LocalDatabase } from '@/data/db'
import { loadCommon, loadRest, type CatalogFiles } from './load'
import { buildIndex, type CatalogIndex } from './search'
import type { CatalogFood } from './types'

// Gjendja e Listës së Vrullit në kujtesë (një për app-in): indeksi i kërkimit. Të zakonshmet hyjnë në kërkim sa
// ngarkohen (pak ms); pjesa tjetër shtohet kur të lexohet nga baza ose nga skedari, pa ndaluar kërkimin.

export interface CatalogState {
  index: CatalogIndex | null
  /** true kur pjesa tjetër e listës është në indeks (jo vetëm të zakonshmet). */
  complete: boolean
  /** true kur ngarkimi i pjesës tjetër dështoi: kërkimi vazhdon me të zakonshmet. */
  failed: boolean
}

export interface CatalogLoader {
  getState(): CatalogState
  subscribe(listener: () => void): () => void
  /** Nis ngarkimin (një herë); kthen premtimin që mbaron kur lista është e plotë ose ka dështuar. */
  start(): Promise<void>
}

export function createCatalogLoader(db: LocalDatabase, files: CatalogFiles): CatalogLoader {
  let state: CatalogState = { index: null, complete: false, failed: false }
  let started: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const set = (next: CatalogState) => {
    state = next
    listeners.forEach((listener) => listener())
  }
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      started ??= (async () => {
        let common: CatalogFood[] = []
        try {
          common = await loadCommon(files)
          set({ index: buildIndex(common), complete: false, failed: false })
          const rest = await loadRest(db, files)
          set({ index: buildIndex([...common, ...rest.foods]), complete: true, failed: false })
        } catch {
          // Lista e plotë nuk u ngarkua (skedar ose bazë me gabim): kërkimi mbetet me ato që ka.
          set({ index: common.length > 0 ? buildIndex(common) : null, complete: false, failed: true })
        }
      })()
      return started
    },
  }
}
