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

export type LocalDatabase = Dexie & { [T in TableName]: Table<LocalRow, string> } & {
  _meta: Table<MetaEntry, string>
  _photo_files: Table<PhotoFile, string>
}

export function createDatabase(name = 'training-hub'): LocalDatabase {
  const db = new Dexie(name) as LocalDatabase
  const schema: Record<string, string> = { _meta: 'key' }
  for (const table of TABLES) {
    schema[table] = ['id', '_dirty', ...INDEXES[table]].join(', ')
  }
  db.version(1).stores(schema)
  // Versioni 2: skedarët e fotove të progresit, vetëm në telefon (rreshtat sinkronizohen te progress_photos).
  db.version(2).stores({ _photo_files: 'id, uploaded' })
  return db
}
