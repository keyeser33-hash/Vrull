import { decideWeeklyCheck, readWeeklyCheck } from './weekly-check'
import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { EMPTY_TARGETS_PROFILE, saveTargetsProfile } from './targets-profile'

// Kontrolli javor (V33, V2-E2-04) në bazë: objektivat personale nga e hëna 2 nëntor (java 1), java
// e rishikuar 9–15 nëntor (java 2), 6 ditë me 2 800 kcal dhe pesha 88 kg pa lëvizur.
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time = '09:00') => new Date(`${date}T${time}:00`)
const REVIEWED = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

async function setup({ personal = true, logged = REVIEWED } = {}) {
  const store = createLocalStore(createDatabase(`weekly-check-${crypto.randomUUID()}`), { userId: () => USER, now: () => at('2026-11-16') })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => at('2026-11-02', '08:00'))
  if (personal) await saveTargetsProfile(store, { ...EMPTY_TARGETS_PROFILE, sex: 'male', heightCm: 185, activity: 'sedentary', goal: 'gain' }, '2026-11-02')
  for (const date of logged) await store.put('diary_entries', { date, meal: 'lunch', kcal: 2800, protein_g: 170, carbs_g: 350, fat_g: 80, logged_at: at(date, '13:00').toISOString() })
  await store.put('body_measurements', { date: '2026-11-15', weight_kg: 88 })
  return store
}

describe('kontrolli javor', () => {
  it('e hëna e javës 3: propozon +90 kcal dhe tregon objektivat e reja', async () => {
    const store = await setup()
    const view = await readWeeklyCheck(store, '2026-11-16')
    expect(view).toMatchObject({ weekStart: '2026-11-09', week: 2, goal: 'gain', decided: null, training: 3020, rest: 2720 })
    expect(view?.result).toMatchObject({ kind: 'proposal', kcal: 90, loggedDays: 6, averageKcal: 2800, changeKg: 0, plannedChangeKg: 0.22 })
  })

  it('"Po" ndryshon objektivat nga sot, edhe ato të ruajtura; ditët e kaluara mbeten', async () => {
    const store = await setup()
    await store.put('nutrition_targets', { date: '2026-11-16', day_type: 'training', kcal: 2930, protein_g: 176, carbs_g: 379, fat_g: 79, bodyweight_kg: 88, is_manual: false })
    const view = (await readWeeklyCheck(store, '2026-11-16'))!
    await decideWeeklyCheck(store, view, 'accepted', '2026-11-16')

    const today = await nutritionDay(store, '2026-11-16', at('2026-11-16'))
    expect(today.targets).toMatchObject({ kcal: 3020, carbsG: 402, proteinG: 176, fatG: 79 })
    expect((await nutritionDay(store, '2026-11-17', at('2026-11-16'))).targets?.kcal).toBe(3020)
    expect((await nutritionDay(store, '2026-11-18', at('2026-11-16'))).targets?.kcal).toBe(2720)
    expect((await nutritionDay(store, '2026-11-13', at('2026-11-16'))).targets?.kcal).toBe(2930)
    expect(await readWeeklyCheck(store, '2026-11-16')).toMatchObject({ decided: { status: 'accepted', kcal: 90 } })
    expect(await store.all('weekly_checks')).toMatchObject([{ week_start: '2026-11-09', status: 'accepted', kcal: 90, applies_from: '2026-11-16', logged_days: 6, average_kcal: 2800 }])
  })

  it('"Jo tani" e lë deri të hënën tjetër dhe objektivat mbeten', async () => {
    const store = await setup()
    await decideWeeklyCheck(store, (await readWeeklyCheck(store, '2026-11-16'))!, 'dismissed', '2026-11-16')
    expect(await readWeeklyCheck(store, '2026-11-18')).toMatchObject({ decided: { status: 'dismissed' } })
    expect((await nutritionDay(store, '2026-11-17', at('2026-11-17'))).targets?.kcal).toBe(2930)
    // Java tjetër ka vendimin e vet.
    expect(await readWeeklyCheck(store, '2026-11-23')).toMatchObject({ weekStart: '2026-11-16', decided: null })
  })

  it('me më pak se 4 ditë ushqim: pa propozim', async () => {
    const store = await setup({ logged: REVIEWED.slice(0, 3) })
    expect((await readWeeklyCheck(store, '2026-11-16'))?.result).toEqual({ kind: 'insufficient', loggedDays: 3, weighIns: 1 })
  })

  it('java e parë dhe objektivat e Jimit: pa kontroll', async () => {
    expect(await readWeeklyCheck(await setup(), '2026-11-09')).toBeNull()
    expect(await readWeeklyCheck(await setup({ personal: false }), '2026-11-16')).toBeNull()
  })
})
