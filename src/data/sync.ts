import type { LocalDatabase } from './db'
import { CLEAN, type LocalRow, PENDING, REJECTED, type Row, TABLES, type TableName } from './tables'

// Sinkronizimi (SPEC §3, TH-04). Telefoni është burimi i parë: çdo shkrim ndodh lokalisht
// (store.ts) dhe këtu vetëm dërgohet dhe merret.
//
// 1. Dërgimi: për çdo tabelë, me radhën e lidhjeve (prindi para fëmijës), rreshtat që presin
//    dërgohen me upsert. Serveri nuk pranon një version më të vjetër se i tiji (trigger-i
//    sync_touch), dhe rreshti i tij vjen me pull-in.
// 2. Marrja (paralelisht për tabelat): rreshtat me server_updated_at pas kursorit, në faqe keyset
//    (server_updated_at, id). Kursori niset 60 s më herët, që një shkrim i serverit që u
//    regjistrua pak më vonë se ora e tij të mos humbasë; rreshtat e njëjtë nuk rishkruhen.
// 3. Konflikti: fiton updated_at më i ri (ora e pajisjes që bëri ndryshimin).

export interface Cursor {
  at: string
  id: string
}

export interface Remote {
  /** Kthen rreshtat që serveri pranoi, me server_updated_at. */
  upsert(table: TableName, rows: Row[]): Promise<Row[]>
  /** Rreshtat pas kursorit, në rend (server_updated_at, id). */
  pull(table: TableName, after: Cursor | null, limit: number): Promise<Row[]>
}

/** Pa lidhje me serverin: provohet përsëri më vonë, asgjë nuk humbet. */
export class NetworkError extends Error {}

/** Serveri u përgjigj me gabim (p.sh. një rresht që shkel një kontroll të skemës). */
export class RemoteError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export type SyncStatus = 'ok' | 'offline' | 'signed_out' | 'error'

export interface SyncResult {
  status: SyncStatus
  at: string
  pushed: number
  pulled: number
  rejected: number
  error?: string
}

export interface SyncOptions {
  db: LocalDatabase
  remote: Remote
  userId: () => string | null
  now?: () => Date
  pageSize?: number
  pullLagMs?: number
  /** Tabelat që sinkronizohen; parazgjedhje të gjitha. Provat e bazës së v1 japin vetëm tabelat e saj. */
  tables?: readonly TableName[]
}

const MIN_UUID = '00000000-0000-0000-0000-000000000000'
const LAST_RESULT_KEY = 'sync:last'
// Përdoruesi për të cilin marrja e plotë ka përfunduar të paktën një herë në këtë telefon.
const PULLED_KEY = 'sync:pulled'
const cursorKey = (table: TableName) => `sync:cursor:${table}`

const instant = (value: unknown) => Date.parse(String(value))

/** Rreshti siç dërgohet: pa fushat lokale dhe pa kursorin që e vendos serveri. */
function toRemote(row: LocalRow): Row {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('_') && key !== 'server_updated_at') out[key] = value
  }
  return out as Row
}

/** Ekzekuton punët me të shumtën `limit` njëkohësisht; gabimi i parë ndal pjesën tjetër. */
async function inPool<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>) {
  const results: R[] = []
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function createSync(options: SyncOptions) {
  const { db, remote } = options
  const now = () => (options.now ?? (() => new Date()))()
  const pageSize = options.pageSize ?? 200
  const lagMs = options.pullLagMs ?? 60_000
  const tables = options.tables ?? TABLES
  let inflight: Promise<SyncResult> | null = null

  /** Vendos versionin e serverit vetëm kur rreshti lokal nuk ka ndryshuar që nga dërgimi. */
  async function acceptPushed(table: TableName, sent: Map<string, LocalRow>, accepted: Row[]) {
    await db.transaction('rw', db[table], async () => {
      for (const row of accepted) {
        const local = await db[table].get(row.id)
        if (local && local.updated_at === sent.get(row.id)?.updated_at) {
          await db[table].put({ ...row, _dirty: CLEAN })
        }
      }
    })
  }

  async function reject(table: TableName, row: LocalRow, message: string) {
    await db.transaction('rw', db[table], async () => {
      const local = await db[table].get(row.id)
      if (local && local.updated_at === row.updated_at) {
        await db[table].put({ ...local, _dirty: REJECTED, _error: message })
      }
    })
  }

  /** Dërgon një nga një; një rresht i refuzuar shënohet dhe nuk ndal të tjerët. */
  async function pushOneByOne(table: TableName, rows: LocalRow[], rejectedIds: Set<string>) {
    let pushed = 0
    let rejected = 0
    for (const row of rows) {
      try {
        const accepted = await remote.upsert(table, [toRemote(row)])
        await acceptPushed(table, new Map([[row.id, row]]), accepted)
        pushed += 1
      } catch (error) {
        if (!(error instanceof RemoteError)) throw error
        await reject(table, row, error.message)
        rejectedIds.add(row.id)
        rejected += 1
      }
    }
    return { pushed, rejected }
  }

  async function push(table: TableName) {
    let pushed = 0
    let rejected = 0
    const rejectedNow = new Set<string>()
    const pending = await db[table].where('_dirty').equals(PENDING).toArray()
    for (const chunk of chunks(pending, pageSize)) {
      try {
        const accepted = await remote.upsert(table, chunk.map(toRemote))
        await acceptPushed(table, new Map(chunk.map((row) => [row.id, row])), accepted)
        pushed += chunk.length
      } catch (error) {
        if (!(error instanceof RemoteError)) throw error
        const result = await pushOneByOne(table, chunk, rejectedNow)
        pushed += result.pushed
        rejected += result.rejected
      }
    }
    // Të refuzuarit e mëparshëm provohen përsëri, një nga një (p.sh. pasi u shfaq prindi i tyre).
    const previouslyRejected = (await db[table].where('_dirty').equals(REJECTED).toArray()).filter(
      (row) => !rejectedNow.has(row.id),
    )
    const retried = await pushOneByOne(table, previouslyRejected, rejectedNow)
    return { pushed: pushed + retried.pushed, rejected: rejected + retried.rejected }
  }

  async function merge(table: TableName, rows: Row[]) {
    let applied = 0
    await db.transaction('rw', db[table], async () => {
      for (const row of rows) {
        const local = await db[table].get(row.id)
        if (local && local._dirty !== CLEAN && instant(local.updated_at) > instant(row.updated_at)) continue
        if (local && local._dirty === CLEAN && local.server_updated_at === row.server_updated_at) continue
        await db[table].put({ ...row, _dirty: CLEAN })
        applied += 1
      }
    })
    return applied
  }

  async function pull(table: TableName) {
    const saved = (await db._meta.get(cursorKey(table)))?.value as Cursor | undefined
    let after: Cursor | null = saved
      ? { at: new Date(instant(saved.at) - lagMs).toISOString(), id: MIN_UUID }
      : null
    let latest = saved
    let pulled = 0
    for (;;) {
      const rows = await remote.pull(table, after, pageSize)
      pulled += await merge(table, rows)
      if (rows.length > 0) {
        const last = rows[rows.length - 1]
        after = { at: String(last.server_updated_at), id: last.id }
        if (!latest || instant(after.at) >= instant(latest.at)) latest = after
      }
      if (rows.length < pageSize) break
    }
    if (latest && latest !== saved) await db._meta.put({ key: cursorKey(table), value: latest })
    return pulled
  }

  async function runOnce(): Promise<SyncResult> {
    const result: SyncResult = { status: 'ok', at: now().toISOString(), pushed: 0, pulled: 0, rejected: 0 }
    if (!options.userId()) return { ...result, status: 'signed_out' }
    try {
      for (const table of tables) {
        const { pushed, rejected } = await push(table)
        result.pushed += pushed
        result.rejected += rejected
      }
      // Marrja nuk ka varësi mes tabelave: kërkesat shkojnë paralelisht, 5 njëkohësisht.
      const pulled = await inPool(tables, 5, pull)
      result.pulled = pulled.reduce((sum, count) => sum + count, 0)
      await db._meta.put({ key: PULLED_KEY, value: options.userId() })
      if (result.rejected > 0) {
        result.status = 'error'
        result.error = `${result.rejected} ndryshime u refuzuan nga serveri`
      }
    } catch (error) {
      result.status = error instanceof NetworkError ? 'offline' : 'error'
      result.error = error instanceof Error ? error.message : String(error)
    }
    await db._meta.put({ key: LAST_RESULT_KEY, value: result })
    return result
  }

  return {
    /** Një sinkronizim i plotë; thirrjet gjatë një sinkronizimi marrin të njëjtin rezultat. */
    run(): Promise<SyncResult> {
      inflight ??= runOnce().finally(() => {
        inflight = null
      })
      return inflight
    },
    /** Për kë janë marrë të dhënat të paktën një herë (null kur kurrë). */
    async pulledFor(): Promise<string | null> {
      return ((await db._meta.get(PULLED_KEY))?.value as string | undefined) ?? null
    },
    async lastResult(): Promise<SyncResult | undefined> {
      return (await db._meta.get(LAST_RESULT_KEY))?.value as SyncResult | undefined
    },
  }
}

export type SyncEngine = ReturnType<typeof createSync>
