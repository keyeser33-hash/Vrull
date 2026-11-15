// Leximi i tre datasets të USDA FoodData Central (CSV) në rreshta të njëtrajtshëm për Listën e Vrullit.
// Çdo rresht është për 100 g pjesë të ngrënshme; vlerat nuk përzihen mes burimeve (një rresht vjen nga një dataset).
//
// Energjia (kcal), sipas dokumentimit të FDC-së dhe tabelës `nutrient.csv` që vjen me secilin shkarkim:
//  - Foundation Foods: "Most energy values are calculated using the Atwater general factors ... nutrient ID: 2047.
//    Other energy values are calculated using Atwater specific factors per food ... nutrient ID: 2048 ... energy
//    values represented by "Energy" (ID 1008) will no longer display in Foundation Foods" (https://fdc.nal.usda.gov/
//    Foundation_Foods_Documentation, "Energy"). Rregulli: 2048, pastaj 2047, pastaj 1008 (vetëm kur të tjerat mungojnë).
//  - SR Legacy: 1008 (Energy, KCAL; nutrient_nbr 208) te çdo rresht; nuk ka 2047/2048.
//  - FNDDS (Survey): kolona `nutrient_id` te food_nutrient.csv mban numrat e lëndëve (nutrient_nbr: 208, 203, 204, 205,
//    291), jo ID-të e `nutrient.csv`; kcal = 208.
// Proteina 1003 (203), yndyra 1004 (204), karbohidratet "by difference" 1005 (205), fibra 1079 (291). Karbohidratet
// "by summation" (1050) nuk zëvendësojnë 1005: një rresht pa 1005 hiqet, që dy mënyra llogaritjeje të mos përzihen.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { kcalWithinTolerance } from './check.mjs'

export const LICENSE = 'CC0-1.0'
export const CARBS_NEGATIVE_TOLERANCE = 1

/** Rregullat e secilit dataset: lloji i rreshtit te food.csv, tabela e grupeve, ID-të e lëndëve (sipas përparësisë për kcal). */
export const DATASETS = {
  usda_foundation: {
    dataType: 'foundation_food',
    groups: 'food_category.csv',
    kcal: ['2048', '2047', '1008'],
    protein: ['1003'],
    carbs: ['1005'],
    fat: ['1004'],
    fiber: ['1079'],
  },
  usda_sr_legacy: {
    dataType: 'sr_legacy_food',
    groups: 'food_category.csv',
    kcal: ['1008'],
    protein: ['1003'],
    carbs: ['1005'],
    fat: ['1004'],
    fiber: ['1079'],
  },
  usda_fndds: {
    dataType: 'survey_fndds_food',
    groups: 'wweia_food_category.csv',
    kcal: ['208'],
    protein: ['203'],
    carbs: ['205'],
    fat: ['204'],
    fiber: ['291'],
  },
}

/** Lexon tekstin CSV (RFC 4180: fusha me thonjëza, thonjëza të dyfishta brenda, rreshta të rinj brenda fushës). */
export function* csvRecords(text) {
  let field = ''
  let record = []
  let quoted = false
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      record.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      field = ''
      if (record.length > 1 || record[0] !== '') yield record
      record = []
    } else field += c
    i++
  }
  if (field !== '' || record.length) {
    record.push(field)
    yield record
  }
}

/** Rreshtat e një teksti CSV si objekte sipas titullit. */
export function* csvObjects(text) {
  let header = null
  for (const record of csvRecords(text.replace(/^﻿/, ''))) {
    if (!header) {
      header = record
      continue
    }
    const row = {}
    for (let k = 0; k < header.length; k++) row[header[k]] = record[k] ?? ''
    yield row
  }
}

/** Dosja me CSV-të: shkarkimi shpaketohet në një nëndosje (p.sh. FoodData_Central_sr_legacy_food_csv_2018-04). */
export function resolveDir(dir) {
  if (readdirSync(dir).includes('food.csv')) return dir
  const sub = readdirSync(dir).find((name) => statSync(join(dir, name)).isDirectory())
  if (!sub) throw new Error(`Nuk gjeta food.csv te ${dir}`)
  return resolveDir(join(dir, sub))
}

const read = (dir, name) => readFileSync(join(dir, name), 'utf8')
const round1 = (value) => Math.round(value * 10) / 10

function numberOrNull(text) {
  if (text === '' || text == null) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/** Vlera e parë e disponueshme sipas përparësisë së ID-ve. */
function pick(values, ids) {
  if (!values) return null
  for (const id of ids) if (values.has(id)) return values.get(id)
  return null
}

/** Etiketa e një porcioni: "2 tablespoon", "1 cup", "1 serving". Pa njësi të panjohur ("undetermined"). */
export function portionLabel(row, unitName) {
  const text = (value) => String(value ?? '').trim()
  const parts = []
  if (text(row.portion_description)) parts.push(text(row.portion_description))
  else {
    const amount = numberOrNull(row.amount)
    if (amount !== null && amount !== 0) parts.push(String(amount))
    if (unitName && unitName !== 'undetermined') parts.push(unitName)
    if (text(row.modifier)) parts.push(text(row.modifier))
  }
  return parts.join(' ').trim()
}

/**
 * Lexon një dataset. `source`: çelësi te DATASETS; `dir`: dosja e shpaketuar; `listVersion`: numri i Versionit të listës.
 * Kthen { rows, dropped, adjusted }: dropped numëron rreshtat e hequr sipas arsyes, adjusted ato që u rregulluan.
 */
export function readDataset(source, dir, listVersion = 1) {
  const rules = DATASETS[source]
  if (!rules) throw new Error(`Dataset i panjohur: ${source}`)
  const root = resolveDir(dir)

  const foods = new Map()
  for (const row of csvObjects(read(root, 'food.csv'))) {
    if (row.data_type === rules.dataType) foods.set(row.fdc_id, row)
  }

  const groups = new Map()
  for (const row of csvObjects(read(root, rules.groups))) {
    groups.set(row.id ?? row.wweia_food_category, row.description ?? row.wweia_food_category_description)
  }

  const wanted = new Set([...rules.kcal, ...rules.protein, ...rules.carbs, ...rules.fat, ...rules.fiber])
  const nutrients = new Map()
  for (const row of csvObjects(read(root, 'food_nutrient.csv'))) {
    if (!foods.has(row.fdc_id) || !wanted.has(row.nutrient_id)) continue
    const amount = numberOrNull(row.amount)
    if (amount === null) continue
    let values = nutrients.get(row.fdc_id)
    if (!values) nutrients.set(row.fdc_id, (values = new Map()))
    if (!values.has(row.nutrient_id)) values.set(row.nutrient_id, amount)
  }

  const units = new Map()
  for (const row of csvObjects(read(root, 'measure_unit.csv'))) units.set(row.id, row.name)
  const portions = new Map()
  for (const row of csvObjects(read(root, 'food_portion.csv'))) {
    if (!foods.has(row.fdc_id)) continue
    const grams = numberOrNull(row.gram_weight)
    if (grams === null || grams <= 0) continue
    const label = portionLabel(row, units.get(row.measure_unit_id))
    if (!label || /^quantity not specified$/i.test(label)) continue
    const grams1 = round1(grams)
    if (grams1 <= 0) continue
    let list = portions.get(row.fdc_id)
    if (!list) portions.set(row.fdc_id, (list = []))
    if (!list.some((p) => p.label_en === label && p.grams === grams1)) list.push({ label_en: label, grams: grams1 })
  }

  const rows = []
  const dropped = { no_kcal: 0, no_macros: 0, negative_macro: 0 }
  const adjusted = { carbs_clamped: 0 }
  const ids = [...foods.keys()].sort((a, b) => Number(a) - Number(b))
  for (const fdcId of ids) {
    const food = foods.get(fdcId)
    const values = nutrients.get(fdcId)
    const kcal = pick(values, rules.kcal)
    if (kcal === null) {
      dropped.no_kcal++
      continue
    }
    const protein = pick(values, rules.protein)
    const carbs = pick(values, rules.carbs)
    const fat = pick(values, rules.fat)
    if (protein === null || carbs === null || fat === null) {
      dropped.no_macros++
      continue
    }
    const fiber = pick(values, rules.fiber)
    // Karbohidratet "by difference" dalin pak negative (-0.1…-0.7) te mishi dhe peshku të papërpunuar, nga zbritja e
    // lagështisë, proteinës, yndyrës dhe hirit. Deri në -1 g rrumbullakohen në 0 (e numëruar); më poshtë hiqet rreshti.
    if (carbs < 0 && carbs >= -CARBS_NEGATIVE_TOLERANCE) adjusted.carbs_clamped++
    else if (protein < 0 || carbs < 0 || fat < 0 || (fiber !== null && fiber < 0)) {
      dropped.negative_macro++
      continue
    }
    const row = {
      id: `usda-fdc-${fdcId}`,
      source,
      source_id: fdcId,
      license: LICENSE,
      name_en: food.description.trim(),
      food_group: groups.get(food.food_category_id) ?? null,
      kcal: round1(kcal),
      protein_g: round1(protein),
      carbs_g: round1(Math.max(carbs, 0)),
      fat_g: round1(fat),
      fiber_g: fiber === null ? null : round1(fiber),
      portions: portions.get(fdcId) ?? [],
      list_version: listVersion,
    }
    // Jashtë 15 % të 4·P + 4·K + 9·Y (alkooli, fibra, ushqime pa energji): hyn, por e shënuar (roja e shfaq).
    if (!kcalWithinTolerance(row)) row.kcal_flag = true
    rows.push(row)
  }
  return { rows, dropped, adjusted }
}
