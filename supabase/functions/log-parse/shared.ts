// Forma e kutisë së AI-së (V40, V2-E2-13) që e lexon edhe app-i (`src/data/ai-box.ts`): konteksti që
// dërgon telefoni, drafti që kthen funksioni dhe kodet e gabimeve. Pa varësi dhe pa Deno: udhëzimet e
// modelit dhe skema e daljes mbeten te logic.ts.

/** Gjatësia më e madhe e një mesazhi; një ditë e tërë me fjalë zë rreth 400 shkronja. */
export const MAX_TEXT = 1_000
/** Kufijtë e kontekstit: ushqimet e njohura dhe suplementet e përdoruesit. */
export const MAX_FOODS = 150
export const MAX_SUPPLEMENTS = 30
/** Përgjigjet e mëparshme të së njëjtës bisedë (përgjigja e lirë te pyetja). */
export const MAX_HISTORY = 6

export const PARSE_ERRORS = ['unauthorized', 'not_configured', 'limit', 'bad_request', 'too_long', 'unreadable', 'timeout', 'ai_failed'] as const
export type ParseErrorCode = (typeof PARSE_ERRORS)[number]

/** Çelësat e vakteve si te `src/nutrition/meals.ts` (provë te `src/data/ai-box.test.ts`). */
export const MEAL_KEYS = ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime', 'pre_workout', 'intra_workout', 'post_workout'] as const
export type ParseMealKey = (typeof MEAL_KEYS)[number]

export interface ContextMeal {
  key: ParseMealKey
  /** Emri në gjuhën e përdoruesit ("Darka"), që AI-ja ta njohë "në darkë". */
  name: string
  /** Ora e vaktit sot, "19:50". */
  time: string
}

export interface ContextFood {
  /** Referenca e shkurtër që app-i e kthen te ushqimi i vet ("f12"). */
  ref: string
  name: string
  /** Porcioni i zakonshëm, kur ka: "1 fetë = 32 g". */
  portion: string | null
}

export interface ContextSupplement {
  ref: string
  name: string
  /** Një dozë: "1 lugë = 30 g", "5 g". */
  dose: string
}

/** Pjesa që ndryshon rrallë: ruhet në cache te Claude (prompt caching) për mesazhet e radhës. */
export interface ParseContext {
  language: 'sq' | 'en'
  meals: ContextMeal[]
  foods: ContextFood[]
  supplements: ContextSupplement[]
}

export interface ParseTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ParseRequest {
  text: string
  /** Dita e ushqimit (V46) dhe ora tani, sipas telefonit. */
  date: string
  time: string
  context: ParseContext
  history?: ParseTurn[]
}

export type DayOffset = 0 | -1

export interface Per100 {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface DraftFood {
  /** Fjalët e përdoruesit për këtë ushqim ("dy tost"). */
  said: string
  /** Referenca e një ushqimi të njohur; null për një ushqim të ri. */
  ref: string | null
  name: string
  /** null: sasia mungon dhe pyetet me `options`. */
  grams: number | null
  /** Porcioni me fjalë ("2 feta", "gjysmë pule"). */
  portion: string
  /** Gramët u vlerësuan nga një sasi e paqartë ("gjysmë pule"). */
  estimated: boolean
  /** Vlerat për 100 g të një ushqimi të ri (vlerësim i AI-së); null për një ushqim të njohur. */
  per100: Per100 | null
  options: { label: string; grams: number }[]
  meal: ParseMealKey | null
  time: string | null
  day: DayOffset
}

export interface DraftWater {
  ml: number
  time: string | null
  day: DayOffset
}

export interface DraftSupplement {
  ref: string
  /** Sa doza (1 lugë, 1 kapsulë). */
  amount: number
  meal: ParseMealKey | null
  time: string | null
  day: DayOffset
}

export interface Draft {
  foods: DraftFood[]
  water: DraftWater[]
  supplements: DraftSupplement[]
  /** Pjesët e mesazhit që AI-ja nuk i ktheu në regjistrim, me fjalët e përdoruesit. */
  notUnderstood: string[]
}
