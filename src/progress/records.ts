import { e1rm, e1rmRecord, type HistorySet, personalRecords, recordThreshold } from '@/program/loads'
import { type ExerciseRecord, sessionRecords } from './history'

// Rekordi te seanca (SPEC §0.3a, §6; V2-E1-07), mbi funksionet e progresit (E1-04) dhe të
// historikut (E1-15): pragu që ekrani i setit thotë me peshën e zgjedhur, rekordi i setit në moment
// dhe rekordet e një seance kundrejt historisë para saj.

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

export type SetRecordResult =
  | { kind: 'e1rm'; e1rmKg: number; previousBestKg: number; gainKg: number }
  | { kind: 'weight'; weightKg: number; reps: number }

/**
 * Rekordi i një seti në moment (§6): e1RM më e lartë, ose pesha më e madhe për këto përsëritje.
 * Rekordi i e1RM-së kërkon një e1RM të mëparshme për të kaluar (`e1rmRecord`): ushtrimi pa e1RM (p.sh.
 * pulpat me 30 përsëritje) nuk merr "rekord +105 kg" me e1RM-në e parë.
 */
export function setRecord(set: HistorySet, history: HistorySet[]): SetRecordResult | null {
  const gain = e1rmRecord(set, history)
  if (gain) return { kind: 'e1rm', ...gain }
  return personalRecords(set, history).weightForReps && set.weightKg && set.reps ? { kind: 'weight', weightKg: set.weightKg, reps: set.reps } : null
}

export const isRecord = (set: HistorySet, history: HistorySet[]) => setRecord(set, history) !== null

/**
 * Rekordet e seancës (`sessionRecords` i historikut: seti më i mirë që theu rekord, kundrejt më të
 * mirit para seancës); më i madhi i pari.
 */
export function sessionBests(history: HistorySet[], sessionId: string): ExerciseRecord[] {
  return sessionRecords(history, sessionId).sort((a, b) => b.gainKg - a.gainKg)
}
