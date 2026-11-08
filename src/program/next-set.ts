import type { PlannedSlot, SessionPlan, Technique } from './types'

// Seti i radhës i seancës dhe vlerat e tij të propozuara (V2-E1-07): pesha, përsëritjet ose sekondat
// dhe RIR-i. Ekrani i seancës dhe njoftimi i seancës (V2-E1-08) i marrin nga këtu, që të propozojnë
// gjithnjë të njëjtën gjë. Pesha e setit të parë është pesha e javës (`workoutWeights`), që e jep thirrësi.

/** Një set i ruajtur i seancës, me fushat që i duhen propozimit. */
export interface LoggedSet {
  id: string
  slotId: string | null
  setNumber: number
  weightKg: number | null
  reps: number | null
  seconds: number | null
  rir: number | null
  technique: Technique['type']
  segments: readonly { weightKg: number | null; reps: number }[]
}

export interface SetValues {
  weightKg: number
  reps: number | null
  seconds: number | null
  rir: number | null
}

/**
 * Seti i fundit i seancës, kur është seti i fundit i slotit me rest-pause ose drop set dhe s'ka
 * ende segmentin e vet: seanca pret segmentin para setit tjetër.
 */
export function pendingSegment<S extends LoggedSet>(plan: Pick<SessionPlan, 'slots'>, sets: readonly S[]): { set: S; slot: PlannedSlot } | null {
  const set = sets.at(-1)
  const slot = set ? plan.slots.find((candidate) => candidate.slotId === set.slotId) : undefined
  if (!set || !slot) return null
  const waits = set.setNumber === slot.sets && set.segments.length === 0 && (set.technique === 'rest_pause' || set.technique === 'drop_set')
  return waits ? { set, slot } : null
}

/**
 * Vlerat e propozuara të një seti: seti i parë i ushtrimit merr peshën e javës dhe kufirin e poshtëm
 * të intervalit; setet e tjera mbajnë peshën, përsëritjet, sekondat dhe RIR-in e setit të mëparshëm
 * të slotit në këtë seancë. Pa peshë jave pesha mbetet 0, që përdoruesi ta zgjedhë.
 */
export function setDefaults(slot: PlannedSlot, lastInSlot: LoggedSet | undefined, weekWeightKg: number | null): SetValues {
  const { target } = slot
  return {
    weightKg: lastInSlot ? (lastInSlot.weightKg ?? 0) : (weekWeightKg ?? 0),
    reps: lastInSlot?.reps ?? (target.kind === 'reps' ? Math.max(target.min, 1) : target.kind === 'timed' ? null : target.reps),
    seconds: target.kind === 'timed' ? (lastInSlot?.seconds ?? target.seconds) : null,
    rir: target.kind === 'reps' && target.rir ? (lastInSlot?.rir ?? target.rir.min) : null,
  }
}

/**
 * Segmenti i setit të fundit: rest-pause me të njëjtën peshë, drop set me peshën e uljes kur dihet
 * (`dropWeight`); përsëritjet, një e treta e setit, të paktën 1.
 */
export function segmentDefaults(set: LoggedSet, dropToKg: number | null): SetValues {
  return {
    weightKg: set.technique === 'drop_set' ? (dropToKg ?? set.weightKg ?? 0) : (set.weightKg ?? 0),
    reps: Math.max(1, Math.round((set.reps ?? 3) / 3)),
    seconds: null,
    rir: null,
  }
}
