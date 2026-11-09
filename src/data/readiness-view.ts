import { MUSCLE_GROUPS } from '@/program/muscles'
import { type DayMode, dayMode, type Readiness } from '@/readiness/readiness'
import { type CheckInAnswers, type CheckInContext, checkInSkipped, type DailyState, followDayState, readDailyState, readinessOfState } from './daily-state'
import { currentFoodDate } from './nutrition'
import type { LocalStore } from './store'
import { isTrainingMode, type TodayView } from './today'

// Gatishmëria e sotme (V50, SPEC §0.3d) në një vend, për Sot, seancën dhe pamjen e ditës. Llogaritet vetëm nga
// rreshti i ditës së ushqimit (V46): rikuperimi i grupit kryesor dhe nëse një grup me dhimbje stërvitej u ruajtën
// në çastin e check-in-it (`checkInContext`), ndaj përqindja mbetet e njëjtë pas shtyrjes ose mbylljes së stërvitjes
// dhe korniza (`dayModeNow`) nuk lexon gjithë pamjen e Sot.

export interface ReadinessView {
  /** Dita e ushqimit (V46): dita e check-in-it. */
  date: string
  state: DailyState | null
  /** Null pa check-in: pa përqindje dhe pa sugjerim. */
  readiness: Readiness | null
  /** "Jo sot" te karta "Si ndihesh sot?". */
  skipped: boolean
  /** "Pamja ndjek gjendjen" (Cilësimet › Pamja). */
  follow: boolean
  mode: DayMode
}

/** Grupet e muskujve (`MUSCLE_GROUPS[].id`) që kanë të paktën një çelës kryesor te stërvitja. */
export function trainedGroups(primaryKeys: readonly string[]): string[] {
  const keys = new Set(primaryKeys)
  return MUSCLE_GROUPS.filter((group) => group.keys.some((key) => keys.has(key))).map((group) => group.id)
}

/**
 * Çfarë ruhet me check-in-in nga pamja e Sot: rikuperimi i grupit kryesor dhe nëse një grup me dhimbje stërvitet sot,
 * vetëm kur sot ka stërvitje (ose seancë të hapur); përndryshe rikuperimi mungon dhe pesha e tij ndahet te pjesët e tjera.
 */
export function checkInContext(view: Pick<TodayView, 'mode' | 'workout'>, answers: Pick<CheckInAnswers, 'soreness'> & { soreGroups: readonly string[] }): CheckInContext {
  const workout = isTrainingMode(view) ? view.workout : null
  if (!workout) return { recovery: null, soreTrained: false }
  const today = trainedGroups(workout.primary)
  return { recovery: workout.recovery, soreTrained: answers.soreness > 0 && answers.soreGroups.some((group) => today.includes(group)) }
}

/** Gatishmëria, pamja e ditës dhe çelësat e një dite ushqimi (parazgjedhja: sot), pa lexuar `todayView`. */
export async function readinessView(store: LocalStore, date?: string): Promise<ReadinessView> {
  const day = date ?? (await currentFoodDate(store, store.now()))
  const [state, skipped, follow] = await Promise.all([readDailyState(store, day), checkInSkipped(store, day), followDayState(store)])
  const value = state ? readinessOfState(state) : null
  return { date: day, state, readiness: value, skipped, follow, mode: dayMode(value, follow) }
}
