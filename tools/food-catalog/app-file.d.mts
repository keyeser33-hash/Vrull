import type { CatalogFile } from '../../src/catalog/types'

// Tipet e `app-file.mjs` për provat te `src/catalog` (që e importojnë për rrethin kodim → dekodim).
export const FIELDS: readonly string[]
export const SOURCES: string[]
export const ID_PREFIX: Record<string, string>
export function encodeRow(row: Record<string, unknown>, groups: string[]): unknown[]
export function buildAppFiles(rows: Record<string, unknown>[]): {
  common: CatalogFile
  rest: CatalogFile
  groups: string[]
  version: number
  total: number
}
export function writeAppFiles(rows: Record<string, unknown>[], outDir: string): Record<string, unknown>
