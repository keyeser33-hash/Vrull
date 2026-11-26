// Roja e Listës së Vrullit (docs/agents/PLANI-LISTA-E-VRULLIT.md, "Rojet dhe provat"): kontrollon rreshtat e
// ndërtuar para se të shkojnë kudo tjetër. Kufijtë përputhen me `food_catalog` te migrimi (kolonat, `check`-et).
//
// Përdorimi: node tools/food-catalog/check.mjs <catalog.jsonl>   (del me kod 1 kur ka gabime)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Burimet e lejuara dhe licenca e secilit. */
export const SOURCE_LICENSES = {
  usda_foundation: 'CC0-1.0',
  usda_sr_legacy: 'CC0-1.0',
  usda_fndds: 'CC0-1.0',
  ciqual: 'etalab-2.0',
  cofid: 'OGL-3.0',
  livsmedelsverket: 'CC-BY-4.0',
  // Pjatat shqiptare (V65): recetat e Vrullit, makrot nga përbërësit e Listës (tools/food-catalog/dishes.mjs).
  vrull_recipe: 'Vrull-recipe',
}

export const KCAL_TOLERANCE = 0.15
// Yndyrat e pastra (dhjami, vaji i peshkut) dalin 902 kcal te USDA (faktorët specifikë të Atwater-it), mbi 9·100.
// Migrimi i ri te food_catalog ka `kcal between 0 and 900` dhe do t'i refuzonte; kufiri këtu është 950.
export const KCAL_MAX = 950
const ID_FORMAT = /^[a-z0-9][a-z0-9-]{2,79}$/
const MACROS = ['protein_g', 'carbs_g', 'fat_g', 'fiber_g']

export const CARBS_NOTES = ['computed', 'includes_fiber']

/** Kcal e pritur nga makrot: 4·P + 4·K + 9·Y. Kur karbohidratet janë pa fibrat (`computed`), fibra numërohet me 4 si më parë. */
export function atwater(row) {
  const fiber = row.carbs_note === 'computed' && typeof row.fiber_g === 'number' ? row.fiber_g : 0
  return 4 * row.protein_g + 4 * (row.carbs_g + fiber) + 9 * row.fat_g
}

/** True kur kcal është brenda 15 % të 4·P + 4·K + 9·Y. Kur e pritura është 0, kcal duhet të jetë 0. */
export function kcalWithinTolerance(row) {
  const expected = atwater(row)
  if (expected === 0) return row.kcal === 0
  return Math.abs(row.kcal - expected) / expected <= KCAL_TOLERANCE
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

/**
 * Kontrollon një listë rreshtash. Kthen { errors, notes }, secili { id, rule, message }.
 * Gabim = rreshti nuk duhet të hyjë në listë; shënim = rreshti hyn, por njeriu e sheh.
 */
export function checkCatalog(rows) {
  const errors = []
  const notes = []
  const fail = (row, rule, message) => errors.push({ id: row?.id ?? null, rule, message })
  const seen = new Set()
  const seenSource = new Set()

  for (const row of rows) {
    if (typeof row.id !== 'string' || !ID_FORMAT.test(row.id)) fail(row, 'id_format', `ID e pavlefshme: ${row.id}`)
    else if (seen.has(row.id)) fail(row, 'id_duplicate', `ID e dyfishtë: ${row.id}`)
    seen.add(row.id)

    if (!row.source || !(row.source in SOURCE_LICENSES)) fail(row, 'source', `burim i munguar ose i panjohur: ${row.source}`)
    else if (row.license !== SOURCE_LICENSES[row.source])
      fail(row, 'license', `licenca ${row.license ?? '(bosh)'} nuk i takon ${row.source}`)
    if (!row.license) fail(row, 'license', 'licenca mungon')
    if (!Number.isInteger(row.list_version) || row.list_version < 1) fail(row, 'list_version', 'versioni i listës mungon')
    if (typeof row.source_id !== 'string' || row.source_id.length < 1 || row.source_id.length > 80)
      fail(row, 'source_id', 'source_id mungon ose është mbi 80 shenja')
    else {
      const key = `${row.source}/${row.source_id}`
      if (seenSource.has(key)) fail(row, 'source_id_duplicate', `burimi dhe source_id i dyfishtë: ${key}`)
      seenSource.add(key)
    }
    if (typeof row.name_en !== 'string' || row.name_en.length < 1 || row.name_en.length > 200)
      fail(row, 'name_en', 'emri anglisht mungon ose është mbi 200 shenja')
    if (row.name_sq != null && (typeof row.name_sq !== 'string' || row.name_sq.trim() === '' || row.name_sq.length > 200))
      fail(row, 'name_sq', 'emri shqip bosh ose mbi 200 shenja')
    if (row.source !== 'vrull_recipe' && row.name_sq != null && row.name_sq_checked !== false) fail(row, 'name_sq_checked', 'emri shqip i ndërtimit duhet të jetë i pakontrolluar (false)')
    if (row.common_rank != null && (!Number.isInteger(row.common_rank) || row.common_rank < 1)) fail(row, 'common_rank', `common_rank i pavlefshëm: ${row.common_rank}`)
    if (row.also_in != null && (!Array.isArray(row.also_in) || row.also_in.some((id) => typeof id !== 'string' || !ID_FORMAT.test(id))))
      fail(row, 'also_in', 'also_in duhet të jetë listë ID-sh')
    if (row.food_group != null && String(row.food_group).length > 80) fail(row, 'food_group', 'grupi mbi 80 shenja')

    if (row.carbs_note != null && !CARBS_NOTES.includes(row.carbs_note)) fail(row, 'carbs_note', `carbs_note i panjohur: ${row.carbs_note}`)
    else if (row.carbs_note === 'computed' && !isNumber(row.fiber_g)) fail(row, 'carbs_note', 'carbs_note computed pa fibra')

    if (!isNumber(row.kcal) || row.kcal < 0 || row.kcal > KCAL_MAX) fail(row, 'kcal_range', `kcal jashtë 0–${KCAL_MAX}: ${row.kcal}`)
    for (const key of MACROS) {
      const value = row[key]
      if (value == null && key === 'fiber_g') continue
      if (!isNumber(value)) fail(row, 'macro_missing', `${key} mungon`)
      else if (value < 0) fail(row, 'negative', `${key} negative: ${value}`)
      else if (value > 100) fail(row, 'over_100g', `${key} mbi 100 g për 100 g: ${value}`)
    }

    if (isNumber(row.kcal) && MACROS.slice(0, 3).every((key) => isNumber(row[key]))) {
      const within = kcalWithinTolerance(row)
      if (!within && !row.kcal_flag)
        fail(row, 'kcal_mismatch', `kcal ${row.kcal} kundrejt ${atwater(row).toFixed(1)} (4P+4K+9Y), jashtë 15 % dhe pa kcal_flag`)
      else if (row.kcal_flag) notes.push({ id: row.id, rule: 'kcal_flag', message: `kcal ${row.kcal} kundrejt ${atwater(row).toFixed(1)} (4P+4K+9Y)` })
    }

    if (!Array.isArray(row.portions)) fail(row, 'portions', 'portions nuk është listë')
    else
      for (const portion of row.portions) {
        if (typeof portion.label_en !== 'string' || portion.label_en === '') fail(row, 'portion_label', 'porcion pa etiketë')
        if (!isNumber(portion.grams) || portion.grams <= 0) fail(row, 'portion_grams', `porcion me gram ${portion.grams}: ${portion.label_en}`)
      }
  }
  return { errors, notes }
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Përdorimi: node tools/food-catalog/check.mjs <catalog.jsonl>')
    process.exit(1)
  }
  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
  const { errors, notes } = checkCatalog(rows)
  console.log(`${rows.length} rreshta, ${errors.length} gabime, ${notes.length} shënime`)
  for (const error of errors.slice(0, 50)) console.log(`GABIM ${error.rule} ${error.id}: ${error.message}`)
  process.exit(errors.length ? 1 : 0)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
