import type { MealKey } from './meals'

// Orari i vakteve të një dite (SPEC §13 dhe PDF-ja): mëngjesi 1 në zgjim, mëngjesi 2 pas 45 min,
// vaktet e tjera me hapa 2,5–3 orë, vakti para gjumit 30 min para gjumit. Në ditë stërvitjeje
// shake-u dhe molla 15 min para; vakti pas stërvitjes 15 min pas mbarimit të vlerësuar të stërvitjes
// ("brenda 30 minutave pas stërvitjes", PDF faqja 13; pa vlerësim, stërvitja llogaritet 60 min). Kur një vakt bie te
// stërvitja (30 min para vaktit para stërvitjes deri 30 min pas vaktit pas saj), ai vjen 1 orë pas
// vaktit pas stërvitjes dhe vaktet pas tij zhvendosen bashkë me të (rregulli i PDF-së).

export interface ScheduledMeal {
  meal: MealKey
  time: string
  /** Minutat nga mesnata e ditës; pas mesnate kalojnë 1440 (vakti i përket po kësaj dite, V46). */
  minutes: number
}

/** Kohëzgjatja e stërvitjes kur nuk dihet vlerësimi i programit. */
export const DEFAULT_WORKOUT_MINUTES = 60
/** Vakti pas stërvitjes vjen kaq minuta pas mbarimit, dhe asnjëherë më vonë se 30 (PDF, faqja 13). */
const POST_WORKOUT_AFTER_END = 15
const POST_WORKOUT_LATEST = 30

const REGULAR: [MealKey, number][] = [
  ['breakfast_1', 0],
  ['breakfast_2', 45],
  ['snack_am', 210],
  ['lunch', 360],
  ['snack_pm', 510],
  ['dinner', 690],
]

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
const toTime = (minutes: number) => {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

/**
 * Ndryshimet e përdoruesit (V35): vaktet e hequra dhe orët e lëvizura me dorë. Vaktet para dhe pas
 * stërvitjes ndjekin stërvitjen dhe nuk lëvizen me dorë, por hiqen.
 */
export interface MealPlan {
  removed: MealKey[]
  times: Partial<Record<MealKey, string>>
}

/** Radha kur ulet numri i vakteve; mëngjesi 1, dreka dhe darka mbeten. */
export const MEAL_REMOVAL_ORDER: readonly MealKey[] = ['snack_am', 'snack_pm', 'breakfast_2', 'bedtime', 'post_workout', 'pre_workout']
export const MIN_MEALS = 3

/** Vaktet e hequra për një numër vaktesh nga `total` të mundshme (3 deri në `total`). */
export function withMealCount(removed: readonly MealKey[], total: number, count: number, order: readonly MealKey[] = MEAL_REMOVAL_ORDER): MealKey[] {
  const wanted = Math.min(total - MIN_MEALS, Math.max(0, total - count))
  const next = [...removed]
  while (next.length > wanted) next.pop()
  for (const meal of order) {
    if (next.length >= wanted) break
    if (!next.includes(meal)) next.push(meal)
  }
  return next
}

const WORKOUT_MEALS: readonly MealKey[] = ['pre_workout', 'post_workout']

export function mealSchedule({
  wakeTime,
  sleepTime,
  trainingTime,
  workoutMinutes,
  plan,
}: {
  wakeTime: string
  sleepTime: string
  trainingTime: string | null
  /** Kohëzgjatja e vlerësuar e stërvitjes së ditës (si te editori, "~45 min"); pa të, 60. */
  workoutMinutes?: number | null
  plan?: MealPlan
}): ScheduledMeal[] {
  const wake = toMinutes(wakeTime)
  let sleep = toMinutes(sleepTime)
  if (sleep <= wake) sleep += 1440
  const bedtime = sleep - 30
  let meals = REGULAR.map(([meal, offset]) => ({ meal, minutes: wake + offset }))
  const extra: { meal: MealKey; minutes: number }[] = []

  if (trainingTime) {
    let start = toMinutes(trainingTime)
    if (start < wake - 60) start += 1440
    const pre = start - 15
    const duration = workoutMinutes && workoutMinutes > 0 ? workoutMinutes : DEFAULT_WORKOUT_MINUTES
    const post = start + duration + Math.min(POST_WORKOUT_AFTER_END, POST_WORKOUT_LATEST)
    extra.push({ meal: 'pre_workout', minutes: pre }, { meal: 'post_workout', minutes: post })
    const first = meals.findIndex((entry) => entry.minutes >= pre - 30 && entry.minutes <= post + 30)
    if (first >= 0) {
      const delta = post + 60 - meals[first].minutes
      meals = meals.map((entry, index) => (index >= first ? { ...entry, minutes: entry.minutes + delta } : entry))
    }
  }

  // Asnjë vakt pas vaktit para gjumit: ato që shtyhen përtej tij mblidhen para tij.
  meals = meals.map((entry) => ({ ...entry, minutes: Math.min(entry.minutes, bedtime - 30) }))
  // Orët e lëvizura me dorë (V35): ora para zgjimit − 1 orë kalon pas mesnate, në fund të ditës.
  const moved = (entry: { meal: MealKey; minutes: number }) => {
    const time = WORKOUT_MEALS.includes(entry.meal) ? undefined : plan?.times[entry.meal]
    if (!time) return entry
    let minutes = toMinutes(time)
    if (minutes < wake - 60) minutes += 1440
    return { ...entry, minutes }
  }
  return [...meals, ...extra, { meal: 'bedtime' as MealKey, minutes: bedtime }]
    .filter((entry) => !plan?.removed.includes(entry.meal))
    .map(moved)
    .sort((a, b) => a.minutes - b.minutes)
    .map((entry) => ({ meal: entry.meal, time: toTime(entry.minutes), minutes: Math.round(entry.minutes) }))
}
