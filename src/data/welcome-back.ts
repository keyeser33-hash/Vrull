import { localDate } from '@/lib/calendar'
import { welcomeBackDays } from '@/progress/weekly-goals'
import type { LocalStore } from './store'
import { activeProgram, openSession } from './training'

// "Mirë se u ktheve" (V43, SPEC §0.3c): kur seanca e fundit e mbyllur është 7 ditë ose më shumë para
// sot. Çelësi "Seanca e parë më e lehtë" (i ndezur kur s'është prekur) ruhet vetëm në telefon për atë
// datë (`writeDevice`, pa sinkronizim); peshat 90% i vendos vetëm `workoutWeights` (week-weights.ts),
// që Sot, seanca, Programi dhe njoftimi i seancës të thonë të njëjtën gjë. Me një seancë të hapur "sot"
// është data e saj (`referenceDate`): ditët dhe çelësi nuk ndryshojnë kur kalon mesnata në mes të saj.

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

/**
 * Data nga e cila matet "Mirë se u ktheve": e seancës së hapur, që peshat e saj të mos ndryshojnë pas
 * mesnatës (rishikimi i 0.23); pa seancë, sot.
 */
async function referenceDate(store: LocalStore): Promise<string> {
  const loaded = await activeProgram(store)
  const open = loaded && !loaded.pointer.completed ? await openSession(store, loaded.row.id, loaded.pointer) : undefined
  return open?.date ? String(open.date).slice(0, 10) : localDate(store.now())
}

async function lighterOn(store: LocalStore, date: string): Promise<boolean> {
  const saved = (await store.readDevice(LIGHTER_KEY)) as { date?: unknown; on?: unknown } | undefined
  return saved?.date === date && typeof saved.on === 'boolean' ? saved.on : true
}

/**
 * "Mirë se u ktheve" sot, ose null: pa seancë të mbyllur (përdoruesi i ri) ose me një brenda 6 ditëve.
 * Mbetet edhe gjatë seancës së parë pas pushimit (ajo s'është mbyllur ende), që peshat të mos ndryshojnë
 * në mes të saj; ikën kur ajo mbyllet. Sot e tregon vetëm me një program me stërvitje (`todayView`).
 * `date`: dita e matjes kur thirrësi e di (data e seancës së hapur, ose sot); pa të, `referenceDate`.
 */
export async function welcomeBack(store: LocalStore, date?: string): Promise<WelcomeBack | null> {
  const today = date ?? (await referenceDate(store))
  const last = await lastCompletedOn(store, today)
  const days = welcomeBackDays(last, today)
  if (days === null || last === null) return null
  return { days, lastSessionOn: last, lighter: await lighterOn(store, today) }
}

/** Peshat e seancës së parë pas pushimit janë 90% e peshës së javës: "Mirë se u ktheve" me çelësin të ndezur. */
export async function lighterFirstSession(store: LocalStore, date?: string): Promise<boolean> {
  return (await welcomeBack(store, date))?.lighter ?? false
}

/** Çelësi "Seanca e parë më e lehtë" për sot (ose për datën e seancës së hapur); të nesërmen vlen përsëri i ndezur. */
export async function setLighterFirstSession(store: LocalStore, on: boolean) {
  await store.writeDevice(LIGHTER_KEY, { date: await referenceDate(store), on })
}
