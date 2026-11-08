import { useEffect, useState } from 'react'
import type { LocalStore } from '@/data/store'

/**
 * `useLocalQuery` i provave mbi një store të vërtetë (IndexedDB në memorie), si ai i app-it
 * (`data/app-data.ts`): rilexon pas çdo shkrimi, një lexim i vjetër nuk mbishkruan një më të ri, dhe
 * një lexim që mbaron pasi ekrani u mbyll ose dështon nuk prek më gjë. Nën ngarkesë një lexim mund
 * të mbarojë pas provës së fundit, kur jsdom është hequr: pa këtë roje, React dështonte me "window is
 * not defined" dhe gjithë `npm test` dilte me gabim. Për `vi.mock('@/data/app-data', …)`.
 */
export function useLocalQueryFor(store: LocalStore) {
  return function useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = []) {
    const [value, setValue] = useState<T>()
    useEffect(() => {
      let cancelled = false
      let started = 0
      let shown = 0
      const run = () => {
        const ticket = ++started
        query().then(
          (result) => {
            if (cancelled || ticket < shown) return
            shown = ticket
            setValue(() => result)
          },
          () => {
            // Një lexim i dështuar (p.sh. baza u mbyll me provën) lë vlerën e fundit, si te app-i.
          },
        )
      }
      run()
      const stop = store.subscribe(run)
      return () => {
        cancelled = true
        stop()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
    return value
  }
}
