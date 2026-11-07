import Dexie, { type Table } from 'dexie'
import { INDEXES, type LocalRow, TABLES, type TableName } from './tables'

// Gjendja e sinkronizimit dhe të dhëna të vogla të app-it (kursorët, përdoruesi aktiv).
export interface MetaEntry {
  key: string
  value: unknown
}

export type LocalDatabase = Dexie & { [T in TableName]: Table<LocalRow, string> } & {
  _meta: Table<MetaEntry, string>
}

export function createDatabase(name = 'training-hub'): LocalDatabase {
  const db = new Dexie(name) as LocalDatabase
  const schema: Record<string, string> = { _meta: 'key' }
  for (const table of TABLES) {
    schema[table] = ['id', '_dirty', ...INDEXES[table]].join(', ')
  }
  db.version(1).stores(schema)
  return db
}
