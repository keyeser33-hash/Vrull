import { AI_MONTHLY_LIMIT_EUR } from '../../supabase/functions/program-import/shared'
import type { LocalStore } from './store'

// Përdorimi i AI-së këtë muaj (V2-E1-11; SPEC V25, bordi "Cilësimet · AI"). Rreshtat e `ai_usage` i
// shkruajnë vetëm funksionet me AI në server, pasi kontrollojnë kufirin; telefoni i merr me sinkronizimin
// dhe i lexon këtu, pa rrjet. Kufiri i personit (ai_limits, V42) dhe muaji vendosen në server: ky lexim
// vetëm i tregon.

export { AI_MONTHLY_LIMIT_EUR }

export type AiFeature = 'program_pdf' | 'food_photo' | 'food_text' | 'explain' | 'supplement_label'

export interface AiMonth {
  /** Dita e parë e muajit, si te serveri: "2026-11-01". */
  month: string
  spentEur: number
  limitEur: number
  remainingEur: number
  /** Kufiri u arrit: AI-ja ndalet deri në muajin tjetër (V25). */
  reached: boolean
  byFeature: Partial<Record<AiFeature, number>>
  /** Dita kur AI-ja rinis: e para e muajit tjetër. */
  resetsOn: Date
}

const pad = (value: number) => String(value).padStart(2, '0')

/** "2026-11-01" për çdo ditë të nëntorit (ora e telefonit; serveri përdor orën e Tiranës). */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`
}

const cents = (value: number) => Math.round(value * 100) / 100

/** Kufiri i personit (V42): rreshti i gjallë te ai_limits që vendos admini; pa të, 10 €. */
export async function aiLimit(store: LocalStore): Promise<number> {
  const [row] = await store.all('ai_limits')
  const value = row?.monthly_eur === null || row?.monthly_eur === undefined ? Number.NaN : Number(row.monthly_eur)
  return Number.isFinite(value) ? value : AI_MONTHLY_LIMIT_EUR
}

export async function aiMonth(store: LocalStore, now = store.now()): Promise<AiMonth> {
  const month = monthKey(now)
  const [rows, limit] = await Promise.all([store.where('ai_usage', 'month', month), aiLimit(store)])
  const byFeature: Partial<Record<AiFeature, number>> = {}
  let spent = 0
  for (const row of rows) {
    // Rezervimi i një leximi që është ende në punë (pa tokena; program-import/handler.ts): jo shpenzim.
    if (!Number(row.input_tokens) && !Number(row.output_tokens)) continue
    const cost = Number(row.cost_eur) || 0
    spent += cost
    const feature = row.feature as AiFeature
    byFeature[feature] = (byFeature[feature] ?? 0) + cost
  }
  for (const key of Object.keys(byFeature) as AiFeature[]) byFeature[key] = cents(byFeature[key]!)
  const spentEur = cents(spent)
  return {
    month,
    spentEur,
    limitEur: limit,
    remainingEur: cents(Math.max(0, limit - spent)),
    reached: spent >= limit,
    byFeature,
    resetsOn: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}
