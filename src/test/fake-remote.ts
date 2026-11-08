// Supabase në memorie për testet e sinkronizimit. Imiton atë që bën skema e vërtetë:
// - trigger-i sync_touch: një version më i vjetër nuk mbishkruan, created_at nuk ndryshon,
//   server_updated_at vendoset në çdo shkrim (në formatin e Postgres-it, +00:00);
// - një upsert me një rresht të pavlefshëm dështon i tëri (transaksion);
// - pull me kursor keyset (server_updated_at, id), në rend rritës.
import { NetworkError, RemoteError, type Cursor, type Remote } from '@/data/sync'
import type { Row, TableName } from '@/data/tables'

export interface FakeRemote extends Remote {
  offline: boolean
  /** Kthen mesazhin e gabimit kur rreshti duhet refuzuar (si një check constraint). */
  rejectWhen: ((table: TableName, row: Row) => string | null) | null
  /** Kur vendoset, çdo shkrim merr këtë server_updated_at (shumë rreshta me të njëjtën kohë). */
  fixedTimestamp: string | null
  calls: { op: 'upsert' | 'pull'; table: TableName; rows: number }[]
  rows(table: TableName): Row[]
  /** Një ndryshim nga një pajisje tjetër, direkt në server. */
  serverWrite(table: TableName, row: Row): Row
}

const at = (cursor: Cursor) => Date.parse(cursor.at)
const compare = (a: Cursor, b: Cursor) => at(a) - at(b) || a.id.localeCompare(b.id)

export function createFakeRemote(): FakeRemote {
  const tables = new Map<TableName, Map<string, Row>>()
  let clock = Date.parse('2026-12-01T00:00:00.000Z')
  const table = (name: TableName) => {
    if (!tables.has(name)) tables.set(name, new Map())
    return tables.get(name)!
  }

  function timestamp(remote: FakeRemote) {
    if (remote.fixedTimestamp) return remote.fixedTimestamp
    clock += 1
    return new Date(clock).toISOString().replace('Z', '+00:00')
  }

  function write(remote: FakeRemote, name: TableName, row: Row): Row | null {
    const existing = table(name).get(row.id)
    if (existing && Date.parse(row.updated_at) < Date.parse(existing.updated_at)) return null
    const stored = {
      ...row,
      created_at: existing?.created_at ?? row.created_at,
      server_updated_at: timestamp(remote),
    }
    table(name).set(row.id, stored)
    return structuredClone(stored)
  }

  const remote: FakeRemote = {
    offline: false,
    rejectWhen: null,
    fixedTimestamp: null,
    calls: [],

    async upsert(name, rows) {
      if (remote.offline) throw new NetworkError('Pa internet')
      remote.calls.push({ op: 'upsert', table: name, rows: rows.length })
      for (const row of rows) {
        const message = remote.rejectWhen?.(name, row)
        if (message) throw new RemoteError(message, '23514')
      }
      return rows.map((row) => write(remote, name, structuredClone(row))).filter((row) => row !== null)
    },

    async pull(name, after, limit) {
      if (remote.offline) throw new NetworkError('Pa internet')
      remote.calls.push({ op: 'pull', table: name, rows: 0 })
      const rows = [...table(name).values()]
        .map((row) => ({ row, cursor: { at: row.server_updated_at as string, id: row.id } }))
        .filter(({ cursor }) => !after || compare(cursor, after) > 0)
        .sort((a, b) => compare(a.cursor, b.cursor))
        .slice(0, limit)
        .map(({ row }) => structuredClone(row))
      remote.calls[remote.calls.length - 1].rows = rows.length
      return rows
    },

    rows: (name) => [...table(name).values()].map((row) => structuredClone(row)),

    serverWrite(name, row) {
      const stored = write(remote, name, row)
      if (!stored) throw new Error('serverWrite: version më i vjetër')
      return stored
    },
  }
  return remote
}

/** Një bucket privat i Supabase Storage në memorie (p.sh. form-videos). */
export interface FakeStorage {
  offline: boolean
  calls: { op: 'upload' | 'download' | 'remove'; path: string }[]
  /** Objektet e bucket-it, pa RLS (pamja e administratorit). */
  objects(): string[]
  upload(path: string, data: ArrayBuffer, type: string): Promise<void>
  download(path: string): Promise<ArrayBuffer>
  remove(path: string): Promise<void>
}

/**
 * Imiton politikat e `storage.objects` të migrimeve: përdoruesi i hyrë (userId) lexon, shkruan dhe
 * fshin vetëm te dosja e tij (<user_id>/...). Një objekt i tjetrit nuk gjendet, si me RLS; fshirja e
 * një objekti që mungon nuk është gabim (si `remove` i Supabase). Me `remote`, interneti bie bashkë
 * me Supabase-in e rremë.
 */
export function createFakeStorage(options: { userId: () => string | null; remote?: FakeRemote }): FakeStorage {
  const files = new Map<string, { data: ArrayBuffer; type: string }>()
  const own = (path: string) => {
    const userId = options.userId()
    return Boolean(userId) && path.split('/')[0] === userId
  }
  const storage: FakeStorage = {
    offline: false,
    calls: [],
    objects: () => [...files.keys()].sort(),
    async upload(path, data, type) {
      if (storage.offline || options.remote?.offline) throw new NetworkError('Pa internet')
      storage.calls.push({ op: 'upload', path })
      if (!own(path)) throw new RemoteError('new row violates row-level security policy', '42501')
      files.set(path, { data: data.slice(0), type })
    },
    async download(path) {
      if (storage.offline || options.remote?.offline) throw new NetworkError('Pa internet')
      storage.calls.push({ op: 'download', path })
      const file = own(path) ? files.get(path) : undefined
      if (!file) throw new RemoteError('Object not found', '404')
      return file.data.slice(0)
    },
    async remove(path) {
      if (storage.offline || options.remote?.offline) throw new NetworkError('Pa internet')
      storage.calls.push({ op: 'remove', path })
      if (own(path)) files.delete(path)
    },
  }
  return storage
}
