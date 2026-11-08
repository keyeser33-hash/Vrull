import type { LocalStore } from './store'

/** Rreshti i vetëm i `user_settings` i përdoruesit, ose undefined para hapave të parë. */
export async function settingsRow(store: LocalStore) {
  return (await store.all('user_settings'))[0]
}

/** Kopja në telefon e një cilësimi që sinkronizohet (gjuha, sfondi). */
export interface PhoneSetting<T> {
  get(): T
  set(next: T): void
}

/**
 * Një cilësim që jeton te `user_settings` dhe ka kopjen e vet në telefon, që app-i të mos presë
 * bazën (gjuha V22, sfondi V2-E1-05):
 * - `saved`: vlera e rreshtit, ose null kur nuk ka rresht ose rreshti nuk e ka ende (v1);
 * - `choose`: zgjedhja e përdoruesit; rreshti shkruhet para ndërrimit, që një sinkronizim që mbaron
 *   në mes të mos e kthejë pas; pa rresht (para hapave të parë) vlen vetëm në telefon;
 * - `adopt`: në nisje dhe pas çdo sinkronizimi vlera e ruajtur fiton (mund të vijë nga një telefon
 *   tjetër); një rresht pa vlerë të njohur merr atë të telefonit; një zgjedhje e bërë ndërkohë
 *   nuk kthehet pas nga leximi i vjetër.
 */
export function syncedSetting<T extends string>(column: 'language' | 'background', isValid: (value: unknown) => value is T) {
  return {
    async saved(store: LocalStore): Promise<T | null> {
      const value = (await settingsRow(store))?.[column]
      return isValid(value) ? value : null
    },
    async choose(store: LocalStore, next: T, phone: PhoneSetting<T>) {
      try {
        const row = await settingsRow(store)
        if (row && row[column] !== next) await store.put('user_settings', { id: row.id, [column]: next })
      } catch {
        // Vlen në telefon edhe kur rreshti nuk shkruhet; ekrani nuk pret bazën.
      }
      phone.set(next)
    },
    async adopt(store: LocalStore, phone: PhoneSetting<T>) {
      const before = phone.get()
      const row = await settingsRow(store)
      if (!row) return
      const value = row[column]
      if (!isValid(value)) {
        await store.put('user_settings', { id: row.id, [column]: phone.get() })
        return
      }
      if (phone.get() === before) phone.set(value)
    },
  }
}
