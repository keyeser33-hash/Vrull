import type { DayType } from '@/nutrition/targets'

// Dita e humbur (V38, SPEC §13): një ditë stërvitjeje e kaluar pa seancë (as e bërë, as e kapërcyer
// me dorë). Të nesërmen, kur ajo nuk është ditë stërvitjeje dhe përdoruesi nuk ka zgjedhur ende,
// Sot pyet nëse e bën stërvitjen sot. Treguesi i programit nuk lëviz pa seancë. Pa UI dhe pa bazë.

export interface MissedInput {
  /** Ditët ISO të stërvitjes (1 = e hënë ... 7 = e diel). */
  trainingDays: readonly number[]
  /** Dita e parë që numërohet (hapat e para); null = asnjë ditë e humbur. */
  startedOn: string | null
  /** Datat me një seancë (e bërë, e kapërcyer ose e hapur). */
  sessionDates: readonly string[]
  /** Llojet e ditëve të zgjedhura me dorë, sipas datës ("Po" e bën sot stërvitje, "Jo" pushim). */
  dayTypes: Readonly<Record<string, DayType>>
}

const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay() || 7
const previous = (date: string) => {
  const day = new Date(`${date}T12:00:00`)
  day.setDate(day.getDate() - 1)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

export function isTrainingDay(input: MissedInput, date: string): boolean {
  return (input.dayTypes[date] ?? (input.trainingDays.includes(weekday(date)) ? 'training' : 'rest')) === 'training'
}

/** Një ditë stërvitjeje para sotme, nga fillimi, pa seancë. */
export function isMissed(input: MissedInput, date: string, today: string): boolean {
  if (input.startedOn === null || date < input.startedOn || date >= today) return false
  return isTrainingDay(input, date) && !input.sessionDates.includes(date)
}

/**
 * Pyetja e sotme: dje ishte ditë e humbur, sot nuk është ditë stërvitjeje dhe nuk është zgjedhur me
 * dorë. `streak`: sa ditë stërvitjeje rresht janë humbur deri dje (ditët e pushimit nuk e ndërpresin).
 */
export function missedYesterday(input: MissedInput, today: string): { date: string; streak: number } | null {
  const yesterday = previous(today)
  if (!isMissed(input, yesterday, today) || isTrainingDay(input, today) || input.dayTypes[today] !== undefined) return null
  let streak = 0
  for (let date = yesterday; input.startedOn !== null && date >= input.startedOn; date = previous(date)) {
    if (!isTrainingDay(input, date)) continue
    if (!isMissed(input, date, today)) break
    streak += 1
  }
  return { date: yesterday, streak }
}
