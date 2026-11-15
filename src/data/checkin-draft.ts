import { type CheckInContext, saveDailyState, type DailyState } from './daily-state'
import type { LocalStore } from './store'
import { completeAnswers, type Draft } from '@/today/checkin-flow'

// Përgjigjet e gjendjes së ditës që s'janë plotësuar ende (V57, SPEC §0.3f): çdo përgjigje ruhet sapo jepet, vetëm në
// këtë telefon, për ditën e ushqimit. Kur janë të katërta shkruhet rreshti i `daily_states` me `saveDailyState`, që
// është e njëjta funksion me fletën e vjetër, dhe skica fshihet.

const KEY = 'checkin-draft'

interface Stored {
  date: string
  answers: Draft
}

const scale = (value: unknown): value is 1 | 2 | 3 | 4 | 5 => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5

export async function readCheckInDraft(store: LocalStore, date: string): Promise<Draft> {
  const value = (await store.readDevice(KEY)) as Partial<Stored> | undefined
  if (!value || value.date !== date || typeof value.answers !== 'object' || value.answers === null) return {}
  const a = value.answers as Record<string, unknown>
  const draft: Draft = {}
  if (scale(a.mood)) draft.mood = a.mood
  if (scale(a.energy)) draft.energy = a.energy
  if (typeof a.sleepMinutes === 'number' && Number.isFinite(a.sleepMinutes)) draft.sleepMinutes = a.sleepMinutes
  if (scale(a.sleepQuality)) draft.sleepQuality = a.sleepQuality
  if (Number.isInteger(a.soreness) && (a.soreness as number) >= 0 && (a.soreness as number) <= 4) draft.soreness = a.soreness as 0 | 1 | 2 | 3 | 4
  if (Array.isArray(a.soreGroups)) draft.soreGroups = a.soreGroups.filter((group): group is string => typeof group === 'string')
  return draft
}

/**
 * Ruan përgjigjet e dhëna deri tani. Kur janë të katërta shkruan rreshtin e ditës (me rikuperimin e çastit) dhe kthen
 * gjendjen; përndryshe mban skicën në telefon dhe kthen null.
 */
export async function saveCheckInAnswers(store: LocalStore, date: string, draft: Draft, context: (answers: NonNullable<ReturnType<typeof completeAnswers>>) => CheckInContext): Promise<DailyState | null> {
  const done = completeAnswers(draft)
  if (!done) {
    await store.writeDevice(KEY, { date, answers: draft } satisfies Stored)
    return null
  }
  const state = await saveDailyState(store, date, done, context(done))
  await store.writeDevice(KEY, { date, answers: {} } satisfies Stored)
  return state
}
