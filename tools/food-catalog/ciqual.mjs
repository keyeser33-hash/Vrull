// Leximi i tabelës Ciqual 2025 (ANSES, Francë) në rreshta të njëtrajtshëm për Listën e Vrullit.
// Burimi: https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY (alim, alim_grp, compo,
// const; XML i datuar 2025-11-03). Çdo rresht është për 100 g pjesë të ngrënshme; një rresht vjen vetëm nga Ciqual.
//
// Rregullat (dokumentimi zyrtar "Table Ciqual 2025 doc FR", §3.2 dhe §3.3):
//  - Energjia: konstanta 328 "Energy, Regulation EU No 1169/2011 (kcal/100g)" (§3.3.6: lipide 9, protein 4, glucide 4,
//    alkool 7, acide organike 3, polyole 2,4, fibra 2 kcal/g; proteina brute N×6,25). Nuk bie te 333 (N × Jones, me fibra):
//    dy mënyra llogaritjeje nuk përzihen brenda një burimi; një ushqim pa 328 hiqet.
//  - Proteina: 25003 "Protein, crude, N x 6.25", e njëjta bazë me 328; kur mungon, 25000 (N × Jones). Yndyra: 40000.
//  - Karbohidratet: 31000 "Carbohydrate": sipas rregullores glucidet NUK përfshijnë fibrat (§3.3.2), ndryshe nga USDA
//    "by difference"; vlera mbetet siç e botojnë ata (kcal_flag kap rastet me fibra të larta).
//  - Fibrat: 34100 "Fibres"; kur mungon, fibra është null (nuk hiqet rreshti).
//  - Vlerat e veçanta të `teneur` (§3.2.1–3.2.3): "-" = mungon (dokumentimi: "ne pas les assimiler à des zéros") → null;
//    "traces" (e zbuluar, e pamatshme) → 0; "< x" (nën kufirin e matjes x) → 0. Një makro që mungon e heq rreshtin;
//    numërohen te `adjusted` (traces_to_zero, below_limit_to_zero; vetëm për rreshtat që hyjnë). Numrat kanë presje dhjetore ("59,7").
//  - Emri: `alim_nom_eng` → name_en; `alim_nom_fr` → name_source kur ndryshon. Grupi: `alim_grp_nom_eng`.
//  - Ciqual nuk ka porcione: `portions` bosh.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flagKcal, nameSource, round1 } from './common.mjs'

export const SOURCE = 'ciqual'
export const LICENSE = 'etalab-2.0'

/** Kodet e përbërësve dhe emri anglisht që pritet te `const` (roja kundër ndryshimit të kodeve në një version të ri). */
export const CONSTITUENTS = {
  kcal: { code: '328', name: /Energy, Regulation EU No 1169\/2011 \(kcal\/100g\)/ },
  protein: { code: '25003', name: /^Protein, crude, N x 6\.25 \(g\/100g\)/ },
  proteinJones: { code: '25000', name: /^Protein \(g\/100g\)/ },
  carbs: { code: '31000', name: /^Carbohydrate \(g\/100g\)/ },
  fat: { code: '40000', name: /^Fat \(g\/100g\)/ },
  fiber: { code: '34100', name: /^Fibres \(g\/100g\)/ },
}

const decode = (text) =>
  text.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (_, name, dec, hex) =>
    name ? { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name] : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)),
  )

/** Teksti i një etikete (`<x> a </x>` → "a"); etiketa bosh me `missing=" "` kthen null. */
function tag(block, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(block)
  if (!match) return null
  const text = decode(match[1]).trim()
  return text === '' ? null : text
}

function* records(xml, element) {
  for (const match of xml.matchAll(new RegExp(`<${element}>([\\s\\S]*?)</${element}>`, 'g'))) yield match[1]
}

/**
 * Vlera e një `teneur`: { value, kind } ku kind është 'number', 'traces', 'below_limit' ose 'missing'.
 * "traces" dhe "< x" kthehen 0 (shih rregullat lart); "-" ose bosh = mungon.
 */
export function parseTeneur(text) {
  if (text == null) return { value: null, kind: 'missing' }
  const clean = text.trim()
  if (clean === '' || clean === '-') return { value: null, kind: 'missing' }
  if (/^traces?$/i.test(clean)) return { value: 0, kind: 'traces' }
  if (/^<\s*[\d.,]+$/.test(clean)) return { value: 0, kind: 'below_limit' }
  const number = Number(clean.replace(/\s/g, '').replace(',', '.'))
  return /^[\d\s]+(?:[.,]\d+)?$/.test(clean) && Number.isFinite(number) ? { value: number, kind: 'number' } : { value: null, kind: 'missing' }
}

const findFile = (dir, pattern) => {
  const name = readdirSync(dir).find((entry) => pattern.test(entry))
  if (!name) throw new Error(`Nuk gjeta ${pattern} te ${dir}`)
  return join(dir, name)
}

/** Lexon Ciqual nga dosja me alim_*.xml, alim_grp_*.xml, compo_*.xml, const_*.xml. Kthen { rows, dropped, adjusted }. */
export function readCiqual(dir, listVersion = 1) {
  const constXml = readFileSync(findFile(dir, /^const_.*\.xml$/), 'utf8')
  const constNames = new Map([...records(constXml, 'CONST')].map((block) => [tag(block, 'const_code'), tag(block, 'const_nom_eng')]))
  for (const [key, { code, name }] of Object.entries(CONSTITUENTS)) {
    if (!name.test(constNames.get(code) ?? '')) throw new Error(`Ciqual: konstanta ${key} (${code}) nuk është më "${name}", por "${constNames.get(code)}"`)
  }
  const wanted = new Map(Object.entries(CONSTITUENTS).map(([key, { code }]) => [code, key]))

  const groups = new Map()
  for (const block of records(readFileSync(findFile(dir, /^alim_grp_.*\.xml$/), 'utf8'), 'ALIM_GRP')) {
    const code = tag(block, 'alim_grp_code')
    if (code && !groups.has(code)) groups.set(code, tag(block, 'alim_grp_nom_eng'))
  }

  const adjusted = { traces_to_zero: 0, below_limit_to_zero: 0 }
  const values = new Map()
  for (const block of records(readFileSync(findFile(dir, /^compo_.*\.xml$/), 'utf8'), 'COMPO')) {
    const key = wanted.get(tag(block, 'const_code'))
    if (!key) continue
    const code = tag(block, 'alim_code')
    let entry = values.get(code)
    if (!entry) values.set(code, (entry = {}))
    entry[key] = parseTeneur(tag(block, 'teneur'))
  }

  const rows = []
  const dropped = { no_kcal: 0, no_macros: 0, no_name: 0 }
  const foods = [...records(readFileSync(findFile(dir, /^alim_\d.*\.xml$/), 'utf8'), 'ALIM')].map((block) => ({
    code: tag(block, 'alim_code'),
    nameEn: tag(block, 'alim_nom_eng'),
    nameFr: tag(block, 'alim_nom_fr'),
    group: tag(block, 'alim_grp_code'),
  }))
  foods.sort((a, b) => Number(a.code) - Number(b.code))
  for (const food of foods) {
    const entry = values.get(food.code) ?? {}
    const tally = { traces_to_zero: 0, below_limit_to_zero: 0 }
    const note = (item) => {
      if (item?.kind === 'traces') tally.traces_to_zero++
      else if (item?.kind === 'below_limit') tally.below_limit_to_zero++
      return item?.value ?? null
    }
    const kcal = note(entry.kcal)
    if (kcal === null) {
      dropped.no_kcal++
      continue
    }
    const protein = note(entry.protein) ?? note(entry.proteinJones)
    const carbs = note(entry.carbs)
    const fat = note(entry.fat)
    if (protein === null || carbs === null || fat === null) {
      dropped.no_macros++
      continue
    }
    const fiber = note(entry.fiber)
    if (!food.nameEn) {
      dropped.no_name++
      continue
    }
    const row = {
      id: `ciqual-${food.code}`,
      source: SOURCE,
      source_id: food.code,
      license: LICENSE,
      name_en: food.nameEn,
      name_source: nameSource(food.nameFr, food.nameEn),
      food_group: groups.get(food.group) ?? null,
      kcal: round1(kcal),
      protein_g: round1(protein),
      carbs_g: round1(carbs),
      fat_g: round1(fat),
      fiber_g: fiber === null ? null : round1(fiber),
      portions: [],
      list_version: listVersion,
    }
    adjusted.traces_to_zero += tally.traces_to_zero
    adjusted.below_limit_to_zero += tally.below_limit_to_zero
    rows.push(flagKcal(row))
  }
  return { rows, dropped, adjusted }
}
