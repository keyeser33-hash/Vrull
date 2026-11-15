import { mealSchedule } from './schedule'

// Vakti pas stërvitjes (V62, PDF faqja 13: "POSTWORKOUT (WITHIN 30 MINUTES AFTER WORKOUTS)"):
// fillimi + kohëzgjatja e vlerësuar + 15 min; pa vlerësim, 60 + 15.
const base = { wakeTime: '07:00', sleepTime: '23:00' }
const lines = (input: Parameters<typeof mealSchedule>[0]) => mealSchedule(input).map((entry) => `${entry.time} ${entry.meal}`)
const time = (input: Parameters<typeof mealSchedule>[0], meal: string) => mealSchedule(input).find((entry) => entry.meal === meal)?.time

describe('vakti pas stërvitjes', () => {
  it('me vlerësim 45 min: stërvitja 18:00 mbaron 18:45, vakti 19:00', () => {
    expect(time({ ...base, trainingTime: '18:00', workoutMinutes: 45 }, 'post_workout')).toBe('19:00')
    expect(time({ ...base, trainingTime: '18:00', workoutMinutes: 45 }, 'pre_workout')).toBe('17:45')
  })

  it('pa vlerësim: 60 min stërvitje dhe 15 pas saj', () => {
    expect(time({ ...base, trainingTime: '18:00' }, 'post_workout')).toBe('19:15')
    expect(time({ ...base, trainingTime: '18:00', workoutMinutes: null }, 'post_workout')).toBe('19:15')
    expect(time({ ...base, trainingTime: '18:00', workoutMinutes: 0 }, 'post_workout')).toBe('19:15')
  })

  it('një stërvitje e gjatë e zhvendos vaktin bashkë me mbarimin e saj', () => {
    expect(time({ ...base, trainingTime: '18:00', workoutMinutes: 80 }, 'post_workout')).toBe('19:35')
  })

  it('vakti pas stërvitjes vjen gjithmonë 15 min pas mbarimit, brenda 30 min', () => {
    for (const minutes of [20, 45, 60, 75, 95]) {
      const post = time({ ...base, trainingTime: '10:00', workoutMinutes: minutes }, 'post_workout')!
      const [h, m] = post.split(':').map(Number)
      const afterEnd = h * 60 + m - (10 * 60 + minutes)
      expect(afterEnd).toBe(15)
      expect(afterEnd).toBeLessThanOrEqual(30)
    }
  })

  it('vakti tjetër vjen 1 orë pas vaktit pas stërvitjes', () => {
    // Stërvitja 12:30: vaktet rreth saj zëvendësohen, vakti tjetër është 1 orë pas "post".
    const meals = lines({ ...base, trainingTime: '12:30', workoutMinutes: 45 })
    const post = meals.indexOf('13:30 post_workout')
    expect(post).toBeGreaterThan(-1)
    expect(meals[post + 1]).toMatch(/^14:30 /)
  })

  it('ditë pushimi: asnjë vakt para ose pas stërvitjes', () => {
    expect(lines({ ...base, trainingTime: null, workoutMinutes: 45 }).some((line) => line.includes('workout'))).toBe(false)
  })
})
