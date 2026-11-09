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

/** Suplementet me radhë; i njëjti emër del një herë (p.sh. kur dy telefona e shtuan listën). */
export async function supplementList(store: LocalStore): Promise<Supplement[]> {
  const rows = (await store.all('supplements')).sort(
    (a, b) => Number(a.position) - Number(b.position) || String(a.created_at).localeCompare(String(b.created_at)),
  )
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    const name = String(row.name)
    if (seen.has(name)) return []
    seen.add(name)
    const known = supplementByName(name)
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
        custom: !known,
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
 * te vakti një regjistrim me makrot e tij, një herë; heqja e shenjës e heq. Kthen rreshtat e krijuar.
 */
export async function setSupplementTaken(
  store: LocalStore,
  input: { date: string; supplementId: string; meal: MealKey },
  taken: boolean,
): Promise<{ log: string | null; diary: string | null }> {
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
  const log = existing ? null : (await store.put('supplement_logs', { date: input.date, supplement_id: input.supplementId, timing: input.meal, taken_at: store.now().toISOString() })).id
  let diary: string | null = null
  if (foodId && serving && supplement && entries.length === 0) {
    const round1 = (value: number) => Math.round(value * 10) / 10
    diary = (
      await store.put('diary_entries', {
        date: input.date,
        meal: input.meal,
        food_id: foodId,
        grams: round1(serving.grams),
        kcal: round1(supplement.macros!.kcal * serving.scoops),
        protein_g: round1(supplement.macros!.proteinG * serving.scoops),
        carbs_g: round1(supplement.macros!.carbsG * serving.scoops),
        fat_g: round1(supplement.macros!.fatG * serving.scoops),
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
