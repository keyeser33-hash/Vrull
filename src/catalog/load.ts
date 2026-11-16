import type { CatalogRecord, LocalDatabase } from '@/data/db'
import { decodeFile, decodeRows } from './decode'
import type { CatalogFile, CatalogFood, CatalogHeader, CatalogMeta } from './types'

// Ngarkimi i Listës së Vrullit në telefon (V2-E3-27, SPEC §0.3h). Asnjë kërkesë rrjeti: skedarët vijnë me app-in.
// - Të zakonshmet (rreth 900 rreshta) ngarkohen sa hapet kërkimi dhe hyjnë menjëherë në kërkim.
// - Pjesa tjetër (rreth 20 000) ngarkohet me `import()` të vonuar vetëm herën e parë (ose kur ndryshon versioni i
//   listës), ruhet te Dexie me versionin dhe numrin, dhe më pas lexohet nga baza pa prekur skedarin.

export interface CatalogFiles {
  meta: CatalogMeta
  common: () => Promise<CatalogFile>
  rest: () => Promise<CatalogFile>
}

/** Sa rreshta ruhen në një rekord Dexie: pak rekorde të mëdha lexohen shumë më shpejt se 20 000 të vegjël. */
const CHUNK = 1000
const HEAD = 'head'
const chunkId = (index: number) => `rest:${index}`

export async function loadCommon(files: CatalogFiles): Promise<CatalogFood[]> {
  return decodeFile(await files.common())
}

async function readStored(db: LocalDatabase, meta: CatalogMeta): Promise<CatalogFood[] | null> {
  const head = await db._catalog.get(HEAD)
  if (!head?.header || head.version !== meta.version || head.count !== meta.rest.count) return null
  const chunks = (await db._catalog.toArray()).filter((record) => record.id.startsWith('rest:'))
  chunks.sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)))
  const rows = chunks.flatMap((record) => record.rows ?? [])
  return rows.length === head.count ? decodeRows(head.header as unknown as CatalogHeader, rows) : null
}

async function store(db: LocalDatabase, file: CatalogFile) {
  const { rows, ...header } = file
  const records: CatalogRecord[] = []
  for (let start = 0; start < rows.length; start += CHUNK) records.push({ id: chunkId(start / CHUNK), rows: rows.slice(start, start + CHUNK) })
  // Një transaksion: ose gjithçka, ose asgjë. Koka shkruhet e fundit, që pa të pjesa nuk quhet e plotë.
  await db.transaction('rw', db._catalog, async () => {
    await db._catalog.clear()
    await db._catalog.bulkPut(records)
    await db._catalog.put({ id: HEAD, version: file.version, count: file.count, header: header as unknown as Record<string, unknown> })
  })
}

/** Pjesa tjetër e listës: nga baza kur versioni dhe numri përputhen, përndryshe nga skedari (dhe ruhet). */
export async function loadRest(db: LocalDatabase, files: CatalogFiles): Promise<{ foods: CatalogFood[]; from: 'database' | 'file' }> {
  const stored = await readStored(db, files.meta)
  if (stored) return { foods: stored, from: 'database' }
  const file = await files.rest()
  const foods = decodeFile(file)
  await store(db, file)
  return { foods, from: 'file' }
}
