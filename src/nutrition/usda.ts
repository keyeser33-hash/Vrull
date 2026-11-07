import type { ExternalFood } from './off'

// USDA FoodData Central (SPEC §9): ushqimet e përgjithshme, përmes funksionit `usda-search` te
// Supabase. Vlerat e Foundation dhe SR Legacy janë për 100 g.

type Json = Record<string, unknown>

const round1 = (value: number) => Math.round(value * 10) / 10

function nutrient(nutrients: Json[], numbers: string[]) {
  for (const number of numbers) {
    const found = nutrients.find((item) => String(item.nutrientNumber) === number)
    if (found && typeof found.value === 'number') return { value: found.value, unit: String(found.unitName ?? '').toLowerCase() }
  }
  return null
}

export function usdaFromJson(json: Json): ExternalFood[] {
  const foods = Array.isArray(json.foods) ? (json.foods as Json[]) : []
  return foods.flatMap((food) => {
    const nutrients = Array.isArray(food.foodNutrients) ? (food.foodNutrients as Json[]) : []
    const energy = nutrient(nutrients, ['208', '957', '958', '268'])
    const protein = nutrient(nutrients, ['203'])
    const fat = nutrient(nutrients, ['204'])
    const carbs = nutrient(nutrients, ['205'])
    const name = typeof food.description === 'string' ? food.description.trim() : ''
    if (!energy || !protein || !fat || !carbs || !name || food.fdcId === undefined) return []
    return [
      {
        source: 'usda' as const,
        sourceId: String(food.fdcId),
        name,
        brand: null,
        kcal: energy.unit === 'kj' ? round1(energy.value / 4.184) : energy.value,
        proteinG: protein.value,
        carbsG: carbs.value,
        fatG: fat.value,
        fiberG: nutrient(nutrients, ['291'])?.value ?? null,
        servingG: null,
        servingLabel: null,
      },
    ]
  })
}
