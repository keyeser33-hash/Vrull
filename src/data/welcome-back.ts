import { localDate } from '@/lib/calendar'
import { welcomeBackDays } from '@/progress/weekly-goals'
import type { LocalStore } from './store'

// "Mirë se u ktheve" (V43, SPEC §0.3c): kur seanca e fundit e mbyllur është 7 ditë ose më shumë para
// sot. Çelësi "Seanca e parë më e lehtë" (i ndezur kur s'është prekur) ruhet vetëm në telefon për atë
// datë (`writeDevice`, pa sinkronizim); peshat 90% i vendos vetëm `workoutWeights` (week-weights.ts),
// që Sot, seanca, Programi dhe njoftimi i seancës të thonë të njëjtën gjë.

const LIGHTER_KEY = 'lighter-first-session'

export interface WelcomeBack {
  /** Ditët pa stërvitje: nga data e seancës së fundit të mbyllur deri sot ("10 ditë pa stërvitje"). */
  days: number
  lastSessionOn: string
  /** "Seanca e parë më e lehtë": çelësi i sotëm. */
  lighter: boolean
}

/** Data e seancës së fundit të mbyllur deri sot; null pa asnjë. */
async function lastCompletedOn(store: LocalStore, today: string): Promise<string | null> {
  const dates = (await store.all('workout_sessions'))
    .filter((row) => row.status === 'completed')
    .map((row) => String(row.date).slice(0, 10))
    .filter((date) => date <= today)
    .sort()
  return dates.at(-1) ?? null
}

async function lighterOn(store: LocalStore, date: string): Promise<boolean> {
  const saved = (await store.readDevice(LIGHTER_KEY)) as { date?: unknown; on?: unknown } | undefined
  return saved?.date === date && typeof saved.on === 'boolean' ? saved.on : true
}

/**
 * "Mirë se u ktheve" sot, ose null: pa seancë të mbyllur (përdoruesi i ri) ose me një brenda 6 ditëve.
 * Mbetet edhe gjatë seancës së parë pas pushimit (ajo s'është mbyllur ende), që peshat të mos ndryshojnë
 * në mes të saj; ikën kur ajo mbyllet. Sot e tregon vetëm me një program me stërvitje (`todayView`).
 */
export async function welcomeBack(store: LocalStore): Promise<WelcomeBack | null> {
  const today = localDate(store.now())
  const last = await lastCompletedOn(store, today)
  const days = welcomeBackDays(last, today)
  if (days === null || last === null) return null
  return { days, lastSessionOn: last, lighter: await lighterOn(store, today) }
}

/** Peshat e seancës së parë pas pushimit janë 90% e peshës së javës: "Mirë se u ktheve" me çelësin të ndezur. */
export async function lighterFirstSession(store: LocalStore): Promise<boolean> {
  return (await welcomeBack(store))?.lighter ?? false
}

/** Çelësi "Seanca e parë më e lehtë" për sot; të nesërmen vlen përsëri i ndezur. */
export async function setLighterFirstSession(store: LocalStore, on: boolean) {
  await store.writeDevice(LIGHTER_KEY, { date: localDate(store.now()), on })
}
