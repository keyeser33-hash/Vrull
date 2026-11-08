import type { Equipment, ProgressionRule, Target, Tracking } from './types'

// 1RM dhe pesha e sugjeruar (SPEC §7). Funksione të pastra mbi historinë e seteve.

export interface HistorySet {
  id: string
  exerciseId: string
  sessionId: string
  run: number
  blockPosition: number
  blockName: string
  blockWeeks: number
  week: number
  setNumber: number
  weightKg: number | null
  reps: number | null
  rir: number | null
  isWarmup: boolean
  loggedAt: string
}

const DAY_MS = 86_400_000
const WINDOW_DAYS = 28

/** e1RM me formulën Epley; vetëm sete me peshë dhe 1–15 përsëritje (RIR = 0 kur mungon). */
export function e1rm(weightKg: number | null, reps: number | null, rir?: number | null): number | null {
  if (!weightKg || weightKg <= 0 || !reps || reps < 1 || reps > 15) return null
  return weightKg * (1 + (reps + (rir ?? 0)) / 30)
}

const setE1rm = (set: HistorySet) => (set.isWarmup ? null : e1rm(set.weightKg, set.reps, set.rir))

/**
 * 1RM aktuale: më e larta nga 28 ditët e fundit; pa asgjë në 28 ditë, e fundit e njohur. Vlera me
 * dorë vlen derisa një set pas saj të japë më shumë.
 */
export function currentOneRm(
  history: HistorySet[],
  exerciseId: string,
  now: Date,
  override?: { oneRmKg: number; setAt: string } | null,
): number | null {
  const known = history
    .filter((set) => set.exerciseId === exerciseId)
    .map((set) => ({ at: set.loggedAt, value: setE1rm(set) }))
    .filter((entry): entry is { at: string; value: number } => entry.value !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
  if (override) {
    const after = known.filter((entry) => entry.at > override.setAt).map((entry) => entry.value)
    return Math.max(override.oneRmKg, ...after)
  }
  if (known.length === 0) return null
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString()
  const recent = known.filter((entry) => entry.at >= since).map((entry) => entry.value)
  return recent.length > 0 ? Math.max(...recent) : known[0].value
}

/** Rrumbullakim poshtë sipas hapit, pa gabimet e numrave dhjetorë (7,5 / 2,5 mbetet 3). */
export function roundDown(weightKg: number, step: number): number {
  const steps = Math.floor(weightKg / step + 1e-9)
  return Math.round(steps * step * 100) / 100
}

/** 1RM / (1 + përsëritjet / 30): pesha e saktë për një numër përsëritjesh, para rrumbullakimit. */
const exactWeight = (oneRmKg: number, reps: number) => oneRmKg / (1 + reps / 30)

/** Pesha për një interval përsëritjesh: 1RM / (1 + kufiri i sipërm / 30), poshtë sipas hapit. */
export function suggestedWeight(oneRmKg: number, maxReps: number, step: number): number {
  return roundDown(exactWeight(oneRmKg, maxReps), step)
}

const DEFAULT_STEP = 2.5
/** Hapat e §7, si parazgjedhjet e `user_settings.weight_steps` te Supabase. */
const DEFAULT_STEPS: Partial<Record<Equipment, number>> = { barbell: 2.5, ez_bar: 2.5, dumbbell: 2, cable: 5, machine: 5, kettlebell: 4 }

/** Hapi i peshës sipas pajisjes: cilësimi i përdoruesit, ose parazgjedhja e §7. */
export function weightStep(equipment: Equipment, steps: Partial<Record<Equipment, number>>): number {
  return steps[equipment] ?? DEFAULT_STEPS[equipment] ?? DEFAULT_STEP
}

export interface Reference {
  /** "Java 0" ose "Faza 1 · Java 2" ("previous_block"); "Herën e fundit" ("last_time"). */
  kind: 'previous_block' | 'last_time'
  blockName: string
  blockWeeks: number
  week: number
  setNumber: number
  weightKg: number | null
  reps: number | null
}

const latestFirst = (a: HistorySet, b: HistorySet) => b.loggedAt.localeCompare(a.loggedAt)

/** Seti me numrin e kërkuar nga seanca, ose i fundit i saj kur ka më pak sete. */
function setOf(sets: HistorySet[], setNumber: number) {
  const working = sets.filter((set) => !set.isWarmup).sort((a, b) => a.setNumber - b.setNumber)
  return working.find((set) => set.setNumber === setNumber) ?? working.at(-1)
}

function asReference(kind: Reference['kind'], set: HistorySet): Reference {
  const { blockName, blockWeeks, week, setNumber, weightKg, reps } = set
  return { kind, blockName, blockWeeks, week, setNumber, weightKg, reps }
}

/**
 * Referenca e §7: e njëjta javë te blloku i mëparshëm (seanca më e fundit), i njëjti set. Pa të:
 * seti i njëjtë herën e fundit që u bë ushtrimi, jashtë seancës së tanishme.
 */
export function reference(
  history: HistorySet[],
  at: { exerciseId: string; blockPosition: number; week: number; setNumber: number; sessionId?: string },
): Reference | null {
  const mine = history.filter((set) => set.exerciseId === at.exerciseId && set.sessionId !== at.sessionId).sort(latestFirst)
  const previous = mine.find((set) => set.blockPosition === at.blockPosition - 1 && set.week === at.week)
  if (previous) {
    const match = setOf(mine.filter((set) => set.sessionId === previous.sessionId), at.setNumber)
    if (match) return asReference('previous_block', match)
  }
  const [last] = mine
  if (!last) return null
  const match = setOf(mine.filter((set) => set.sessionId === last.sessionId), at.setNumber)
  return match ? asReference('last_time', match) : null
}

/**
 * Pesha e drop set-it (§4): ajo e javës 1 të bllokut për këtë ushtrim, në të njëjtën xhiro; ose
 * një përqindje e peshës së setit kur receta e jep.
 */
export function dropWeight(
  history: HistorySet[],
  at: { exerciseId: string; run: number; blockPosition: number },
  setWeightKg: number,
  technique: { percent?: number },
  step: number,
): number | null {
  if (technique.percent) return roundDown((setWeightKg * technique.percent) / 100, step)
  const weekOne = history
    .filter(
      (set) =>
        set.exerciseId === at.exerciseId &&
        set.run === at.run &&
        set.blockPosition === at.blockPosition &&
        set.week === 1 &&
        !set.isWarmup &&
        set.weightKg !== null,
    )
    .sort((a, b) => a.setNumber - b.setNumber)
  return weekOne[0]?.weightKg ?? null
}

/**
 * Rekordet në moment (§6): pesha më e madhe për këtë numër përsëritjesh (asnjë set i mëparshëm me
 * aq ose më shumë përsëritje nuk e arriti) dhe e1RM më e lartë. Seti i parë i ushtrimit nuk është rekord.
 */
export function personalRecords(set: HistorySet, history: HistorySet[]): { weightForReps: boolean; e1rm: boolean } {
  const none = { weightForReps: false, e1rm: false }
  const previous = history.filter((other) => other.exerciseId === set.exerciseId && other.id !== set.id && !other.isWarmup)
  if (set.isWarmup || previous.length === 0 || !set.weightKg || !set.reps) return none
  const weight = set.weightKg
  const reps = set.reps
  const weightForReps = previous.every((other) => (other.reps ?? 0) < reps || (other.weightKg ?? 0) < weight)
  return { weightForReps, e1rm: e1rmRecord(set, history) !== null }
}

/**
 * Rekordi i e1RM-së për setin, me sa e kalon më të mirin e mëparshëm ("rekord +1,5"); null kur
 * seti nuk e kalon. Seti i parë i ushtrimit nuk është rekord.
 */
export function e1rmRecord(set: HistorySet, history: HistorySet[]): { e1rmKg: number; previousBestKg: number; gainKg: number } | null {
  const previous = history.filter((other) => other.exerciseId === set.exerciseId && other.id !== set.id && !other.isWarmup)
  const value = setE1rm(set)
  if (value === null || previous.length === 0) return null
  const best = Math.max(0, ...previous.map((other) => setE1rm(other) ?? 0))
  return value > best ? { e1rmKg: value, previousBestKg: best, gainKg: value - best } : null
}

/**
 * Pragu i rekordit (§0.3a): përsëritjet më të pakta që me këtë peshë japin një e1RM më të lartë se
 * çdo set i mëparshëm i ushtrimit.
 */
export function recordThreshold(
  history: HistorySet[],
  at: { exerciseId: string; weightKg: number; min: number; max: number | null },
): { reps: number; e1rmKg: number } | null {
  const best = Math.max(0, ...history.filter((set) => set.exerciseId === at.exerciseId).map((set) => setE1rm(set) ?? 0))
  if (best === 0) return null
  const top = at.max ?? at.min
  for (let reps = 1; reps <= 15; reps++) {
    const value = e1rm(at.weightKg, reps) ?? 0
    if (value > best) return reps >= at.min && reps <= top + 2 ? { reps, e1rmKg: value } : null
  }
  return null
}

/** Progresion çdo seancë (§4): fillon nga pesha fillestare, rritet pas një seance të mbyllur, ulet pas N dështimesh. */
export function linearWeight(
  target: { startKg: number; incrementKg: number; failuresBeforeDeload: number; deloadPercent: number },
  previous: { weightKg: number; allRepsDone: boolean }[],
  step: number,
): number {
  const [last] = previous
  if (!last) return target.startKg
  if (last.allRepsDone) return last.weightKg + target.incrementKg
  const failures = previous.slice(0, target.failuresBeforeDeload)
  if (failures.length === target.failuresBeforeDeload && failures.every((session) => !session.allRepsDone)) {
    return roundDown(last.weightKg * (1 - target.deloadPercent / 100), step)
  }
  return last.weightKg
}

/** Pesha për `percent_1rm`, nga 1RM aktuale. */
export function percentWeight(oneRmKg: number, percent: number, step: number): number {
  return roundDown((oneRmKg * percent) / 100, step)
}

/** Nga vjen pesha e propozuar: llogaria që i tregohet përdoruesit pranë peshës. */
export type WeightBasis =
  | { kind: 'one_rm'; oneRmKg: number; reps: number; exactKg: number; stepKg: number }
  /** Ushtrim me histori, por pa e1RM (setet mbi 15 përsëritje): pesha e fundit e përdorur. */
  | { kind: 'last_weight'; weightKg: number }
  /** Ushtrim pa histori: "Zgjidh peshën ku mbyll X–Y përsëritje". */
  | { kind: 'choose'; min: number; max: number | null }
  | { kind: 'percent_1rm'; oneRmKg: number; percent: number; exactKg: number; stepKg: number }
  /** %1RM pa 1RM: përdoruesi e vendos me dorë. */
  | { kind: 'needs_one_rm' }
  /** Progresion çdo seancë (§4): nga seancat e mëparshme të ushtrimit. */
  | { kind: 'linear' }
  /** Rregulli i progresit (V9): pesha e seancës së kaluar, plus shtesa kur u fitua. */
  | { kind: 'progression'; lastKg: number; incrementKg: number; minRir: number; topReps: number; earned: boolean }

export interface WeightProposal {
  weightKg: number | null
  basis: WeightBasis | null
}

export interface WeightInput {
  exerciseId: string
  target: Target
  exercise: { equipment: Equipment; tracking: Tracking }
  history: HistorySet[]
  now: Date
  override?: { oneRmKg: number; setAt: string } | null
  steps?: Partial<Record<Equipment, number>>
  /** Rregulli i progresit të slotit dhe kufiri i sipërm i intervalit të seancës së kaluar (V9). */
  progression?: { rule: ProgressionRule; topReps: number | null } | null
}

/** Setet e punës me peshë të seancës më të fundit të ushtrimit, i fundit i pari. */
function lastSessionSets(history: HistorySet[], exerciseId: string): HistorySet[] {
  const working = history.filter((set) => set.exerciseId === exerciseId && !set.isWarmup && (set.weightKg ?? 0) > 0).sort(latestFirst)
  return working.filter((set) => set.sessionId === working[0]?.sessionId)
}

/** Pesha e setit të punës më të fundit të ushtrimit; null kur s'ka asnjë set me peshë. */
export function lastWeight(history: HistorySet[], exerciseId: string): number | null {
  return lastSessionSets(history, exerciseId)[0]?.weightKg ?? null
}

/**
 * Rregulli i progresit (V9): pesha më e rëndë e seancës së kaluar, plus shtesa kur çdo set arriti
 * kufirin e sipërm me RIR të mjaftueshëm. Null pa rregull, pa javë të kaluar ose pa seancë.
 */
function progressionWeight(input: WeightInput): WeightProposal | null {
  const rule = input.progression?.rule
  const topReps = input.progression?.topReps ?? null
  const last = lastSessionSets(input.history, input.exerciseId)
  if (!rule || topReps === null || last.length === 0) return null
  const lastKg = Math.max(...last.map((set) => set.weightKg ?? 0))
  // RIR-i i paregjistruar vlen 0, si te e1RM-ja (§7).
  const earned = last.every((set) => (set.reps ?? 0) >= topReps && (set.rir ?? 0) >= rule.minRir)
  return {
    weightKg: earned ? lastKg + rule.incrementKg : lastKg,
    basis: { kind: 'progression', lastKg, incrementKg: rule.incrementKg, minRir: rule.minRir, topReps, earned },
  }
}

/** Pesha e propozuar për slotin, me llogarinë që e jep (§7). */
export function weightFor(input: WeightInput): WeightProposal {
  const { target } = input
  if (target.kind === 'timed') return { weightKg: null, basis: null }
  const progressed = progressionWeight(input)
  if (progressed) return progressed
  const stepKg = weightStep(input.exercise.equipment, input.steps ?? {})
  if (target.kind === 'linear') {
    const sessions = new Map<string, HistorySet[]>()
    for (const set of input.history.filter((entry) => entry.exerciseId === input.exerciseId && !entry.isWarmup).sort(latestFirst)) {
      sessions.set(set.sessionId, [...(sessions.get(set.sessionId) ?? []), set])
    }
    const previous = [...sessions.values()].map((sets) => ({
      weightKg: sets[0].weightKg ?? 0,
      allRepsDone: sets.every((set) => (set.reps ?? 0) >= target.reps),
    }))
    return { weightKg: linearWeight(target, previous, stepKg), basis: { kind: 'linear' } }
  }
  const oneRmKg = currentOneRm(input.history, input.exerciseId, input.now, input.override)
  if (target.kind === 'percent_1rm') {
    if (!oneRmKg) return { weightKg: null, basis: { kind: 'needs_one_rm' } }
    const exactKg = (oneRmKg * target.percent) / 100
    return { weightKg: roundDown(exactKg, stepKg), basis: { kind: 'percent_1rm', oneRmKg, percent: target.percent, exactKg, stepKg } }
  }
  if (!oneRmKg) {
    const lastKg = lastWeight(input.history, input.exerciseId)
    return lastKg === null
      ? { weightKg: null, basis: { kind: 'choose', min: target.min, max: target.max } }
      : { weightKg: lastKg, basis: { kind: 'last_weight', weightKg: lastKg } }
  }
  const reps = target.max ?? target.min
  const exactKg = exactWeight(oneRmKg, reps)
  return { weightKg: roundDown(exactKg, stepKg), basis: { kind: 'one_rm', oneRmKg, reps, exactKg, stepKg } }
}

export interface Suggestion {
  weightKg: number | null
  /** Kur s'ka sugjerim: si të zgjidhet pesha. */
  hint: string | null
}

function hintFor(basis: WeightBasis | null): string | null {
  if (basis?.kind === 'needs_one_rm') return 'Vendos 1RM-në e ushtrimit për peshën e javës'
  if (basis?.kind !== 'choose') return null
  const range = basis.max === null ? `${basis.min}` : `${basis.min}–${basis.max}`
  return `Zgjidh peshën ku mbyll ${range} përsëritje`
}

/** Pesha e sugjeruar e §7 për slotin e seancës, ose si të zgjidhet kur s'ka 1RM. */
export function suggestionFor(
  slot: { exerciseId: string; target: Target },
  exercise: { equipment: Equipment; tracking: Tracking },
  history: HistorySet[],
  now: Date,
  override: { oneRmKg: number; setAt: string } | null,
  steps: Partial<Record<Equipment, number>>,
): Suggestion {
  if (exercise.tracking !== 'weight_reps') return { weightKg: null, hint: null }
  const { weightKg, basis } = weightFor({ exerciseId: slot.exerciseId, target: slot.target, exercise, history, now, override, steps })
  return { weightKg, hint: hintFor(basis) }
}
