import { JIM_MEALS } from './jim'
import type { MealKey } from './meals'
import { jimPlan, roundToPortion, scalePlan } from './my-plan'

// Plani im (V34, V2-E2-05): plani i Jimit i shkallëzuar te objektivat, në njësi reale.
const TRAINING_MEALS: MealKey[] = ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'pre_workout', 'post_workout', 'bedtime']
const REST_MEALS: MealKey[] = ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime']

describe('Plani im', () => {
  it('ditë stërvitjeje për 2 930 kcal dhe 176 g proteinë: brenda ±5% dhe ±10 g', () => {
    const plan = scalePlan(jimPlan(TRAINING_MEALS), { kcal: 2930, proteinG: 176, carbsG: 379, fatG: 79 })
    expect(Math.abs(plan.totals.kcal - 2930) / 2930).toBeLessThanOrEqual(0.05)
    expect(Math.abs(plan.totals.proteinG - 176)).toBeLessThanOrEqual(10)
  })

  it('ditë pushimi për 2 630 kcal dhe 176 g proteinë', () => {
    const plan = scalePlan(jimPlan(REST_MEALS), { kcal: 2630, proteinG: 176, carbsG: 304, fatG: 79 })
    expect(Math.abs(plan.totals.kcal - 2630) / 2630).toBeLessThanOrEqual(0.05)
    expect(Math.abs(plan.totals.proteinG - 176)).toBeLessThanOrEqual(10)
  })

  it('porcionet janë në njësi reale: vezë të plota, lugë të plota ose gjysmë, gramët në 10', () => {
    const plan = scalePlan(jimPlan(TRAINING_MEALS), { kcal: 2930, proteinG: 176, carbsG: 379, fatG: 79 })
    for (const meal of plan.meals) {
      for (const item of meal.items) {
        const ratio = item.count / item.step
        expect(Math.abs(ratio - Math.round(ratio)), `${item.food} ${item.count}`).toBeLessThan(1e-9)
        expect(item.count).toBeGreaterThanOrEqual(item.step)
      }
    }
    const egg = plan.meals.find((meal) => meal.meal === 'breakfast_2')!.items.find((item) => item.food === 'egg')!
    expect(Number.isInteger(egg.count)).toBe(true)
  })

  it('një plan që i ka objektivat nuk ndryshon', () => {
    const plan = jimPlan(['lunch'])
    const totals = plan.flatMap((meal) => meal.items).reduce((sum, item) => sum + (item.per100.kcal * item.grams) / 100, 0)
    const protein = plan.flatMap((meal) => meal.items).reduce((sum, item) => sum + (item.per100.proteinG * item.grams) / 100, 0)
    const scaled = scalePlan(plan, { kcal: totals, proteinG: protein, carbsG: 0, fatG: 0 })
    expect(scaled.meals[0].items.map((item) => item.grams)).toEqual(JIM_MEALS.lunch!.map((item) => item.grams))
  })

  it('rrumbullakimi në njësinë e ushqimit', () => {
    expect(roundToPortion(140, { unitGrams: 50, step: 1 })).toEqual({ grams: 150, count: 3 })
    expect(roundToPortion(10, { unitGrams: 50, step: 1 })).toEqual({ grams: 50, count: 1 })
    expect(roundToPortion(47, { unitGrams: 30, step: 0.5 })).toEqual({ grams: 45, count: 1.5 })
    expect(roundToPortion(176, { unitGrams: 1, step: 10 })).toEqual({ grams: 180, count: 180 })
  })
})

describe('ndërrimi i ushqimit', () => {
  it('ushqimet e Jimit të së njëjtës lloj, me porcionin që mban proteinën', async () => {
    const { jimSwaps } = await import('./my-plan')
    const tuna = jimPlan(['lunch'])[0].items.find((item) => item.food === 'tuna')!
    const options = jimSwaps(tuna)
    expect(options.map((option) => option.food)).toEqual(expect.arrayContaining(['salmon', 'cottage_cheese', 'egg_white']))
    expect(options.some((option) => option.food === 'tuna')).toBe(false)
    const salmon = options.find((option) => option.food === 'salmon')!
    // 142 g ton = 33,5 g proteinë → rreth 170 g salmon, në hapa 10 g.
    expect(salmon).toMatchObject({ unit: 'gram', grams: 170 })
  })

  it('karbohidratet ndërrohen me të njëjtat kalori', async () => {
    const { jimSwaps } = await import('./my-plan')
    const bread = jimPlan(['lunch'])[0].items.find((item) => item.food === 'wheat_bread')!
    const options = jimSwaps(bread)
    expect(options.map((option) => option.food)).toContain('oatmeal')
    const oatmeal = options.find((option) => option.food === 'oatmeal')!
    expect(Math.abs((oatmeal.per100.kcal * oatmeal.grams) / 100 - 161)).toBeLessThan(60)
  })
})
