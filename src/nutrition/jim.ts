import type { MealKey } from './meals'
import type { Macros } from './targets'

// Shablloni i Jimit (PDF, "Basic diet" dhe vaktet e stërvitjes; SPEC §9, Q18). Makrot për 100 g
// nga USDA FoodData Central (SR Legacy); Clif Bar dhe karamelet gummy nga etiketa e prodhuesit.
// Me këto vlera dita e pushimit del rreth 3110 kcal / 267 g P / 108 g Y dhe ajo e stërvitjes
// rreth 3700 kcal, sa totalet e PDF-së.

export interface FoodDef extends Macros {
  /** Emri shqip, si ruhet te `foods` (burimi `template`, `jim:<çelësi>`); ekrani e përkthen (`foodName`). */
  name: string
}

export const JIM_FOODS = {
  protein: { name: 'Pluhur proteine', kcal: 400, proteinG: 80, carbsG: 10, fatG: 5 },
  cantaloupe: { name: 'Pjepër', kcal: 34, proteinG: 0.84, carbsG: 8.16, fatG: 0.19 },
  egg: { name: 'Vezë', kcal: 143, proteinG: 12.56, carbsG: 0.72, fatG: 9.51 },
  egg_white: { name: 'E bardhë veze', kcal: 52, proteinG: 10.9, carbsG: 0.73, fatG: 0.17 },
  olive_oil: { name: 'Vaj ulliri', kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
  american_cheese: { name: 'Djathë amerikan me pak yndyrë', kcal: 180, proteinG: 24.6, carbsG: 3.5, fatG: 7 },
  oatmeal: { name: 'Tërshërë e gatuar', kcal: 71, proteinG: 2.54, carbsG: 12, fatG: 1.52 },
  cottage_cheese: { name: 'Gjizë me pak yndyrë', kcal: 72, proteinG: 12.39, carbsG: 2.72, fatG: 1.02 },
  pineapple: { name: 'Ananas', kcal: 50, proteinG: 0.54, carbsG: 13.12, fatG: 0.12 },
  clif_bar: { name: 'Clif Bar', kcal: 368, proteinG: 14.7, carbsG: 64.7, fatG: 7.4 },
  tuna: { name: 'Ton albacore në ujë', kcal: 128, proteinG: 23.62, carbsG: 0, fatG: 2.97 },
  wheat_bread: { name: 'Bukë integrale', kcal: 252, proteinG: 12.45, carbsG: 42.71, fatG: 3.5 },
  light_mayo: { name: 'Majonezë light', kcal: 238, proteinG: 0.37, carbsG: 9.23, fatG: 22.22 },
  apple: { name: 'Mollë', kcal: 52, proteinG: 0.26, carbsG: 13.81, fatG: 0.17 },
  peanut_butter: { name: 'Gjalpë kikiriku', kcal: 588, proteinG: 25.09, carbsG: 19.56, fatG: 50.39 },
  jam: { name: 'Reçel', kcal: 278, proteinG: 0.37, carbsG: 68.86, fatG: 0.07 },
  salmon: { name: 'Salmon', kcal: 142, proteinG: 19.84, carbsG: 0, fatG: 6.34 },
  broccoli: { name: 'Brokoli', kcal: 34, proteinG: 2.82, carbsG: 6.64, fatG: 0.37 },
  greens: { name: 'Sallatë jeshile e përzier', kcal: 15, proteinG: 1.36, carbsG: 2.87, fatG: 0.15 },
  dressing: { name: 'Salcë me vaj ulliri dhe uthull', kcal: 449, proteinG: 0, carbsG: 2.5, fatG: 50.1 },
  gummies: { name: 'Karamele gummy', kcal: 343, proteinG: 6.9, carbsG: 77, fatG: 0 },
} satisfies Record<string, FoodDef>

export type JimFoodKey = keyof typeof JIM_FOODS

/** Njësia e sasisë si në PDF ("1 kanoçe", "2 feta"); teksti vjen nga katalogu (`portionText`). */
export type PortionUnit = 'scoop' | 'scoopShake' | 'halfMelon' | 'egg' | 'eggWhite' | 'tbsp' | 'slice' | 'cup' | 'piece' | 'can' | 'large' | 'gram'

export interface Portion {
  count: number
  unit: PortionUnit
}

export interface TemplateItem {
  food: JimFoodKey
  grams: number
  /** Sasia si në PDF: 1 kanoçe, 2 feta. */
  portion: Portion
}

const portion = (count: number, unit: PortionUnit): Portion => ({ count, unit })

export const JIM_MEALS: Partial<Record<MealKey, TemplateItem[]>> = {
  breakfast_1: [
    { food: 'protein', grams: 30, portion: portion(1, 'scoop') },
    { food: 'cantaloupe', grams: 276, portion: portion(1, 'halfMelon') },
  ],
  breakfast_2: [
    { food: 'egg', grams: 150, portion: portion(3, 'egg') },
    { food: 'egg_white', grams: 99, portion: portion(3, 'eggWhite') },
    { food: 'olive_oil', grams: 13.5, portion: portion(1, 'tbsp') },
    { food: 'american_cheese', grams: 21, portion: portion(1, 'slice') },
    { food: 'oatmeal', grams: 468, portion: portion(2, 'cup') },
  ],
  snack_am: [
    { food: 'cottage_cheese', grams: 226, portion: portion(1, 'cup') },
    { food: 'pineapple', grams: 165, portion: portion(1, 'cup') },
    { food: 'clif_bar', grams: 68, portion: portion(1, 'piece') },
  ],
  lunch: [
    { food: 'tuna', grams: 142, portion: portion(1, 'can') },
    { food: 'wheat_bread', grams: 64, portion: portion(2, 'slice') },
    { food: 'light_mayo', grams: 15, portion: portion(1, 'tbsp') },
    { food: 'apple', grams: 223, portion: portion(1, 'large') },
  ],
  snack_pm: [
    { food: 'protein', grams: 30, portion: portion(1, 'scoop') },
    { food: 'peanut_butter', grams: 16, portion: portion(1, 'tbsp') },
    { food: 'jam', grams: 20, portion: portion(1, 'tbsp') },
    { food: 'wheat_bread', grams: 64, portion: portion(2, 'slice') },
  ],
  dinner: [
    { food: 'salmon', grams: 227, portion: portion(227, 'gram') },
    { food: 'broccoli', grams: 91, portion: portion(1, 'cup') },
    { food: 'greens', grams: 70, portion: portion(2, 'cup') },
    { food: 'dressing', grams: 32, portion: portion(2, 'tbsp') },
  ],
  bedtime: [
    { food: 'protein', grams: 30, portion: portion(1, 'scoop') },
    { food: 'peanut_butter', grams: 16, portion: portion(1, 'tbsp') },
  ],
  // Shake-u para/gjatë/pas stërvitjes: ⅓ 10–15 min para, ⅓ gjatë, ⅓ në fund.
  pre_workout: [
    { food: 'apple', grams: 223, portion: portion(1, 'large') },
    { food: 'protein', grams: 60, portion: portion(2, 'scoopShake') },
  ],
  post_workout: [{ food: 'gummies', grams: 69, portion: portion(30, 'piece') }],
}

export const macrosFor = (food: Macros, grams: number): Macros => ({
  kcal: (food.kcal * grams) / 100,
  proteinG: (food.proteinG * grams) / 100,
  carbsG: (food.carbsG * grams) / 100,
  fatG: (food.fatG * grams) / 100,
})

export const sumMacros = (list: Macros[]): Macros =>
  list.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      proteinG: total.proteinG + item.proteinG,
      carbsG: total.carbsG + item.carbsG,
      fatG: total.fatG + item.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )

/** Totali i vakteve të shabllonit. */
export function templateTotals(meals: MealKey[]): Macros {
  return sumMacros(meals.flatMap((meal) => (JIM_MEALS[meal] ?? []).map((item) => macrosFor(JIM_FOODS[item.food], item.grams))))
}
