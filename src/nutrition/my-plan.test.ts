import { JIM_MEALS } from './jim'
import type { MealKey } from './meals'
import { jimPlan, jimSwaps, pdfFoodItem, pdfSwaps, roundToPortion, scalePlan, withinPlanTargets } from './my-plan'

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

describe('brenda objektivave (V34)', () => {
  const target = { kcal: 2930, proteinG: 176, carbsG: 379, fatG: 79 }
  it('kaloritë ±5% dhe proteina ±10 g', () => {
    expect(withinPlanTargets({ ...target, kcal: 2930 * 1.05, proteinG: 186 }, target)).toBe(true)
    expect(withinPlanTargets({ ...target, kcal: 2930 * 0.94 }, target)).toBe(false)
    expect(withinPlanTargets({ ...target, proteinG: 165 }, target)).toBe(false)
  })
})

describe('zëvendësimet e PDF-së (V34)', () => {
  const dinner = jimPlan(['dinner'])[0].items
  const protein = (item: { per100: { proteinG: number }; grams: number }) => (item.per100.proteinG * item.grams) / 100

  it('salmoni: mishrat e PDF-së me radhën e saj, porcioni mban proteinën', () => {
    const salmon = dinner.find((item) => item.food === 'salmon')!
    const swaps = pdfSwaps(salmon)
    expect(swaps).toHaveLength(16)
    expect(swaps.slice(0, 3).map((item) => item.food)).toEqual(['pdf:chicken_breast', 'pdf:chicken_thigh', 'pdf:turkey_breast'])
    expect(swaps[0]).toMatchObject({ unit: 'gram', grams: 200 })
    for (const swap of swaps) expect(Math.abs(protein(swap) - protein(salmon))).toBeLessThan(2.5)
  })

  it('brokoli: perimet, porcioni mban kaloritë; vaji nuk ka listë', () => {
    const broccoli = dinner.find((item) => item.food === 'broccoli')!
    const swaps = pdfSwaps(broccoli)
    expect(swaps.map((item) => item.food)).toContain('pdf:asparagus')
    expect(swaps).toHaveLength(9)
    expect(pdfSwaps(dinner.find((item) => item.food === 'dressing')!)).toEqual([])
  })

  it('një artikull i PDF-së: të tjerët e listës së tij, dhe ushqimet e Jimit të llojit të tij', () => {
    const banana = pdfFoodItem('banana')
    expect(banana).toMatchObject({ food: 'pdf:banana', unit: 'gram', grams: 100 })
    expect(pdfSwaps(banana).map((item) => item.food)).not.toContain('pdf:banana')
    expect(pdfSwaps(banana)).toHaveLength(10)
    expect(jimSwaps(banana).map((item) => item.food)).toEqual(expect.arrayContaining(['apple', 'cantaloupe', 'broccoli']))
    expect(jimSwaps(banana).map((item) => item.food)).not.toContain('oatmeal')
  })
})
