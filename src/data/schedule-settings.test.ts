import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { mealPlanOn, moveMealTimes, readSchedule, saveFoodSetup, saveSchedule, setMealSkipped, SKIPPED_DAYS_KEPT, setTrainingTime, skippedOn, trainingTimeOn } from './schedule-settings'
import { createLocalStore } from './store'

// Oraret e përdoruesit (V35, V2-E2-06).
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

async function setup() {
  const store = createLocalStore(createDatabase(`schedule-${crypto.randomUUID()}`), { userId: () => USER })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () =>
    at('2026-12-01', '08:00'),
  )
  return store
}

describe('oraret e përdoruesit', () => {
  it('ora e stërvitjes për çdo ditë', async () => {
    const store = await setup()
    const schedule = await readSchedule(store)
    expect(schedule.trainingTimes).toEqual({ 1: '21:00', 2: '21:00', 4: '21:00', 5: '21:00' })
    await saveSchedule(store, { wakeTime: '08:20', sleepTime: '01:00', trainingTimes: { ...schedule.trainingTimes, 4: '20:30' }, plan: schedule.plan }, '2026-12-07')
    const saved = await readSchedule(store)
    expect(trainingTimeOn(saved, '2026-12-10')).toBe('20:30')
    expect(trainingTimeOn(saved, '2026-12-07')).toBe('21:00')
    // E enjtja në 20:30: darka bie te stërvitja dhe kalon pas saj (rregulli i PDF-së).
    const thursday = await nutritionDay(store, '2026-12-10', at('2026-12-10', '09:00'))
    expect(thursday.meals.map((meal) => `${meal.time} ${meal.meal}`).slice(-4)).toEqual(['20:15 pre_workout', '21:30 post_workout', '22:30 dinner', '00:30 bedtime'])
  })

  it('ora "vetëm sot" (V76): vlen për atë datë, vaktet e stërvitjes lëvizin, java tjetër mbetet', async () => {
    const store = await setup()
    await setTrainingTime(store, '2026-12-10', '07:00', 'day')
    const saved = await readSchedule(store)
    expect(trainingTimeOn(saved, '2026-12-10')).toBe('07:00')
    expect(trainingTimeOn(saved, '2026-12-17')).toBe('21:00')
    expect(saved.trainingTimes[4]).toBe('21:00')
    const thursday = await nutritionDay(store, '2026-12-10', at('2026-12-10', '06:00'))
    expect(thursday.meals.find((meal) => meal.meal === 'post_workout')?.time).toBe('08:00')
    // E njëjta orë me të zakonshmen e heq ndryshimin.
    await setTrainingTime(store, '2026-12-10', '21:00', 'day')
    expect((await readSchedule(store)).plan.training).toBeNull()
  })

  it('ora "çdo të enjte" (V76): ndryshon ditën e javës dhe heq orën vetëm-sot të asaj date', async () => {
    const store = await setup()
    await setTrainingTime(store, '2026-12-10', '07:00', 'day')
    await setTrainingTime(store, '2026-12-10', '20:30', 'weekday')
    const saved = await readSchedule(store)
    expect(saved.plan.training).toBeNull()
    expect(saved.trainingTimes).toEqual({ 1: '21:00', 2: '21:00', 4: '20:30', 5: '21:00' })
    expect(trainingTimeOn(saved, '2026-12-17')).toBe('20:30')
    // E mërkura nuk është ditë stërvitjeje: ora vlen vetëm për atë datë.
    await setTrainingTime(store, '2026-12-09', '19:00', 'weekday')
    const next = await readSchedule(store)
    expect(next.plan.training).toEqual({ date: '2026-12-09', time: '19:00' })
    expect(Object.keys(next.trainingTimes)).toEqual(['1', '2', '4', '5'])
  })

  it('plani i vakteve vlen nga nesër; sot mbetet si ishte', async () => {
    const store = await setup()
    const schedule = await readSchedule(store)
    await saveSchedule(store, { ...schedule, plan: { removed: ['snack_am'], times: { lunch: '14:00' } } }, '2026-12-07')
    const saved = await readSchedule(store)
    expect(saved.plan).toMatchObject({ from: '2026-12-08', previous: { removed: [], times: {} } })
    expect(mealPlanOn(saved.plan, '2026-12-07')).toEqual({ removed: [], times: {} })
    expect(mealPlanOn(saved.plan, '2026-12-08')).toEqual({ removed: ['snack_am'], times: { lunch: '14:00' } })
    const today = await nutritionDay(store, '2026-12-07', at('2026-12-07', '09:00'))
    expect(today.meals.some((meal) => meal.meal === 'snack_am')).toBe(true)
    const tomorrow = await nutritionDay(store, '2026-12-08', at('2026-12-07', '09:00'))
    expect(tomorrow.meals.some((meal) => meal.meal === 'snack_am')).toBe(false)
    expect(tomorrow.meals.find((meal) => meal.meal === 'lunch')?.time).toBe('14:00')
  })

  it('një ruajtje pa ndryshim te vaktet nuk e shtyn datën e planit', async () => {
    const store = await setup()
    const schedule = await readSchedule(store)
    await saveSchedule(store, { ...schedule, plan: { removed: ['snack_am'], times: {} } }, '2026-12-07')
    const first = await readSchedule(store)
    await saveSchedule(store, { ...first, wakeTime: '08:00' }, '2026-12-09')
    expect((await readSchedule(store)).plan.from).toBe('2026-12-08')
  })
})

describe('lëvizja e vakteve nga ritmi i ditës (V57, V64: vetëm sot)', () => {
  it('ora e re vlen vetëm sot; dje dhe nesër mbeten me planin', async () => {
    const store = await setup()
    await moveMealTimes(store, { dinner: '19:15' }, '2026-12-07')
    const saved = await readSchedule(store)
    expect(saved.plan).toMatchObject({ from: null, times: {}, day: { date: '2026-12-07', times: { dinner: '19:15' } } })
    expect(mealPlanOn(saved.plan, '2026-12-07').times).toEqual({ dinner: '19:15' })
    expect(mealPlanOn(saved.plan, '2026-12-06').times).toEqual({})
    expect(mealPlanOn(saved.plan, '2026-12-08').times).toEqual({})
    const today = await nutritionDay(store, '2026-12-07', at('2026-12-07', '09:00'))
    expect(today.meals.find((meal) => meal.meal === 'dinner')?.time).toBe('19:15')
    const tomorrow = await nutritionDay(store, '2026-12-08', at('2026-12-07', '09:00'))
    expect(tomorrow.meals.find((meal) => meal.meal === 'dinner')?.time).not.toBe('19:15')
  })

  it('vaktet e lëvizura bashkë ruhen me orët e tyre; një lëvizje e re po atë ditë i shton, një ditë tjetër i zëvendëson', async () => {
    const store = await setup()
    await moveMealTimes(store, { snack_pm: '17:00', dinner: '19:30' }, '2026-12-07')
    await moveMealTimes(store, { lunch: '13:30' }, '2026-12-07')
    expect(mealPlanOn((await readSchedule(store)).plan, '2026-12-07').times).toEqual({ snack_pm: '17:00', dinner: '19:30', lunch: '13:30' })
    await moveMealTimes(store, { lunch: '12:30' }, '2026-12-08')
    const saved = (await readSchedule(store)).plan
    expect(mealPlanOn(saved, '2026-12-08').times).toEqual({ lunch: '12:30' })
    expect(mealPlanOn(saved, '2026-12-07').times).toEqual({})
  })

  it('pa ndryshim real nuk shkruan; një orë e pavlefshme anashkalohet', async () => {
    const store = await setup()
    await moveMealTimes(store, { dinner: '25:99' }, '2026-12-07')
    expect((await readSchedule(store)).plan.day).toBeNull()
    await moveMealTimes(store, { dinner: '19:15' }, '2026-12-07')
    const first = (await readSchedule(store)).plan
    await moveMealTimes(store, { dinner: '19:15' }, '2026-12-07')
    expect((await readSchedule(store)).plan).toEqual(first)
  })

  it('vaktet e hequra mbeten të hequra; plani që pret nga nesër nuk hyn sot dhe e mban ndryshimin e sotëm jashtë', async () => {
    const store = await setup()
    const schedule = await readSchedule(store)
    await saveSchedule(store, { ...schedule, plan: { removed: ['snack_am'], times: { lunch: '14:00' } } }, '2026-12-07')
    await moveMealTimes(store, { dinner: '19:15' }, '2026-12-07')
    const saved = await readSchedule(store)
    expect(mealPlanOn(saved.plan, '2026-12-07')).toEqual({ removed: [], times: { dinner: '19:15' } })
    expect(mealPlanOn(saved.plan, '2026-12-08')).toEqual({ removed: ['snack_am'], times: { lunch: '14:00' } })
  })

  it('një ruajtje e orareve po atë ditë e mban lëvizjen e sotme', async () => {
    const store = await setup()
    await moveMealTimes(store, { dinner: '19:15' }, '2026-12-07')
    const schedule = await readSchedule(store)
    await saveSchedule(store, { ...schedule, plan: { removed: [], times: { lunch: '14:00' } } }, '2026-12-07')
    const saved = (await readSchedule(store)).plan
    expect(mealPlanOn(saved, '2026-12-07').times).toEqual({ dinner: '19:15' })
    expect(mealPlanOn(saved, '2026-12-08').times).toEqual({ lunch: '14:00' })
  })
})

// "E kapërceva" (V71).
describe('vaktet e kapërcyera', () => {
  it('vakti i kapërcyer mbyllet pa ushqim dhe nuk është më i radhës as i humbur', async () => {
    const store = await setup()
    const before = await nutritionDay(store, '2026-12-08', at('2026-12-08', '18:00'))
    expect(before.meals.find((meal) => meal.meal === 'lunch')?.status).toBe('missed')
    await setMealSkipped(store, '2026-12-08', 'lunch', true)
    await setMealSkipped(store, '2026-12-08', 'snack_pm', true)
    const day = await nutritionDay(store, '2026-12-08', at('2026-12-08', '18:00'))
    expect(day.meals.find((meal) => meal.meal === 'lunch')?.status).toBe('skipped')
    expect(day.meals.find((meal) => meal.meal === 'snack_pm')?.status).toBe('skipped')
    expect(day.next?.meal).not.toBe('snack_pm')
    // Vlen vetëm për atë datë.
    const tomorrow = await nutritionDay(store, '2026-12-09', at('2026-12-09', '18:00'))
    expect(tomorrow.meals.find((meal) => meal.meal === 'lunch')?.status).toBe('missed')
  })

  it('hapet sërish, dhe mbijeton ndryshimin e orareve dhe lëvizjen e Sot-it', async () => {
    const store = await setup()
    await setMealSkipped(store, '2026-12-08', 'lunch', true)
    const schedule = await readSchedule(store)
    await saveSchedule(store, { ...schedule, plan: { removed: ['snack_am'], times: {} } }, '2026-12-08')
    await moveMealTimes(store, { dinner: '21:15' }, '2026-12-08')
    expect(skippedOn((await readSchedule(store)).plan, '2026-12-08')).toEqual(['lunch'])
    await setMealSkipped(store, '2026-12-08', 'lunch', false)
    expect((await readSchedule(store)).plan.skipped).toEqual({})
  })

  it('mban vetëm ditët e fundit', async () => {
    const store = await setup()
    const day = (index: number) => {
      const date = new Date(2026, 0, 1 + index)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    for (let index = 0; index < SKIPPED_DAYS_KEPT + 3; index += 1) await setMealSkipped(store, day(index), 'dinner', true)
    const kept = Object.keys((await readSchedule(store)).plan.skipped)
    expect(kept).toHaveLength(SKIPPED_DAYS_KEPT)
    expect(kept[0]).toBe(day(3))
  })
})

// Nisja e Ushqimit (V68, V69).
describe('nisja e Ushqimit', () => {
  it('pa përgjigje, mënyra e regjistrimit është null', async () => {
    const store = await setup()
    expect((await readSchedule(store)).plan.logging).toBeNull()
  })

  it('katër vakte dhe "në mbrëmje": nga nesër dita ka katër vakte, sot mbetet si ishte', async () => {
    const store = await setup()
    const before = await nutritionDay(store, '2026-12-08', at('2026-12-08', '10:00'))
    await setMealSkipped(store, '2026-12-08', 'lunch', true)
    await saveFoodSetup(store, { meals: 4, logging: 'evening' }, '2026-12-08')
    const schedule = await readSchedule(store)
    expect(schedule.plan.logging).toBe('evening')
    expect(skippedOn(schedule.plan, '2026-12-08')).toEqual(['lunch'])
    const today = await nutritionDay(store, '2026-12-08', at('2026-12-08', '10:00'))
    expect(today.meals.map((meal) => meal.meal)).toEqual(before.meals.map((meal) => meal.meal))
    const tomorrow = await nutritionDay(store, '2026-12-09', at('2026-12-09', '10:00'))
    expect(tomorrow.meals.map((meal) => meal.meal)).toEqual(['breakfast_1', 'lunch', 'snack_pm', 'dinner'])
    // Ditë stërvitjeje: të njëjtat katër, pa vaktet rreth stërvitjes.
    const thursday = await nutritionDay(store, '2026-12-10', at('2026-12-10', '10:00'))
    expect(thursday.meals.map((meal) => meal.meal).sort()).toEqual(['breakfast_1', 'dinner', 'lunch', 'snack_pm'])
  })

  it('tre dhe pesë vakte', async () => {
    const store = await setup()
    await saveFoodSetup(store, { meals: 3, logging: 'day' }, '2026-12-08')
    expect((await nutritionDay(store, '2026-12-09', at('2026-12-09', '10:00'))).meals.map((meal) => meal.meal)).toEqual(['breakfast_1', 'lunch', 'dinner'])
    await saveFoodSetup(store, { meals: 5, logging: 'day' }, '2026-12-09')
    expect((await nutritionDay(store, '2026-12-10', at('2026-12-10', '10:00'))).meals).toHaveLength(5)
    expect((await readSchedule(store)).plan.logging).toBe('day')
  })
})
