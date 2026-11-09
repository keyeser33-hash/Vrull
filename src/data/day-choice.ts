import { shiftDate } from '@/lib/calendar'
import { type DailyChoice, type DayType, readDailyChoice, setReadinessChoice } from './daily-state'
import { decisionDate, workoutKey } from './lighter-day'
import { setDayType } from './nutrition'
import type { LocalStore } from './store'
import { activeProgram, openSession } from './training'

// Zgjedhjet e kartës së sugjerimit (V50, V2-E3-06; SPEC §0.3d) mbi gjendjen e ditës: "Seanca më e lehtë", "Jo sot",
// "Kthe si zakonisht", "Shtyje për nesër" dhe "Ktheje për sot". Programi nuk ndryshon: treguesi mbetet te stërvitja
// e radhës, kështu që nesër kjo stërvitje është e radhës (Q3). Data është dita e ushqimit e vendimit (V46). Vendimi
// mban stërvitjen ku vlen dhe llojet e ditëve para shtyrjes (`daily_choices`), kështu që çdo telefon e kthen shtyrjen.

/** Çelësi i stërvitjes së radhës; null pa program aktiv. */
async function currentWorkout(store: LocalStore): Promise<string | null> {
  const loaded = await activeProgram(store)
  return loaded && !loaded.pointer.completed ? workoutKey(loaded.pointer) : null
}

/** "Seanca më e lehtë": vlen vetëm për stërvitjen e radhës së këtij çasti. */
export async function chooseLighter(store: LocalStore, date: string) {
  await setReadinessChoice(store, date, 'lighter', { workout: await currentWorkout(store) })
}

/** "Jo sot" te karta, dhe "Kthe si zakonisht" te seanca: stërvitja mbetet siç është në program. */
export async function keepUsual(store: LocalStore, date: string) {
  await setReadinessChoice(store, date, 'normal', { workout: await currentWorkout(store) })
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
  const previous = { prevToday: await manualType(store, date), prevTomorrow: await manualType(store, tomorrow) }
  await setReadinessChoice(store, date, 'tomorrow', { workout: await currentWorkout(store), ...previous })
  await setDayType(store, date, 'rest')
  await setDayType(store, tomorrow, 'training')
  if (open.sessionId) await store.remove('workout_sessions', open.sessionId)
  return true
}

/** Llojet e dy ditëve kthehen siç ishin para shtyrjes, dhe vendimi hiqet. */
async function revertPostponement(store: LocalStore, choice: DailyChoice) {
  await restoreType(store, choice.date, choice.prevToday)
  await restoreType(store, shiftDate(choice.date, 1), choice.prevTomorrow)
  await setReadinessChoice(store, choice.date, null)
}

/**
 * "Ktheje për sot": llojet e ditëve kthehen siç ishin dhe vendimi hiqet. Vlen deri në setin e parë; pas tij
 * (seancë e nisur me dorë) vendimi s'ndryshon. Kthen false kur nuk ka shtyrje ose seanca ka sete.
 */
export async function undoPostpone(store: LocalStore, date: string): Promise<boolean> {
  const choice = await readDailyChoice(store, date)
  if (choice?.choice !== 'tomorrow') return false
  if ((await loggedSets(store)).sets > 0) return false
  await revertPostponement(store, choice)
  return true
}

/**
 * Nisja e stërvitjes (`startWorkout`) në ditën e shtyrë e anulon shtyrjen: stërvitja bëhet sot, nesër kthehet siç
 * ishte dhe nuk mbetet një stërvitje e dytë atje.
 */
export async function cancelPostponement(store: LocalStore): Promise<void> {
  const choice = await readDailyChoice(store, await decisionDate(store))
  if (choice?.choice === 'tomorrow') await revertPostponement(store, choice)
}
