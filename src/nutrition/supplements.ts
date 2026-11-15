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

/**
 * Doza e pluhurit të proteinës sipas vaktit (PDF, faqet 13–14): 1 scoop te mëngjesi 1, snack-u
 * pasdite dhe para gjumit; 2 scoop te shake-u para/gjatë/pas stërvitjes.
 */
export const PROTEIN_SCOOPS: Partial<Record<MealKey, number>> = { breakfast_1: 1, snack_pm: 1, bedtime: 1, pre_workout: 2 }
/** Teksti i përmbledhur (jashtë një vakti), si ruhet te `notes` i rreshtave të rinj. */
export const PROTEIN_DOSE_TEXT = '1 scoop; 2 scoop te shake-u'
/** Tekstet e planit që tregojnë dozën e pandryshuar: "1–2 scoop" është parazgjedhja e vjetër. */
const PROTEIN_PLAN_TEXTS = ['1–2 scoop', PROTEIN_DOSE_TEXT]

const SHAKE: MealKey[] = ['pre_workout', 'post_workout']

export const SUPPLEMENTS: SupplementDef[] = [
  { key: 'protein', name: 'Pluhur proteine', doseAmount: 1, doseUnit: 'scoop', doseText: PROTEIN_DOSE_TEXT, timing: ['breakfast_1', 'snack_pm', 'bedtime', 'pre_workout'], evidence: 'food' },
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
      .map((supplement) => ({ id: supplement.id, name: supplement.name, doseText: doseForMeal({ ...supplement, custom: false }, meal).doseText, evidence: supplement.evidence, meal, time })),
  )
}

/**
 * Doza e një suplementi te një vakt: pluhuri i proteinës i planit, i pandryshuar (teksti i planit ose
 * i vjetri "1–2 scoop", 1 lugë), merr dozën e vaktit; çdo dozë tjetër (e ndryshuar nga përdoruesi,
 * suplement i tij) mbetet siç është.
 */
export function doseForMeal<T extends { name: string; custom: boolean; doseText: string; doseAmount: number; doseUnit: DoseUnit }>(
  supplement: T,
  meal: MealKey,
): { doseText: string; doseAmount: number } {
  const unchanged = !supplement.custom && supplement.name === 'Pluhur proteine' && supplement.doseUnit === 'scoop' && supplement.doseAmount === 1 && PROTEIN_PLAN_TEXTS.includes(supplement.doseText)
  if (!unchanged) return { doseText: supplement.doseText, doseAmount: supplement.doseAmount }
  const scoops = PROTEIN_SCOOPS[meal] ?? 1
  return { doseText: `${scoops} scoop`, doseAmount: scoops }
}
