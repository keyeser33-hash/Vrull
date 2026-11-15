// Livsmedelsverket (Agjencia Suedeze e Ushqimit), Livsmedelsdatabasen: shkarkimi nga API zyrtare dhe leximi në rreshta të
// njëtrajtshëm për Listën e Vrullit. Çdo rresht është për 100 g pjesë të ngrënshme; vlerat vijnë vetëm nga ky burim.
// API: https://dataportal.livsmedelsverket.se/livsmedel/api/v1 (swagger: /livsmedel/swagger/index.html).
//
// Shkarkimi (`fetchLivsmedelsverketBundle`): një paketë JSON e përcaktuar (radhitur sipas `nummer`) me, për çdo ushqim,
// emrin anglisht (`sprak=2`), emrin suedisht (`sprak=1`), llojin, versionin, grupin dhe vetëm përbërësit që duhen
// (ENERC, PROT, CHO, FAT, FIBT) nga `/naringsvarden?sprak=2`. Kërkesat janë të ngadalta (4 njëkohësisht, me riprovim).
//
// Rregullat (faqja zyrtare "Food Composition Data" dhe skema e `/naringsvarden`):
//  - Energjia: ENERC me enhet "kcal" (ENERC me "kJ" nuk përdoret). Proteina PROT, yndyra FAT, karbohidratet CHO
//    ("Carbohydrates, available", të disponueshme, pa fibrat), fibrat FIBT ("Fibre"); të gjitha në g.
//  - Vetëm vlera me `matrisenhetkod` W ("per 100 g edible portion") dhe `viktGram` 100 ("Always 100 grams"); tjetër = i munguar.
//  - `varde` është "the value that is considered the best representative": përdoret siç është, përfshirë vlerat me
//    `vardetypkod` BL ("Below limit of detection") dhe LZ ("Logical zero"), që e kanë 0. Përbërës që mungon ose `varde` bosh
//    = i munguar: një makro ose energji e munguar e heq rreshtin, fibra e munguar është null.
//  - Yndyra (ose makro tjetër) mbi 100 g për 100 g është e mundur te vajrat (yndyra si trigliceride: "Cooking oil" 102 g,
//    vardetypkod MN): deri në 105 g rrumbullakohet në 100 (e numëruar, `over_100_clamped`); mbi 105 hiqet (`over_100g`).
//  - Emri: `namn` me `sprak=2` ("Food name in British English") → name_en; `namn` suedisht → name_source kur ndryshon.
//  - Grupi: faseta "A. PRODUCT TYPE" e LanguaL te `/klassificeringar` (emri i parë), në shkronja të vogla; pa të, null.
//  - Porcione: API nuk jep; `portions` bosh. Burimi nuk jep as ID tekst: `source_id` = `nummer`.
import { flagKcal, nameSource, round1 } from './common.mjs'

export const SOURCE = 'livsmedelsverket'
export const LICENSE = 'CC-BY-4.0'
export const NUTRIENTS = { kcal: 'ENERC', protein: 'PROT', carbs: 'CHO', fat: 'FAT', fiber: 'FIBT' }
export const MACRO_CLAMP_LIMIT = 105
const CONCURRENCY = 4

async function getJson(url, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      if (attempt >= tries) throw new Error(`${url}: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    }
  }
}

/** Ndërton paketën JSON nga API (URL bazë e listës, p.sh. .../api/v1/livsmedel). Kthen Buffer. */
export async function fetchLivsmedelsverketBundle(listUrl) {
  const list = async (sprak) => (await getJson(`${listUrl}?offset=0&limit=5000&sprak=${sprak}`)).livsmedel
  const [english, swedish] = [await list(2), await list(1)]
  const swedishNames = new Map(swedish.map((food) => [food.nummer, food.namn]))
  const foods = english.map((food) => ({
    nummer: food.nummer,
    version: food.version,
    typ: food.livsmedelsTyp,
    name_en: food.namn,
    name_sv: swedishNames.get(food.nummer) ?? null,
    group: null,
    nutrients: [],
  }))
  foods.sort((a, b) => a.nummer - b.nummer)
  let next = 0
  const keep = new Set(Object.values(NUTRIENTS))
  async function worker() {
    while (next < foods.length) {
      const food = foods[next++]
      const values = await getJson(`${listUrl}/${food.nummer}/naringsvarden?sprak=2`)
      food.nutrients = values
        .filter((value) => keep.has(value.euroFIRkod))
        .map(({ euroFIRkod, namn, varde, enhet, viktGram, matrisenhetkod, vardetypkod }) => ({ euroFIRkod, namn, varde, enhet, viktGram, matrisenhetkod, vardetypkod }))
      const classes = await getJson(`${listUrl}/${food.nummer}/klassificeringar?sprak=2`)
      food.group = classes.find((item) => item.typ === 'LanguaL' && /^A\./.test(item.fasett))?.namn?.trim() ?? null
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return Buffer.from(`${JSON.stringify({ source: listUrl, count: foods.length, foods })}\n`)
}

/** Vlera e një përbërësi në g (ose kcal) per 100 g pjesë të ngrënshme; null kur mungon. */
export function nutrientValue(food, key) {
  const wanted = NUTRIENTS[key]
  const unit = key === 'kcal' ? 'kcal' : 'g'
  const entry = food.nutrients.find(
    (item) => item.euroFIRkod === wanted && item.enhet === unit && item.matrisenhetkod === 'W' && Number(item.viktGram) === 100,
  )
  return typeof entry?.varde === 'number' && Number.isFinite(entry.varde) ? entry.varde : null
}

const sentence = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : null)

/** Lexon paketën (tekst JSON). Kthen { rows, dropped, adjusted }. */
export function readLivsmedelsverket(bundleText, listVersion = 1) {
  const bundle = JSON.parse(bundleText)
  const rows = []
  const dropped = { no_kcal: 0, no_macros: 0, negative_macro: 0, over_100g: 0 }
  const adjusted = { over_100_clamped: 0 }
  for (const food of [...bundle.foods].sort((a, b) => a.nummer - b.nummer)) {
    const kcal = nutrientValue(food, 'kcal')
    if (kcal === null) {
      dropped.no_kcal++
      continue
    }
    const protein = nutrientValue(food, 'protein')
    const carbs = nutrientValue(food, 'carbs')
    const fat = nutrientValue(food, 'fat')
    if (protein === null || carbs === null || fat === null) {
      dropped.no_macros++
      continue
    }
    const fiber = nutrientValue(food, 'fiber')
    if (protein < 0 || carbs < 0 || fat < 0 || (fiber !== null && fiber < 0) || kcal < 0) {
      dropped.negative_macro++
      continue
    }
    const macros = [protein, carbs, fat, fiber ?? 0]
    if (macros.some((value) => value > MACRO_CLAMP_LIMIT)) {
      dropped.over_100g++
      continue
    }
    if (macros.some((value) => value > 100)) adjusted.over_100_clamped++
    const row = {
      id: `livsmedelsverket-${food.nummer}`,
      source: SOURCE,
      source_id: String(food.nummer),
      license: LICENSE,
      name_en: food.name_en.trim(),
      name_source: nameSource(food.name_sv?.trim(), food.name_en.trim()),
      food_group: sentence(food.group),
      kcal: round1(kcal),
      protein_g: round1(Math.min(protein, 100)),
      carbs_g: round1(Math.min(carbs, 100)),
      fat_g: round1(Math.min(fat, 100)),
      fiber_g: fiber === null ? null : round1(Math.min(fiber, 100)),
      portions: [],
      list_version: listVersion,
    }
    rows.push(flagKcal(row))
  }
  return { rows, dropped, adjusted }
}
