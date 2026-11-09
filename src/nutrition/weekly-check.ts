import type { Goal } from './calculator'

// Kontrolli javor (V33, SPEC §9): nga ushqimi i regjistruar dhe pesha trend e javës së kaluar del
// mirëmbajtja e vërtetë; propozimi është gjysma e diferencës me mirëmbajtjen që supozojnë objektivat,
// në hapa 10 kcal dhe të shumtën ±150 kcal në javë. Pa UI dhe pa bazë.

export const MIN_LOGGED_DAYS = 4
export const MIN_WEIGH_INS = 1
export const MAX_STEP_KCAL = 150
/** Një ditë numërohet si e regjistruar kur ka të paktën gjysmën e objektivit të saj. */
export const LOGGED_SHARE = 0.5

/** Dita e regjistruar (`LOGGED_SHARE`): kontrolli javor dhe mesatarja e ushqimit te përmbledhja e së dielës. */
export const isLoggedDay = (day: { kcal: number; targetKcal: number | null }) => day.targetKcal !== null && day.kcal >= day.targetKcal * LOGGED_SHARE
/** Energjia e një kg, si te kalkulatori: shtimi 5 600 kcal (muskul dhe yndyrë), humbja 7 700. */
const KCAL_PER_KG = { gain: 5600, other: 7700 }

export interface Weight {
  date: string
  kg: number
}

export interface WeeklyCheckInput {
  /** E hëna e javës që rishikohet. */
  weekStart: string
  goal: Goal
  weights: readonly Weight[]
  /** Shtatë ditët e javës: kaloritë e regjistruara dhe objektivi i secilës. */
  days: readonly { date: string; kcal: number; targetKcal: number | null }[]
  /** Objektivi mesatar ditor i javës sot, me korrigjimet e pranuara. */
  averageTargetKcal: number
  /** Teprica (+) ose mungesa (−) ditore e planit. */
  plannedAdjustmentKcal: number
  /** Ndryshimi i synuar i peshës në javë, kg. */
  plannedChangeKg: number
}

export type WeeklyCheck =
  | { kind: 'insufficient'; loggedDays: number; weighIns: number }
  | {
      kind: 'proposal'
      loggedDays: number
      averageKcal: number
      previousTrendKg: number
      trendKg: number
      changeKg: number
      plannedChangeKg: number
      maintenanceKcal: number
      /** Korrigjimi ditor i propozuar; 0 kur java ishte në ritëm. */
      kcal: number
    }

const shift = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/** Pesha trend: mesatarja e peshimeve të 7 ditëve deri te data (përfshirë); null pa peshim. */
export function trendWeight(weights: readonly Weight[], date: string): number | null {
  const from = shift(date, -6)
  const inWindow = weights.filter((weight) => weight.date >= from && weight.date <= date)
  return inWindow.length > 0 ? inWindow.reduce((sum, weight) => sum + weight.kg, 0) / inWindow.length : null
}

export function weeklyCheck(input: WeeklyCheckInput): WeeklyCheck {
  const weekEnd = shift(input.weekStart, 6)
  const logged = input.days.filter(isLoggedDay)
  const weekWeights = [...input.weights].filter((weight) => weight.date >= input.weekStart && weight.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date))
  const before = [...input.weights].filter((weight) => weight.date < input.weekStart).sort((a, b) => a.date.localeCompare(b.date))
  // Pika e nisjes: trendi i javës para, pesha e fundit para javës, ose peshimi i parë i javës kur ka dy.
  const baseline = trendWeight(input.weights, shift(input.weekStart, -1)) ?? before.at(-1)?.kg ?? (weekWeights.length >= 2 ? weekWeights[0].kg : null)
  const trend = trendWeight(input.weights, weekEnd)
  if (logged.length < MIN_LOGGED_DAYS || weekWeights.length < MIN_WEIGH_INS || trend === null || baseline === null) {
    return { kind: 'insufficient', loggedDays: logged.length, weighIns: weekWeights.length }
  }
  const averageKcal = logged.reduce((sum, day) => sum + day.kcal, 0) / logged.length
  const changeKg = trend - baseline
  const perKg = input.goal === 'gain' ? KCAL_PER_KG.gain : KCAL_PER_KG.other
  const maintenance = averageKcal - (changeKg * perKg) / 7
  const assumed = input.averageTargetKcal - input.plannedAdjustmentKcal
  const half = (maintenance - assumed) / 2
  const kcal = Math.max(-MAX_STEP_KCAL, Math.min(MAX_STEP_KCAL, Math.round(half / 10) * 10))
  return {
    kind: 'proposal',
    loggedDays: logged.length,
    averageKcal: Math.round(averageKcal),
    previousTrendKg: round(baseline, 2),
    trendKg: round(trend, 2),
    changeKg: round(changeKg, 2),
    plannedChangeKg: round(input.plannedChangeKg, 2),
    maintenanceKcal: Math.round(maintenance),
    kcal: kcal === 0 ? 0 : kcal,
  }
}
