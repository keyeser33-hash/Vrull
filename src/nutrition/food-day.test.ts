import { foodDate, minutesInFoodDay } from './food-day'
import { mealSchedule } from './schedule'

// Dita e ushqimit (V46): nuk ndërrohet në mesnatë, por 3 orë para zgjimit.
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

describe('dita e ushqimit', () => {
  it('ndërrohet 3 orë para zgjimit', () => {
    expect(foodDate(at('2026-12-08', '00:30'), '08:20')).toBe('2026-12-07')
    expect(foodDate(at('2026-12-08', '05:19'), '08:20')).toBe('2026-12-07')
    expect(foodDate(at('2026-12-08', '05:20'), '08:20')).toBe('2026-12-08')
    expect(foodDate(at('2026-12-08', '23:50'), '08:20')).toBe('2026-12-08')
    // Zgjimi 07:00: ndërrimi në 04:00.
    expect(foodDate(at('2026-12-08', '03:59'), '07:00')).toBe('2026-12-07')
    expect(foodDate(at('2026-12-08', '04:00'), '07:00')).toBe('2026-12-08')
  })

  it('zgjimi shumë herët: ndërrimi mbetet në mesnatë', () => {
    expect(foodDate(at('2026-12-08', '00:10'), '02:00')).toBe('2026-12-08')
  })

  it('kalon nga një muaj te tjetri', () => {
    expect(foodDate(at('2027-01-01', '01:00'), '08:20')).toBe('2026-12-31')
  })

  it('minutat brenda ditës së ushqimit kalojnë 1440 pas mesnate', () => {
    expect(minutesInFoodDay(at('2026-12-07', '14:00'), '2026-12-07')).toBe(840)
    expect(minutesInFoodDay(at('2026-12-08', '00:20'), '2026-12-07')).toBe(1460)
  })
})

describe('orari me gjumin pas mesnate', () => {
  it('vakti para gjumit ka minutat e ditës tjetër, por i përket kësaj dite', () => {
    const meals = mealSchedule({ wakeTime: '08:20', sleepTime: '01:00', trainingTime: '21:00' })
    expect(meals.map((entry) => `${entry.time} ${entry.meal} ${entry.minutes}`)).toEqual([
      '08:20 breakfast_1 500',
      '09:05 breakfast_2 545',
      '11:50 snack_am 710',
      '14:20 lunch 860',
      '16:50 snack_pm 1010',
      '19:50 dinner 1190',
      '20:45 pre_workout 1245',
      '22:15 post_workout 1335',
      '00:30 bedtime 1470',
    ])
  })
})

// V35: përdoruesi zgjedh sa vakte ka dhe e lëviz ose e heq secilin.
describe('orari i përdoruesit', () => {
  const late = { wakeTime: '08:20', sleepTime: '01:00', trainingTime: '21:00' }
  const list = (meals: ReturnType<typeof mealSchedule>) => meals.map((entry) => `${entry.time} ${entry.meal}`)

  it('një vakt i hequr nuk del; një i lëvizur del në orën e tij dhe në radhë', () => {
    expect(list(mealSchedule({ ...late, plan: { removed: ['snack_am'], times: { lunch: '14:00' } } }))).toEqual([
      '08:20 breakfast_1',
      '09:05 breakfast_2',
      '14:00 lunch',
      '16:50 snack_pm',
      '19:50 dinner',
      '20:45 pre_workout',
      '22:15 post_workout',
      '00:30 bedtime',
    ])
  })

  it('një vakt i lëvizur pas mesnate mbetet në fund të ditës', () => {
    const meals = mealSchedule({ ...late, trainingTime: null, plan: { removed: [], times: { dinner: '00:10' } } })
    expect(list(meals).slice(-2)).toEqual(['00:10 dinner', '00:30 bedtime'])
    expect(meals.at(-2)?.minutes).toBe(1450)
  })

  it('vaktet e stërvitjes nuk lëvizen me dorë, por hiqen', () => {
    const meals = mealSchedule({ ...late, plan: { removed: ['post_workout'], times: { pre_workout: '10:00' } } })
    expect(list(meals)).toContain('20:45 pre_workout')
    expect(list(meals).some((line) => line.endsWith('post_workout'))).toBe(false)
  })
})

describe('numri i vakteve', () => {
  it('ulja heq sipas radhës, rritja i rikthen; 3 deri në 9', async () => {
    const { MEAL_REMOVAL_ORDER, withMealCount } = await import('./schedule')
    expect(MEAL_REMOVAL_ORDER.slice(0, 3)).toEqual(['snack_am', 'snack_pm', 'breakfast_2'])
    expect(withMealCount([], 9, 7)).toEqual(['snack_am', 'snack_pm'])
    expect(withMealCount(['snack_am', 'snack_pm'], 9, 8)).toEqual(['snack_am'])
    expect(withMealCount([], 9, 1)).toHaveLength(6)
  })
})
