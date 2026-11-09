import { MUSCLE_GROUPS } from '@/program/muscles'
import { type DayMode, dayMode, type Readiness, readiness } from '@/readiness/readiness'
import { checkInSkipped, type DailyState, followDayState, readDailyState } from './daily-state'
import type { LocalStore } from './store'
import { type TodayView, todayView } from './today'

// Gatishmëria e sotme (V50, SPEC §0.3d) në një vend, për Sot, seancën dhe pamjen e ditës: gjendja e ditës së
// ushqimit (V46), rikuperimi i grupit kryesor dhe grupet që stërviten sot vetëm kur sot ka stërvitje (ose seancë të
// hapur); përndryshe rikuperimi mungon dhe pesha e tij ndahet te pjesët e tjera (`readiness`).

export interface ReadinessView {
  /** Dita e ushqimit (`TodayView.date`): dita e check-in-it. */
  date: string
  state: DailyState | null
  /** Null pa check-in: pa përqindje dhe pa sugjerim. */
  readiness: Readiness | null
  /** Sot ka stërvitje që nuk ka nisur ende ose seancë të hapur. */
  training: boolean
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

/** Gatishmëria nga pamja e Sot dhe gjendja e ditës; null pa gjendje. */
export function readinessFor(view: Pick<TodayView, 'mode' | 'workout'>, state: DailyState | null): Readiness | null {
  if (!state) return null
  const training = (view.mode === 'train' || view.mode === 'session') && !!view.workout
  return readiness({
    checkIn: state,
    recovery: training ? (view.workout?.recovery ?? null) : null,
    trainedGroups: training ? trainedGroups(view.workout?.primary ?? []) : [],
  })
}

export async function readinessView(store: LocalStore, view?: TodayView): Promise<ReadinessView> {
  const today = view ?? (await todayView(store))
  const [state, skipped, follow] = await Promise.all([readDailyState(store, today.date), checkInSkipped(store, today.date), followDayState(store)])
  const value = readinessFor(today, state)
  return {
    date: today.date,
    state,
    readiness: value,
    training: (today.mode === 'train' || today.mode === 'session') && !!today.workout,
    skipped,
    follow,
    mode: dayMode(value, follow),
  }
}
