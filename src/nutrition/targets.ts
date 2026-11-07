// Objektivat e ushqimit (SPEC §9, Shtojca C): totalet e ditës shembull të Jimit për 180 lb
// (81,65 kg), të shkallëzuara sipas peshës.

export type DayType = 'training' | 'rest'

export interface Macros {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export const JIM_WEIGHT_KG = 81.65

export const JIM_TOTALS: Record<DayType, Macros> = {
  rest: { kcal: 3100, proteinG: 265, carbsG: 260, fatG: 110 },
  training: { kcal: 3700, proteinG: 335, carbsG: 340, fatG: 110 },
}

export function nutritionTargets(weightKg: number, dayType: DayType): Macros {
  const scale = weightKg / JIM_WEIGHT_KG
  const totals = JIM_TOTALS[dayType]
  return {
    kcal: Math.round(totals.kcal * scale),
    proteinG: Math.round(totals.proteinG * scale),
    carbsG: Math.round(totals.carbsG * scale),
    fatG: Math.round(totals.fatG * scale),
  }
}

const DAY_MS = 86_400_000
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)

/**
 * Pesha për objektivat e një dite: mesatarja e matjeve të 7 ditëve deri në atë ditë kur janë të
 * paktën 3, përndryshe matja e fundit deri në atë ditë.
 */
export function bodyweightForTargets(measurements: { date: string; weightKg: number }[], date: string): number | null {
  const today = dayNumber(date)
  const upToDate = measurements.filter((entry) => dayNumber(entry.date) <= today).sort((a, b) => b.date.localeCompare(a.date))
  const week = upToDate.filter((entry) => today - dayNumber(entry.date) < 7)
  if (week.length >= 3) return Math.round((week.reduce((total, entry) => total + entry.weightKg, 0) / week.length) * 100) / 100
  return upToDate[0]?.weightKg ?? null
}

/** Pesha e Jimit vlen pa ndryshime për 160–200 lb; jashtë tyre app-i e thotë. */
export const JIM_RANGE_KG = { min: 72.6, max: 90.7 }
