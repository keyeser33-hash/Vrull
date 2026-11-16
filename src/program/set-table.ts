import { type HistorySet, reference, type Reference } from './loads'
import type { LoggedSet } from './next-set'
import type { PlannedSlot } from './types'

// Tabela e seteve të një ushtrimi te seanca (SPEC §0.3g, V58; bordet "Seanca · seti 1", "· seti 3",
// "Pushimi · Zhbëj"), pa UI: një rresht për çdo set të slotit, me "Herën e kaluar" (seti me të njëjtin
// numër te referenca e §7, `reference`), setin e ruajtur, rreshtin aktiv (seti që regjistrohet tani, ose
// segmenti që pret) dhe setet që vijnë me peshën e propozuar (si `setDefaults`: pesha e setit të fundit të
// ruajtur të slotit, ose pesha e javës). Teknika (rest-pause, drop set, deri në dështim) del vetëm te seti
// i fundit i recetës.

export type SetRowState = 'saved' | 'active' | 'upcoming'

export interface SetRow<S extends LoggedSet = LoggedSet> {
  setNumber: number
  state: SetRowState
  /** Teknika e setit të fundit të recetës; null te të tjerët. */
  technique: 'rest_pause' | 'drop_set' | 'to_failure' | null
  /** Seti i ruajtur me këtë numër, edhe kur rreshti është aktiv për segmentin. */
  saved: S | null
  /** "Herën e kaluar": seti me të njëjtin numër te referenca e §7. */
  previous: Reference | null
  /** Pesha e setit të ruajtur; për të tjerët pesha e propozuar; null pa peshë. */
  weightKg: number | null
  /** Rreshti aktiv pret segmentin e setit të fundit (rest-pause, drop set). */
  segment: boolean
}

export function setTable<S extends LoggedSet>(input: {
  slot: PlannedSlot
  /** Setet e seancës (çdo slot); tabela merr ato të slotit. */
  sets: readonly S[]
  /** Numri i setit aktiv; null kur ushtrimi shihet pa u regjistruar tani (i bërë ose jo në radhë). */
  active: number | null
  segment: boolean
  weekWeightKg: number | null
  history: HistorySet[]
  /** Koordinatat e referencës së §7: ushtrimi, blloku, java dhe seanca e tanishme (jashtë referencës). */
  at: { exerciseId: string; blockPosition: number; week: number; sessionId: string }
}): SetRow<S>[] {
  const { slot, active, segment } = input
  const mine = input.sets.filter((set) => set.slotId === slot.slotId)
  const count = Math.max(slot.sets, ...mine.map((set) => set.setNumber))
  const technique = slot.technique.type === 'none' ? null : slot.technique.type
  const rows: SetRow<S>[] = []
  let weight = input.weekWeightKg && input.weekWeightKg > 0 ? input.weekWeightKg : null
  for (let setNumber = 1; setNumber <= count; setNumber++) {
    const saved = mine.find((set) => set.setNumber === setNumber) ?? null
    const isActive = active === setNumber && (saved === null || segment)
    if (saved) weight = saved.weightKg
    rows.push({
      setNumber,
      state: isActive ? 'active' : saved ? 'saved' : 'upcoming',
      technique: setNumber === slot.sets ? technique : null,
      saved,
      previous: reference(input.history, { ...input.at, setNumber }),
      weightKg: saved ? saved.weightKg : weight,
      segment: isActive && segment,
    })
  }
  return rows
}
