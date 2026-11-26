import { shiftDate } from '@/lib/calendar'
import { nutritionDay } from './nutrition'
import { SKIPPED_DAYS_KEPT } from './schedule-settings'
import type { LocalStore } from './store'

// Vargu i ditëve të shënuara te Ushqimi (V72). Një ditë numërohet kur çdo vakt i saj është mbyllur, i ngrënë ose i
// kapërcyer (V71), dhe të paktën një është ngrënë. Dita e sotme numërohet kur është mbyllur; e hapur, nuk e këput
// vargun e ditëve para saj. Shkon mbrapa vetëm sa mbahen vaktet e kapërcyera.

async function dayClosed(store: LocalStore, date: string, now: Date) {
  const day = await nutritionDay(store, date, now)
  return day.meals.length > 0 && day.meals.every((meal) => meal.status === 'done' || meal.status === 'skipped') && day.meals.some((meal) => meal.status === 'done')
}

/** Sa ditë rresht janë mbyllur, deri te `today` (dita e ushqimit). */
export async function foodStreak(store: LocalStore, today: string, now: Date): Promise<number> {
  let streak = (await dayClosed(store, today, now)) ? 1 : 0
  for (let back = 1; back < SKIPPED_DAYS_KEPT; back += 1) {
    if (!(await dayClosed(store, shiftDate(today, -back), now))) break
    streak += 1
  }
  return streak
}
