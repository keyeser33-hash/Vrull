import { shiftDate } from '@/lib/calendar'
import { readDailyState, setReadinessChoice } from './daily-state'
import { setDayType } from './nutrition'
import type { LocalStore } from './store'
import { activeProgram, openSession } from './training'

// Zgjedhjet e kartës së sugjerimit (V50, V2-E3-06; SPEC §0.3d) mbi gjendjen e ditës: "Seanca më e lehtë", "Jo sot",
// "Kthe si zakonisht", "Shtyje për nesër" dhe "Ktheje për sot". Programi nuk ndryshon: treguesi mbetet te stërvitja
// e radhës, kështu që nesër kjo stërvitje është e radhës (Q3). Data është dita e ushqimit të check-in-it (V46).

type DayType = 'training' | 'rest'
/** Lloji i zgjedhur me dorë i një dite para shtyrjes; null kur ishte automatik. */
interface PreviousTypes {
  today: DayType | null
  tomorrow: DayType | null
}

const POSTPONE_KEY = (date: string) => `postponed-from:${date}`

/** "Seanca më e lehtë". */
export async function chooseLighter(store: LocalStore, date: string) {
  await setReadinessChoice(store, date, 'lighter')
}

/** "Jo sot" te karta, dhe "Kthe si zakonisht" te seanca: stërvitja mbetet siç është në program. */
export async function keepUsual(store: LocalStore, date: string) {
  await setReadinessChoice(store, date, 'normal')
}

async function manualType(store: LocalStore, date: string): Promise<DayType | null> {
  const [row] = await store.where('nutrition_targets', 'date', date)
  return row?.is_manual ? (row.day_type === 'training' ? 'training' : 'rest') : null
}

/** Kthen llojin automatik të një dite (heq zgjedhjen me dorë), ose të zgjedhurin më parë. */
async function restoreType(store: LocalStore, date: string, previous: DayType | null) {
  if (previous) return setDayType(store, date, previous)
  const [row] = await store.where('nutrition_targets', 'date', date)
  if (row?.is_manual) await store.put('nutrition_targets', { id: row.id, is_manual: false })
}

/** Sa sete ka seanca e hapur e stërvitjes së radhës (0 pa seancë). */
async function loggedSets(store: LocalStore): Promise<{ sessionId: string | null; sets: number }> {
  const loaded = await activeProgram(store)
  if (!loaded || loaded.pointer.completed) return { sessionId: null, sets: 0 }
  const open = await openSession(store, loaded.row.id, loaded.pointer)
  if (!open) return { sessionId: null, sets: 0 }
  return { sessionId: open.id, sets: (await store.where('set_logs', 'session_id', open.id)).length }
}

/**
 * "Shtyje për nesër": sot bëhet ditë pushimi dhe nesër ditë stërvitjeje (që objektivat e ushqimit dhe rikujtuesit
 * ta ndjekin, si zgjedhja me dorë e llojit të ditës), dhe vendimi ruhet. Vlen vetëm para setit të parë; një seancë e
 * hapur pa sete hiqet. Kthen false kur seanca ka sete.
 */
export async function postponeWorkout(store: LocalStore, date: string): Promise<boolean> {
  const open = await loggedSets(store)
  if (open.sets > 0) return false
  const tomorrow = shiftDate(date, 1)
  const previous: PreviousTypes = { today: await manualType(store, date), tomorrow: await manualType(store, tomorrow) }
  await store.writeDevice(POSTPONE_KEY(date), previous)
  await setDayType(store, date, 'rest')
  await setDayType(store, tomorrow, 'training')
  if (open.sessionId) await store.remove('workout_sessions', open.sessionId)
  await setReadinessChoice(store, date, 'tomorrow')
  return true
}

/**
 * "Ktheje për sot": llojet e ditëve kthehen siç ishin dhe vendimi bëhet null. Vlen deri në setin e parë; pas tij
 * (seancë e nisur me dorë) vendimi s'ndryshon. Kthen false kur nuk ka shtyrje ose seanca ka sete.
 */
export async function undoPostpone(store: LocalStore, date: string): Promise<boolean> {
  if ((await readDailyState(store, date))?.choice !== 'tomorrow') return false
  if ((await loggedSets(store)).sets > 0) return false
  const saved = (await store.readDevice(POSTPONE_KEY(date))) as Partial<PreviousTypes> | undefined
  await restoreType(store, date, saved?.today ?? null)
  await restoreType(store, shiftDate(date, 1), saved?.tomorrow ?? null)
  await setReadinessChoice(store, date, null)
  return true
}
