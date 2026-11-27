import type { MealKey } from '@/nutrition/meals'
import type { MealPlan } from '@/nutrition/schedule'
import { DEFAULT_PROFILE } from './profile'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'

// Oraret e përdoruesit (V35, V2-E2-06): zgjimi, gjumi, ora e stërvitjes për çdo ditë dhe plani i
// vakteve. Plani i ri vlen nga dita tjetër: `user_settings.meal_plan` mban edhe planin e mëparshëm
// për ditët para `from`, orët e një dite të vetme të lëvizura nga ritmi i Sot-it (`day`, V64) dhe vaktet e
// kapërcyera sipas datës (`skipped`, V71).

export interface StoredMealPlan extends MealPlan {
  /** Data nga e cila vlen ky plan; null = gjithmonë. */
  from: string | null
  /** Plani para `from`; null = orari i parazgjedhur. */
  previous: MealPlan | null
  /** Orët e lëvizura nga ritmi i Sot-it, vetëm për atë datë (V64); null = asnjë. */
  day: MealDay | null
  /** Vaktet e shënuara "E kapërceva" sipas datës së ditës së ushqimit (V71); mbahen ditët e fundit. */
  skipped: Record<string, MealKey[]>
  /** Kur e shënon përdoruesi ushqimin (V69): gjatë ditës ose në mbrëmje; null = nuk është pyetur ende. */
  logging: FoodLogging | null
  /** Ora e stërvitjes vetëm për një datë (V76); ditët e tjera mbajnë orën e ditës së javës. */
  training: { date: string; time: string } | null
}

export type FoodLogging = 'day' | 'evening'

/** Sa vakte ha përdoruesi (V68) dhe cilat mbeten nga vaktet e planit. */
export const MEAL_SETS: Record<3 | 4 | 5, readonly MealKey[]> = {
  3: ['breakfast_1', 'lunch', 'dinner'],
  4: ['breakfast_1', 'lunch', 'snack_pm', 'dinner'],
  5: ['breakfast_1', 'snack_am', 'lunch', 'snack_pm', 'dinner'],
}

export interface MealDay {
  date: string
  times: Partial<Record<MealKey, string>>
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

function cleanDay(value: unknown): MealDay | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { date?: unknown }
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null
  const times = cleanPlan(value)?.times ?? {}
  return Object.keys(times).length > 0 ? { date: raw.date, times } : null
}

/** Sa ditë mbahen vaktet e kapërcyera: mjafton për vargun e ditëve dhe për javët e fundit. */
export const SKIPPED_DAYS_KEPT = 62

function cleanSkipped(value: unknown): Record<string, MealKey[]> {
  if (typeof value !== 'object' || value === null) return {}
  const result: Record<string, MealKey[]> = {}
  for (const [date, meals] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(meals)) continue
    const kept = MEALS.filter((meal) => meals.includes(meal))
    if (kept.length > 0) result[date] = kept
  }
  return result
}

function cleanTraining(value: unknown): { date: string; time: string } | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as { date?: unknown; time?: unknown }
  return typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) && typeof raw.time === 'string' && TIME.test(raw.time) ? { date: raw.date, time: raw.time } : null
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
  const stored = (row?.meal_plan ?? null) as { from?: unknown; previous?: unknown; day?: unknown; skipped?: unknown; logging?: unknown; training?: unknown } | null
  const current = cleanPlan(stored) ?? EMPTY_MEAL_PLAN
  return {
    wakeTime: (row?.wake_time as string | undefined)?.slice(0, 5) ?? DEFAULT_PROFILE.wakeTime,
    sleepTime: (row?.sleep_time as string | undefined)?.slice(0, 5) ?? DEFAULT_PROFILE.sleepTime,
    trainingDays: days,
    trainingTimes,
    plan: { ...current, from: typeof stored?.from === 'string' ? stored.from : null, previous: cleanPlan(stored?.previous), day: cleanDay(stored?.day), skipped: cleanSkipped(stored?.skipped), logging: stored?.logging === 'day' || stored?.logging === 'evening' ? stored.logging : null, training: cleanTraining(stored?.training) },
  }
}

/** Ora e stërvitjes së një date: ajo e vendosur vetëm për atë datë (V76), pastaj e ditës së saj ISO, pastaj e ditës së parë të stërvitjes. */
export function trainingTimeOn(schedule: Pick<ScheduleSettings, 'trainingDays' | 'trainingTimes'> & { plan?: Pick<StoredMealPlan, 'training'> }, date: string): string {
  if (schedule.plan?.training?.date === date) return schedule.plan.training.time
  return schedule.trainingTimes[isoWeekday(date)] ?? schedule.trainingTimes[schedule.trainingDays[0]] ?? DEFAULT_PROFILE.trainingTime
}

/** Plani i vakteve që vlen për një datë. */
export function mealPlanOn(plan: StoredMealPlan, date: string): MealPlan {
  const base = plan.from !== null && date < plan.from ? (plan.previous ?? EMPTY_MEAL_PLAN) : { removed: plan.removed, times: plan.times }
  // Lëvizja e Sot-it (V64) vlen vetëm për datën e saj, mbi planin e asaj dite.
  return plan.day?.date === date ? { removed: base.removed, times: { ...base.times, ...plan.day.times } } : base
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
  const plan: StoredMealPlan = unchanged ? current.plan : { ...wanted, from: nextDate(today), previous: mealPlanOn({ ...current.plan, day: null }, today), day: current.plan.day, skipped: current.plan.skipped, logging: current.plan.logging, training: current.plan.training }
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
 * Lëvizja e vakteve që vijnë nga ritmi i ditës te Sot (V57; V64: vetëm sot): orët e reja vlejnë vetëm për `date`
 * (dita e ushqimit e sotme, V46), mbi planin e asaj dite; nesër vaktet kthehen te plani. Një lëvizje tjetër po atë
 * ditë shtohet te e para; një lëvizje në një ditë tjetër e zëvendëson. Ndryshimi i përhershëm bëhet te Oraret (V35).
 */
export async function moveMealTimes(store: LocalStore, times: Partial<Record<MealKey, string>>, date: string) {
  const row = await settingsRow(store)
  if (!row) return
  const current = await readSchedule(store)
  const kept = current.plan.day?.date === date ? current.plan.day.times : {}
  const wanted: Partial<Record<MealKey, string>> = { ...kept }
  for (const [meal, time] of Object.entries(times)) if (MEALS.includes(meal as MealKey) && TIME.test(time)) wanted[meal as MealKey] = time
  if (JSON.stringify(wanted) === JSON.stringify(kept)) return
  const plan: StoredMealPlan = { ...current.plan, day: { date, times: wanted } }
  await store.put('user_settings', { id: row.id, meal_plan: plan })
}

/**
 * "E kapërceva" (V71): vakti i një dite mbyllet pa ushqim, ose hapet sërish me `skipped: false`. Ruhet te
 * `user_settings.meal_plan.skipped`, pa migrim; ditët më të vjetra se `SKIPPED_DAYS_KEPT` hiqen.
 */
export async function setMealSkipped(store: LocalStore, date: string, meal: MealKey, skipped: boolean) {
  const row = await settingsRow(store)
  if (!row || !MEALS.includes(meal) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
  const current = await readSchedule(store)
  const before = current.plan.skipped[date] ?? []
  const after = skipped ? MEALS.filter((key) => key === meal || before.includes(key)) : before.filter((key) => key !== meal)
  if (JSON.stringify(after) === JSON.stringify(before)) return
  const all: Record<string, MealKey[]> = { ...current.plan.skipped }
  if (after.length > 0) all[date] = after
  else delete all[date]
  const kept = Object.keys(all).sort().slice(-SKIPPED_DAYS_KEPT)
  const next: Record<string, MealKey[]> = {}
  for (const key of kept) next[key] = all[key]
  await store.put('user_settings', { id: row.id, meal_plan: { ...current.plan, skipped: next } })
}

/** Vaktet e kapërcyera të një date. */
export function skippedOn(plan: Pick<StoredMealPlan, 'skipped'>, date: string): MealKey[] {
  return plan.skipped[date] ?? []
}

/**
 * Nisja e Ushqimit (V68, V69): sa vakte ha përdoruesi dhe kur i shënon. Vaktet jashtë `MEAL_SETS[meals]` hiqen nga
 * plani (nga dita pas `today`, si çdo ndryshim orari); orët e ndryshuara të vakteve që mbeten ruhen.
 */
export async function saveFoodSetup(store: LocalStore, setup: { meals: 3 | 4 | 5; logging: FoodLogging }, today: string) {
  const row = await settingsRow(store)
  if (!row) return
  const current = await readSchedule(store)
  const kept = MEAL_SETS[setup.meals]
  const future = mealPlanOn(current.plan, nextDate(today))
  const times: Partial<Record<MealKey, string>> = {}
  for (const meal of kept) if (future.times[meal]) times[meal] = future.times[meal]
  await saveSchedule(store, { wakeTime: current.wakeTime, sleepTime: current.sleepTime, trainingTimes: current.trainingTimes, plan: { removed: MEALS.filter((meal) => !kept.includes(meal)), times } }, today)
  const saved = await readSchedule(store)
  await store.put('user_settings', { id: row.id, meal_plan: { ...saved.plan, logging: setup.logging } })
}

/**
 * Ora e stërvitjes (V76). `scope: 'day'`: vetëm për `date` (ruhet te `meal_plan.training`, pa migrim; një datë
 * tjetër e zëvendëson). `scope: 'weekday'`: për çdo javë në atë ditë, dhe ora "vetëm sot" e asaj date hiqet.
 * Vaktet para dhe pas stërvitjes dhe rikujtuesit e lexojnë nga `trainingTimeOn`, ndaj lëvizin bashkë me të.
 */
export async function setTrainingTime(store: LocalStore, date: string, time: string, scope: 'day' | 'weekday') {
  const row = await settingsRow(store)
  if (!row || !TIME.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
  const current = await readSchedule(store)
  // Një ditë jashtë ditëve të stërvitjes (p.sh. e shtyrë) nuk ka orë jave: vlen vetëm për datën.
  if (scope === 'day' || !current.trainingDays.includes(isoWeekday(date))) {
    const usual = trainingTimeOn({ trainingDays: current.trainingDays, trainingTimes: current.trainingTimes }, date)
    await store.put('user_settings', { id: row.id, meal_plan: { ...current.plan, training: time === usual ? null : { date, time } } })
    return
  }
  const times: Record<string, string> = {}
  for (const day of current.trainingDays) times[String(day)] = current.trainingTimes[day]
  times[String(isoWeekday(date))] = time
  await store.put('user_settings', { id: row.id, training_times: times, meal_plan: { ...current.plan, training: current.plan.training?.date === date ? null : current.plan.training } })
}
