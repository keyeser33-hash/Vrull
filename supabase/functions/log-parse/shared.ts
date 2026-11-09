// Forma e kutisë së AI-së (V40, V2-E2-13) që e lexon edhe app-i (`src/data/ai-box.ts`): konteksti që
// dërgon telefoni, drafti që kthen funksioni dhe kodet e gabimeve. Pa varësi dhe pa Deno: udhëzimet e
// modelit dhe skema e daljes mbeten te logic.ts.

/** Gjatësia më e madhe e një mesazhi; një ditë e tërë me fjalë zë rreth 400 shkronja. */
export const MAX_TEXT = 1_000
/** Kufijtë e kontekstit: ushqimet e njohura dhe suplementet e përdoruesit. */
export const MAX_FOODS = 150
export const MAX_SUPPLEMENTS = 30
/** Stërvitjet që mund të marrin sete: e sotmja, e radhës dhe ato të 7 ditëve të fundit (V2-E2-14). */
export const MAX_WORKOUTS = 8
/** Faktet e trajnerit (V2-E2-15) që shkojnë me mesazhin, jashtë cache-it. */
export const MAX_FACTS = 4_000
/** Përgjigjet e mëparshme të së njëjtës bisedë (përgjigja e lirë te pyetja). */
export const MAX_HISTORY = 6
/** Foto e pjatës (V2-E2-16): app-i e zvogëlon në 1 568 px (rreth 300 KB); base64 deri në ~5 MB. */
export const MAX_IMAGE_BASE64 = 7_000_000
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ImageType = (typeof IMAGE_TYPES)[number]
/** Shenja te `notUnderstood` kur foto nuk tregon ushqim (udhëzimet te logic.ts); app-i e thotë me fjalë. */
export const NO_FOOD_IN_PHOTO = 'photo'

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

export interface ContextWorkout {
  /** Referenca e shkurtër ("w1"). */
  ref: string
  /** Data e seancës; null për stërvitjen e radhës që s'është nisur (merr ditën që thotë përdoruesi). */
  date: string | null
  /** "Stërvitja 1 · Gjoks, triceps, pulpa". */
  label: string
  status: 'done' | 'open' | 'next'
  exercises: { ref: string; name: string }[]
}

/** Pjesa që ndryshon rrallë: ruhet në cache te Claude (prompt caching) për mesazhet e radhës. */
export interface ParseContext {
  language: 'sq' | 'en'
  meals: ContextMeal[]
  foods: ContextFood[]
  supplements: ContextSupplement[]
  workouts: ContextWorkout[]
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
  /** Të dhënat e ditës për trajnerin (objektivat, ushqimi, plani, stërvitjet), si tekst i shkurtër. */
  facts?: string
  history?: ParseTurn[]
  /** Foto e pjatës (V2-E2-16): kostoja numërohet si food_photo. */
  image?: { mediaType: ImageType; data: string }
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

export interface DraftSet {
  reps: number
  /** null: me peshën e trupit ose pa peshë të thënë. */
  weightKg: number | null
  rir: number | null
}

export interface DraftExercise {
  said: string
  /** Stërvitja e kontekstit ku shkojnë setet. */
  workoutRef: string
  /** Ushtrimi i asaj stërvitjeje; null kur nuk është aty (pyetet si ushtrim shtesë). */
  exerciseRef: string | null
  /** Emri në anglisht, si në bibliotekë ("Dips"). */
  exerciseName: string
  sets: DraftSet[]
  day: DayOffset
}

/** Përgjigja e trajnerit (V41): numri ose fakti kryesor, pastaj një deri në tri fjali. */
export interface CoachAnswer {
  headline: string
  text: string
}

export interface Draft {
  foods: DraftFood[]
  water: DraftWater[]
  supplements: DraftSupplement[]
  sets: DraftExercise[]
  /** Kur mesazhi është pyetje: përgjigja nga të dhënat e përdoruesit. */
  answer: CoachAnswer | null
  /** Pjesët e mesazhit që AI-ja nuk i ktheu në regjistrim, me fjalët e përdoruesit. */
  notUnderstood: string[]
}
