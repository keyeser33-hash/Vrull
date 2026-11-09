import type { RecoveryStatus } from '@/program/recovery'
import type { PlannedSlot, Target, Tracking } from '@/program/types'
import { type CheckIn, LIGHTER, lighterSlots, type Readiness, type ReadinessPartKey } from './readiness'
import { chipsOf, type SoreChip } from './sore-chips'

// "Seanca më e lehtë" (V50, V2-E3-06) si logjikë e pastër mbi stërvitjen e ditës: setet dhe RIR-i e ndryshojnë
// planin (`trainingSnapshot`), pesha ndryshon me `workoutWeights`; të dyja kalojnë nga `lighterSlots`
// (readiness.ts), që rregulli të jetë një i vetëm. Këtu janë edhe fjalët e kartës: çfarë kushton seanca më e
// lehtë dhe pse e ofrojmë (dy pjesët me pikët më të ulëta).

const rirOf = (target: Target): { min: number; max: number } | null => (target.kind === 'reps' && target.rir ? target.rir : null)

/** Plani pa peshat: nga ushtrimi i 3-të një set më pak, dhe RIR +1 (deri në 4) kur java ka RIR. */
export function lightenPlan<T extends Pick<PlannedSlot, 'sets' | 'target'>>(slots: T[]): T[] {
  const lighter = lighterSlots(
    slots.map((slot) => ({ sets: slot.sets, rir: rirOf(slot.target)?.min ?? null, weightKg: null })),
    { keepWeight: true },
  )
  return slots.map((slot, index) => {
    const range = rirOf(slot.target)
    const rise = range ? (lighter[index].rir ?? range.min) - range.min : 0
    const target: Target =
      slot.target.kind === 'reps' && range && rise > 0
        ? { ...slot.target, rir: { min: range.min + rise, max: Math.max(range.min + rise, Math.min(LIGHTER.maxRir, range.max + rise)) } }
        : slot.target
    return { ...slot, sets: lighter[index].sets, target }
  })
}

/**
 * Pesha e çdo sloti pas rregullit: pa RIR 90% poshtë sipas hapit, me RIR e njëjta. Me `keepWeight` (p.sh. "Mirë se u ktheve":
 * pesha 90% tashmë) nuk ulet përsëri. Kthen peshat në radhën e hyrjes.
 */
export function lightenWeights(
  rows: { sets: number; target: Target; weightKg: number | null; stepKg: number }[],
  options: { keepWeight: boolean },
): (number | null)[] {
  return lighterSlots(
    rows.map((row) => ({ sets: row.sets, rir: rirOf(row.target)?.min ?? null, weightKg: row.weightKg, stepKg: row.stepKg })),
    { keepWeight: options.keepWeight },
  ).map((slot) => slot.weightKg)
}

export type LighterEffect = 'weight' | 'rir' | 'both' | null

export interface LighterCost {
  /** Ka një set më pak nga ushtrimi i 3-të (stërvitja ka të paktën tre ushtrime). */
  sets: boolean
  /** Pesha −10%, RIR +1, ose të dyja kur java përziehet. */
  effect: LighterEffect
}

/**
 * Çfarë kushton seanca më e lehtë, për rreshtin e kartës dhe shiritin e seancës. Nuk varet nga setet e planit
 * (që mund të jenë ulur tashmë), vetëm nga numri i ushtrimeve dhe nga recetat e javës. Me "Mirë se u ktheve" pesha
 * është ulur tashmë, ndaj kostoja e saj nuk numërohet.
 */
export function lighterCost(
  slots: Pick<PlannedSlot, 'exerciseId' | 'target'>[],
  trackings: Record<string, Tracking | undefined>,
  options: { keepWeight: boolean },
): LighterCost {
  const rir = slots.some((slot) => rirOf(slot.target) !== null)
  const weight =
    !options.keepWeight &&
    slots.some((slot) => rirOf(slot.target) === null && slot.target.kind !== 'timed' && (trackings[slot.exerciseId] ?? 'weight_reps') === 'weight_reps')
  return { sets: slots.length > LIGHTER.fromIndex, effect: rir && weight ? 'both' : rir ? 'rir' : weight ? 'weight' : null }
}

// --- Pse ofrohet ---

export type ReasonKey =
  | 'sleepShort'
  | 'sleepPoor'
  | 'sleepBoth'
  | 'sleepAverage'
  | 'energyLow'
  | 'energyAverage'
  | 'moodLow'
  | 'moodAverage'
  | 'recoveryPoor'
  | 'recoveryPartial'
  | 'soreGroups'
  | 'soreMany'
  | 'sore'

export interface Reason {
  key: ReasonKey
  /** Grupet e muskujve (`MUSCLE_GROUPS[].id`) për `recovery*`. */
  groups?: string[]
  /** Çipat e dhimbjeve (`SORE_CHIPS`) për `soreGroups`: "dhimbjet te këmbët", jo te pesë grupe. */
  chips?: SoreChip[]
  /** Numri i çipave për `soreMany`. */
  count?: number
}

/** Gjumi nën 7 orë është "i shkurtër" (poshtë 85 pikëve), cilësia 1-2 është "e dobët". */
const SHORT_SLEEP_MINUTES = 7 * 60
const MAX_NAMED_GROUPS = 2

export interface ReasonInput {
  checkIn: CheckIn
  readiness: Readiness
  /** Grupi kryesor i sotëm dhe rikuperimi i tij; null pa stërvitje. */
  recovery: { group: string; status: RecoveryStatus } | null
  /** Grupet që stërviten sot (`trainedGroups`). */
  trainedGroups: string[]
}

function reasonFor(part: ReadinessPartKey, input: ReasonInput): Reason {
  const { checkIn, recovery } = input
  switch (part) {
    case 'sleep': {
      const short = checkIn.sleepMinutes < SHORT_SLEEP_MINUTES
      const poor = checkIn.sleepQuality <= 2
      return { key: short && poor ? 'sleepBoth' : short ? 'sleepShort' : poor ? 'sleepPoor' : 'sleepAverage' }
    }
    case 'energy':
      return { key: checkIn.energy <= 2 ? 'energyLow' : 'energyAverage' }
    case 'mood':
      return { key: checkIn.mood <= 2 ? 'moodLow' : 'moodAverage' }
    case 'recovery':
      return { key: recovery?.status === 'i_lodhur' ? 'recoveryPoor' : 'recoveryPartial', groups: recovery ? [recovery.group] : [] }
    case 'soreness': {
      // Grupet që stërviten sot e ulin gatishmërinë; pa to, çdo grup me dhimbje. Numërohen dhe emërtohen si çipat.
      const today = checkIn.soreGroups.filter((group) => input.trainedGroups.includes(group))
      const chips = chipsOf(today.length > 0 ? today : checkIn.soreGroups)
      if (chips.length === 0) return { key: 'sore' }
      return chips.length > MAX_NAMED_GROUPS ? { key: 'soreMany', count: chips.length } : { key: 'soreGroups', chips }
    }
  }
}

/** Dy pjesët me pikët më të ulëta (në barazim, sipas radhës së pjesëve), të thëna sipas radhës së pjesëve. */
export function readinessReasons(input: ReasonInput): Reason[] {
  return input.readiness.parts
    .map((part, index) => ({ part, index }))
    .sort((a, b) => a.part.score - b.part.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map(({ part }) => reasonFor(part.key, input))
}

// --- Pse është e lartë ---

/** Fjalët e pjesëve të forta (nga 85%): çdo çelës ka tekstin e vet te katalogu, `readiness.strength.*`. */
export type StrengthKey = 'sleepGood' | 'sleepLong' | 'sleepQuality' | 'energyHigh' | 'moodGood' | 'soreNone' | 'soreLight'

const GOOD_SLEEP_MINUTES = 7 * 60

/** Fjala e saktë e një pjese sipas vlerës që përdoruesi dha, ose null kur pjesa s'ka fjalë të sakta pozitive. */
function strengthFor(part: ReadinessPartKey, checkIn: CheckIn): StrengthKey | null {
  switch (part) {
    case 'sleep': {
      const long = checkIn.sleepMinutes >= GOOD_SLEEP_MINUTES
      const good = checkIn.sleepQuality >= 4
      return long && good ? 'sleepGood' : long ? 'sleepLong' : good ? 'sleepQuality' : null
    }
    case 'energy':
      return checkIn.energy >= 4 ? 'energyHigh' : null
    case 'mood':
      return checkIn.mood >= 4 ? 'moodGood' : null
    case 'soreness':
      return checkIn.soreness === 0 ? 'soreNone' : checkIn.soreness === 1 ? 'soreLight' : null
    case 'recovery':
      // Rikuperimi thuhet tashmë në rreshtin e kartës ("Gjoksi: gati").
      return null
  }
}

/** Dy pjesët më të forta me fjalë të sakta (në barazim, sipas radhës së pjesëve), të thëna sipas radhës së pjesëve. */
export function readinessStrengths(input: { checkIn: CheckIn; readiness: Readiness }): StrengthKey[] {
  return input.readiness.parts
    .map((part, index) => ({ index, key: strengthFor(part.key, input.checkIn), score: part.score }))
    .filter((item): item is { index: number; key: StrengthKey; score: number } => item.key !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.key)
}
