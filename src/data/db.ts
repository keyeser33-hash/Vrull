import Dexie, { type Table } from 'dexie'
import { INDEXES, type LocalRow, TABLES, type TableName } from './tables'

// Gjendja e sinkronizimit dhe të dhëna të vogla të app-it (kursorët, përdoruesi aktiv).
export interface MetaEntry {
  key: string
  value: unknown
}

/** Skedari i një fotoje progresi, vetëm në telefon; `uploaded` 1 kur është në bucket. */
export interface PhotoFile {
  id: string
  data: ArrayBuffer
  type: string
  uploaded: 0 | 1
  storagePath: string
}

/**
 * Skedari i një videoje forme, vetëm në telefon (V2-E1-13). `uploaded` 1 kur është (ose mund të jetë)
 * në bucket; `removed` 1 për një video të fshirë që pret heqjen nga bucket-i (pa `data`).
 */
export interface VideoFile {
  id: string
  data: ArrayBuffer | null
  type: string
  uploaded: 0 | 1
  removed: 0 | 1
  storagePath: string
}

export type LocalDatabase = Dexie & { [T in TableName]: Table<LocalRow, string> } & {
  _meta: Table<MetaEntry, string>
  _photo_files: Table<PhotoFile, string>
  _video_files: Table<VideoFile, string>
}

// Tabelat e sinkronizuara që erdhën pas versionit 1, me versionin ku hynë.
const ADDED_LATER: Partial<Record<TableName, number>> = { week_weights: 3, form_videos: 4, ai_usage: 5 }

const tableSchema = (table: TableName) => ['id', '_dirty', ...INDEXES[table]].join(', ')

export function createDatabase(name = 'training-hub'): LocalDatabase {
  const db = new Dexie(name) as LocalDatabase
  const schema: Record<string, string> = { _meta: 'key' }
  for (const table of TABLES.filter((candidate) => !ADDED_LATER[candidate])) schema[table] = tableSchema(table)
  db.version(1).stores(schema)
  // Versioni 2: skedarët e fotove të progresit, vetëm në telefon (rreshtat sinkronizohen te progress_photos).
  db.version(2).stores({ _photo_files: 'id, uploaded' })
  // Versioni 3: peshat e javës (V23).
  db.version(3).stores({ week_weights: tableSchema('week_weights') })
  // Versioni 4: videot e formës (V2-E1-13): rreshtat sinkronizohen, skedarët mbeten në telefon.
  db.version(4).stores({ form_videos: tableSchema('form_videos'), _video_files: 'id, uploaded, removed' })
  // Versioni 5: kostoja e AI-së (V2-E1-11), vetëm për lexim: rreshtat vijnë nga serveri.
  db.version(5).stores({ ai_usage: tableSchema('ai_usage') })
  return db
}
