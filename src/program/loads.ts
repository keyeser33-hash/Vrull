import type { Equipment, Target, Tracking } from './types'

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

/** Pesha për një interval përsëritjesh: 1RM / (1 + kufiri i sipërm / 30), poshtë sipas hapit. */
export function suggestedWeight(oneRmKg: number, maxReps: number, step: number): number {
  return roundDown(oneRmKg / (1 + maxReps / 30), step)
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
  const value = setE1rm(set)
  const best = Math.max(0, ...previous.map((other) => setE1rm(other) ?? 0))
  return { weightForReps, e1rm: value !== null && value > best }
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

export interface Suggestion {
  weightKg: number | null
  /** Kur s'ka sugjerim: si të zgjidhet pesha. */
  hint: string | null
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
  const { target } = slot
  if (exercise.tracking !== 'weight_reps' || target.kind === 'timed') return { weightKg: null, hint: null }
  const step = weightStep(exercise.equipment, steps)
  const oneRm = currentOneRm(history, slot.exerciseId, now, override)
  if (target.kind === 'percent_1rm') {
    return oneRm
      ? { weightKg: percentWeight(oneRm, target.percent, step), hint: null }
      : { weightKg: null, hint: 'Vendos 1RM-në e ushtrimit për peshën e javës' }
  }
  if (target.kind === 'linear') {
    const sessions = new Map<string, HistorySet[]>()
    for (const set of history.filter((entry) => entry.exerciseId === slot.exerciseId && !entry.isWarmup).sort(latestFirst)) {
      sessions.set(set.sessionId, [...(sessions.get(set.sessionId) ?? []), set])
    }
    const previous = [...sessions.values()].map((sets) => ({
      weightKg: sets[0].weightKg ?? 0,
      allRepsDone: sets.every((set) => (set.reps ?? 0) >= target.reps),
    }))
    return { weightKg: linearWeight(target, previous, step), hint: null }
  }
  if (oneRm) return { weightKg: suggestedWeight(oneRm, target.max ?? target.min, step), hint: null }
  const range = target.max === null ? `${target.min}` : `${target.min}–${target.max}`
  return { weightKg: null, hint: `Zgjidh peshën ku mbyll ${range} përsëritje` }
}
