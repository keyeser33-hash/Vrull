import type { MealKey } from '@/nutrition/meals'
import type { MealPlan } from '@/nutrition/schedule'
import { DEFAULT_PROFILE } from './profile'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'

// Oraret e përdoruesit (V35, V2-E2-06): zgjimi, gjumi, ora e stërvitjes për çdo ditë dhe plani i
// vakteve. Plani i ri vlen nga dita tjetër: `user_settings.meal_plan` mban edhe planin e mëparshëm
// për ditët para `from`.

export interface StoredMealPlan extends MealPlan {
  /** Data nga e cila vlen ky plan; null = gjithmonë. */
  from: string | null
  /** Plani para `from`; null = orari i parazgjedhur. */
  previous: MealPlan | null
}

export interface ScheduleSettings {
  wakeTime: string
  sleepTime: string
  /** Ditët ISO (1 = e hënë ... 7 = e diel). */
  trainingDays: number[]
  /** Ora e stërvitjes sipas ditës ISO. */
  trainingTimes: Record<number, string>
  plan: StoredMealPlan
}

export const EMPTY_MEAL_PLAN: MealPlan = { removed: [], times: {} }
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const MEALS: readonly MealKey[] = ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime', 'pre_workout', 'post_workout']

function cleanPlan(value: unknown): MealPlan | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { removed?: unknown; times?: unknown }
  const removed = Array.isArray(raw.removed) ? raw.removed.filter((meal): meal is MealKey => MEALS.includes(meal as MealKey)) : []
  const times: Partial<Record<MealKey, string>> = {}
  if (typeof raw.times === 'object' && raw.times !== null) {
    for (const [meal, time] of Object.entries(raw.times)) if (MEALS.includes(meal as MealKey) && typeof time === 'string' && TIME.test(time)) times[meal as MealKey] = time
  }
  return { removed, times }
}

const isoWeekday = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return ((new Date(year, month - 1, day).getDay() + 6) % 7) + 1
}
const nextDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(year, month - 1, day + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

export async function readSchedule(store: LocalStore): Promise<ScheduleSettings> {
  const row = await settingsRow(store)
  const days = (row?.training_days as number[] | undefined) ?? DEFAULT_PROFILE.trainingDays
  const saved = (row?.training_times as Record<string, string> | undefined) ?? {}
  const first = saved[String(days[0])] ?? DEFAULT_PROFILE.trainingTime
  const trainingTimes: Record<number, string> = {}
  for (const day of days) trainingTimes[day] = TIME.test(saved[String(day)] ?? '') ? saved[String(day)] : first
  const stored = (row?.meal_plan ?? null) as { from?: unknown; previous?: unknown } | null
  const current = cleanPlan(stored) ?? EMPTY_MEAL_PLAN
  return {
    wakeTime: (row?.wake_time as string | undefined)?.slice(0, 5) ?? DEFAULT_PROFILE.wakeTime,
    sleepTime: (row?.sleep_time as string | undefined)?.slice(0, 5) ?? DEFAULT_PROFILE.sleepTime,
    trainingDays: days,
    trainingTimes,
    plan: { ...current, from: typeof stored?.from === 'string' ? stored.from : null, previous: cleanPlan(stored?.previous) },
  }
}

/** Ora e stërvitjes së një date (dita e saj ISO), ose e ditës së parë të stërvitjes. */
export function trainingTimeOn(schedule: Pick<ScheduleSettings, 'trainingDays' | 'trainingTimes'>, date: string): string {
  return schedule.trainingTimes[isoWeekday(date)] ?? schedule.trainingTimes[schedule.trainingDays[0]] ?? DEFAULT_PROFILE.trainingTime
}

/** Plani i vakteve që vlen për një datë. */
export function mealPlanOn(plan: StoredMealPlan, date: string): MealPlan {
  if (plan.from !== null && date < plan.from) return plan.previous ?? EMPTY_MEAL_PLAN
  return { removed: plan.removed, times: plan.times }
}

/**
 * Ruan oraret. Zgjimi, gjumi dhe orët e stërvitjes vlejnë menjëherë; plani i vakteve nga dita pas
 * `today`, që dita e sotme të mos ndryshojë në mes.
 */
export async function saveSchedule(
  store: LocalStore,
  next: { wakeTime: string; sleepTime: string; trainingTimes: Record<number, string>; plan: MealPlan },
  today: string,
) {
  const row = await settingsRow(store)
  if (!row) return
  const current = await readSchedule(store)
  const wanted: MealPlan = { removed: [...next.plan.removed], times: { ...next.plan.times } }
  const unchanged = JSON.stringify(mealPlanOn(current.plan, nextDate(today))) === JSON.stringify(wanted)
  const plan: StoredMealPlan = unchanged ? current.plan : { ...wanted, from: nextDate(today), previous: mealPlanOn(current.plan, today) }
  const times: Record<string, string> = {}
  for (const day of current.trainingDays) times[String(day)] = next.trainingTimes[day] ?? current.trainingTimes[day]
  await store.put('user_settings', {
    id: row.id,
    wake_time: next.wakeTime,
    sleep_time: next.sleepTime,
    training_times: times,
    meal_plan: plan,
  })
}

/**
 * Lëvizja e vakteve që vijnë nga ritmi i ditës te Sot (V57, V35): orët e reja vlejnë nga data e dhënë (dita e
 * ushqimit e sotme, V46), sepse vaktet që lëvizin nuk kanë ardhur ende; ditët para saj mbeten me planin e
 * mëparshëm. Pjesa e planit që pret nga nesër (Oraret e vakteve) hyn bashkë me të. Zgjimi, gjumi dhe oraret e
 * stërvitjes nuk preken; vaktet e hequra mbeten të hequra.
 */
export async function moveMealTimes(store: LocalStore, times: Partial<Record<MealKey, string>>, date: string) {
  const row = await settingsRow(store)
  if (!row) return
  const current = await readSchedule(store)
  const base = mealPlanOn(current.plan, nextDate(date))
  const wanted: MealPlan = { removed: [...base.removed], times: { ...base.times } }
  for (const [meal, time] of Object.entries(times)) if (TIME.test(time)) wanted.times[meal as MealKey] = time
  if (JSON.stringify(mealPlanOn(current.plan, date)) === JSON.stringify(wanted)) return
  const yesterday = new Date(`${date}T12:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  const before = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const plan: StoredMealPlan = { ...wanted, from: date, previous: mealPlanOn(current.plan, before) }
  await store.put('user_settings', { id: row.id, meal_plan: plan })
}
