import type { MealKey } from '@/nutrition/meals'
import { type DoseUnit, type Evidence, SUPPLEMENTS, supplementByName, type SupplementDef, type SupplementKind } from '@/nutrition/supplements'
import type { Macros } from '@/nutrition/targets'
import type { LocalStore } from './store'

// Suplementet (SPEC §10, TH-17): lista e planit shtohet një herë; çdo ditë ato dalin te vaktet e
// tyre si checklist (`supplement_logs`). Përdoruesi mund të çaktivizojë çdo suplement, dhe (V39,
// V2-E2-10) të shtojë, ndryshojë e heqë të vetët. Pluhuri i proteinës me makro për lugë dhe "Numëroje
// te ushqimi": "E mora" shton te vakti një regjistrim ushqimi (një ushqim `custom` me `source_id`
// "supplement:<id>"), një herë; heqja e shenjës e heq.

/** Një rresht i `supplements`; emri dhe doza si ruhen (ekrani i përkthen me `@/i18n/domain`). */
export interface Supplement extends Omit<SupplementDef, 'key'> {
  id: string
  enabled: boolean
  kind: SupplementKind | null
  /** Gramët e një luge (pluhurat). */
  scoopG: number | null
  /** Makrot për një lugë ose dozë; null pa to. */
  macros: Macros | null
  countsAsFood: boolean
  /** I shtuar nga përdoruesi (jo nga lista e §10): ndryshohet dhe hiqet. */
  custom: boolean
}

export interface SupplementInput {
  name: string
  kind: SupplementKind
  doseAmount: number
  doseUnit: DoseUnit
  scoopG: number | null
  timing: MealKey[]
  macros: Macros | null
  countsAsFood: boolean
}

const numberOr = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value))
const SUPPLEMENT_FOOD = 'supplement:'
/** Ushqimi i pluhurit të proteinës te plani i Jimit (data/nutrition.ts › templateFood). */
const PLAN_POWDER = 'jim:protein'

/** Një regjistrim nga "E mora" i një proteine që numërohet te ushqimi, sipas `source_id` të ushqimit. */
export const isSupplementSource = (sourceId: string | null | undefined) => !!sourceId && sourceId.startsWith(SUPPLEMENT_FOOD)

/** Ushqimet që shtoi "E mora" i një proteine që numërohet te ushqimi (jo një vakt i ngrënë). */
export async function supplementFoodIds(store: LocalStore): Promise<Set<string>> {
  const foods = await store.all('foods')
  return new Set(foods.filter((row) => row.source === 'custom' && isSupplementSource(row.source_id as string | null)).map((row) => row.id))
}

/**
 * Pluhuri i proteinës numërohet një herë në vakt (V39): nëse vakti ka pluhurin e planit, "E mora" nuk
 * shton rresht; nëse ka proteinën e përdoruesit, plani nuk shton pluhurin e tij.
 */
export async function mealPowder(store: LocalStore, date: string, meal: MealKey): Promise<{ plan: boolean; supplement: boolean }> {
  const entries = (await store.where('diary_entries', 'date', date)).filter((row) => row.meal === meal)
  const foods = await Promise.all(entries.map((row) => store.get('foods', String(row.food_id))))
  return {
    plan: foods.some((food) => food?.source === 'template' && food.source_id === PLAN_POWDER),
    supplement: foods.some((food) => food?.source === 'custom' && isSupplementSource(food.source_id as string | null)),
  }
}

/** Lista e §10, vetëm kur përdoruesi nuk ka asnjë suplement. */
export async function ensureSupplements(store: LocalStore) {
  if ((await store.all('supplements')).length > 0) return
  await store.insertMany(
    'supplements',
    SUPPLEMENTS.map((supplement, position) => ({
      name: supplement.name,
      dose_amount: supplement.doseAmount,
      dose_unit: supplement.doseUnit,
      timing: supplement.timing,
      evidence: supplement.evidence,
      enabled: true,
      position,
      notes: supplement.doseText,
    })),
  )
}

/** Suplementet me radhë; një emër i listës del një herë (p.sh. kur dy telefona e shtuan listën), ato të përdoruesit gjithnjë. */
export async function supplementList(store: LocalStore): Promise<Supplement[]> {
  const rows = (await store.all('supplements')).sort(
    (a, b) => Number(a.position) - Number(b.position) || String(a.created_at).localeCompare(String(b.created_at)),
  )
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    const name = String(row.name)
    // Suplementet e përdoruesit kanë llojin; një emër i listës nuk i bën të listës.
    const custom = (row.kind !== null && row.kind !== undefined) || !supplementByName(name)
    if (!custom && seen.has(name)) return []
    if (!custom) seen.add(name)
    const known = custom ? undefined : supplementByName(name)
    return [
      {
        id: row.id,
        name,
        doseAmount: Number(row.dose_amount ?? known?.doseAmount ?? 1),
        doseUnit: (row.dose_unit as Supplement['doseUnit']) ?? known?.doseUnit ?? 'dose',
        doseText: (row.notes as string | null) ?? known?.doseText ?? '',
        timing: (row.timing as MealKey[] | null) ?? [],
        evidence: (row.evidence as Evidence | null) ?? known?.evidence ?? 'unknown',
        enabled: row.enabled !== false,
        kind: (row.kind as SupplementKind | null) ?? null,
        scoopG: numberOr(row.scoop_g),
        macros:
          row.kcal === null || row.kcal === undefined
            ? null
            : { kcal: Number(row.kcal), proteinG: Number(row.protein_g ?? 0), carbsG: Number(row.carbs_g ?? 0), fatG: Number(row.fat_g ?? 0) },
        countsAsFood: row.counts_as_food === true,
        custom,
      },
    ]
  })
}

/** Një lugë ose dozë e suplementit si ushqim, në gramë; null kur nuk numërohet te ushqimi. */
function servingOf(supplement: Pick<Supplement, 'countsAsFood' | 'macros' | 'scoopG' | 'doseAmount' | 'doseUnit'>) {
  if (!supplement.countsAsFood || !supplement.macros || !supplement.scoopG) return null
  const scoops = supplement.doseUnit === 'scoop' ? supplement.doseAmount : 1
  return { grams: supplement.scoopG * scoops, scoops }
}

/** Ushqimi i suplementit (për 100 g), që regjistrimet e "E mora" ta kenë si burim. */
async function supplementFood(store: LocalStore, id: string, input: { name: string; scoopG: number; macros: Macros }) {
  const per100 = (value: number) => Math.round((value / input.scoopG) * 1000) / 10
  const [existing] = (await store.all('foods')).filter((row) => row.source === 'custom' && row.source_id === `${SUPPLEMENT_FOOD}${id}`)
  const row = await store.put('foods', {
    id: existing?.id,
    source: 'custom',
    source_id: `${SUPPLEMENT_FOOD}${id}`,
    name: input.name,
    kcal: per100(input.macros.kcal),
    protein_g: per100(input.macros.proteinG),
    carbs_g: per100(input.macros.carbsG),
    fat_g: per100(input.macros.fatG),
    serving_g: input.scoopG,
  })
  return row.id
}

/** Shton ose ndryshon një suplement të përdoruesit; kthen id-në. */
export async function saveSupplement(store: LocalStore, input: SupplementInput, id?: string): Promise<string> {
  const known = supplementByName(input.name.trim())
  const position = id ? undefined : (await store.all('supplements')).reduce((max, row) => Math.max(max, Number(row.position ?? 0)), 0) + 1
  const protein = input.kind === 'protein' && input.macros
  const row = await store.put('supplements', {
    id,
    name: input.name.trim(),
    kind: input.kind,
    dose_amount: input.doseAmount,
    dose_unit: input.doseUnit,
    scoop_g: input.scoopG,
    timing: input.timing,
    evidence: known?.evidence ?? null,
    kcal: protein ? input.macros!.kcal : null,
    protein_g: protein ? input.macros!.proteinG : null,
    carbs_g: protein ? input.macros!.carbsG : null,
    fat_g: protein ? input.macros!.fatG : null,
    counts_as_food: Boolean(protein && input.countsAsFood && input.scoopG),
    ...(position === undefined ? {} : { position, enabled: true, notes: null }),
  })
  if (protein && input.countsAsFood && input.scoopG) await supplementFood(store, row.id, { name: input.name.trim(), scoopG: input.scoopG, macros: input.macros! })
  return row.id
}

export async function removeSupplement(store: LocalStore, id: string) {
  await store.remove('supplements', id)
}

export async function setSupplementEnabled(store: LocalStore, id: string, enabled: boolean) {
  await store.put('supplements', { id, enabled })
}

/**
 * Shënon suplementin të marrë (ose e heq shenjën). Një pluhur proteine që numërohet te ushqimi shton
 * te vakti një regjistrim me makrot e tij, një herë dhe vetëm kur vakti nuk ka pluhurin e planit;
 * heqja e shenjës e heq. `amount`: sa doza (kutia e AI-së, "dy lugë"); pa të, një. Kthen rreshtat e krijuar.
 */
export async function setSupplementTaken(
  store: LocalStore,
  input: { date: string; supplementId: string; meal: MealKey; amount?: number },
  taken: boolean,
): Promise<{ log: string | null; diary: string | null }> {
  const doses = input.amount !== undefined && Number.isFinite(input.amount) && input.amount > 0 ? Math.round(input.amount * 100) / 100 : 1
  const logs = await store.where('supplement_logs', 'date', input.date)
  const existing = logs.find((row) => row.supplement_id === input.supplementId && row.timing === input.meal)
  const supplement = (await supplementList(store)).find((item) => item.id === input.supplementId)
  const serving = supplement ? servingOf(supplement) : null
  const foodId = serving && supplement ? await supplementFood(store, supplement.id, { name: supplement.name, scoopG: supplement.scoopG!, macros: supplement.macros! }) : null
  const entries = foodId ? (await store.where('diary_entries', 'date', input.date)).filter((row) => row.meal === input.meal && row.food_id === foodId) : []
  if (!taken) {
    if (existing) await store.remove('supplement_logs', existing.id)
    for (const row of entries) await store.remove('diary_entries', row.id)
    return { log: null, diary: null }
  }
  const log = existing
    ? null
    : (await store.put('supplement_logs', { date: input.date, supplement_id: input.supplementId, timing: input.meal, taken_at: store.now().toISOString(), ...(input.amount === undefined ? {} : { amount: doses }) })).id
  let diary: string | null = null
  if (foodId && serving && supplement && entries.length === 0 && !(await mealPowder(store, input.date, input.meal)).plan) {
    const round1 = (value: number) => Math.round(value * 10) / 10
    diary = (
      await store.put('diary_entries', {
        date: input.date,
        meal: input.meal,
        food_id: foodId,
        grams: round1(serving.grams * doses),
        kcal: round1(supplement.macros!.kcal * serving.scoops * doses),
        protein_g: round1(supplement.macros!.proteinG * serving.scoops * doses),
        carbs_g: round1(supplement.macros!.carbsG * serving.scoops * doses),
        fat_g: round1(supplement.macros!.fatG * serving.scoops * doses),
        logged_at: store.now().toISOString(),
      })
    ).id
  }
  return { log, diary }
}

/** Një prekje e shënon të marrë; një tjetër e heq. */
export async function toggleSupplement(store: LocalStore, input: { date: string; supplementId: string; meal: MealKey }) {
  const logs = await store.where('supplement_logs', 'date', input.date)
  const existing = logs.some((row) => row.supplement_id === input.supplementId && row.timing === input.meal)
  await setSupplementTaken(store, input, !existing)
}
