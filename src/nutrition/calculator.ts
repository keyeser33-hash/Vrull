// Kalkulatori i objektivave (SPEC Shtojca C, V32): mirëmbajtja nga trupi dhe aktiviteti jashtë
// palestrës, qëllimi dhe ritmi, makrot. Pa UI dhe pa bazë; burimi: docs/research/objektivat.md.
import type { Macros } from './targets'

export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'standing' | 'physical'
export type Goal = 'gain' | 'maintain' | 'lose'
export type Formula = 'mifflin' | 'cunningham' | 'known'
export type TargetLimit = 'kcal_floor' | 'carbs_floor'

export interface ProfileInput {
  sex: Sex
  birthYear?: number | null
  heightCm: number
  /** Mesatarja 7-ditore e peshës (`bodyweightForTargets`). */
  weightKg: number
  activity: Activity
  sessionsPerWeek: number
  goal: Goal
  /** Madhësia e ritmit në % të peshës në javë; shenja vjen nga qëllimi. */
  ratePctPerWeek?: number | null
  bodyFatPct?: number | null
  /** Mirëmbajtja e njohur e një dite pushimi. */
  knownMaintenanceKcal?: number | null
  proteinGPerKg?: number | null
  fatGPerKg?: number | null
  /** Data e sotme (YYYY-MM-DD), për moshën. */
  today: string
}

/** Rreshtat e "Si u llogarit", të rrumbullakosur që të mblidhen saktë. */
export interface TargetsBreakdown {
  bmr: number
  maintenanceRest: number
  adjustment: number
  rest: number
  trainingExtra: number
  training: number
}

export interface TargetsResult {
  formula: Formula
  age: number
  bmrKcal: number
  ratePctPerWeek: number
  proteinGPerKg: number
  fatGPerKg: number
  /** Teprica (+) ose mungesa (−) ditore, pa rrumbullakim. */
  adjustmentKcal: number
  rest: Macros
  training: Macros
  /** Kaloritë mesatare të javës sipas seancave. */
  averageKcal: number
  breakdown: TargetsBreakdown
  limits: TargetLimit[]
}

export const ACTIVITY_FACTORS: Record<Activity, number> = { sedentary: 1.3, light: 1.4, standing: 1.55, physical: 1.7 }
export const DEFAULT_AGE = 30
export const TRAINING_KCAL_PER_KG = 3.4
const KCAL_PER_KG_GAIN = 5600
const KCAL_PER_KG_LOSS = 7700
const KCAL_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 }
const MIN_CARBS_G = 50
const MIN_FAT_SHARE = 0.2

export const RATE_LIMITS: Record<Exclude<Goal, 'maintain'>, { min: number; max: number; default: number }> = {
  gain: { min: 0.1, max: 0.5, default: 0.25 },
  lose: { min: 0.25, max: 1, default: 0.5 },
}
export const PROTEIN_LIMITS = { min: 1.6, max: 2.4, default: 2, defaultLose: 2.2 }
export const FAT_LIMITS = { min: 0.6, max: 1.2, default: 0.9 }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round10 = (value: number) => Math.round(value / 10) * 10
const given = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

function ageOn(today: string, birthYear: number | null | undefined): number {
  if (!given(birthYear)) return DEFAULT_AGE
  return clamp(Number(today.slice(0, 4)) - birthYear, 14, 100)
}

function rateFor(goal: Goal, requested: number | null | undefined): number {
  if (goal === 'maintain') return 0
  const limits = RATE_LIMITS[goal]
  return clamp(given(requested) ? Math.abs(requested) : limits.default, limits.min, limits.max)
}

export function calculateTargets(input: ProfileInput): TargetsResult {
  const weight = input.weightKg
  const age = ageOn(input.today, input.birthYear)
  const limits: TargetLimit[] = []

  const bodyFat = given(input.bodyFatPct) ? clamp(input.bodyFatPct, 3, 60) : null
  const mifflin = 10 * weight + 6.25 * input.heightCm - 5 * age + (input.sex === 'male' ? 5 : -161)
  const bmrKcal = bodyFat === null ? mifflin : 500 + 22 * weight * (1 - bodyFat / 100)
  const known = given(input.knownMaintenanceKcal) && input.knownMaintenanceKcal > 0 ? input.knownMaintenanceKcal : null
  const formula: Formula = known !== null ? 'known' : bodyFat === null ? 'mifflin' : 'cunningham'

  const maintenanceRest = known ?? bmrKcal * ACTIVITY_FACTORS[input.activity]
  const maintenanceTraining = maintenanceRest + TRAINING_KCAL_PER_KG * weight

  const ratePctPerWeek = rateFor(input.goal, input.ratePctPerWeek)
  const perKg = input.goal === 'lose' ? -KCAL_PER_KG_LOSS : KCAL_PER_KG_GAIN
  const adjustmentKcal = input.goal === 'maintain' ? 0 : ((ratePctPerWeek / 100) * weight * perKg) / 7

  const floor = Math.max(KCAL_FLOOR[input.sex], bmrKcal)
  const dayKcal = (maintenance: number) => {
    const target = maintenance + adjustmentKcal
    if (target >= floor) return round10(target)
    if (!limits.includes('kcal_floor')) limits.push('kcal_floor')
    return round10(floor)
  }
  const restKcal = dayKcal(maintenanceRest)
  const trainingKcal = dayKcal(maintenanceTraining)

  const proteinGPerKg = clamp(
    given(input.proteinGPerKg) ? input.proteinGPerKg : input.goal === 'lose' ? PROTEIN_LIMITS.defaultLose : PROTEIN_LIMITS.default,
    PROTEIN_LIMITS.min,
    PROTEIN_LIMITS.max,
  )
  const fatGPerKg = clamp(given(input.fatGPerKg) ? input.fatGPerKg : FAT_LIMITS.default, FAT_LIMITS.min, FAT_LIMITS.max)
  const proteinG = Math.round(proteinGPerKg * weight)
  // E njëjta yndyrë çdo ditë, jo nën 20% të ditës me më shumë kalori.
  const fatG = Math.round(Math.max(fatGPerKg * weight, (MIN_FAT_SHARE * trainingKcal) / 9))

  const day = (kcal: number): Macros => {
    const carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4)
    if (carbsG >= MIN_CARBS_G) return { kcal, proteinG, carbsG, fatG }
    if (!limits.includes('carbs_floor')) limits.push('carbs_floor')
    return { kcal: round10(proteinG * 4 + fatG * 9 + MIN_CARBS_G * 4), proteinG, carbsG: MIN_CARBS_G, fatG }
  }
  const rest = day(restKcal)
  const training = day(trainingKcal)

  const sessions = clamp(Math.round(input.sessionsPerWeek), 0, 7)
  const shownMaintenance = round10(maintenanceRest)

  return {
    formula,
    age,
    bmrKcal,
    ratePctPerWeek,
    proteinGPerKg,
    fatGPerKg,
    adjustmentKcal,
    rest,
    training,
    averageKcal: (rest.kcal * (7 - sessions) + training.kcal * sessions) / 7,
    breakdown: {
      bmr: round10(bmrKcal),
      maintenanceRest: shownMaintenance,
      adjustment: rest.kcal - shownMaintenance,
      rest: rest.kcal,
      trainingExtra: training.kcal - rest.kcal,
      training: training.kcal,
    },
    limits,
  }
}

export interface NavyInput {
  sex: Sex
  heightCm: number
  neckCm: number
  waistCm: number
  hipCm?: number | null
}

/** Yndyra e trupit (%) me formulën US Navy, në cm; null kur matjet nuk japin një vlerë të besueshme. */
export function navyBodyFat({ sex, heightCm, neckCm, waistCm, hipCm }: NavyInput): number | null {
  let pct: number
  if (sex === 'male') {
    if (waistCm - neckCm <= 0) return null
    pct = 86.01 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76
  } else {
    if (!given(hipCm) || waistCm + hipCm - neckCm <= 0) return null
    pct = 163.205 * Math.log10(waistCm + hipCm - neckCm) - 97.684 * Math.log10(heightCm) - 78.387
  }
  return pct >= 3 && pct <= 60 ? pct : null
}
