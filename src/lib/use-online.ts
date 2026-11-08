import { useSyncExternalStore } from 'react'

// A ka rrjet telefoni tani (navigator.onLine), për gjendjet "Pa internet". Asnjë ekran nuk pret
// rrjetin: kjo vetëm e thotë me fjalë.
function subscribe(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
