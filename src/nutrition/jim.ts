import type { MealKey } from './meals'
import type { Macros } from './targets'

// Shablloni i Jimit (PDF, "Basic diet" dhe vaktet e stërvitjes; SPEC §9, Q18). Makrot për 100 g
// nga USDA FoodData Central (SR Legacy); Clif Bar dhe karamelet gummy nga etiketa e prodhuesit.
// Me këto vlera dita e pushimit del rreth 3110 kcal / 267 g P / 108 g Y dhe ajo e stërvitjes
// rreth 3700 kcal, sa totalet e PDF-së.

export interface FoodDef extends Macros {
  name: string
}

export const JIM_FOODS: Record<string, FoodDef> = {
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
}

export interface TemplateItem {
  food: keyof typeof JIM_FOODS
  grams: number
  /** Sasia si në PDF: "1 kanoçe", "2 feta". */
  amount: string
}

export const JIM_MEALS: Partial<Record<MealKey, TemplateItem[]>> = {
  breakfast_1: [
    { food: 'protein', grams: 30, amount: '1 scoop' },
    { food: 'cantaloupe', grams: 276, amount: '½ pjepër' },
  ],
  breakfast_2: [
    { food: 'egg', grams: 150, amount: '3 vezë' },
    { food: 'egg_white', grams: 99, amount: '3 të bardha' },
    { food: 'olive_oil', grams: 13.5, amount: '1 lugë gjelle' },
    { food: 'american_cheese', grams: 21, amount: '1 fetë' },
    { food: 'oatmeal', grams: 468, amount: '2 gota' },
  ],
  snack_am: [
    { food: 'cottage_cheese', grams: 226, amount: '1 gotë' },
    { food: 'pineapple', grams: 165, amount: '1 gotë' },
    { food: 'clif_bar', grams: 68, amount: '1 copë' },
  ],
  lunch: [
    { food: 'tuna', grams: 142, amount: '1 kanoçe' },
    { food: 'wheat_bread', grams: 64, amount: '2 feta' },
    { food: 'light_mayo', grams: 15, amount: '1 lugë gjelle' },
    { food: 'apple', grams: 223, amount: '1 e madhe' },
  ],
  snack_pm: [
    { food: 'protein', grams: 30, amount: '1 scoop' },
    { food: 'peanut_butter', grams: 16, amount: '1 lugë gjelle' },
    { food: 'jam', grams: 20, amount: '1 lugë gjelle' },
    { food: 'wheat_bread', grams: 64, amount: '2 feta' },
  ],
  dinner: [
    { food: 'salmon', grams: 227, amount: '227 g' },
    { food: 'broccoli', grams: 91, amount: '1 gotë' },
    { food: 'greens', grams: 70, amount: '2 gota' },
    { food: 'dressing', grams: 32, amount: '2 lugë gjelle' },
  ],
  bedtime: [
    { food: 'protein', grams: 30, amount: '1 scoop' },
    { food: 'peanut_butter', grams: 16, amount: '1 lugë gjelle' },
  ],
  // Shake-u para/gjatë/pas stërvitjes: ⅓ 10–15 min para, ⅓ gjatë, ⅓ në fund.
  pre_workout: [
    { food: 'apple', grams: 223, amount: '1 e madhe' },
    { food: 'protein', grams: 60, amount: '2 scoop në shake' },
  ],
  post_workout: [{ food: 'gummies', grams: 69, amount: '30 copë' }],
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
