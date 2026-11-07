import type { MealKey } from './meals'

// Orari i vakteve të një dite (SPEC §13 dhe PDF-ja): mëngjesi 1 në zgjim, mëngjesi 2 pas 45 min,
// vaktet e tjera me hapa 2,5–3 orë, vakti para gjumit 30 min para gjumit. Në ditë stërvitjeje
// shake-u dhe molla 15 min para, vakti pas stërvitjes 90 min pas fillimit. Kur një vakt bie te
// stërvitja (30 min para vaktit para stërvitjes deri 30 min pas vaktit pas saj), ai vjen 1 orë pas
// vaktit pas stërvitjes dhe vaktet pas tij zhvendosen bashkë me të (rregulli i PDF-së).

export interface ScheduledMeal {
  meal: MealKey
  time: string
}

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

export function mealSchedule({ wakeTime, sleepTime, trainingTime }: { wakeTime: string; sleepTime: string; trainingTime: string | null }): ScheduledMeal[] {
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
    const post = start + 90
    extra.push({ meal: 'pre_workout', minutes: pre }, { meal: 'post_workout', minutes: post })
    const first = meals.findIndex((entry) => entry.minutes >= pre - 30 && entry.minutes <= post + 30)
    if (first >= 0) {
      const delta = post + 60 - meals[first].minutes
      meals = meals.map((entry, index) => (index >= first ? { ...entry, minutes: entry.minutes + delta } : entry))
    }
  }

  // Asnjë vakt pas vaktit para gjumit: ato që shtyhen përtej tij mblidhen para tij.
  meals = meals.map((entry) => ({ ...entry, minutes: Math.min(entry.minutes, bedtime - 30) }))
  return [...meals, ...extra, { meal: 'bedtime' as MealKey, minutes: bedtime }]
    .sort((a, b) => a.minutes - b.minutes)
    .map((entry) => ({ meal: entry.meal, time: toTime(entry.minutes) }))
}
