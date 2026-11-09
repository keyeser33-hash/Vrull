import type { AdminFeature, AdminPerson } from '../../supabase/functions/ai-admin/logic'
import { LIMIT_STEP_EUR, MAX_LIMIT_EUR } from '../../supabase/functions/ai-admin/logic'

// Kufiri i AI-së te Admini (V42, V2-E2-17; bordi V22-Admin-Kufiri): lista e personave me koston e muajit dhe
// kufirin, dhe ndryshimi me ±5 €. Vetëm me internet dhe vetëm për adminin; funksioni ai-admin e kontrollon.

export type { AdminFeature, AdminPerson }
export { LIMIT_STEP_EUR, MAX_LIMIT_EUR }

export type AdminError = 'offline' | 'forbidden' | 'failed'
export type AdminResult = { ok: true; month: string; people: AdminPerson[] } | { ok: false; error: AdminError }

export interface AdminRemote {
  list(): Promise<AdminResult>
  setLimit(userId: string, limitEur: number): Promise<AdminResult>
}

const isPerson = (value: unknown): value is AdminPerson =>
  typeof value === 'object' && value !== null && typeof (value as AdminPerson).id === 'string' && typeof (value as AdminPerson).limitEur === 'number' && typeof (value as AdminPerson).byFeature === 'object'

/** Përgjigja e funksionit (statusi null: pa lidhje). */
export function adminResultFrom(status: number | null, body: unknown): AdminResult {
  if (status === null) return { ok: false, error: 'offline' }
  const value = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (status === 200 && typeof value.month === 'string' && Array.isArray(value.people) && value.people.every(isPerson)) return { ok: true, month: value.month, people: value.people }
  return { ok: false, error: status === 403 ? 'forbidden' : 'failed' }
}

/** Kufiri i ri pas një prekjeje −/+ (hapi 5 €, 0–500 €). */
export const stepLimit = (limitEur: number, direction: -1 | 1) => Math.min(MAX_LIMIT_EUR, Math.max(0, Math.round((limitEur + direction * LIMIT_STEP_EUR) / LIMIT_STEP_EUR) * LIMIT_STEP_EUR))
