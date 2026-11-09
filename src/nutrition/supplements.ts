import type { MealKey } from './meals'
import type { ScheduledMeal } from './schedule'

// Suplementet e planit (SPEC §10): kur merren (sipas vakteve), doza e PDF-së dhe evidenca. Shake-u
// para/gjatë/pas stërvitjes ndahet te vakti para dhe ai pas stërvitjes. Emri dhe doza ruhen shqip te
// `supplements` (`name`, `notes`); ekrani i përkthen sipas `key` (`supplementName`, `supplementDose`),
// dhe evidenca me fjalë vjen nga katalogu ('food.supplementEvidence.*', 'food.evidence.*').

/** "unknown": një suplement jashtë listës së §10 (V39: "E panjohur"); te baza ruhet null. */
export type Evidence = 'strong' | 'moderate' | 'limited' | 'weak' | 'food' | 'deficiency_only' | 'unknown'
export type DoseUnit = 'g' | 'mg' | 'scoop' | 'dose' | 'piece' | 'capsule' | 'tablet'
/** Lloji i një suplementi të shtuar nga përdoruesi (V39). */
export type SupplementKind = 'protein' | 'creatine' | 'capsule' | 'other'
export type SupplementKey =
  | 'protein'
  | 'creatine'
  | 'beta_alanine'
  | 'betaine'
  | 'bcaa'
  | 'carnitine'
  | 'glutamine'
  | 'dextrose'
  | 'multivitamin'
  | 'zma'

export interface SupplementDef {
  key: SupplementKey
  /** Emri shqip, si ruhet te baza. */
  name: string
  doseAmount: number
  doseUnit: DoseUnit
  /** Doza si te PDF-ja ("1,5–5 g"), si ruhet te baza (`notes`). */
  doseText: string
  timing: MealKey[]
  evidence: Evidence
}

const SHAKE: MealKey[] = ['pre_workout', 'post_workout']

export const SUPPLEMENTS: SupplementDef[] = [
  { key: 'protein', name: 'Pluhur proteine', doseAmount: 1, doseUnit: 'scoop', doseText: '1–2 scoop', timing: ['breakfast_1', 'snack_pm', 'bedtime', 'pre_workout'], evidence: 'food' },
  { key: 'creatine', name: 'Kreatinë', doseAmount: 5, doseUnit: 'g', doseText: '1,5–5 g', timing: SHAKE, evidence: 'strong' },
  { key: 'beta_alanine', name: 'Beta-alaninë', doseAmount: 3, doseUnit: 'g', doseText: '1,5–3 g', timing: SHAKE, evidence: 'moderate' },
  { key: 'betaine', name: 'Betainë', doseAmount: 2, doseUnit: 'g', doseText: '1,5–2 g', timing: SHAKE, evidence: 'limited' },
  { key: 'bcaa', name: 'BCAA', doseAmount: 5, doseUnit: 'g', doseText: '5 g', timing: SHAKE, evidence: 'weak' },
  { key: 'carnitine', name: 'Karnitinë', doseAmount: 2, doseUnit: 'g', doseText: '1–2 g', timing: ['post_workout'], evidence: 'weak' },
  { key: 'glutamine', name: 'Glutaminë', doseAmount: 5, doseUnit: 'g', doseText: '3–5 g', timing: ['post_workout'], evidence: 'weak' },
  { key: 'dextrose', name: 'Dekstrozë ose gummy', doseAmount: 30, doseUnit: 'g', doseText: '20–30 g ose 30 copë', timing: ['post_workout'], evidence: 'food' },
  { key: 'multivitamin', name: 'Multivitaminë', doseAmount: 1, doseUnit: 'dose', doseText: '1 dozë', timing: ['lunch'], evidence: 'deficiency_only' },
  { key: 'zma', name: 'ZMA', doseAmount: 1, doseUnit: 'dose', doseText: '1 dozë', timing: ['bedtime'], evidence: 'weak' },
]

/** Suplementi i planit me këtë emër (si ruhet te baza), ose null për një suplement tjetër. */
export const supplementByName = (name: string): SupplementDef | null => SUPPLEMENTS.find((supplement) => supplement.name === name) ?? null

export interface PlannedSupplement {
  id: string
  name: string
  doseText: string
  evidence: Evidence
  meal: MealKey
  time: string
}

/** Suplementet e ditës sipas orarit të vakteve: vetëm ato aktive dhe vetëm për vaktet e ditës. */
export function supplementPlan(supplements: (SupplementDef & { id: string; enabled: boolean })[], schedule: ScheduledMeal[]): PlannedSupplement[] {
  return schedule.flatMap(({ meal, time }) =>
    supplements
      .filter((supplement) => supplement.enabled && supplement.timing.includes(meal))
      .map((supplement) => ({ id: supplement.id, name: supplement.name, doseText: supplement.doseText, evidence: supplement.evidence, meal, time })),
  )
}
