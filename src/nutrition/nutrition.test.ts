import { JIM_FOODS, JIM_MEALS, templateTotals } from './jim'
import { mealSchedule } from './schedule'
import { bodyweightForTargets, nutritionTargets } from './targets'

describe('objektivat (Shtojca C)', () => {
  it('për 80 kg dalin vlerat e shembullit', () => {
    expect(nutritionTargets(80, 'rest')).toEqual({ kcal: 3037, proteinG: 260, carbsG: 255, fatG: 108 })
    expect(nutritionTargets(80, 'training')).toEqual({ kcal: 3625, proteinG: 328, carbsG: 333, fatG: 108 })
  })

  it('për 81,65 kg dalin totalet e Jimit', () => {
    expect(nutritionTargets(81.65, 'rest')).toEqual({ kcal: 3100, proteinG: 265, carbsG: 260, fatG: 110 })
    expect(nutritionTargets(81.65, 'training')).toEqual({ kcal: 3700, proteinG: 335, carbsG: 340, fatG: 110 })
  })

  it('pesha: mesatarja e 7 ditëve kur ka të paktën 3 matje, përndryshe e fundit', () => {
    const today = '2026-12-10'
    expect(bodyweightForTargets([], today)).toBeNull()
    expect(bodyweightForTargets([{ date: '2026-12-09', weightKg: 80 }, { date: '2026-12-01', weightKg: 78 }], today)).toBe(80)
    const week = [
      { date: '2026-12-04', weightKg: 79 },
      { date: '2026-12-06', weightKg: 80 },
      { date: '2026-12-08', weightKg: 81 },
      { date: '2026-12-02', weightKg: 70 },
      { date: '2026-12-11', weightKg: 90 },
    ]
    expect(bodyweightForTargets(week, today)).toBe(80)
    expect(bodyweightForTargets([{ date: '2026-12-09', weightKg: 80 }, { date: '2026-12-08', weightKg: 78 }], today)).toBe(80)
  })
})

const at = (schedule: ReturnType<typeof mealSchedule>) => schedule.map((entry) => `${entry.time} ${entry.meal}`)

describe('orari i vakteve (§13)', () => {
  it('ditë pushimi: mëngjesi 1 në zgjim, mëngjesi 2 pas 45 min, para gjumit 30 min para gjumit', () => {
    expect(at(mealSchedule({ wakeTime: '07:00', sleepTime: '23:00', trainingTime: null }))).toEqual([
      '07:00 breakfast_1',
      '07:45 breakfast_2',
      '10:30 snack_am',
      '13:00 lunch',
      '15:30 snack_pm',
      '18:30 dinner',
      '22:30 bedtime',
    ])
  })

  it('stërvitje në mbrëmje: vakti që bie te stërvitja vjen 1 orë pas vaktit pas stërvitjes', () => {
    expect(at(mealSchedule({ wakeTime: '07:00', sleepTime: '23:00', trainingTime: '18:00' }))).toEqual([
      '07:00 breakfast_1',
      '07:45 breakfast_2',
      '10:30 snack_am',
      '13:00 lunch',
      '15:30 snack_pm',
      '17:45 pre_workout',
      '19:15 post_workout',
      '20:15 dinner',
      '22:30 bedtime',
    ])
  })

  it('stërvitje në mesditë: dreka dhe vaktet pas saj zhvendosen bashkë', () => {
    expect(at(mealSchedule({ wakeTime: '07:00', sleepTime: '23:00', trainingTime: '12:30' }))).toEqual([
      '07:00 breakfast_1',
      '07:45 breakfast_2',
      '10:30 snack_am',
      '12:15 pre_workout',
      '13:45 post_workout',
      '14:45 lunch',
      '17:15 snack_pm',
      '20:15 dinner',
      '22:30 bedtime',
    ])
  })

  it('vakti i shtyrë nuk kalon vaktin para gjumit', () => {
    expect(at(mealSchedule({ wakeTime: '07:00', sleepTime: '22:00', trainingTime: '19:00' })).slice(-4)).toEqual([
      '18:45 pre_workout',
      '20:15 post_workout',
      '21:00 dinner',
      '21:30 bedtime',
    ])
  })

  it('stërvitje sapo zgjohesh: vakti para stërvitjes është i pari; asnjë vakt pas vaktit para gjumit', () => {
    const schedule = mealSchedule({ wakeTime: '06:30', sleepTime: '22:30', trainingTime: '07:00' })
    expect(at(schedule).slice(0, 4)).toEqual(['06:45 pre_workout', '08:15 post_workout', '09:15 breakfast_1', '10:00 breakfast_2'])
    expect(schedule.at(-1)).toEqual({ meal: 'bedtime', time: '22:00', minutes: 1320 })
    const times = schedule.map((entry) => entry.time)
    expect([...times].sort()).toEqual(times)
  })
})

describe('shablloni i Jimit (PDF, dita bazë)', () => {
  it('dita e pushimit afrohet me 3100 kcal, 265 g P, 260 g K, 110 g Y', () => {
    const rest = templateTotals(['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime'])
    expect(rest.kcal).toBeGreaterThan(3100 * 0.97)
    expect(rest.kcal).toBeLessThan(3100 * 1.03)
    expect(Math.abs(rest.proteinG - 265)).toBeLessThan(10)
    expect(Math.abs(rest.carbsG - 260)).toBeLessThan(25)
    expect(Math.abs(rest.fatG - 110)).toBeLessThan(8)
  })

  it('dita e stërvitjes shton vaktet para dhe pas: afrohet me 3700 kcal', () => {
    const training = templateTotals(['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime', 'pre_workout', 'post_workout'])
    expect(training.kcal).toBeGreaterThan(3700 * 0.97)
    expect(training.kcal).toBeLessThan(3700 * 1.03)
  })

  it('çdo artikull i shabllonit ka ushqimin e vet me makro për 100 g', () => {
    for (const items of Object.values(JIM_MEALS)) {
      for (const item of items) expect(JIM_FOODS[item.food], item.food).toBeDefined()
    }
    expect(Object.values(JIM_FOODS).every((food) => food.kcal >= 0 && food.proteinG >= 0 && food.carbsG >= 0 && food.fatG >= 0)).toBe(true)
  })
})
