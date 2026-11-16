import { createDatabase } from './db'
import { nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { mealPlanOn, moveMealTimes, readSchedule, saveSchedule, trainingTimeOn } from './schedule-settings'
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
