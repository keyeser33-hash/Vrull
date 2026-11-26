// Pjatat shqiptare te Lista e Vrullit (V65, SPEC §0.3h, V31): çdo pjatë është një recetë me përbërës nga Lista dhe gramët e tyre;
// makrot për 100 g llogariten nga përbërësit, me burimin "Vrull, recetë". Të dhënat: `dishes/*.json` (një skedar për grup), provat e
// burimeve te `docs/research/dishes/*.md`. Rreshti del si çdo rresht tjetër i `catalog.jsonl`, plus fusha `dish` me recetën.
//
// Llogaritja është e njëjta me kontrollin e recetave (`check.mjs` i hapit të recetave): shuma e përbërësve (gramë/100 · vlera për 100 g),
// pjesëtuar me `cooked_weight_g` kur jepet, përndryshe me shumën e gramëve; çdo vlerë për 100 g rrumbullakohet në një shifër pas presjes.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DISH_SOURCE = 'vrull_recipe'
export const DISH_ID_PREFIX = 'vrull-dish-'
export const DISH_LICENSE = 'Vrull-recipe'
export const DISH_GROUP = 'Albanian dishes'

const ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ONE_UNIT = /^1 \S/
const READERS = /recetë e lexuesve/i
const round1 = (value) => Math.round(value * 10) / 10

/** Pjatat e të gjithë skedarëve `*.json` të dosjes, sipas emrit të skedarit dhe radhës brenda tij. */
export function loadDishFiles(dir) {
  const dishes = []
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json')).sort()) {
    const data = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    if (!Array.isArray(data.dishes)) throw new Error(`${name}: duhet { group, dishes: [] }`)
    dishes.push(...data.dishes)
  }
  return dishes
}

/** Rreshtat e Listës (të paktën id, kcal, protein_g, carbs_g, fat_g, fiber_g) si Map sipas ID-së; pjatat vetë nuk hyjnë. */
export function dishLookup(rows) {
  return new Map(rows.filter((row) => row.source !== DISH_SOURCE).map((row) => [row.id, row]))
}

function totals(dish, lookup) {
  const sum = { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  for (const item of dish.ingredients) {
    const row = lookup.get(item.catalog_id)
    if (!row) throw new Error(`${dish.id}: përbërësi ${item.catalog_id} nuk është te Lista e Vrullit`)
    const factor = item.grams / 100
    sum.grams += item.grams
    sum.kcal += (row.kcal ?? 0) * factor
    sum.protein_g += (row.protein_g ?? 0) * factor
    sum.carbs_g += (row.carbs_g ?? 0) * factor
    sum.fat_g += (row.fat_g ?? 0) * factor
    sum.fiber_g += (row.fiber_g ?? 0) * factor
  }
  return sum
}

/** "6 japrak" → "1 porcion": etiketa e porcionit është një njësi ("1 copë"); me "(6 japrak)" brenda, "2 porcion (6 japrak)" gënjente numrin. */
const oneServing = (label, word) => (ONE_UNIT.test(label) ? label : `1 ${word}`)

/** Një pjatë si rresht i `catalog.jsonl`; `rank` është `common_rank` (pjatat vijnë pas të zakonshmeve). */
export function dishRow(dish, lookup, { listVersion, rank }) {
  const sum = totals(dish, lookup)
  const weight = typeof dish.cooked_weight_g === 'number' && dish.cooked_weight_g > 0 ? dish.cooked_weight_g : sum.grams
  const per100 = (value) => round1((value / weight) * 100)
  const portion = { sq: oneServing(dish.portion.label.sq, 'porcion'), en: oneServing(dish.portion.label.en, 'serving') }
  return {
    id: DISH_ID_PREFIX + dish.id,
    source: DISH_SOURCE,
    source_id: dish.id,
    license: DISH_LICENSE,
    name_en: dish.name.en,
    name_sq: dish.name.sq,
    name_sq_checked: true,
    food_group: DISH_GROUP,
    kcal: per100(sum.kcal),
    protein_g: per100(sum.protein_g),
    // Karbohidratet e USDA janë pa fibrat (V61); shuma mbetet "pa fibrat", si te rreshtat e përbërësve.
    carbs_g: per100(sum.carbs_g),
    carbs_note: 'computed',
    fat_g: per100(sum.fat_g),
    fiber_g: per100(sum.fiber_g),
    portions: [{ label_en: portion.en, grams: dish.portion.grams }],
    list_version: listVersion,
    common_rank: rank,
    dish: {
      ingredients: dish.ingredients.map((item) => [item.as_in_source, item.grams, item.catalog_id]),
      source: { label: dish.source.label, title: dish.source.title, url: dish.source.url ?? null },
      estimates: dish.estimates ?? [],
      // "Vlerësim": pesha e gatshme mungon (shuma e përbërësve zë vendin e saj) ose burimi lë diçka që e kemi vlerësuar vetë.
      estimate: !(typeof dish.cooked_weight_g === 'number' && dish.cooked_weight_g > 0) || (dish.estimates ?? []).length > 0,
      readers: READERS.test(dish.source.label),
      note: dish.note,
      portion,
    },
  }
}

/**
 * Të gjitha pjatat si rreshta, të gjitha me `common_rank` `firstRank` (numër i plotë, si roja kërkon): brenda të zakonshmeve (rishikimi: pas të gjithave, "byrek" jepte
 * "Petë byreku" të parën; me një rregull të veçantë, "pule" jepte "Pulë me oriz" para "Gjoks pule" #28).
 */
export function dishRows(dishes, lookup, { listVersion, firstRank }) {
  return dishes.map((dish) => dishRow(dish, lookup, { listVersion, rank: firstRank }))
}

/** Gabimet e të dhënave të pjatave (lista bosh = në rregull); përbërësit kontrollohen kundrejt Listës. */
export function validateDishes(dishes, lookup) {
  const errors = []
  const ids = new Set()
  const text = (where, value, max) => {
    for (const lang of ['sq', 'en']) {
      const s = value?.[lang]
      if (typeof s !== 'string' || s.trim() === '') errors.push(`${where}.${lang}: bosh`)
      else if (s.length > max) errors.push(`${where}.${lang}: ${s.length} shenja (deri në ${max})`)
      else if (s.includes('!')) errors.push(`${where}.${lang}: pa pikëçuditje`)
    }
  }
  for (const dish of dishes) {
    const at = dish.id ?? '(pa id)'
    if (typeof dish.id !== 'string' || !ID_FORMAT.test(dish.id)) errors.push(`${at}: id kebab-case pa diakritika`)
    if (ids.has(dish.id)) errors.push(`${at}: id e dyfishtë`)
    ids.add(dish.id)
    text(`${at}.name`, dish.name, 80)
    text(`${at}.note`, dish.note, 400)
    text(`${at}.portion.label`, dish.portion?.label, 40)
    if (!(dish.portion?.grams > 0 && dish.portion.grams <= 1000)) errors.push(`${at}: portion.grams 1–1000`)
    if (!Array.isArray(dish.ingredients) || dish.ingredients.length < 2) errors.push(`${at}: të paktën 2 përbërës`)
    for (const item of dish.ingredients ?? []) {
      if (!lookup.has(item.catalog_id)) errors.push(`${at}: përbërësi ${item.catalog_id} nuk është te Lista e Vrullit`)
      if (typeof item.as_in_source !== 'string' || item.as_in_source === '') errors.push(`${at}: përbërës pa as_in_source`)
      if (!(item.grams > 0 && item.grams <= 5000)) errors.push(`${at}: gramët e ${item.catalog_id} jashtë 0–5000`)
    }
    if (typeof dish.source?.label !== 'string' || dish.source.label === '' || typeof dish.source?.title !== 'string' || dish.source.title === '') errors.push(`${at}: burimi pa label ose titull`)
    if (dish.source?.url != null && !/^https:\/\//.test(dish.source.url)) errors.push(`${at}: source.url https ose null`)
    if (/wikipedia\.org/.test(dish.source?.url ?? '')) errors.push(`${at}: Wikipedia nuk pranohet`)
  }
  return errors
}
