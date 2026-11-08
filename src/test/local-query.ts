import { useEffect, useState } from 'react'
import type { LocalStore } from '@/data/store'

/**
 * `useLocalQuery` i provave mbi një store të vërtetë (IndexedDB në memorie): rilexon pas çdo shkrimi,
 * dhe një lexim i vjetër nuk mbishkruan një më të ri. Për `vi.mock('@/data/app-data', …)`.
 */
export function useLocalQueryFor(store: LocalStore) {
  return function useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = []) {
    const [value, setValue] = useState<T>()
    useEffect(() => {
      let started = 0
      let shown = 0
      const run = () => {
        const ticket = ++started
        void query().then((result) => {
          if (ticket < shown) return
          shown = ticket
          setValue(() => result)
        })
      }
      run()
      return store.subscribe(run)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
    return value
  }
}
