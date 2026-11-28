import { shiftDate } from '@/lib/calendar'
import { nutritionDay } from './nutrition'
import type { LocalStore } from './store'
import { weekGoalsView } from './weekly-goals'

// "Kjo javë" te Progresi (V83; bordi "15 · Progresi" te kanavaca "Vrull - Propozimi UX"): java e tanishme në një
// vështrim dhe hapi i radhës drejt "Javës së plotë". Qëllimet janë ato të javës (§0.3c, `weekGoalsView`); këtu
// shtohen vetëm ditët me proteinën e mbyllur, që është numri kryesor i Ushqimit që nga V72.

/** Proteina e ditës quhet e mbyllur nga 90% e objektivit: 144 nga 160 g është ditë e mirë, jo e humbur. */
export const PROTEIN_SHARE = 0.9

export interface WeekNow {
  monday: string
  training: { done: number; target: number }
  /** Ditë me ushqim dhe ujë të numëruar kundrejt qëllimit (5 nga 7); null pa objektiva. */
  food: { counted: number; goal: number } | null
  water: { counted: number; goal: number } | null
  /** Ditë të javës, deri sot, me proteinën e mbyllur; null pa objektiva. */
  proteinDays: number | null
  /** Sa mungon për "Javën e plotë"; të gjitha zero kur u arrit. */
  left: { training: number; food: number; water: number }
  complete: boolean
}

export async function weekNow(store: LocalStore): Promise<WeekNow> {
  const goals = await weekGoalsView(store)
  const now = store.now()
  let proteinDays: number | null = null
  if (goals.food) {
    proteinDays = 0
    for (let offset = 0; offset < 7; offset++) {
      const date = shiftDate(goals.monday, offset)
      if (date > goals.foodToday) break
      const day = await nutritionDay(store, date, now)
      if (day.targets && day.targets.proteinG > 0 && day.totals.proteinG >= day.targets.proteinG * PROTEIN_SHARE - 1e-9) proteinDays += 1
    }
  }
  const short = (goal: { counted: number; goal: number; met: boolean } | null) => (goal && !goal.met ? Math.max(0, goal.goal - goal.counted) : 0)
  return {
    monday: goals.monday,
    training: { done: goals.training.done, target: goals.training.target },
    food: goals.food ? { counted: goals.food.counted, goal: goals.food.goal } : null,
    water: goals.water ? { counted: goals.water.counted, goal: goals.water.goal } : null,
    proteinDays,
    left: { training: goals.training.met ? 0 : Math.max(0, goals.training.target - goals.training.done), food: short(goals.food), water: short(goals.water) },
    complete: goals.complete,
  }
}
