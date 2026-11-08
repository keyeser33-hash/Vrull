import { safeStorage } from '@/lib/safe-storage'

// Gjuha e app-it (SPEC V22): shqip (parazgjedhje) ose anglisht britanike. Ruhet në telefon që
// app-i të nisë menjëherë në gjuhën e duhur, edhe para hyrjes; te user_settings sinkronizohet
// nga data/language.ts. Ndërrimi njofton dëgjuesit (useI18n), pa rinisje.

export const LANGUAGES = ['sq', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'sq'

/** Etiketa BCP 47 për Intl dhe për `lang` e faqes. */
export const LOCALES: Record<Language, string> = { sq: 'sq', en: 'en-GB' }

/** Emri i çdo gjuhe në gjuhën e vet, si në çdo zgjedhës gjuhe. */
export const LANGUAGE_NAMES: Record<Language, string> = { sq: 'Shqip', en: 'English' }

const STORAGE_KEY = 'th-language'

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

export function readLanguage(): Language {
  const saved = safeStorage.getItem(STORAGE_KEY)
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE
}

/** `lang` i faqes ndjek gjuhën, që lexuesi i ekranit të shqiptojë drejt. */
export function applyLanguage(lang: Language, root: HTMLElement = document.documentElement) {
  root.lang = LOCALES[lang]
}

export interface LanguageStore {
  get(): Language
  /** Ndërron gjuhën, e ruan në telefon dhe njofton dëgjuesit; e njëjta gjuhë nuk bën asgjë. */
  set(next: Language): void
  subscribe(listener: () => void): () => void
}

export function createLanguageStore(): LanguageStore {
  let current = readLanguage()
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set(next) {
      if (next === current) return
      current = next
      applyLanguage(next)
      // Pa ruajtje (p.sh. modalitet privat), gjuha vlen për këtë seancë.
      safeStorage.setItem(STORAGE_KEY, next)
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Gjuha e app-it; main.tsx e zbaton në nisje, Cilësimet e ndërrojnë. */
export const language = createLanguageStore()
