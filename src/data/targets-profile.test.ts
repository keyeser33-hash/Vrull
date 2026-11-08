import { createDatabase } from './db'
import { logTemplateMeal, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { EMPTY_TARGETS_PROFILE, readTargetsProfile, saveTargetsProfile, type TargetsInput } from './targets-profile'

// Objektivat personale (V32, V2-E2-03): profili te `user_settings`, objektivat nga kalkulatori nga
// data e ruajtjes, objektivat e ruajtura të ditëve të kaluara mbeten.
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)
const owner: TargetsInput = {
  ...EMPTY_TARGETS_PROFILE,
  sex: 'male',
  heightCm: 185,
  activity: 'sedentary',
  goal: 'gain',
}

async function setup() {
  const store = createLocalStore(createDatabase(`targets-${crypto.randomUUID()}`), { userId: () => USER, now: () => at('2026-12-07', '06:00') })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () =>
    at('2026-12-01', '08:00'),
  )
  return store
}

describe('profili i objektivave', () => {
  it('pa profil: objektivat e Jimit si më parë', async () => {
    const store = await setup()
    expect(await readTargetsProfile(store)).toEqual(EMPTY_TARGETS_PROFILE)
    const day = await nutritionDay(store, '2026-12-09', at('2026-12-09', '09:00'))
    expect(day.targetsSource).toBe('jim')
    expect(day.targets?.kcal).toBe(Math.round(3100 * (88 / 81.65)))
  })

  it('ruhet dhe lexohet', async () => {
    const store = await setup()
    await saveTargetsProfile(store, { ...owner, birthYear: 1996, ratePct: 0.3, proteinGPerKg: 2.2, fatGPerKg: 0.8, bodyFatPct: 18, maintenanceKcal: null }, '2026-12-07')
    expect(await readTargetsProfile(store)).toEqual({
      ...owner,
      birthYear: 1996,
      ratePct: 0.3,
      proteinGPerKg: 2.2,
      fatGPerKg: 0.8,
      bodyFatPct: 18,
      maintenanceKcal: null,
      from: '2026-12-07',
    })
  })

  it('nga dita e ruajtjes: objektivat e kalkulatorit sipas llojit të ditës', async () => {
    const store = await setup()
    await saveTargetsProfile(store, owner, '2026-12-07')
    const rest = await nutritionDay(store, '2026-12-09', at('2026-12-09', '09:00'))
    expect(rest).toMatchObject({ dayType: 'rest', targetsSource: 'personal', targets: { kcal: 2630, proteinG: 176, carbsG: 304, fatG: 79 } })
    const training = await nutritionDay(store, '2026-12-07', at('2026-12-07', '09:00'))
    expect(training).toMatchObject({ dayType: 'training', targets: { kcal: 2930, proteinG: 176, carbsG: 379, fatG: 79 } })
    // Para datës së ruajtjes, një ditë pa objektiva të ruajtura mbetet me ato të Jimit.
    expect((await nutritionDay(store, '2026-12-03', at('2026-12-07', '09:00'))).targetsSource).toBe('jim')
  })

  it('objektivat e ruajtura të ditëve të kaluara nuk ndryshojnë; ato të sotme po', async () => {
    const store = await setup()
    await logTemplateMeal(store, '2026-12-06', 'breakfast_1')
    await logTemplateMeal(store, '2026-12-07', 'breakfast_1')
    const yesterday = (await nutritionDay(store, '2026-12-06', at('2026-12-07', '09:00'))).targets
    await saveTargetsProfile(store, owner, '2026-12-07')
    expect((await nutritionDay(store, '2026-12-06', at('2026-12-07', '09:00'))).targets).toEqual(yesterday)
    expect((await nutritionDay(store, '2026-12-07', at('2026-12-07', '09:00'))).targets?.kcal).toBe(2930)
  })

  it('ruajtja e dytë nuk e zhvendos datën e fillimit', async () => {
    const store = await setup()
    await saveTargetsProfile(store, owner, '2026-12-07')
    await saveTargetsProfile(store, { ...owner, activity: 'light' }, '2026-12-20')
    expect((await readTargetsProfile(store)).from).toBe('2026-12-07')
    expect((await nutritionDay(store, '2026-12-09', at('2026-12-20', '09:00'))).targets?.kcal).toBe(2820)
  })

  it('një profil pa fushat kryesore nuk zëvendëson objektivat e Jimit', async () => {
    const store = await setup()
    await saveTargetsProfile(store, { ...owner, activity: null }, '2026-12-07')
    expect((await nutritionDay(store, '2026-12-09', at('2026-12-09', '09:00'))).targetsSource).toBe('jim')
  })
})
