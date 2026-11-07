// Kërkimi i ushqimeve te USDA FoodData Central (SPEC §9, TH-15). Çelësi USDA_API_KEY rri si secret
// i funksionit dhe nuk shkon kurrë te telefoni; pa të përdoret DEMO_KEY (rreth 30 kërkime në orë).
// verify_jwt mbetet aktiv: platforma pranon vetëm kërkesa me sesion të vlefshëm të përdoruesit.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Energjia (kcal ose kJ), proteina, yndyra, karbohidratet, fibrat.
const NUTRIENTS = new Set(['208', '957', '958', '268', '203', '204', '205', '291'])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoda nuk lejohet.' }, 405)
  let query = ''
  try {
    query = String((await req.json())?.query ?? '').trim()
  } catch {
    // Trupi i kërkesës mungon ose nuk është JSON.
  }
  if (query.length < 2 || query.length > 100) return json({ error: 'Kërkesa duhet të ketë 2 deri në 100 shkronja.' }, 400)

  const params = new URLSearchParams({
    api_key: Deno.env.get('USDA_API_KEY') ?? 'DEMO_KEY',
    query,
    pageSize: '20',
    dataType: 'Foundation,SR Legacy',
  })
  let response: Response
  try {
    response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`, { signal: AbortSignal.timeout(10_000) })
  } catch {
    return json({ error: 'USDA nuk po përgjigjet.' }, 502)
  }
  if (!response.ok) return json({ error: `USDA: ${response.status}` }, response.status === 429 ? 429 : 502)
  const data = await response.json()
  const foods = (Array.isArray(data?.foods) ? data.foods : []).map((food: Record<string, unknown>) => ({
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    foodNutrients: (Array.isArray(food.foodNutrients) ? food.foodNutrients : [])
      .filter((nutrient: Record<string, unknown>) => NUTRIENTS.has(String(nutrient.nutrientNumber)))
      .map((nutrient: Record<string, unknown>) => ({ nutrientNumber: String(nutrient.nutrientNumber), unitName: nutrient.unitName, value: nutrient.value })),
  }))
  return json({ foods })
})
