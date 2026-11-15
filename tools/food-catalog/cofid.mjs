// Leximi i McCance and Widdowson's The Composition of Foods Integrated Dataset 2021 (CoFID, Public Health England,
// 19.03.2021) në rreshta të njëtrajtshëm për Listën e Vrullit. Çdo rresht është për 100 g; vlerat vijnë vetëm nga CoFID.
// Burimi: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid (Excel, fleta "1.3 Proximates").
//
// Rregullat (dokumenti "McCance and Widdowson's The Composition of Foods integrated dataset 2021", "Details of nutrient data"):
//  - Kolonat sipas etiketës te rreshti 2 i fletës: PROT (proteina), FAT, CHO (karbohidrat të disponueshëm, në ekuivalent
//    monosaharidi, pa fibrat; nuk janë "by difference"), KCALS (energjia), AOACFIB (fibra AOAC). Një etiketë që mungon është gabim.
//  - Energjia: KCALS, e llogaritur me proteinë 4, yndyrë 9, karbohidrat të disponueshëm 3,75 (monosaharid) dhe alkool 7 kcal/g.
//    Nuk përdoret kJ.
//  - Fibrat: vetëm AOAC fibre (përfshin niseshtenë rezistente dhe lignin, afër "total dietary fibre"); NSP (Englyst) është metodë
//    tjetër dhe nuk e zëvendëson: pa AOAC fibra është null.
//  - Vlerat e veçanta ("Notes", fleta 1.1): "Tr" = gjurmë → 0; "N" = përbërësi është i pranishëm në sasi të rëndësishme, por pa
//    vlerë të besueshme → i munguar (null), jo 0; qelizë bosh = i munguar. Një makro ose energji e munguar e heq rreshtin.
//    Vlerat vijnë si tekst ("76.7") ose numër.
//  - Karbohidratet janë në ekuivalent monosaharidi (saharoza 100 g = 105,3 g glukozë, dokumenti "Factors"): sheqeri dhe
//    ushqimet pothuajse të pastra del deri në 105 g për 100 g. Mbi 100 e deri në 106 g rrumbullakohet në 100 (e numëruar,
//    `carbs_clamped`); mbi 106 hiqet rreshti (`carbs_over_limit`).
//  - Pijet alkoolike (grupi Q: birra, mollë, verëra, alkoole) botohen për 100 ml, jo 100 g (Notes): hiqen (`per_100ml`), pa
//    konvertim me peshën specifike (mungon për gjysmën).
//  - Dy ushqime me të njëjtin kod (13-669) janë gabim në burim: të dyja hiqen (`duplicate_code`).
//  - Emrat: "Food Name" është anglishte britanike (name_en); name_source null. Grupi: shkronja e parë e kodit të grupit,
//    emri sipas Appendix B të dokumentit. CoFID nuk ka porcione: `portions` bosh.
import { flagKcal, round1 } from './common.mjs'
import { readSheet } from './xlsx.mjs'

export const SOURCE = 'cofid'
export const LICENSE = 'OGL-3.0'
export const SHEET = '1.3 Proximates'
export const CARBS_MONOSACCHARIDE_LIMIT = 106
const TAGS = { protein: 'PROT', fat: 'FAT', carbs: 'CHO', kcal: 'KCALS', fiber: 'AOACFIB' }

/** Grupet kryesore (shkronja e parë e kodit), nga Appendix B i dokumentit. */
export const GROUPS = {
  A: 'Cereals and cereal products',
  B: 'Milk and milk products',
  C: 'Eggs',
  D: 'Vegetables',
  F: 'Fruit',
  G: 'Nuts and seeds',
  H: 'Herbs and spices',
  J: 'Fish and fish products',
  M: 'Meat and meat products',
  O: 'Fats and oils',
  P: 'Beverages',
  Q: 'Alcoholic beverages',
  S: 'Sugars, preserves and snacks',
  W: 'Soups, sauces and miscellaneous foods',
}

/** Vlera e një qelize: { value, kind } ku kind është 'number', 'trace', 'no_value' (N) ose 'missing'. */
export function parseValue(cell) {
  if (cell === undefined || cell === null) return { value: null, kind: 'missing' }
  if (typeof cell === 'number') return Number.isFinite(cell) ? { value: cell, kind: 'number' } : { value: null, kind: 'missing' }
  const text = String(cell).trim()
  if (text === '') return { value: null, kind: 'missing' }
  if (text === 'Tr') return { value: 0, kind: 'trace' }
  if (text === 'N') return { value: null, kind: 'no_value' }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { value: Number(text), kind: 'number' }
  return { value: null, kind: 'missing' }
}

/** Lexon skedarin XLSX të CoFID (rruga e skedarit). Kthen { rows, dropped, adjusted }. */
export function readCofid(file, listVersion = 1) {
  const sheet = readSheet(file, SHEET)
  const tags = sheet.find((entry) => entry.row === 2)?.cells ?? {}
  const column = {}
  for (const [key, tag] of Object.entries(TAGS)) {
    column[key] = Object.keys(tags).find((letter) => tags[letter] === tag)
    if (!column[key]) throw new Error(`CoFID: etiketa ${tag} nuk është te rreshti 2 i fletës ${SHEET}`)
  }
  const data = sheet.filter((entry) => entry.row >= 4 && entry.cells.A)

  const counts = new Map()
  for (const entry of data) counts.set(entry.cells.A, (counts.get(entry.cells.A) ?? 0) + 1)

  const rows = []
  const dropped = { no_kcal: 0, no_macros: 0, per_100ml: 0, duplicate_code: 0, carbs_over_limit: 0 }
  const adjusted = { trace_to_zero: 0, carbs_clamped: 0 }
  for (const entry of data) {
    const cells = entry.cells
    const code = String(cells.A).trim()
    if (counts.get(cells.A) > 1) {
      dropped.duplicate_code++
      continue
    }
    const letter = String(cells.D ?? '')[0] ?? ''
    if (letter === 'Q') {
      dropped.per_100ml++
      continue
    }
    const parsed = Object.fromEntries(Object.keys(TAGS).map((key) => [key, parseValue(cells[column[key]])]))
    if (parsed.kcal.value === null) {
      dropped.no_kcal++
      continue
    }
    if (parsed.protein.value === null || parsed.carbs.value === null || parsed.fat.value === null) {
      dropped.no_macros++
      continue
    }
    if (parsed.carbs.value > CARBS_MONOSACCHARIDE_LIMIT) {
      dropped.carbs_over_limit++
      continue
    }
    if (parsed.carbs.value > 100) adjusted.carbs_clamped++
    for (const item of Object.values(parsed)) if (item.kind === 'trace') adjusted.trace_to_zero++
    const name = String(cells.B ?? '').trim()
    const row = {
      id: `cofid-${code.toLowerCase()}`,
      source: SOURCE,
      source_id: code,
      license: LICENSE,
      name_en: name,
      name_source: null,
      food_group: GROUPS[letter] ?? null,
      kcal: round1(parsed.kcal.value),
      protein_g: round1(parsed.protein.value),
      carbs_g: round1(Math.min(parsed.carbs.value, 100)),
      fat_g: round1(parsed.fat.value),
      fiber_g: parsed.fiber.value === null ? null : round1(parsed.fiber.value),
      portions: [],
      list_version: listVersion,
    }
    rows.push(flagKcal(row))
  }
  return { rows, dropped, adjusted }
}
