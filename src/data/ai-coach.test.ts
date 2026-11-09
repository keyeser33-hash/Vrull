import { coachFacts } from './ai-coach'
import { createDatabase } from './db'
import { logFood } from './nutrition'
import { completeOnboarding } from './profile'
import { createCustomFood } from './foods'
import { createLocalStore } from './store'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'
import { i18nFor } from '@/i18n'

// Faktet e trajnerit (V41, V2-E2-15): ushqimi i sotëm kundrejt objektivave, plani që mbetet, stërvitjet.
const USER = '11111111-1111-4111-8111-111111111111'

describe('faktet e trajnerit', () => {
  it('ushqimi me objektivat dhe sa mbetet, vaktet e radhës, stërvitja e radhës dhe e fundit', async () => {
    let now = new Date('2026-11-16T21:00:00')
    const store = createLocalStore(createDatabase(`coach-${crypto.randomUUID()}`), { userId: () => USER, now: () => now })
    await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => now)
    const sessionId = await startWorkout(store)
    await saveSet(store, { sessionId, slot: (await trainingSnapshot(store))!.plan.slots[0], setNumber: 1, weightKg: 60, reps: 10 })
    await finishWorkout(store, sessionId)
    now = new Date('2026-11-18T22:40:00')
    const chicken = await createCustomFood(store, { name: 'Pulë', kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 })
    await logFood(store, { date: '2026-11-18', meal: 'dinner', foodId: chicken, grams: 300 })

    const facts = await coachFacts(store, now, i18nFor('sq'))
    expect(facts).toMatch(/^Food day 2026-11-18 \(rest day\)\. Eaten: 717 kcal, protein 82 g/)
    // Pa objektiva personale: ato të Jimit për peshën (Shtojca C); mbetja = objektivi − e ngrëna.
    expect(facts).toContain('Targets: 3341 kcal, protein 286 g, carbs 280 g, fat 119 g. Left: 2624 kcal, protein 204 g.')
    expect(facts).toMatch(/Plan, Para gjumit 00:30: /)
    expect(facts).toMatch(/Next workout \(2026-11-19 21:00\): Stërvitja 2 · /)
    expect(facts).toMatch(/Water: 0 of 3 L\./)
    expect(facts).toMatch(/Done 2026-11-16: Stërvitja 1\. Bench Press 60 kg × 10\./)
  })
})
