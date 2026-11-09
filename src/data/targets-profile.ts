import { type Activity, calculateTargets, type Goal, type Sex, type TargetsResult, withAdjustment } from '@/nutrition/calculator'
import { type DayType, type Macros, nutritionTargets } from '@/nutrition/targets'
import { numberOrNull } from '@/lib/number'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Objektivat personale (V32, V2-E2-03): të dhënat e kalkulatorit te `user_settings`. Pa gjininë,
// gjatësinë, aktivitetin dhe qëllimin mbeten objektivat e Jimit (Q15). Objektivat personale vlejnë
// nga `targets_from`; objektivat e ruajtura të një date (`nutrition_targets`) nuk ndryshojnë më pas,
// përveç atyre të sotme dhe të ardhshme, që rillogariten kur ruhet profili. Korrigjimet e pranuara
// të kontrollit javor (V33, `weekly_checks`) u shtohen të dyja llojeve të ditës, te karbohidratet.

export interface TargetsProfile {
  sex: Sex | null
  birthYear: number | null
  heightCm: number | null
  activity: Activity | null
  goal: Goal | null
  /** Madhësia e ritmit (% e peshës në javë); null = parazgjedhja e qëllimit. */
  ratePct: number | null
  proteinGPerKg: number | null
  fatGPerKg: number | null
  bodyFatPct: number | null
  /** Mirëmbajtja e njohur e një dite pushimi. */
  maintenanceKcal: number | null
  /** Data nga e cila vlejnë objektivat personale; null = ende objektivat e Jimit. */
  from: string | null
  /** Korrigjimet e pranuara të kontrollit javor, sipas datës. */
  adjustments: readonly TargetAdjustment[]
}

/** Një korrigjim i pranuar (V33): kcal në ditë nga data, te karbohidratet. */
export interface TargetAdjustment {
  weekStart: string
  from: string
  kcal: number
}

export type TargetsInput = Omit<TargetsProfile, 'from' | 'adjustments'>

export const EMPTY_TARGETS_PROFILE: TargetsProfile = {
  sex: null,
  birthYear: null,
  heightCm: null,
  activity: null,
  goal: null,
  ratePct: null,
  proteinGPerKg: null,
  fatGPerKg: null,
  bodyFatPct: null,
  maintenanceKcal: null,
  from: null,
  adjustments: [],
}

const SEXES: readonly Sex[] = ['male', 'female']
const ACTIVITIES: readonly Activity[] = ['sedentary', 'light', 'standing', 'physical']
const GOALS: readonly Goal[] = ['gain', 'maintain', 'lose']
const oneOf = <T extends string>(values: readonly T[], value: unknown): T | null => (values.includes(value as T) ? (value as T) : null)

/** Profili ka të dhënat që i duhen kalkulatorit. */
export function isComplete(profile: TargetsInput): profile is TargetsInput & { sex: Sex; heightCm: number; activity: Activity; goal: Goal } {
  return profile.sex !== null && profile.heightCm !== null && profile.activity !== null && profile.goal !== null
}

/** Korrigjimet e pranuara, të renditura sipas datës; një javë me dy vendime merr të fundit. */
export async function readAdjustments(store: LocalStore): Promise<TargetAdjustment[]> {
  const latest = new Map<string, LocalRow>()
  for (const row of await store.all('weekly_checks')) {
    const week = String(row.week_start).slice(0, 10)
    const current = latest.get(week)
    if (!current || String(row.updated_at ?? '') > String(current.updated_at ?? '')) latest.set(week, row)
  }
  return [...latest.values()]
    .filter((row) => row.status === 'accepted' && Number(row.kcal) !== 0)
    .map((row) => ({ weekStart: String(row.week_start).slice(0, 10), from: String(row.applies_from).slice(0, 10), kcal: Number(row.kcal) }))
    .sort((a, b) => a.from.localeCompare(b.from))
}

/** Shuma e korrigjimeve që vlejnë në një datë. */
export const adjustmentOn = (adjustments: readonly TargetAdjustment[], date: string) =>
  adjustments.filter((adjustment) => adjustment.from <= date).reduce((sum, adjustment) => sum + adjustment.kcal, 0)


export async function readTargetsProfile(store: LocalStore): Promise<TargetsProfile> {
  const [row, adjustments] = await Promise.all([settingsRow(store), readAdjustments(store)])
  if (!row) return { ...EMPTY_TARGETS_PROFILE, adjustments }
  return {
    sex: oneOf(SEXES, row.sex),
    birthYear: numberOrNull(row.birth_year),
    heightCm: numberOrNull(row.height_cm),
    activity: oneOf(ACTIVITIES, row.activity),
    goal: oneOf(GOALS, row.goal),
    ratePct: numberOrNull(row.rate_pct),
    proteinGPerKg: numberOrNull(row.protein_g_per_kg),
    fatGPerKg: numberOrNull(row.fat_g_per_kg),
    bodyFatPct: numberOrNull(row.body_fat_pct),
    maintenanceKcal: numberOrNull(row.maintenance_kcal),
    from: typeof row.targets_from === 'string' ? row.targets_from.slice(0, 10) : null,
    adjustments,
  }
}

/** Objektivat e kalkulatorit për një profil të plotë, ose null. */
export function personalTargets(profile: TargetsInput, input: { weightKg: number; sessionsPerWeek: number; date: string }): TargetsResult | null {
  if (!isComplete(profile)) return null
  return calculateTargets({
    sex: profile.sex,
    birthYear: profile.birthYear,
    heightCm: profile.heightCm,
    weightKg: input.weightKg,
    activity: profile.activity,
    sessionsPerWeek: input.sessionsPerWeek,
    goal: profile.goal,
    ratePctPerWeek: profile.ratePct,
    bodyFatPct: profile.bodyFatPct,
    knownMaintenanceKcal: profile.maintenanceKcal,
    proteinGPerKg: profile.proteinGPerKg,
    fatGPerKg: profile.fatGPerKg,
    today: input.date,
  })
}

export type TargetsSource = 'jim' | 'personal'

/** Objektivat e një date: personale nga `from` me një profil të plotë, përndryshe të Jimit. */
export function targetsFor(
  profile: TargetsProfile,
  input: { weightKg: number; dayType: DayType; date: string; sessionsPerWeek: number },
): { macros: Macros; source: TargetsSource } {
  const personal = profile.from !== null && input.date >= profile.from ? personalTargets(profile, input) : null
  if (personal) return { macros: withAdjustment(personal[input.dayType], adjustmentOn(profile.adjustments, input.date)), source: 'personal' }
  return { macros: nutritionTargets(input.weightKg, input.dayType), source: 'jim' }
}

/**
 * Ruan profilin te `user_settings`. Data e fillimit mbetet ajo e ruajtjes së parë, që ditët mes dy
 * ruajtjeve të mos kthehen te Jimi; objektivat e ruajtura nga sot e tutje rillogariten me të njëjtin
 * lloj dite dhe të njëjtën peshë, ato të kaluara mbeten.
 */
export async function saveTargetsProfile(store: LocalStore, input: TargetsInput, today: string) {
  const row = await settingsRow(store)
  if (!row) return
  const current = await readTargetsProfile(store)
  const from = current.from ?? today
  await store.put('user_settings', {
    id: row.id,
    sex: input.sex,
    birth_year: input.birthYear,
    height_cm: input.heightCm,
    activity: input.activity,
    goal: input.goal,
    rate_pct: input.ratePct,
    protein_g_per_kg: input.proteinGPerKg,
    fat_g_per_kg: input.fatGPerKg,
    body_fat_pct: input.bodyFatPct,
    maintenance_kcal: input.maintenanceKcal,
    targets_from: from,
  })
  await refreshSavedTargets(store, { ...input, from, adjustments: current.adjustments }, today)
}

/**
 * Rillogarit objektivat e ruajtura nga sot e tutje (pas ruajtjes së profilit ose një korrigjimi), me
 * të njëjtin lloj dite dhe të njëjtën peshë; ato të kaluara mbeten.
 */
export async function refreshSavedTargets(store: LocalStore, profile: TargetsProfile, today: string) {
  const row = await settingsRow(store)
  const sessionsPerWeek = Array.isArray(row?.training_days) ? row.training_days.length : 4
  for (const saved of await store.all('nutrition_targets')) {
    const date = String(saved.date)
    if (date < today || saved.bodyweight_kg === null || saved.bodyweight_kg === undefined) continue
    const { macros } = targetsFor(profile, { weightKg: Number(saved.bodyweight_kg), dayType: saved.day_type as DayType, date, sessionsPerWeek })
    await store.put('nutrition_targets', { id: saved.id, kcal: macros.kcal, protein_g: macros.proteinG, carbs_g: macros.carbsG, fat_g: macros.fatG })
  }
}
