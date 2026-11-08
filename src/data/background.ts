import { type Background, background as appBackground, type BackgroundStore, isBackground } from '@/lib/background'
import type { LocalStore } from './store'

// Sfondi te cilësimet e sinkronizuara (V2-E1-05): `user_settings.background`, si gjuha
// (data/language.ts). Telefoni mban kopjen e vet (lib/background.ts), që korniza të mos presë bazën.

async function settingsRow(store: LocalStore) {
  return (await store.all('user_settings'))[0]
}

/** Sfondi i ruajtur te cilësimet, ose null kur nuk ka rresht ose rreshti nuk e ka ende (v1). */
export async function savedBackground(store: LocalStore): Promise<Background | null> {
  const value = (await settingsRow(store))?.background
  return isBackground(value) ? value : null
}

/**
 * Zgjedhja te Pamja. Rreshti shkruhet para ndërrimit, që një sinkronizim që mbaron në mes të mos
 * e kthejë sfondin pas; pa rresht (para hapave të parë) sfondi vlen vetëm në telefon.
 */
export async function chooseBackground(store: LocalStore, next: Background, phone: BackgroundStore = appBackground) {
  try {
    const row = await settingsRow(store)
    if (row && row.background !== next) await store.put('user_settings', { id: row.id, background: next })
  } catch {
    // Sfondi vlen në telefon edhe kur rreshti nuk shkruhet; ekrani nuk pret bazën.
  }
  phone.set(next)
}

/**
 * Në nisje dhe pas çdo sinkronizimi: sfondi i ruajtur fiton (mund të vijë nga një telefon tjetër);
 * një rresht pa sfond (v1) ose me vlerë të panjohur merr sfondin e telefonit. Një zgjedhje e bërë
 * ndërkohë nuk kthehet pas nga leximi i vjetër.
 */
export async function adoptSavedBackground(store: LocalStore, phone: BackgroundStore = appBackground) {
  const before = phone.get()
  const row = await settingsRow(store)
  if (!row) return
  if (!isBackground(row.background)) {
    await store.put('user_settings', { id: row.id, background: phone.get() })
    return
  }
  if (phone.get() === before) phone.set(row.background)
}
