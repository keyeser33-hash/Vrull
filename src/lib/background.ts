import { useSyncExternalStore } from 'react'
import { safeStorage } from './safe-storage'

// Sfondi i faqes (DESIGN.md › Sfondet, V2-E1-05): "I plotë" (`solid`, ngjyra e sfondit të temës)
// ose "Vija shpejtësie" (`speed_lines`), me çdo temë. Si gjuha: ruhet në telefon, që korniza ta
// vizatojë menjëherë në nisje, dhe te user_settings.background (data/background.ts), që sinkronizohet.
// Emrat që sheh përdoruesi vijnë nga katalogu: `settings.background.<sfondi>`.

export const BACKGROUNDS = ['solid', 'speed_lines'] as const
export type Background = (typeof BACKGROUNDS)[number]

export const DEFAULT_BACKGROUND: Background = 'solid'
const STORAGE_KEY = 'th-background'

export function isBackground(value: unknown): value is Background {
  return typeof value === 'string' && (BACKGROUNDS as readonly string[]).includes(value)
}

export function readBackground(): Background {
  const saved = safeStorage.getItem(STORAGE_KEY)
  return isBackground(saved) ? saved : DEFAULT_BACKGROUND
}

export interface BackgroundStore {
  get(): Background
  /** Ndërron sfondin, e ruan në telefon dhe njofton dëgjuesit; e njëjta vlerë nuk bën asgjë. */
  set(next: Background): void
  subscribe(listener: () => void): () => void
}

export function createBackgroundStore(): BackgroundStore {
  let current = readBackground()
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set(next) {
      if (next === current) return
      current = next
      // Pa ruajtje (p.sh. modalitet privat), sfondi vlen për këtë seancë.
      safeStorage.setItem(STORAGE_KEY, next)
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Sfondi i app-it; korniza e vizaton, Pamja e ndërron. */
export const background = createBackgroundStore()

export function useBackground(): Background {
  return useSyncExternalStore(background.subscribe, background.get)
}
