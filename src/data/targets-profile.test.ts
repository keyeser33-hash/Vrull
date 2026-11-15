import { createDatabase } from './db'
import { logTemplateMeal, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { EMPTY_TARGETS_PROFILE, readTargetsProfile, saveTargetsProfile, setTargetsChoice, type TargetsInput } from './targets-profile'
import { setReminderToggle } from './reminders'
import { readWeeklyCheck } from './weekly-check'

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

// "Plani i Jimit" ose "Të miat" (V62): zgjedhja ruhet te `user_settings.reminders` (jsonb, pa kolonë
// të re); të dhënat personale mbeten dhe rikthehen kur përdoruesi zgjedh "Të miat".
describe('zgjedhja e objektivave', () => {
  const day = (store: Awaited<ReturnType<typeof setup>>, date: string) => nutritionDay(store, date, at(date, '09:00'))

  it('pa zgjedhje asgjë nuk ndryshon: parazgjedhja e sotme (V32) mbetet', async () => {
    const store = await setup()
    expect((await readTargetsProfile(store)).choice).toBeNull()
    await saveTargetsProfile(store, owner, '2026-12-07')
    expect((await readTargetsProfile(store)).choice).toBeNull()
    expect((await day(store, '2026-12-09')).targetsSource).toBe('personal')
  })

  it('"Plani i Jimit": totalet e planit, pa peshë dhe pa shkallëzim, për pushim dhe stërvitje', async () => {
    const store = await setup()
    await setTargetsChoice(store, 'jim', '2026-12-07')
    expect((await readTargetsProfile(store)).choice).toBe('jim')
    expect(await day(store, '2026-12-09')).toMatchObject({ dayType: 'rest', targetsSource: 'jim', jimChosen: true, targets: { kcal: 3100, proteinG: 265, carbsG: 260, fatG: 110 } })
    expect(await day(store, '2026-12-07')).toMatchObject({ dayType: 'training', targets: { kcal: 3700, proteinG: 335, carbsG: 340, fatG: 110 } })
  })

  it('"Plani i Jimit" nuk i ndryshon të dhënat personale dhe "Të miat" i rikthen', async () => {
    const store = await setup()
    await saveTargetsProfile(store, { ...owner, birthYear: 1996, proteinGPerKg: 2.2 }, '2026-12-07')
    const saved = await readTargetsProfile(store)
    await setTargetsChoice(store, 'jim', '2026-12-08')
    expect(await readTargetsProfile(store)).toEqual({ ...saved, choice: 'jim' })
    await setTargetsChoice(store, 'personal', '2026-12-08')
    expect(await readTargetsProfile(store)).toEqual(saved)
    expect((await day(store, '2026-12-09')).targets).toMatchObject({ kcal: 2630, proteinG: 194 })
  })

  it('zgjedhja nuk prek cilësimet e tjera te `reminders`, dhe ato nuk e prekin zgjedhjen', async () => {
    const store = await setup()
    await setReminderToggle(store, 'water', false)
    await setTargetsChoice(store, 'jim', '2026-12-07')
    await setReminderToggle(store, 'meals', false)
    const row = (await store.all('user_settings'))[0]
    expect(row.reminders).toMatchObject({ water: false, meals: false, targets_source: 'jim' })
    await setTargetsChoice(store, 'personal', '2026-12-07')
    expect((await store.all('user_settings'))[0].reminders).toMatchObject({ water: false, meals: false })
    expect((await store.all('user_settings'))[0].reminders).not.toHaveProperty('targets_source')
  })

  it('objektivat e ruajtura nga sot ndryshojnë, ato të ditëve të kaluara jo', async () => {
    const store = await setup()
    await saveTargetsProfile(store, owner, '2026-12-01')
    await logTemplateMeal(store, '2026-12-06', 'breakfast_1')
    await logTemplateMeal(store, '2026-12-07', 'breakfast_1')
    await setTargetsChoice(store, 'jim', '2026-12-07')
    expect((await day(store, '2026-12-06')).targets?.kcal).toBe(2630)
    expect((await day(store, '2026-12-07')).targets?.kcal).toBe(3700)
    await setTargetsChoice(store, 'personal', '2026-12-07')
    expect((await day(store, '2026-12-07')).targets?.kcal).toBe(2930)
  })

  it('Plani im nuk shkallëzohet: 3 vezë, 1 kanoçe, 227 g salmon, edhe me peshë 100 kg', async () => {
    const store = await setup()
    await store.put('body_measurements', { date: '2026-12-09', weight_kg: 100 })
    await setTargetsChoice(store, 'jim', '2026-12-07')
    const rest = await day(store, '2026-12-09')
    const items = rest.meals.flatMap((meal) => meal.template)
    expect(items.find((item) => item.food === 'salmon')?.grams).toBe(227)
    expect(items.find((item) => item.food === 'egg')?.portion).toEqual({ count: 3, unit: 'egg' })
    expect(items.find((item) => item.food === 'tuna')?.portion.count).toBe(1)
  })

  it('kontrolli javor nuk propozon korrigjime me "Plani i Jimit"', async () => {
    const store = await setup()
    await saveTargetsProfile(store, owner, '2026-11-02')
    for (const date of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'])
      await store.put('diary_entries', { date, meal: 'lunch', kcal: 2800, protein_g: 170, carbs_g: 350, fat_g: 80, logged_at: at(date, '13:00').toISOString() })
    await store.put('body_measurements', { date: '2026-11-15', weight_kg: 88 })
    expect(await readWeeklyCheck(store, '2026-11-16')).not.toBeNull()
    await setTargetsChoice(store, 'jim', '2026-11-16')
    expect(await readWeeklyCheck(store, '2026-11-16')).toBeNull()
    await setTargetsChoice(store, 'personal', '2026-11-16')
    expect(await readWeeklyCheck(store, '2026-11-16')).not.toBeNull()
  })

  it('"Të miat" pa profil të plotë: objektivat mbeten ato të Jimit të sotme (pa shkallëzim vetëm me zgjedhje)', async () => {
    const store = await setup()
    await setTargetsChoice(store, 'jim', '2026-12-07')
    await setTargetsChoice(store, 'personal', '2026-12-07')
    const rest = await day(store, '2026-12-09')
    expect(rest).toMatchObject({ targetsSource: 'jim', jimChosen: false })
    expect(rest.targets?.kcal).toBe(Math.round(3100 * (88 / 81.65)))
  })
})
