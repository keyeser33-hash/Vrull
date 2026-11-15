import { type FillFood, type FillProposal } from '@/nutrition/fill-macros'
import type { MealKey } from '@/nutrition/meals'
import { type BasketItem, basketItemFromFood } from './basket'
import { type Food, foodById, foodsById } from './foods'
import { currentFoodDate, nutritionDay, planFoodId } from './nutrition'
import { favoriteFoods, isQuickFood, recentPortions } from './quick-food'
import type { LocalStore } from './store'
import { isSupplementSource, mealPowder, supplementList } from './supplements'

// Plotëso makrot, burimet (V2-E3-28c, SPEC §0.3h): çfarë mbetet nga objektivat dhe cilat ushqime mund të propozohen.
// Vetëm lexim: asnjë ekran dhe asnjë shkrim te baza kur hapet faqja; ushqimet e planit që nuk janë ruajtur ende marrin një
// id të përkohshme (`plan:<çelësi>`) që zgjidhet kur përdoruesi i shton në shportë. Burimet (vendim i ngrirë): suplementet
// e përdoruesit me makro (pluhuri i proteinës), Plani im dhe ushqimet e tij (të preferuarat, të fundit). Pa Listën e Vrullit.

export interface FillView {
  date: string
  /** Vakti i radhës: aty shkon shporta. */
  meal: MealKey
  /** Sa mbetet nga objektivat e ditës; null pa objektiva (pa peshë). */
  left: { kcal: number; proteinG: number } | null
  foods: FillFood[]
}

const PLAN_ID = 'plan:'
/** Të fundit që hyjnë te propozimet, përveç të preferuarave. */
const RECENT = 12

const asFill = (food: Food, source: FillFood['source']): FillFood => ({
  foodId: food.id,
  name: food.name,
  source,
  sourceId: food.sourceId,
  per100: { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG },
  servingG: food.servingG,
  servingLabel: food.servingLabel,
  unit: null,
})

export async function fillView(store: LocalStore, now: Date): Promise<FillView> {
  const date = await currentFoodDate(store, now)
  const day = await nutritionDay(store, date, now)
  const meal = day.next ?? day.meals[day.meals.length - 1]
  const powder = await mealPowder(store, date, meal.meal)
  const [supplements, foods, favorites, recent] = await Promise.all([supplementList(store), foodsById(store), favoriteFoods(store), recentPortions(store, RECENT)])
  const list: FillFood[] = []

  // Suplementet: pluhuri i proteinës me makro që numërohet te ushqimi; një herë në vakt (`mealPowder`), pa plan pluhurin e tij.
  for (const supplement of supplements) {
    if (!supplement.enabled || !supplement.countsAsFood || !supplement.macros || !supplement.scoopG || powder.plan) continue
    const food = [...foods.values()].find((entry) => entry.source === 'custom' && entry.sourceId === `supplement:${supplement.id}`)
    if (food && food.proteinG > 0) list.push({ ...asFill(food, 'supplement'), name: supplement.name, servingG: supplement.scoopG, servingLabel: null, unit: supplement.doseUnit === 'scoop' ? 'scoop' : null })
  }
  const hasPowder = list.length > 0

  // Plani im: artikujt e vakteve që nuk janë regjistruar ende (si "Si në plan"); pluhuri i planit nuk del kur e ka suplementi.
  for (const slot of day.meals) {
    if (slot.status === 'done') continue
    for (const line of slot.template) {
      if (line.food === 'protein' && (hasPowder || powder.supplement)) continue
      const sourceId = line.sourceId
      const [stored] = line.food.startsWith('food:') ? [] : sourceId ? await store.where('foods', '[source+source_id]', ['template', sourceId]) : []
      const foodId = line.food.startsWith('food:') ? line.food.slice('food:'.length) : (stored?.id ?? `${PLAN_ID}${line.food}`)
      list.push({
        foodId,
        name: line.name,
        source: 'plan',
        sourceId,
        per100: line.item.per100,
        servingG: line.item.unit === 'gram' ? null : line.item.unitGrams,
        servingLabel: null,
        unit: line.item.unit === 'gram' ? null : line.item.unit,
      })
    }
  }

  // Ushqimet e përdoruesit: të preferuarat dhe të fundit, pa makrot e shpejta (nuk kanë gramë) dhe pa pluhurin e suplementit.
  for (const portion of [...favorites, ...recent]) {
    const food = foods.get(portion.foodId)
    if (!food || isQuickFood(food.sourceId) || isSupplementSource(food.sourceId)) continue
    list.push(asFill(food, 'own'))
  }

  // Një ushqim del një herë: suplementi, pastaj plani, pastaj ushqimet e tua (`fillMacros` mban të parin).
  const left = day.targets ? { kcal: day.targets.kcal - day.totals.kcal, proteinG: day.targets.proteinG - day.totals.proteinG } : null
  return { date, meal: meal.meal, left, foods: list }
}

/** Artikujt e një propozimi si artikuj të shportës; ushqimet e planit që s'janë ruajtur ende ruhen tani (veprim i përdoruesit). */
export async function proposalBasketItems(store: LocalStore, proposal: FillProposal): Promise<BasketItem[]> {
  const items: BasketItem[] = []
  for (const entry of proposal.items) {
    const id = entry.food.foodId
    const food = await foodById(store, id.startsWith(PLAN_ID) ? await planFoodId(store, id.slice(PLAN_ID.length)) : id)
    if (food) items.push(basketItemFromFood(food, entry.grams))
  }
  return items
}
