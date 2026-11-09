import type { LocalStore } from '@/data/store'

// Mostra e ekraneve të programit për provat (V2-E1-09), si te bordet: e diel 8 nëntor 2026, Shortcut to
// Size te Faza 1 · Java 2 · Stërvitja 1, ditët e stërvitjes e diel, e hënë, e martë, e enjte. Bench
// Press: Java 0 50 × 14 me RIR 2 (e1RM 76,7), Java 1 60 × 13 (e1RM 86,0).

export const SAMPLE_PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }
export const TODAY = new Date(2026, 10, 8, 9, 0)

/** Ora e store-it të provës: `clock.date` ndryshon gjatë mostrës. */
export interface TestClock {
  date: Date
}

export async function sampleWeek(store: LocalStore, clock: TestClock) {
  const { completeOnboarding } = await import('@/data/profile')
  const { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } = await import('@/data/training')
  clock.date = new Date(2026, 9, 25, 17, 30)
  await completeOnboarding(store, SAMPLE_PROFILE, () => clock.date)
  const benchDay = async (weightKg: number, reps: number, rir: number | null) => {
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg, reps, rir })
    await finishWorkout(store, sessionId)
    for (let day = 0; day < 3; day++) await skipWorkout(store)
  }
  await benchDay(50, 14, 2)
  clock.date = new Date(2026, 10, 1, 17, 30)
  await benchDay(60, 13, null)
  clock.date = TODAY
  // Seanca e fundit e mbyllur është 1 nëntor, 7 ditë para mostrës: "Mirë se u ktheve" (V43) do ta ulte
  // stërvitjen e radhës në 90%. Bordet e Programit tregojnë peshat e javës, ndaj çelësi i sotëm fiket.
  const { setLighterFirstSession } = await import('@/data/welcome-back')
  await setLighterFirstSession(store, false)
}
