import type { LocalStore } from '@/data/store'

// Mostra e javës për provat e ekraneve të 0.23 (Sot, Qëllimet e javës, përmbledhja, karta): si bordi
// "Sot" i v2, hapat e parë të dielën 25 tetor, ditët e stërvitjes e diel, e hënë, e martë, e enjte në
// 17:15. Java 0: 25–29 tetor; Java 1 e Fazës 1: 1–5 nëntor (Bench Press 60 × 13 → rekord). Java e
// kalendarit 26 tetor – 1 nëntor: 4 nga 4; java 2–8 nëntor: 3 nga 4 deri të dielën.

export const USER = '11111111-1111-4111-8111-111111111111'
export const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
export const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

export interface WeekContext {
  store: LocalStore
  setClock(date: Date): void
}

/** Një stërvitje 17:15–18:21 me setet e ushtrimit të parë. */
export async function train(context: WeekContext, date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) {
  const { finishWorkout, saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
  context.setClock(date)
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(context.store, { sessionId, slot: first, setNumber: index + 1, ...set })
  context.setClock(new Date(date.getTime() + 66 * 60_000))
  await finishWorkout(context.store, sessionId)
}

/** Hapat e parë dhe dy javët e stërvitjes; ora mbetet e diela 8 nëntor, 10:00. */
export async function trainedWeeks(context: WeekContext) {
  const { completeOnboarding } = await import('@/data/profile')
  context.setClock(at(25, 10, 9))
  await completeOnboarding(context.store, PROFILE, () => at(25, 10, 9))
  for (const day of [25, 26, 27, 29]) await train(context, at(day, 10, 17, 15), [{ weightKg: 50, reps: 14, rir: 2 }])
  await train(context, at(1, 11, 17, 15), [
    { weightKg: 60, reps: 13 },
    { weightKg: 60, reps: 12 },
    { weightKg: 60, reps: 11 },
    { weightKg: 60, reps: 10 },
  ])
  for (const day of [2, 3, 5]) await train(context, at(day, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
  await context.store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_1', food_id: null, grams: 100, kcal: 400, protein_g: 38, carbs_g: 30, fat_g: 10, logged_at: at(8, 11, 8).toISOString() })
  context.setClock(at(8, 11))
}
