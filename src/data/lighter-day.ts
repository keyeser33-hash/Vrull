import { foodDate } from '@/nutrition/food-day'
import { readDailyState } from './daily-state'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'

// "Seanca më e lehtë" (V50, V2-E3-06): a është zgjedhur për një ditë. Vendimi ruhet te gjendja e ditës, me datën e
// ditës së ushqimit (V46), si check-in-i; seanca e hapur mban datën e vet kalendarike, ndaj me seancë të hapur
// vlen data e saj (si "Mirë se u ktheve"). Skedar pa varësi nga training.ts, që `trainingSnapshot` dhe
// `workoutWeights` ta lexojnë pa cikël.

const DEFAULT_WAKE = '07:00'

/** Dita e ushqimit e tanishme (si `currentFoodDate` te nutrition.ts, pa varësinë nga profili). */
export async function currentDay(store: LocalStore): Promise<string> {
  const wake = (await settingsRow(store))?.wake_time
  return foodDate(store.now(), typeof wake === 'string' ? wake.slice(0, 5) : DEFAULT_WAKE)
}

/** Seanca më e lehtë sot (ose për datën e seancës së hapur, kur ka një). */
export async function lighterDay(store: LocalStore, sessionDate?: string | null): Promise<boolean> {
  const date = sessionDate ? sessionDate.slice(0, 10) : await currentDay(store)
  return (await readDailyState(store, date))?.choice === 'lighter'
}

/** Datat me seancë më të lehtë, për historikun dhe për peshat e propozuara. */
export async function lighterDates(store: LocalStore): Promise<Set<string>> {
  return new Set((await store.all('daily_states')).filter((row) => row.choice === 'lighter').map((row) => String(row.date).slice(0, 10)))
}
