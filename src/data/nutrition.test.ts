import { createDatabase } from './db'
import { logTemplateMeal, nutritionDay, removeDiaryEntry, setDayType } from './nutrition'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'
const MONDAY = '2026-12-07'
const WEDNESDAY = '2026-12-09'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

async function setup() {
  const store = createLocalStore(createDatabase(`nutrition-${crypto.randomUUID()}`), { userId: () => USER, now: () => at(MONDAY, '06:00') })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () =>
    at('2026-12-01', '08:00'),
  )
  return store
}

describe('dita e ushqimit', () => {
  it('ditë pushimi për 80 kg: objektivat e Shtojcës C dhe shtatë vaktet me orë', async () => {
    const store = await setup()
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '06:30'))
    expect(day).toMatchObject({ dayType: 'rest', dayTypeManual: false, weightKg: 80, targets: { kcal: 3037, proteinG: 260, carbsG: 255, fatG: 108 } })
    expect(day.meals.map((meal) => `${meal.time} ${meal.label}`)).toEqual([
      '07:00 Mëngjesi 1',
      '07:45 Mëngjesi 2',
      '10:30 Snack paradite',
      '13:00 Dreka',
      '15:30 Snack pasdite',
      '18:30 Darka',
      '22:30 Para gjumit',
    ])
    expect(day.next?.meal).toBe('breakfast_1')
    expect(day.next?.template.map((item) => `${item.name} · ${item.amount}`)).toEqual(['Pluhur proteine · 1 scoop', 'Pjepër · ½ pjepër'])
    expect(Math.round(day.next!.templateTotals.kcal)).toBe(214)
  })

  it('dita e stërvitjes nga cilësimet: vaktet para dhe pas, objektivat e stërvitjes', async () => {
    const store = await setup()
    const day = await nutritionDay(store, MONDAY, at(MONDAY, '17:30'))
    expect(day).toMatchObject({ dayType: 'training', targets: { kcal: 3625 } })
    expect(day.meals.map((meal) => meal.meal)).toEqual([
      'breakfast_1',
      'breakfast_2',
      'snack_am',
      'lunch',
      'snack_pm',
      'pre_workout',
      'post_workout',
      'dinner',
      'bedtime',
    ])
    expect(day.next?.meal).toBe('pre_workout')
    expect(day.meals.slice(0, 5).every((meal) => meal.status === 'missed')).toBe(true)
  })

  it('një stërvitje e regjistruar e bën ditën e pushimit ditë stërvitjeje; ndryshimi me dorë fiton', async () => {
    const store = await setup()
    await store.put('workout_sessions', { date: WEDNESDAY, status: 'completed' })
    expect((await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))).dayType).toBe('training')
    await setDayType(store, WEDNESDAY, 'rest')
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))
    expect(day).toMatchObject({ dayType: 'rest', dayTypeManual: true, targets: { kcal: 3037 } })
    expect(await store.where('nutrition_targets', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ day_type: 'rest', is_manual: true, kcal: 3037 })])
  })

  it('vakti i Jimit regjistrohet me një prekje; ushqimet krijohen një herë; objektivat e ditës ruhen', async () => {
    const store = await setup()
    await logTemplateMeal(store, WEDNESDAY, 'lunch')
    await logTemplateMeal(store, WEDNESDAY, 'snack_pm')
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '13:10'))
    const lunch = day.meals.find((meal) => meal.meal === 'lunch')!
    expect(lunch.status).toBe('done')
    expect(lunch.entries.map((entry) => [entry.name, entry.grams])).toEqual([
      ['Ton albacore në ujë', 142],
      ['Bukë integrale', 64],
      ['Majonezë light', 15],
      ['Mollë', 223],
    ])
    expect(Math.round(lunch.totals.kcal)).toBe(495)
    expect(Math.round(day.totals.kcal)).toBe(495 + 431)
    expect((await store.all('foods')).filter((food) => food.name === 'Bukë integrale')).toHaveLength(1)
    expect(await store.where('nutrition_targets', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ day_type: 'rest', is_manual: false, kcal: 3037, bodyweight_kg: 80 })])
    expect(day.next?.meal).toBe('dinner')
    expect(day.meals.slice(0, 3).map((meal) => meal.status)).toEqual(['missed', 'missed', 'missed'])
  })

  it('dita e Jimit me shtatë prekje afrohet me 3100 kcal; një regjistrim hiqet', async () => {
    const store = await setup()
    for (const meal of ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime'] as const) await logTemplateMeal(store, WEDNESDAY, meal)
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '23:00'))
    expect(day.totals.kcal).toBeGreaterThan(3000)
    expect(day.totals.kcal).toBeLessThan(3200)
    expect(day.next).toBeNull()
    const [first] = day.meals[0].entries
    await removeDiaryEntry(store, first.id)
    expect((await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '23:00'))).meals[0].entries).toHaveLength(1)
  })

  it('i radhës mbetet vakti që ka kaluar më pak se 1 orë', async () => {
    const store = await setup()
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '13:50'))
    expect(day.next?.meal).toBe('lunch')
    expect(day.meals.find((meal) => meal.meal === 'snack_am')?.status).toBe('missed')
  })

  it('objektivat e ruajtura nuk ndryshojnë kur ndryshon pesha më vonë; jashtë planit të Jimit thuhet', async () => {
    const store = await setup()
    await logTemplateMeal(store, WEDNESDAY, 'breakfast_1')
    await store.put('body_measurements', { date: WEDNESDAY, weight_kg: 70 })
    await logTemplateMeal(store, WEDNESDAY, 'breakfast_2')
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))
    expect(day.targets?.kcal).toBe(3037)
    expect(await store.where('nutrition_targets', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ bodyweight_kg: 80 })])
    expect((await nutritionDay(store, '2026-12-10', at(WEDNESDAY, '09:00'))).outsideJimRange).toBe(true)
    expect(day.outsideJimRange).toBe(false)
  })

  it('kur dita bëhet stërvitje pas regjistrimit, objektivat ndjekin llojin e ri', async () => {
    const store = await setup()
    await logTemplateMeal(store, WEDNESDAY, 'breakfast_1')
    await store.put('workout_sessions', { date: WEDNESDAY, status: 'in_progress' })
    expect((await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '18:00'))).targets?.kcal).toBe(3625)
    await logTemplateMeal(store, WEDNESDAY, 'post_workout')
    expect(await store.where('nutrition_targets', 'date', WEDNESDAY)).toEqual([expect.objectContaining({ day_type: 'training', kcal: 3625 })])
  })

  it('pa peshë: pa objektiva, por vaktet dhe totalet dalin', async () => {
    const store = createLocalStore(createDatabase(`nutrition-${crypto.randomUUID()}`), { userId: () => USER })
    const day = await nutritionDay(store, WEDNESDAY, at(WEDNESDAY, '09:00'))
    expect(day.targets).toBeNull()
    expect(day.meals).toHaveLength(7)
  })
})
