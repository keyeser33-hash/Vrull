import type { LocalDatabase } from './db'
import { tablePulledKey } from './sync'
import { type LocalRow, PENDING, type TableName } from './tables'

// Çdo veprim i app-it shkruan këtu, në telefon, dhe përfundon menjëherë. Sinkronizimi
// (sync.ts) i dërgon më vonë rreshtat që presin, kur ka internet.

type Values = Record<string, unknown> & { id?: string }

/** Tabela e vlerave vetëm të këtij telefoni (`readDevice`, `writeDevice`), pa sinkronizim. */
export const DEVICE_TABLE = '_meta'
/** Çfarë ndryshoi një shkrim: një tabelë që sinkronizohet, ose vlerat e telefonit. */
export type StoreChange = TableName | typeof DEVICE_TABLE

// Vlerat e telefonit rrinë te `_meta` me këtë parashtesë, larg kursorëve të sinkronizimit.
const DEVICE_PREFIX = 'device:'

export interface LocalStore {
  /** Krijon ose ndryshon (pjesërisht) një rresht dhe e shënon për dërgim. */
  /**
   * Shton ose ndryshon një rresht. `revive`: një rresht i fshirë me këtë id kthehet (për id-të nga një çelës
   * natyror, p.sh. `weekWeightId`); pa të, një rresht i fshirë mbetet i fshirë.
   */
  put(table: TableName, values: Values, options?: { revive?: boolean }): Promise<LocalRow>
  /** Shumë rreshta të rinj në një transaksion, me një njoftim të vetëm (p.sh. një program i plotë). */
  insertMany(table: TableName, rows: Values[]): Promise<LocalRow[]>
  /** Fshirje e butë: rreshti mbetet me deleted_at, që fshirja të arrijë edhe në Supabase. */
  remove(table: TableName, id: string): Promise<void>
  /** Rreshti, ose undefined kur nuk ekziston ose është fshirë; `deleted: true` e kthen edhe të fshirin. */
  get(table: TableName, id: string, options?: { deleted?: boolean }): Promise<LocalRow | undefined>
  all(table: TableName): Promise<LocalRow[]>
  where(table: TableName, index: string, value: unknown): Promise<LocalRow[]>
  /** Ora e store-it (në teste, ora e provës): kohët e stërvitjes vijnë nga e njëjta orë si rreshtat. */
  now(): Date
  /** Përdoruesi i hyrë (p.sh. për dosjen e tij te Storage); null pa hyrje. */
  userId(): string | null
  /** Një vlerë vetëm e këtij telefoni (p.sh. "Seanca e parë më e lehtë", V43); undefined kur mungon. */
  readDevice(key: string): Promise<unknown>
  /** Ruan një vlerë vetëm të këtij telefoni, pa sinkronizim; dëgjuesit marrin `DEVICE_TABLE`. */
  writeDevice(key: string, value: unknown): Promise<void>
  /** Thirret pas çdo shkrimi; kthen funksionin që e ndal. */
  subscribe(listener: (table: StoreChange) => void): () => void
  /** Ky telefon e ka marrë tabelën nga serveri të paktën një herë për përdoruesin e hyrë (sync.ts). */
  pulled(table: TableName): Promise<boolean>
}

export interface StoreOptions {
  userId: () => string | null
  now?: () => Date
  uuid?: () => string
}

// Fushat që i vendos vetëm store-i (ose serveri), jo thirrësi.
const PROTECTED = ['user_id', 'created_at', 'updated_at', 'deleted_at', 'server_updated_at', '_dirty', '_error']

const visible = (row: LocalRow | undefined) => (row && row.deleted_at === null ? row : undefined)

/**
 * Koha e një ndryshimi: ora e tanishme, por gjithmonë pas ndryshimit të mëparshëm të rreshtit.
 * Sinkronizimi e njeh një ndryshim gjatë dërgimit nga updated_at (sync.ts, `acceptPushed`); dy shkrime
 * në të njëjtën milisekondë, ose ora e telefonit që kthehet mbrapa, do ta humbnin pa këtë.
 */
function nextTimestamp(now: string, previous: string | undefined): string {
  if (!previous) return now
  const after = Date.parse(previous) + 1
  return Date.parse(now) >= after ? now : new Date(after).toISOString()
}

export function createLocalStore(db: LocalDatabase, options: StoreOptions): LocalStore {
  const clock = options.now ?? (() => new Date())
  const now = () => clock().toISOString()
  const uuid = options.uuid ?? (() => crypto.randomUUID())
  const listeners = new Set<(table: StoreChange) => void>()
  const notify = (table: StoreChange) => listeners.forEach((listener) => listener(table))

  function requireUser() {
    const userId = options.userId()
    if (!userId) throw new Error('Pa përdorues: hyr në llogari para se të ruash të dhëna.')
    return userId
  }

  return {
    async put(table, values, { revive = false } = {}) {
      const userId = requireUser()
      const timestamp = now()
      const changes = Object.fromEntries(Object.entries(values).filter(([key]) => !PROTECTED.includes(key)))
      const row = await db.transaction('rw', db[table], async () => {
        const existing = values.id ? await db[table].get(values.id) : undefined
        const next: LocalRow = existing
          ? {
              ...existing,
              ...changes,
              id: existing.id,
              ...(revive ? { deleted_at: null } : {}),
              updated_at: nextTimestamp(timestamp, existing.updated_at),
              _dirty: PENDING,
            }
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

    async insertMany(table, values) {
      const userId = requireUser()
      const timestamp = now()
      const rows: LocalRow[] = values.map((row) => ({
        ...Object.fromEntries(Object.entries(row).filter(([key]) => !PROTECTED.includes(key))),
        id: row.id ?? uuid(),
        user_id: userId,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        _dirty: PENDING,
      }))
      await db[table].bulkAdd(rows)
      notify(table)
      return rows
    },

    async remove(table, id) {
      requireUser()
      const timestamp = now()
      await db.transaction('rw', db[table], async () => {
        const existing = await db[table].get(id)
        if (!existing) return
        await db[table].put({ ...existing, deleted_at: timestamp, updated_at: nextTimestamp(timestamp, existing.updated_at), _dirty: PENDING })
      })
      notify(table)
    },

    async get(table, id, { deleted = false } = {}) {
      const row = await db[table].get(id)
      return deleted ? row : visible(row)
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

    now: () => clock(),
    userId: () => options.userId(),

    async readDevice(key) {
      return (await db._meta.get(DEVICE_PREFIX + key))?.value
    },

    async writeDevice(key, value) {
      await db._meta.put({ key: DEVICE_PREFIX + key, value })
      notify(DEVICE_TABLE)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async pulled(table) {
      const userId = options.userId()
      return userId !== null && (await db._meta.get(tablePulledKey(table)))?.value === userId
    },
  }
}
