import { e1rm, type HistorySet } from '@/program/loads'

// Faqja e ushtrimit (V2-E1-09, bordi "Ushtrimi"): "Rekordet e tua", grafiku i e1RM-së sipas javës së
// programit dhe historia e seteve. e1RM sipas §7 (Epley, 1–15 përsëritje, pa ngrohjet).

export interface WeekE1rm {
  run: number
  blockPosition: number
  blockName: string
  blockWeeks: number
  week: number
  e1rmKg: number
  /** Koha e setit të parë të javës, për radhën. */
  at: string
}

const work = (history: HistorySet[], exerciseId: string) =>
  history.filter((set) => set.exerciseId === exerciseId && !set.isWarmup).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))

/** e1RM më e mirë e çdo jave të programit (xhiroja, blloku, java), me radhën kohore. */
export function e1rmByWeek(history: HistorySet[], exerciseId: string): WeekE1rm[] {
  const weeks = new Map<string, WeekE1rm>()
  for (const set of work(history, exerciseId)) {
    const value = e1rm(set.weightKg, set.reps, set.rir)
    if (value === null) continue
    const key = `${set.run}:${set.blockPosition}:${set.week}`
    const entry = weeks.get(key)
    if (entry) entry.e1rmKg = Math.max(entry.e1rmKg, value)
    else {
      const { run, blockPosition, blockName, blockWeeks, week, loggedAt } = set
      weeks.set(key, { run, blockPosition, blockName, blockWeeks, week, e1rmKg: value, at: loggedAt })
    }
  }
  return [...weeks.values()].sort((a, b) => a.at.localeCompare(b.at))
}

export interface ExerciseRecords {
  /** e1RM më e lartë që nga seti i parë; null kur asnjë set s'jep e1RM (mbi 15 përsëritje). */
  bestE1rmKg: number | null
  /** Sa u rrit e1RM-ja kundrejt javës së parë me e1RM ("+10,8 kg nga Java 0"). */
  gainKg: number | null
  since: WeekE1rm | null
  /** Pesha më e madhe e ngritur; me të njëjtën peshë, seti me më shumë përsëritje. */
  heaviest: { weightKg: number; reps: number } | null
}

export function exerciseRecords(history: HistorySet[], exerciseId: string): ExerciseRecords | null {
  const sets = work(history, exerciseId).filter((set) => (set.weightKg ?? 0) > 0 && (set.reps ?? 0) > 0)
  if (sets.length === 0) return null
  const weeks = e1rmByWeek(history, exerciseId)
  const best = weeks.length ? Math.max(...weeks.map((entry) => entry.e1rmKg)) : null
  const first = weeks[0] ?? null
  const top = sets.reduce((winner, set) =>
    set.weightKg! > winner.weightKg! || (set.weightKg === winner.weightKg && set.reps! > winner.reps!) ? set : winner,
  )
  return {
    bestE1rmKg: best,
    gainKg: best !== null && weeks.length > 1 ? best - first.e1rmKg : null,
    since: weeks.length > 1 ? first : null,
    heaviest: { weightKg: top.weightKg!, reps: top.reps! },
  }
}

export interface SessionSets {
  sessionId: string
  /** Koha e setit të parë të seancës. */
  at: string
  blockName: string
  blockWeeks: number
  week: number
  /** Setet e punës sipas numrit të setit. */
  sets: { weightKg: number | null; reps: number | null; rir: number | null }[]
}

/** Seancat më të reja të ushtrimit, me setet e punës sipas numrit të setit. */
export function recentSessions(history: HistorySet[], exerciseId: string, limit: number): SessionSets[] {
  const sessions = new Map<string, HistorySet[]>()
  for (const set of work(history, exerciseId)) sessions.set(set.sessionId, [...(sessions.get(set.sessionId) ?? []), set])
  return [...sessions.values()]
    .map((sets): SessionSets => {
      const [first] = sets
      return {
        sessionId: first.sessionId,
        at: first.loggedAt,
        blockName: first.blockName,
        blockWeeks: first.blockWeeks,
        week: first.week,
        sets: [...sets].sort((a, b) => a.setNumber - b.setNumber).map((set) => ({ weightKg: set.weightKg, reps: set.reps, rir: set.rir })),
      }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}

/**
 * Nga vjen 1RM aktuale e §7, për llogarinë te "Peshat e javës": vlera me dorë, ose seti më i ri që e
 * dha. Null kur asnjë set s'e jep (p.sh. vlerë e rrumbullakosur nga jashtë).
 */
export function oneRmSource(
  history: HistorySet[],
  exerciseId: string,
  oneRmKg: number,
  override: { oneRmKg: number; setAt: string } | null,
): { kind: 'manual' | 'set'; at: string } | null {
  if (override && Math.abs(override.oneRmKg - oneRmKg) < 1e-6) return { kind: 'manual', at: override.setAt }
  const source = work(history, exerciseId)
    .reverse()
    .find((set) => Math.abs((e1rm(set.weightKg, set.reps, set.rir) ?? 0) - oneRmKg) < 1e-6)
  return source ? { kind: 'set', at: source.loggedAt } : null
}
