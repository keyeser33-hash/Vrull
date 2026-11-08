import { e1rm, e1rmRecord, type HistorySet, personalRecords, recordThreshold } from './loads'

// Rekordi te seanca (SPEC §0.3a, §6; V2-E1-07), mbi funksionet e progresit (E1-04): pragu që
// ekrani i setit thotë me peshën e zgjedhur dhe rekordet e një seance kundrejt historisë para saj.

export type RecordHint =
  /** "12 përsëritje të japin rekord të ri: e1RM 87,5 kg". */
  | { kind: 'reps'; reps: number; e1rmKg: number }
  /** Pragu bie nën minimumin: çdo set i intervalit jep rekord; e1RM-ja me minimumin. */
  | { kind: 'any'; reps: number; e1rmKg: number }

/**
 * Pragu i rekordit për peshën e zgjedhur (`recordThreshold`). Kur bie nën kufirin e poshtëm,
 * ekrani nuk e fsheh: thotë që çdo set i intervalit jep rekord, por vetëm kur gjithë intervali jep
 * e1RM (deri në 15 përsëritje). Null pa e1RM të mëparshme, pa peshë, me përsëritje të lira, ose kur
 * do të duheshin më shumë se 2 përsëritje mbi kufirin e sipërm.
 */
export function recordHint(history: HistorySet[], at: { exerciseId: string; weightKg: number; min: number; max: number | null }): RecordHint | null {
  if (at.weightKg <= 0 || at.min < 1) return null
  const top = at.max ?? at.min
  const found = recordThreshold(history, { exerciseId: at.exerciseId, weightKg: at.weightKg, min: 1, max: top })
  if (!found) return null
  if (found.reps >= at.min) return { kind: 'reps', ...found }
  const atMin = e1rm(at.weightKg, at.min)
  return top <= 15 && atMin !== null ? { kind: 'any', reps: at.min, e1rmKg: atMin } : null
}

export interface SessionRecord {
  exerciseId: string
  setId: string
  setNumber: number
  weightKg: number
  reps: number
  e1rmKg: number
  previousBestKg: number
  gainKg: number
}

const setE1rm = (set: HistorySet) => (set.isWarmup ? null : e1rm(set.weightKg, set.reps, set.rir))

/**
 * Rekordi i e1RM-së (`e1rmRecord`), vetëm kur ka një e1RM të mëparshme për të kaluar: si te pragu,
 * ushtrimi pa e1RM (p.sh. pulpat me 30 përsëritje) nuk jep "rekord +105 kg" me e1RM-në e parë.
 */
function e1rmGain(set: HistorySet, history: HistorySet[]) {
  const record = e1rmRecord(set, history)
  return record && record.previousBestKg > 0 ? record : null
}

export type SetRecordResult =
  | { kind: 'e1rm'; e1rmKg: number; previousBestKg: number; gainKg: number }
  | { kind: 'weight'; weightKg: number; reps: number }

/** Rekordi i një seti në moment (§6): e1RM më e lartë, ose pesha më e madhe për këto përsëritje. */
export function setRecord(set: HistorySet, history: HistorySet[]): SetRecordResult | null {
  const gain = e1rmGain(set, history)
  if (gain) return { kind: 'e1rm', ...gain }
  return personalRecords(set, history).weightForReps && set.weightKg && set.reps ? { kind: 'weight', weightKg: set.weightKg, reps: set.reps } : null
}

export const isRecord = (set: HistorySet, history: HistorySet[]) => setRecord(set, history) !== null

/**
 * Rekordet e e1RM-së të një seance: për çdo ushtrim, seti më i mirë i seancës kundrejt historisë
 * para saj. Ushtrimi i bërë për herë të parë, ose pa e1RM të mëparshme, nuk jep rekord. Më i madhi i pari.
 */
export function sessionRecords(history: HistorySet[], sessionId: string): SessionRecord[] {
  const mine = history.filter((set) => set.sessionId === sessionId)
  const records: SessionRecord[] = []
  for (const exerciseId of new Set(mine.map((set) => set.exerciseId))) {
    let best: HistorySet | null = null
    for (const set of mine.filter((candidate) => candidate.exerciseId === exerciseId)) {
      if ((setE1rm(set) ?? 0) > (best ? (setE1rm(best) ?? 0) : 0)) best = set
    }
    if (!best) continue
    const before = history.filter((set) => set.exerciseId === exerciseId && set.sessionId !== sessionId)
    const record = e1rmGain(best, before)
    if (record) {
      records.push({ exerciseId, setId: best.id, setNumber: best.setNumber, weightKg: best.weightKg!, reps: best.reps!, ...record })
    }
  }
  return records.sort((a, b) => b.gainKg - a.gainKg)
}
