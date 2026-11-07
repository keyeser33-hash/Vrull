import type { LocalDatabase } from './db'
import { type LocalRow, PENDING, type TableName } from './tables'

// Çdo veprim i app-it shkruan këtu, në telefon, dhe përfundon menjëherë. Sinkronizimi
// (sync.ts) i dërgon më vonë rreshtat që presin, kur ka internet.

type Values = Record<string, unknown> & { id?: string }

export interface LocalStore {
  /** Krijon ose ndryshon (pjesërisht) një rresht dhe e shënon për dërgim. */
  put(table: TableName, values: Values): Promise<LocalRow>
  /** Fshirje e butë: rreshti mbetet me deleted_at, që fshirja të arrijë edhe në Supabase. */
  remove(table: TableName, id: string): Promise<void>
  /** Rreshti, ose undefined kur nuk ekziston ose është fshirë. */
  get(table: TableName, id: string): Promise<LocalRow | undefined>
  all(table: TableName): Promise<LocalRow[]>
  where(table: TableName, index: string, value: unknown): Promise<LocalRow[]>
  /** Thirret pas çdo shkrimi; kthen funksionin që e ndal. */
  subscribe(listener: (table: TableName) => void): () => void
}

export interface StoreOptions {
  userId: () => string | null
  now?: () => Date
  uuid?: () => string
}

// Fushat që i vendos vetëm store-i (ose serveri), jo thirrësi.
const PROTECTED = ['user_id', 'created_at', 'updated_at', 'deleted_at', 'server_updated_at', '_dirty', '_error']

const visible = (row: LocalRow | undefined) => (row && row.deleted_at === null ? row : undefined)

export function createLocalStore(db: LocalDatabase, options: StoreOptions): LocalStore {
  const now = () => (options.now ?? (() => new Date()))().toISOString()
  const uuid = options.uuid ?? (() => crypto.randomUUID())
  const listeners = new Set<(table: TableName) => void>()
  const notify = (table: TableName) => listeners.forEach((listener) => listener(table))

  function requireUser() {
    const userId = options.userId()
    if (!userId) throw new Error('Pa përdorues: hyr në llogari para se të ruash të dhëna.')
    return userId
  }

  return {
    async put(table, values) {
      const userId = requireUser()
      const timestamp = now()
      const changes = Object.fromEntries(Object.entries(values).filter(([key]) => !PROTECTED.includes(key)))
      const row = await db.transaction('rw', db[table], async () => {
        const existing = values.id ? await db[table].get(values.id) : undefined
        const next: LocalRow = existing
          ? { ...existing, ...changes, id: existing.id, updated_at: timestamp, _dirty: PENDING }
          : {
              ...changes,
              id: values.id ?? uuid(),
              user_id: userId,
              created_at: timestamp,
              updated_at: timestamp,
              deleted_at: null,
              _dirty: PENDING,
            }
        delete next._error
        await db[table].put(next)
        return next
      })
      notify(table)
      return row
    },

    async remove(table, id) {
      requireUser()
      const timestamp = now()
      await db[table].update(id, { deleted_at: timestamp, updated_at: timestamp, _dirty: PENDING })
      notify(table)
    },

    async get(table, id) {
      return visible(await db[table].get(id))
    },

    async all(table) {
      return db[table].filter((row) => row.deleted_at === null).toArray()
    },

    async where(table, index, value) {
      return db[table]
        .where(index)
        .equals(value as never)
        .filter((row) => row.deleted_at === null)
        .toArray()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
