// Forma e leximit të etiketës (V39, V2-E2-10) që e lexon edhe app-i (`src/data/supplement-label.ts`):
// fushat, kodet e gabimeve dhe kufijtë. Pa varësi dhe pa Deno.

/** 5 MB: app-i e zvogëlon foton në 1 568 px para dërgimit (rreth 300 KB); kufiri mbron nga një skedar i madh. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const LABEL_ERRORS = ['unauthorized', 'not_configured', 'limit', 'not_image', 'too_large', 'bad_request', 'unreadable', 'not_label', 'timeout', 'ai_failed'] as const
export type LabelErrorCode = (typeof LABEL_ERRORS)[number]

export type LabelKind = 'protein' | 'creatine' | 'capsule' | 'other'
export type LabelUnit = 'scoop' | 'g' | 'mg' | 'capsule' | 'tablet' | 'dose'

/** Fushat siç i lexoi AI-ja; null kur etiketa nuk e thotë ose nuk lexohet. */
export interface LabelFields {
  name: string | null
  kind: LabelKind | null
  doseAmount: number | null
  doseUnit: LabelUnit | null
  /** Gramët e një luge ("Serving size 30.4 g"). */
  scoopG: number | null
  /** Makrot për një dozë (një lugë). */
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}
