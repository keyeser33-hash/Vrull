import type { MealKey } from '@/nutrition/meals'
import { type Evidence, EVIDENCE_LABEL, SUPPLEMENTS, type SupplementDef } from '@/nutrition/supplements'
import type { LocalStore } from './store'

// Suplementet (SPEC §10, TH-17): lista e planit shtohet një herë; çdo ditë ato dalin te vaktet e
// tyre si checklist (`supplement_logs`). Përdoruesi mund të çaktivizojë çdo suplement.

export interface Supplement extends SupplementDef {
  id: string
  enabled: boolean
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
    const known = SUPPLEMENTS.find((supplement) => supplement.name === name)
    const evidence = (row.evidence as Evidence | null) ?? known?.evidence ?? 'weak'
    return [
      {
        id: row.id,
        name,
        doseAmount: Number(row.dose_amount ?? known?.doseAmount ?? 1),
        doseUnit: (row.dose_unit as Supplement['doseUnit']) ?? known?.doseUnit ?? 'dose',
        doseText: (row.notes as string | null) ?? known?.doseText ?? '',
        timing: (row.timing as MealKey[] | null) ?? [],
        evidence,
        evidenceText: known?.evidenceText ?? EVIDENCE_LABEL[evidence],
        enabled: row.enabled !== false,
      },
    ]
  })
}

export async function setSupplementEnabled(store: LocalStore, id: string, enabled: boolean) {
  await store.put('supplements', { id, enabled })
}

/** Një prekje e shënon të marrë; një tjetër e heq. */
export async function toggleSupplement(store: LocalStore, input: { date: string; supplementId: string; meal: MealKey }) {
  const logs = await store.where('supplement_logs', 'date', input.date)
  const existing = logs.find((row) => row.supplement_id === input.supplementId && row.timing === input.meal)
  if (existing) await store.remove('supplement_logs', existing.id)
  else await store.put('supplement_logs', { date: input.date, supplement_id: input.supplementId, timing: input.meal, taken_at: store.now().toISOString() })
}
