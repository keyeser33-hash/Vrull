import type { MealKey } from './meals'
import type { ScheduledMeal } from './schedule'

// Suplementet e planit (SPEC §10): kur merren (sipas vakteve), doza e PDF-së dhe evidenca me
// fjalë. Shake-u para/gjatë/pas stërvitjes ndahet te vakti para dhe ai pas stërvitjes.

export type Evidence = 'strong' | 'moderate' | 'limited' | 'weak' | 'food' | 'deficiency_only'
export type DoseUnit = 'g' | 'mg' | 'scoop' | 'dose' | 'piece' | 'capsule'

export interface SupplementDef {
  name: string
  doseAmount: number
  doseUnit: DoseUnit
  /** Doza si te PDF-ja: "1,5–5 g". */
  doseText: string
  timing: MealKey[]
  evidence: Evidence
  /** Evidenca si te tabela e §10. */
  evidenceText: string
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: 'E fortë',
  moderate: 'Mesatare',
  limited: 'E kufizuar',
  weak: 'E dobët',
  food: 'Ushqim',
  deficiency_only: 'Vetëm për mungesa',
}

const SHAKE: MealKey[] = ['pre_workout', 'post_workout']

export const SUPPLEMENTS: SupplementDef[] = [
  { name: 'Pluhur proteine', doseAmount: 1, doseUnit: 'scoop', doseText: '1–2 scoop', timing: ['breakfast_1', 'snack_pm', 'bedtime', 'pre_workout'], evidence: 'food', evidenceText: 'Ushqim; e mirë kur mbush objektivin' },
  { name: 'Kreatinë', doseAmount: 5, doseUnit: 'g', doseText: '1,5–5 g', timing: SHAKE, evidence: 'strong', evidenceText: 'E fortë' },
  { name: 'Beta-alaninë', doseAmount: 3, doseUnit: 'g', doseText: '1,5–3 g', timing: SHAKE, evidence: 'moderate', evidenceText: 'Mesatare' },
  { name: 'Betainë', doseAmount: 2, doseUnit: 'g', doseText: '1,5–2 g', timing: SHAKE, evidence: 'limited', evidenceText: 'E kufizuar' },
  { name: 'BCAA', doseAmount: 5, doseUnit: 'g', doseText: '5 g', timing: SHAKE, evidence: 'weak', evidenceText: 'E dobët kur proteina është e lartë' },
  { name: 'Karnitinë', doseAmount: 2, doseUnit: 'g', doseText: '1–2 g', timing: ['post_workout'], evidence: 'weak', evidenceText: 'E dobët' },
  { name: 'Glutaminë', doseAmount: 5, doseUnit: 'g', doseText: '3–5 g', timing: ['post_workout'], evidence: 'weak', evidenceText: 'E dobët për muskulin' },
  { name: 'Dekstrozë ose gummy', doseAmount: 30, doseUnit: 'g', doseText: '20–30 g ose 30 copë', timing: ['post_workout'], evidence: 'food', evidenceText: 'Ushqim (karbohidrat i shpejtë)' },
  { name: 'Multivitaminë', doseAmount: 1, doseUnit: 'dose', doseText: '1 dozë', timing: ['lunch'], evidence: 'deficiency_only', evidenceText: 'Vetëm për mungesa' },
  { name: 'ZMA', doseAmount: 1, doseUnit: 'dose', doseText: '1 dozë', timing: ['bedtime'], evidence: 'weak', evidenceText: 'E dobët pa mungesë' },
]

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
