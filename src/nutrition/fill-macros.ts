import type { PortionUnit } from './jim'
import type { Macros } from './targets'

// Plotëso makrot (V2-E3-28c, SPEC §0.3h, GLOSSARY): propozime për proteinën që mbetet nga një listë ushqimesh, pa AI dhe
// pa rrjet. Çdo propozim ka 1–2 ushqime në porcione të plota (një lugë, një gotë, një kanoçe; pa porcion, hapa 10 g) dhe
// nuk kalon kalorit që mbeten. Renditja: sa e mbush proteinën, pastaj më pak kalori; deri në 3 propozime, secili me një
// ushqim kryesor tjetër. Pa UI dhe pa bazë; burimet i mbledh `data/fill-foods.ts`.

export type FillSource = 'supplement' | 'plan' | 'own'

/** Një ushqim që mund të propozohet: vlerat për 100 g dhe njësia e një porcioni. */
export interface FillFood {
  foodId: string
  name: string
  source: FillSource
  /** `foods.source_id`, që emri i ushqimeve të planit të përkthehet (`foodName`). */
  sourceId: string | null
  per100: Macros
  /** Gramët e një porcioni (1 lugë, 1 gotë, 1 kanoçe); pa të, shtohet me hapa 10 g. */
  servingG: number | null
  servingLabel: string | null
  /** Njësia e planit (`cup`, `slice`…), që numri të shkruhet si te Plani im; null për ushqimet e tjera. */
  unit: PortionUnit | null
}

export interface FillItem {
  food: FillFood
  /** Sa porcione (ose hapa 10 g). */
  count: number
  grams: number
  kcal: number
  proteinG: number
}

export interface FillProposal {
  items: FillItem[]
  kcal: number
  proteinG: number
  /** Pjesa e proteinës që mbetet dhe që mbushet, 0–1. */
  coverage: number
  /** Kalorit që mbeten pas propozimit (jo negative). */
  kcalLeft: number
  /** Burimi i ushqimit kryesor. */
  source: FillSource
}

/** ok: ka propozime ose nuk futet asnjë ushqim; proteinDone: proteina u mbush; noKcal: s'ka kalori; noFoods: s'ka ushqime. */
export type FillStatus = 'ok' | 'proteinDone' | 'noKcal' | 'noFoods'

export interface FillResult {
  status: FillStatus
  proposals: FillProposal[]
}

export const MAX_PROPOSALS = 3
/** Hapi i ushqimeve pa porcion. */
export const STEP_GRAMS = 10
/** Kufijtë e numrit të porcioneve (ushqimi kryesor, ushqimi i dytë), që kërkimi të mbetet i shpejtë. */
const MAX_MAIN = 30
const MAX_SECOND = 12
/** Sa mbi proteinën që mbetet lejohet një propozim (bordi: 2 kanoçe ton me 74 g nuk propozohen kur mbeten 46 g). */
export const OVERSHOOT = 1.25
const EPS = 1e-9

interface Option {
  food: FillFood
  unitG: number
  unitKcal: number
  unitProtein: number
}

const finite = (value: number) => Number.isFinite(value)
const round2 = (value: number) => Math.round(value * 100) / 100

function optionOf(food: FillFood): Option | null {
  const { kcal, proteinG } = food.per100
  if (!finite(kcal) || !finite(proteinG) || kcal < 0 || proteinG <= 0) return null
  const unitG = food.servingG !== null && finite(food.servingG) && food.servingG > 0 ? food.servingG : STEP_GRAMS
  return { food, unitG, unitKcal: (kcal * unitG) / 100, unitProtein: (proteinG * unitG) / 100 }
}

const itemOf = (option: Option, count: number): FillItem => ({
  food: option.food,
  count,
  grams: round2(option.unitG * count),
  kcal: option.unitKcal * count,
  proteinG: option.unitProtein * count,
})

/**
 * Numri më i madh i porcioneve që futet në kalori dhe nuk e kalon proteinën e nevojshme më shumë se `OVERSHOOT`.
 * Porcioni i parë lejohet gjithmonë kur futet në kalori (një lugë për 10 g proteinë që mbeten); më shumë se ai që e mbush
 * proteinën nuk ka kuptim. `ceiling` është proteina më e madhe që lejohet për këtë ushqim.
 */
function maxCount(option: Option, kcalLeft: number, proteinLeft: number, ceiling: number, cap: number, atLeastOne: boolean): number {
  const affordable = option.unitKcal <= EPS ? cap : Math.floor((kcalLeft + EPS) / option.unitKcal)
  const needed = Math.ceil(proteinLeft / option.unitProtein - EPS)
  const allowed = Math.floor(ceiling / option.unitProtein + EPS)
  return Math.max(0, Math.min(affordable, needed, atLeastOne ? Math.max(1, allowed) : allowed, cap))
}

interface Candidate {
  items: FillItem[]
  kcal: number
  proteinG: number
  coverage: number
}

/** Mbulimi i rrumbullakosur në 1 %, që dy propozime pothuajse të barabarta të ndahen nga kaloritë. */
const percent = (candidate: Candidate) => Math.round(candidate.coverage * 100)

/** Më e mira është ajo që mbush më shumë proteinë, pastaj ajo me më pak kalori. */
const better = (a: Candidate, b: Candidate) => percent(a) > percent(b) || (percent(a) === percent(b) && a.kcal < b.kcal - EPS)

function candidate(items: FillItem[], proteinLeft: number): Candidate {
  const proteinG = items.reduce((sum, item) => sum + item.proteinG, 0)
  return { items, kcal: items.reduce((sum, item) => sum + item.kcal, 0), proteinG, coverage: Math.min(1, proteinG / proteinLeft) }
}

export function fillMacros(left: { proteinG: number; kcal: number }, foods: readonly FillFood[]): FillResult {
  if (!finite(left.proteinG) || left.proteinG <= EPS) return { status: 'proteinDone', proposals: [] }
  if (!finite(left.kcal) || left.kcal <= EPS) return { status: 'noKcal', proposals: [] }
  const seen = new Set<string>()
  const options = foods.flatMap((food) => {
    if (seen.has(food.foodId)) return []
    seen.add(food.foodId)
    const option = optionOf(food)
    return option ? [option] : []
  })
  if (foods.length === 0) return { status: 'noFoods', proposals: [] }

  const proteinLeft = left.proteinG
  // Më i miri për çdo ushqim kryesor (një propozim për ushqim).
  const bestByMain = new Map<string, Candidate>()
  const keep = (main: Option, entry: Candidate) => {
    const current = bestByMain.get(main.food.foodId)
    if (!current || better(entry, current)) bestByMain.set(main.food.foodId, entry)
  }

  for (const main of options) {
    const mostMain = maxCount(main, left.kcal, proteinLeft, proteinLeft * OVERSHOOT, MAX_MAIN, true)
    if (mostMain < 1) continue
    // Vetëm: sa më shumë porcione që futen, por jo më shumë se sa e mbushin proteinën.
    const single = candidate([itemOf(main, mostMain)], proteinLeft)
    keep(main, single)
    if (single.coverage >= 1 - EPS) {
      // Një ushqim që e mbush vetë nuk ka nevojë për të dytin, por një numër më i vogël porcionesh me një shtesë
      // mund të kushtojë më pak kalori; kjo shmanget që propozimi të mos bëhet i çuditshëm.
      continue
    }
    for (const second of options) {
      if (second.food.foodId === main.food.foodId) continue
      for (let k1 = 1; k1 <= mostMain; k1++) {
        const rest = left.kcal - main.unitKcal * k1
        const proteinRest = proteinLeft - main.unitProtein * k1
        const mostSecond = maxCount(second, rest, Math.max(proteinRest, EPS), proteinLeft * OVERSHOOT - main.unitProtein * k1, MAX_SECOND, false)
        for (let k2 = 1; k2 <= mostSecond; k2++) {
          const items = [itemOf(main, k1), itemOf(second, k2)]
          // Ushqimi kryesor është ai me më shumë proteinë në propozim.
          if (items[1].proteinG > items[0].proteinG + EPS) continue
          const pair = candidate(items, proteinLeft)
          if (pair.kcal > left.kcal + EPS) continue
          // Të dytin e shton vetëm kur e rrit mbulimin me të paktën 1 %.
          if (percent(pair) < percent(single) + 1) continue
          keep(main, pair)
        }
      }
    }
  }

  // Ushqimi i dytë mund të ketë më shumë proteinë se i pari te lista; ushqimi kryesor është gjithmonë `items[0]`.
  const proposals = [...bestByMain.values()]
    .sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0))
    .slice(0, MAX_PROPOSALS)
    .map((entry): FillProposal => ({ items: entry.items, kcal: entry.kcal, proteinG: entry.proteinG, coverage: entry.coverage, kcalLeft: Math.max(0, left.kcal - entry.kcal), source: entry.items[0].food.source }))
  return { status: 'ok', proposals }
}
