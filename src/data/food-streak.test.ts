import { createDatabase } from './db'
import { foodStreak } from './food-streak'
import { logTemplateMeal, nutritionDay } from './nutrition'
import { completeOnboarding } from './profile'
import { setMealSkipped } from './schedule-settings'
import { createLocalStore } from './store'

// Vargu i ditëve të shënuara (V72): një ditë numërohet kur çdo vakt është mbyllur (i ngrënë ose i kapërcyer) dhe të
// paktën një është ngrënë.
const USER = '11111111-1111-4111-8111-111111111111'
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

async function setup() {
  const store = createLocalStore(createDatabase(`streak-${crypto.randomUUID()}`), { userId: () => USER })
  await completeOnboarding(store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => at('2026-12-01', '08:00'))
  return store
}

/** Mbyll ditën: vakti i parë si në plan, të tjerët të kapërcyer. */
async function closeDay(store: Awaited<ReturnType<typeof setup>>, date: string) {
  const day = await nutritionDay(store, date, at(date, '21:00'))
  await logTemplateMeal(store, date, day.meals[0].meal)
  for (const meal of day.meals.slice(1)) await setMealSkipped(store, date, meal.meal, true)
}

describe('vargu i ditëve të shënuara', () => {
  it('pa asnjë ditë të mbyllur është zero', async () => {
    const store = await setup()
    expect(await foodStreak(store, '2026-12-09', at('2026-12-09', '21:00'))).toBe(0)
  })

  it('numëron ditët e mbyllura rresht deri dje; dita e sotme e hapur nuk e këput', async () => {
    const store = await setup()
    await closeDay(store, '2026-12-07')
    await closeDay(store, '2026-12-08')
    expect(await foodStreak(store, '2026-12-09', at('2026-12-09', '12:00'))).toBe(2)
    await closeDay(store, '2026-12-09')
    expect(await foodStreak(store, '2026-12-09', at('2026-12-09', '21:00'))).toBe(3)
  })

  it('një ditë e pambyllur në mes e këput, dhe një ditë vetëm me vakte të kapërcyera nuk numërohet', async () => {
    const store = await setup()
    await closeDay(store, '2026-12-05')
    await closeDay(store, '2026-12-07')
    const monday = await nutritionDay(store, '2026-12-08', at('2026-12-08', '21:00'))
    for (const meal of monday.meals) await setMealSkipped(store, '2026-12-08', meal.meal, true)
    expect(await foodStreak(store, '2026-12-09', at('2026-12-09', '12:00'))).toBe(0)
    expect(await foodStreak(store, '2026-12-08', at('2026-12-08', '12:00'))).toBe(1)
  })
})
