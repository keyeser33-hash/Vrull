import { LABEL_ERRORS, type LabelErrorCode, type LabelFields } from '../../supabase/functions/supplement-label/shared'
import type { MonthSpend } from './pdf-import'

// Leximi i etiketës me AI (V39, V2-E2-10): përgjigjet e funksionit supplement-label me fjalë për
// ekranin "Shto suplement". Fotoja nuk ruhet: dërgohet dhe harrohet. Fushat i kontrollon përdoruesi.

export type { LabelFields }

/** Gabimet e funksionit, plus "pa internet" që e vendos app-i vetë. */
export type LabelError = 'offline' | LabelErrorCode

export type LabelResult =
  | { ok: true; fields: LabelFields; read: number; total: number; costEur: number; month: MonthSpend }
  | { ok: false; error: LabelError; month?: MonthSpend; costEur?: number }

/** Leximi përmes funksionit (app-data.ts e lidh me Supabase). */
export interface LabelRemote {
  read(image: Blob): Promise<LabelResult>
}

const ERRORS = new Set<LabelError>(LABEL_ERRORS)
const isMonth = (value: unknown): value is MonthSpend =>
  typeof value === 'object' && value !== null && typeof (value as MonthSpend).spentEur === 'number' && typeof (value as MonthSpend).limitEur === 'number'
const FIELD_KEYS: (keyof LabelFields)[] = ['name', 'kind', 'doseAmount', 'doseUnit', 'scoopG', 'kcal', 'proteinG', 'carbsG', 'fatG']

/** Përgjigja e funksionit (statusi null: pa lidhje) si rezultat për ekranin. */
export function labelResultFrom(status: number | null, body: unknown): LabelResult {
  if (status === null) return { ok: false, error: 'offline' }
  const value = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (status === 200) {
    const fields = value.fields as LabelFields | undefined
    const usage = value.usage as { costEur?: unknown } | undefined
    if (fields && FIELD_KEYS.every((key) => key in fields) && typeof value.read === 'number' && typeof value.total === 'number' && isMonth(value.month)) {
      return { ok: true, fields, read: value.read, total: value.total, costEur: typeof usage?.costEur === 'number' ? usage.costEur : 0, month: value.month }
    }
    return { ok: false, error: 'ai_failed' }
  }
  const error = ERRORS.has(value.error as LabelError) ? (value.error as LabelError) : status === 401 ? 'unauthorized' : 'ai_failed'
  return { ok: false, error, ...(isMonth(value.month) ? { month: value.month } : {}), ...(typeof value.costEur === 'number' ? { costEur: value.costEur } : {}) }
}
