// Kufijtë dhe forma e draftit të funksionit program-import (V2-E1-11), që i lexon edhe app-i
// (`src/data/ai-usage.ts`, `src/program/pdf-import.ts`, ekrani "Importo nga PDF"). Pa varësi dhe pa
// Deno: skema e daljes dhe udhëzimet e modelit mbeten te logic.ts, jashtë app-it.

/** Kufiri i AI-së për person në muaj (V25). Faqja e Adminit e bën për person me Etapën 2 (V31). */
export const AI_MONTHLY_LIMIT_EUR = 10

/** 15 MB: PDF-ja, base64-ja dhe kërkesa rrinë bashkë në 256 MB memorie të funksionit. */
export const MAX_PDF_BYTES = 15 * 1024 * 1024

/** Gjuha e emrave të blloqeve dhe ditëve që shkruan AI-ja (emrat e ushtrimeve mbeten si në PDF). */
export type Language = 'sq' | 'en'

/** Objektivi i një jave te një plan (skema te logic.ts, `TARGET`). */
export interface Target {
  reps_min: number
  reps_max: number
  to_failure: boolean
  seconds: number
  rir_min: number
  rir_max: number
  last_set: 'none' | 'rest_pause' | 'drop_set' | 'to_failure'
}

/** Programi siç e lexoi AI-ja nga PDF-ja (skema te logic.ts, `PROGRAM_SCHEMA`). */
export interface Draft {
  found: boolean
  name: string
  pages: number
  blocks: { name: string; weeks: number }[]
  plans: { weeks: Target[] }[]
  exercises: { pdf_name: string; page: number; match: string; alternative: string; sure: boolean; equipment: string; muscles: string[]; timed: boolean }[]
  days: {
    name: string
    slots: {
      exercise: number
      sets: number
      rest_seconds: number
      plan: number
      blocks: { block: number; exercise: number; sets: number; plan: number }[]
      weeks: { block: number; week: number; exercise: number }[]
    }[]
  }[]
}
