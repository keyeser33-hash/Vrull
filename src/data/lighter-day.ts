import { foodDate } from '@/nutrition/food-day'
import { dailyChoices, readDailyChoice } from './daily-state'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'

// "Seanca më e lehtë" (V50, V2-E3-06): a është zgjedhur për një stërvitje. Vendimi ruhet te `daily_choices` me
// datën e ditës së ushqimit (V46) dhe me çelësin e stërvitjes ku vlen. Një datë vendimi për të gjithë lexuesit
// (`decisionDate`): dita e ushqimit e `started_at` të seancës së hapur, ose dita e ushqimit e tanishme pa seancë;
// kështu një seancë e nisur në 00:30 lexon të njëjtin vendim që u zgjodh para saj. Pas mbylljes treguesi kalon te
// stërvitja tjetër, çelësi nuk përputhet më, dhe ajo nuk lehtësohet. Skedar pa varësi nga training.ts, që
// `trainingSnapshot` dhe `workoutWeights` ta lexojnë pa cikël.

const DEFAULT_WAKE = '07:00'

/** Çelësi i një stërvitjeje në program: "blloku|java|dita". */
export function workoutKey(workout: { blockId: string | null; week: number; dayId: string | null }): string {
  return `${workout.blockId ?? ''}|${workout.week}|${workout.dayId ?? ''}`
}

async function wakeTime(store: LocalStore): Promise<string> {
  const wake = (await settingsRow(store))?.wake_time
  return typeof wake === 'string' ? wake.slice(0, 5) : DEFAULT_WAKE
}

/** Dita e ushqimit e një çasti (si `currentFoodDate` te nutrition.ts, pa varësinë nga profili). */
async function foodDayOf(store: LocalStore, moment: Date): Promise<string> {
  return foodDate(moment, await wakeTime(store))
}

/**
 * Data e vendimit: dita e ushqimit kur nisi seanca (`startedAt`, ISO) ose, pa seancë, dita e ushqimit e tanishme.
 * Një seancë pa kohë nisjeje bie te data e saj kalendarike.
 */
export async function decisionDate(store: LocalStore, session?: { startedAt?: string | null; date?: string | null } | null): Promise<string> {
  if (session?.startedAt) {
    const started = new Date(session.startedAt)
    if (!Number.isNaN(started.getTime())) return foodDayOf(store, started)
  }
  if (session?.date) return String(session.date).slice(0, 10)
  return foodDayOf(store, store.now())
}

/** Seanca më e lehtë është zgjedhur për këtë stërvitje, në datën e vendimit. */
export async function lighterDay(store: LocalStore, workout: string, session?: { startedAt?: string | null; date?: string | null } | null): Promise<boolean> {
  const choice = await readDailyChoice(store, await decisionDate(store, session))
  return choice?.choice === 'lighter' && choice.workout === workout
}

/** Seancat (id) që u ndërmorën si më të lehta: vendimi i ditës së ushqimit të nisjes, për stërvitjen e tyre. */
export async function lighterSessions(store: LocalStore): Promise<Set<string>> {
  const lighter = new Map((await dailyChoices(store)).filter((choice) => choice.choice === 'lighter').map((choice) => [choice.date, choice.workout]))
  if (lighter.size === 0) return new Set()
  const wake = await wakeTime(store)
  const ids = new Set<string>()
  for (const row of await store.all('workout_sessions')) {
    const started = row.started_at ? new Date(String(row.started_at)) : null
    const date = started && !Number.isNaN(started.getTime()) ? foodDate(started, wake) : String(row.date).slice(0, 10)
    if (lighter.get(date) === workoutKey({ blockId: (row.block_id as string | null) ?? null, week: Number(row.week), dayId: (row.day_id as string | null) ?? null })) ids.add(row.id)
  }
  return ids
}
