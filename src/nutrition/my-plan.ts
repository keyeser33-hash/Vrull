import { JIM_FOODS, JIM_MEALS, type JimFoodKey, type PortionUnit } from './jim'
import { isPdfFood, PDF_FOODS, PDF_PREFIX, type PdfFoodKey, SWAP_LIST_GROUP, SWAP_LISTS, swapListFor } from './pdf-swaps'
import type { MealKey } from './meals'
import type { Macros } from './targets'

// Plani im (V34, SPEC §9): plani i Jimit si pikënisje, me porcionet e shkallëzuara që totali i ditës
// të bjerë te objektivat. Ushqimet me shumë proteinë dhe të tjerat marrin secili faktorin e vet, që
// proteina dhe kaloritë të dalin njëkohësisht; pastaj çdo porcion rrumbullakohet në njësinë e vet
// (1 vezë, ½ lugë, 10 g). Pa UI dhe pa bazë.

/** Hapi i porcionit: gramët e një njësie dhe sa njësi shtohen ose hiqen njëherësh. */
export interface PortionStep {
  unitGrams: number
  step: number
}

export interface PlanItem extends PortionStep {
  /** Çelësi i ushqimit të Jimit ose `food:<id>` për një ushqim të përdoruesit. */
  food: string
  unit: PortionUnit
  per100: Macros
  grams: number
  /** Sasia në njësinë e vet (3 vezë, 1,5 lugë, 180 g). */
  count: number
}

export interface PlanMeal {
  meal: MealKey
  items: PlanItem[]
}

/** Sa njësi lëviz një prekje: gjysmë luge, kanoçeje, filxhani, pjepri; një vezë, fetë, copë; 10 g. */
const UNIT_STEP: Record<PortionUnit, number> = {
  scoop: 0.5,
  scoopShake: 0.5,
  halfMelon: 0.5,
  egg: 1,
  eggWhite: 1,
  tbsp: 0.5,
  slice: 1,
  cup: 0.5,
  piece: 1,
  can: 0.5,
  large: 0.5,
  gram: 10,
}

/** Copat e vogla (karamelet) lëvizin 5 nga 5. */
const SMALL_PIECE_GRAMS = 5

export function stepFor(unit: PortionUnit, unitGrams: number): PortionStep {
  if (unit === 'gram') return { unitGrams: 1, step: UNIT_STEP.gram }
  if (unit === 'piece' && unitGrams < SMALL_PIECE_GRAMS) return { unitGrams, step: 5 }
  return { unitGrams, step: UNIT_STEP[unit] }
}

/** Gramët dhe sasia e rrumbullakosur në hapin e njësisë, të paktën një hap. */
export function roundToPortion(grams: number, { unitGrams, step }: PortionStep): { grams: number; count: number } {
  const steps = Math.max(1, Math.round(grams / unitGrams / step))
  const count = Math.round(steps * step * 100) / 100
  return { grams: Math.round(count * unitGrams * 100) / 100, count }
}

/** Plani i Jimit për vaktet e dhëna, në gramët e PDF-së. */
export function jimPlan(meals: readonly MealKey[]): PlanMeal[] {
  return meals.map((meal) => ({
    meal,
    items: (JIM_MEALS[meal] ?? []).map((item) => {
      const unitGrams = item.grams / item.portion.count
      return {
        food: item.food,
        unit: item.portion.unit,
        per100: JIM_FOODS[item.food as JimFoodKey],
        grams: item.grams,
        count: item.portion.count,
        ...stepFor(item.portion.unit, unitGrams),
      }
    }),
  }))
}

/** Makrot e një artikulli me gramët e tij. */
export const macrosOf = (item: Pick<PlanItem, 'per100' | 'grams'>): Macros => ({
  kcal: (item.per100.kcal * item.grams) / 100,
  proteinG: (item.per100.proteinG * item.grams) / 100,
  carbsG: (item.per100.carbsG * item.grams) / 100,
  fatG: (item.per100.fatG * item.grams) / 100,
})

export function planTotals(meals: readonly PlanMeal[]): Macros {
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  for (const item of meals.flatMap((meal) => meal.items)) {
    const macros = macrosOf(item)
    totals.kcal += macros.kcal
    totals.proteinG += macros.proteinG
    totals.carbsG += macros.carbsG
    totals.fatG += macros.fatG
  }
  return totals
}

/** Brenda objektivave (V34): kaloritë ±5% dhe proteina ±10 g. */
export const withinPlanTargets = (totals: Macros, targets: Macros) =>
  Math.abs(totals.kcal - targets.kcal) <= targets.kcal * 0.05 && Math.abs(totals.proteinG - targets.proteinG) <= 10

/** Një ushqim "me proteinë" kur proteina jep të paktën 40% të kalorive të tij. */
const PROTEIN_SHARE = 0.4
export const isProteinFood = (item: Pick<PlanItem, 'per100'>) => item.per100.kcal > 0 && (item.per100.proteinG * 4) / item.per100.kcal >= PROTEIN_SHARE
const FACTOR = { min: 0.25, max: 3 }
const clamp = (value: number) => Math.min(FACTOR.max, Math.max(FACTOR.min, value))

/**
 * Shkallëzon planin te kaloritë dhe proteina e objektivave: dy faktorë (ushqimet me proteinë dhe të
 * tjerat) nga dy ekuacionet, pastaj rrumbullakimi i çdo porcioni. Kur ekuacionet nuk kanë zgjidhje
 * (p.sh. vetëm një lloj ushqimi), një faktor i vetëm te kaloritë.
 */
export function scalePlan(meals: readonly PlanMeal[], target: Macros): { meals: PlanMeal[]; totals: Macros } {
  const items = meals.flatMap((meal) => meal.items)
  const sum = (filter: (item: PlanItem) => boolean) =>
    items.filter(filter).reduce(
      (total, item) => {
        const macros = macrosOf(item)
        return { kcal: total.kcal + macros.kcal, proteinG: total.proteinG + macros.proteinG }
      },
      { kcal: 0, proteinG: 0 },
    )
  const protein = sum(isProteinFood)
  const other = sum((item) => !isProteinFood(item))
  const det = protein.proteinG * other.kcal - other.proteinG * protein.kcal
  let p: number
  let c: number
  if (Math.abs(det) < 1e-6 || protein.kcal === 0 || other.kcal === 0) {
    const total = protein.kcal + other.kcal
    p = c = total > 0 ? clamp(target.kcal / total) : 1
  } else {
    p = clamp((target.proteinG * other.kcal - other.proteinG * target.kcal) / det)
    c = clamp((protein.proteinG * target.kcal - target.proteinG * protein.kcal) / det)
  }
  const scaled = meals.map((meal) => ({
    meal: meal.meal,
    items: meal.items.map((item) => {
      const factor = isProteinFood(item) ? p : c
      if (Math.abs(factor - 1) < 1e-9) return { ...item }
      return { ...item, ...roundToPortion(item.grams * factor, item) }
    }),
  }))
  if (!(p === 1 && c === 1)) refine(scaled, target)
  return { meals: scaled, totals: planTotals(scaled) }
}

/** Gabimi i planit: proteina në hapa 10 g, kaloritë 5%; yndyra (8 g) dhe karbohidratet (20 g) me më pak peshë. */
const errorOf = (totals: Macros, target: Macros) =>
  ((totals.proteinG - target.proteinG) / 10) ** 2 +
  ((totals.kcal - target.kcal) / Math.max(1, target.kcal * 0.05)) ** 2 +
  (target.fatG > 0 ? ((totals.fatG - target.fatG) / 8) ** 2 : 0) +
  (target.carbsG > 0 ? ((totals.carbsG - target.carbsG) / 20) ** 2 : 0)
const MAX_NUDGES = 40

/**
 * Pas rrumbullakimit: lëviz një porcion me një hap (lart ose poshtë) sa herë kjo e afron totalin te
 * objektivat, deri sa asnjë hap nuk ndihmon.
 */
function refine(meals: PlanMeal[], target: Macros) {
  for (let nudge = 0; nudge < MAX_NUDGES; nudge++) {
    const current = errorOf(planTotals(meals), target)
    let best: { meal: number; item: number; next: PlanItem; error: number } | null = null
    meals.forEach((meal, mealIndex) =>
      meal.items.forEach((item, itemIndex) => {
        for (const direction of [-1, 1]) {
          const count = Math.round((item.count + direction * item.step) * 100) / 100
          if (count < item.step) continue
          const next = { ...item, count, grams: Math.round(count * item.unitGrams * 100) / 100 }
          const trial = meals.map((entry, index) => (index === mealIndex ? { ...entry, items: entry.items.map((other, k) => (k === itemIndex ? next : other)) } : entry))
          const error = errorOf(planTotals(trial), target)
          if (error < current - 1e-9 && (!best || error < best.error)) best = { meal: mealIndex, item: itemIndex, next, error }
        }
      }),
    )
    if (!best) return
    const chosen: { meal: number; item: number; next: PlanItem } = best
    meals[chosen.meal].items[chosen.item] = chosen.next
  }
}

/** Llojet e ushqimeve të Jimit për ndërrimin (V34): proteina, karbohidrate, fruta dhe perime, yndyra. */
export const JIM_GROUPS: Record<JimFoodKey, 'protein' | 'carbs' | 'produce' | 'fat'> = {
  protein: 'protein',
  egg: 'protein',
  egg_white: 'protein',
  american_cheese: 'protein',
  cottage_cheese: 'protein',
  tuna: 'protein',
  salmon: 'protein',
  oatmeal: 'carbs',
  wheat_bread: 'carbs',
  clif_bar: 'carbs',
  gummies: 'carbs',
  jam: 'carbs',
  cantaloupe: 'produce',
  pineapple: 'produce',
  apple: 'produce',
  broccoli: 'produce',
  greens: 'produce',
  olive_oil: 'fat',
  peanut_butter: 'fat',
  light_mayo: 'fat',
  dressing: 'fat',
}

/** Njësia e parë e një ushqimi te plani i Jimit ("1 kanoçe" = 142 g). */
export function jimUnit(food: JimFoodKey): { unit: PortionUnit; unitGrams: number } {
  for (const items of Object.values(JIM_MEALS)) {
    const item = items?.find((entry) => entry.food === food)
    if (item) return { unit: item.portion.unit, unitGrams: item.grams / item.portion.count }
  }
  return { unit: 'gram', unitGrams: 1 }
}

/** Gramët e një ushqimi tjetër që mbajnë proteinën (ushqimet me proteinë) ose kaloritë e artikullit. */
export function matchingGrams(item: Pick<PlanItem, 'per100' | 'grams'>, per100: Macros): number {
  const byProtein = isProteinFood(item) && per100.proteinG > 0
  const wanted = byProtein ? (item.per100.proteinG * item.grams) / 100 : (item.per100.kcal * item.grams) / 100
  const per = byProtein ? per100.proteinG : per100.kcal
  return per > 0 ? (wanted / per) * 100 : item.grams
}

/** Lloji i një artikulli për ndërrimin: i shabllonit, i listës së PDF-së, ose sipas proteinës. */
function groupOf(item: PlanItem): 'protein' | 'carbs' | 'produce' | 'fat' {
  if (Object.hasOwn(JIM_GROUPS, item.food)) return JIM_GROUPS[item.food as JimFoodKey]
  const list = isPdfFood(item.food) ? swapListFor(item.food) : null
  if (list) return SWAP_LIST_GROUP[list]
  return isProteinFood(item) ? 'protein' : 'carbs'
}

/** Ushqimet e Jimit të së njëjtës lloj, me porcionin e rrumbullakosur në njësinë e tyre. */
export function jimSwaps(item: PlanItem): PlanItem[] {
  const group = groupOf(item)
  return (Object.keys(JIM_GROUPS) as JimFoodKey[])
    .filter((food) => food !== item.food && JIM_GROUPS[food] === group)
    .map((food) => {
      const per100 = JIM_FOODS[food]
      const { unit, unitGrams } = jimUnit(food)
      const step = stepFor(unit, unitGrams)
      return { food, unit, per100, ...step, ...roundToPortion(matchingGrams(item, per100), step) }
    })
}

/**
 * Zëvendësimet e PDF-së (V34) për një artikull: lista që zëvendëson ushqimin e shabllonit (salmoni →
 * mishrat), ose të tjerët e listës së tij; në gramë, me porcionin që mban proteinën ose kaloritë.
 */
export function pdfSwaps(item: PlanItem): PlanItem[] {
  const list = swapListFor(item.food)
  if (!list) return []
  const step = stepFor('gram', 1)
  return SWAP_LISTS[list]
    .filter((key) => `${PDF_PREFIX}${key}` !== item.food)
    .map((key) => {
      const per100 = PDF_FOODS[key]
      return { food: `${PDF_PREFIX}${key}`, unit: 'gram' as const, per100, ...step, ...roundToPortion(matchingGrams(item, per100), step) }
    })
}

/** Një ushqim i PDF-së për "Shto ushqim": 100 g. */
export function pdfFoodItem(key: PdfFoodKey): PlanItem {
  const step = stepFor('gram', 1)
  return { food: `${PDF_PREFIX}${key}`, unit: 'gram', per100: PDF_FOODS[key], ...step, ...roundToPortion(100, step) }
}

/** Një ushqim i Jimit për "Shto ushqim": një njësi (1 vezë, 1 fetë), ose 100 g kur njësia është gram. */
export function jimFoodItem(food: JimFoodKey): PlanItem {
  const { unit, unitGrams } = jimUnit(food)
  const step = stepFor(unit, unitGrams)
  return { food, unit, per100: JIM_FOODS[food], ...step, ...roundToPortion(unit === 'gram' ? 100 : unitGrams * Math.max(1, step.step), step) }
}
