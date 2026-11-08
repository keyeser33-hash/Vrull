import { isLanguage, type Language, language as appLanguage, type LanguageStore } from '@/i18n/language'
import type { LocalStore } from './store'

// Gjuha te cilësimet e sinkronizuara (SPEC V22): `user_settings.language`, si rikujtuesit dhe
// dita e matjes. Telefoni mban edhe kopjen e vet (i18n/language.ts), që app-i të nisë në gjuhën
// e duhur para hyrjes dhe pa pritur bazën.

async function settingsRow(store: LocalStore) {
  return (await store.all('user_settings'))[0]
}

/** Gjuha e ruajtur te cilësimet, ose null kur nuk ka rresht ose rreshti nuk e ka ende. */
export async function savedLanguage(store: LocalStore): Promise<Language | null> {
  const value = (await settingsRow(store))?.language
  return isLanguage(value) ? value : null
}

/**
 * Zgjedhja e përdoruesit te Cilësimet. Rreshti shkruhet para ndërrimit, që një sinkronizim që
 * mbaron në mes të mos e kthejë gjuhën pas; pa rresht (para hapave të parë) gjuha vlen vetëm
 * në telefon dhe hyn te rreshti kur ai krijohet (adoptSavedLanguage).
 */
export async function chooseLanguage(store: LocalStore, next: Language, phone: LanguageStore = appLanguage) {
  try {
    const row = await settingsRow(store)
    if (row && row.language !== next) await store.put('user_settings', { id: row.id, language: next })
  } catch {
    // Gjuha vlen në telefon edhe kur rreshti nuk shkruhet; ekrani nuk pret bazën.
  }
  phone.set(next)
}

/**
 * Në nisje dhe pas çdo sinkronizimi: gjuha e ruajtur fiton, sepse mund të ketë ardhur nga një
 * telefon tjetër; një rresht pa gjuhë (nga v1 ose nga hapat e parë) merr gjuhën e telefonit.
 * Nëse përdoruesi ndërron gjuhën ndërkohë, leximi i vjetër nuk e kthen pas.
 */
export async function adoptSavedLanguage(store: LocalStore, phone: LanguageStore = appLanguage) {
  const before = phone.get()
  const row = await settingsRow(store)
  if (!row) return
  if (!isLanguage(row.language)) {
    await store.put('user_settings', { id: row.id, language: phone.get() })
    return
  }
  if (phone.get() === before) phone.set(row.language)
}
