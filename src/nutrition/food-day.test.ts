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
      '22:30 post_workout 1350',
      '00:30 bedtime 1470',
    ])
  })
})
