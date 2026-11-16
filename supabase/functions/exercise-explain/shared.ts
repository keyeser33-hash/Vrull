// "Shpjegoje më shumë" te faqja e ushtrimit (V56, SPEC §0.3e), forma që e lexon edhe app-i
// (`src/data/exercise-explain.ts`): kërkesa e telefonit, përgjigja dhe kodet e gabimeve. Pa varësi dhe
// pa Deno; udhëzimet e modelit dhe skema e daljes mbeten te logic.ts.

export const LANGUAGES = ['sq', 'en'] as const
export type ExplainLanguage = (typeof LANGUAGES)[number]

/** Kufijtë e kërkesës: një udhëzues i plotë zë rreth 3 000 shkronja. */
export const MAX_NAME = 120
export const MAX_MUSCLES = 12
export const MAX_SECTION_ITEMS = 8
export const MAX_ITEM = 400
export const MAX_GUIDE = 6_000

/** Seksionet e udhëzuesit që shkojnë si kontekst (në gjuhën e kërkuar), sipas SPEC §0.3g. */
export const GUIDE_SECTIONS = ['setup', 'steps', 'breathing', 'cues', 'mistakes', 'tips', 'safety'] as const
export type GuideSectionKey = (typeof GUIDE_SECTIONS)[number]

export interface ExplainRequest {
  language: ExplainLanguage
  exercise: {
    /** Emri në anglisht, si në bibliotekë ("Barbell Bench Press"). */
    name: string
    /** Muskujt kryesorë dhe ndihmës, emrat në gjuhën e kërkuar. */
    primary: string[]
    secondary: string[]
    equipment: string | null
  }
  /** Udhëzuesi ekzistues me burime; null kur ushtrimi nuk ka (shpjegimi mbështetet te emri dhe muskujt). */
  guide: Partial<Record<GuideSectionKey, string[]>> | null
}

export interface ExplainMonth {
  month: string
  spentEur: number
  limitEur: number
}

export const EXPLAIN_ERRORS = ['unauthorized', 'not_configured', 'limit', 'bad_request', 'too_long', 'unreadable', 'timeout', 'ai_failed'] as const
export type ExplainErrorCode = (typeof EXPLAIN_ERRORS)[number]

/** Paragrafët e një shpjegimi: 3–6, nga udhëzimi. */
export const MIN_PARAGRAPHS = 3
export const MAX_PARAGRAPHS = 6
