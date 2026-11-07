import type { LocalDatabase } from './db'
import { type Row, TABLES, type TableName } from './tables'

// "Eksporto të dhënat" (SPEC §8): një skedar JSON me të gjitha tabelat, pa fotot. Plani falas
// i Supabase nuk ka kopje ditore automatike, ndaj ky është rrjeti i sigurisë.

export interface ExportFile {
  app: 'Training Hub'
  version: string
  exported_at: string
  user_id: string | null
  tables: Record<TableName, Row[]>
}

export async function buildExport(
  db: LocalDatabase,
  options: { version: string; userId: string | null; now?: () => Date },
): Promise<ExportFile> {
  const tables = {} as Record<TableName, Row[]>
  for (const table of TABLES) {
    const rows = await db[table].filter((row) => row.deleted_at === null).toArray()
    tables[table] = rows.map(
      (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_'))) as Row,
    )
  }
  return {
    app: 'Training Hub',
    version: options.version,
    exported_at: (options.now ?? (() => new Date()))().toISOString(),
    user_id: options.userId,
    tables,
  }
}

export function exportFileName(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `training-hub-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}
