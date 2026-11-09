import type { RecoveryStatus } from '@/program/recovery'
import { LIGHTER_SHARE, lighterWeight } from '@/progress/weekly-goals'

// Gatishmëria (SPEC §0.3d, V50): logjikë e pastër, pa UI dhe pa bazë.

export type Scale = 1 | 2 | 3 | 4 | 5

/** Gjendja e ditës (check-in-i): shkallët 1-5, minutat e gjumit, dhimbjet 0-4 dhe grupet me dhimbje. */
export interface CheckIn {
  mood: Scale
  energy: Scale
  sleepMinutes: number
  sleepQuality: Scale
  soreness: 0 | 1 | 2 | 3 | 4
  soreGroups: string[]
}

export type ReadinessLevel = 'low' | 'normal' | 'high'
export type ReadinessPartKey = 'sleep' | 'energy' | 'recovery' | 'soreness' | 'mood'

export interface ReadinessPart {
  key: ReadinessPartKey
  /** 0-100, pa rrumbullakim. */
  score: number
  /** Pesha pas ndarjes; shuma e peshave është 1. */
  weight: number
}

export interface Readiness {
  percent: number
  level: ReadinessLevel
  parts: ReadinessPart[]
}

/** Peshat e V50, në radhën e pjesëve. */
const WEIGHTS: Record<ReadinessPartKey, number> = { sleep: 0.3, energy: 0.25, recovery: 0.2, soreness: 0.15, mood: 0.1 }
const ORDER: ReadinessPartKey[] = ['sleep', 'energy', 'recovery', 'soreness', 'mood']

/** Orë gjumi → pikë, me vijë të drejtë mes pikave. */
const SLEEP_POINTS: ReadonlyArray<readonly [hours: number, score: number]> = [
  [4, 20],
  [5, 40],
  [6, 65],
  [7, 85],
  [8, 100],
]
const SLEEP_HOURS_SHARE = 0.7

const RECOVERY_SCORE: Record<RecoveryStatus, number> = { gati: 100, pothuajse_gati: 70, i_lodhur: 40 }
const SORE_TRAINED_PENALTY = 20

export const LOW_BELOW = 60
export const HIGH_FROM = 85

const scaleScore = (value: Scale) => (value - 1) * 25
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function hoursScore(hours: number): number {
  const first = SLEEP_POINTS[0]
  const last = SLEEP_POINTS[SLEEP_POINTS.length - 1]
  if (hours <= first[0]) return first[1]
  if (hours >= last[0]) return last[1]
  for (let i = 1; i < SLEEP_POINTS.length; i++) {
    const [toHours, toScore] = SLEEP_POINTS[i]
    const [fromHours, fromScore] = SLEEP_POINTS[i - 1]
    if (hours <= toHours) return fromScore + ((hours - fromHours) / (toHours - fromHours)) * (toScore - fromScore)
  }
  return last[1]
}

/** Gjumi: orët 70% (vijë e drejtë mes pikave) dhe cilësia 30%. */
export function sleepScore(minutes: number, quality: Scale): number {
  return SLEEP_HOURS_SHARE * hoursScore(minutes / 60) + (1 - SLEEP_HOURS_SHARE) * scaleScore(quality)
}

/** Nën 60 e ulët, 60-84 normale, 85 e lart e lartë. */
export function readinessLevel(percent: number): ReadinessLevel {
  if (percent < LOW_BELOW) return 'low'
  return percent >= HIGH_FROM ? 'high' : 'normal'
}

function sorenessScore(checkIn: CheckIn, trainedGroups: string[]): number {
  const base = 100 - 25 * checkIn.soreness
  const trainsSore = checkIn.soreness > 0 && checkIn.soreGroups.some((group) => trainedGroups.includes(group))
  return clamp(trainsSore ? base - SORE_TRAINED_PENALTY : base, 0, 100)
}

/**
 * Gatishmëria e ditës. `recovery`: Rikuperimi i grupit kryesor të sotëm, ose null pa stërvitje sot (pjesa
 * "recovery" del dhe pesha e saj ndahet proporcionalisht te katër të tjerat).
 */
export function readiness(input: { checkIn: CheckIn; recovery: RecoveryStatus | null; trainedGroups: string[] }): Readiness {
  const { checkIn, recovery, trainedGroups } = input
  const scores: Record<ReadinessPartKey, number> = {
    sleep: sleepScore(checkIn.sleepMinutes, checkIn.sleepQuality),
    energy: scaleScore(checkIn.energy),
    recovery: recovery ? RECOVERY_SCORE[recovery] : 0,
    soreness: sorenessScore(checkIn, trainedGroups),
    mood: scaleScore(checkIn.mood),
  }
  const keys = ORDER.filter((key) => key !== 'recovery' || recovery !== null)
  const total = keys.reduce((sum, key) => sum + WEIGHTS[key], 0)
  const parts = keys.map((key) => ({ key, score: scores[key], weight: WEIGHTS[key] / total }))
  const percent = Math.round(parts.reduce((sum, part) => sum + part.score * part.weight, 0))
  return { percent, level: readinessLevel(percent), parts }
}

// --- Seanca më e lehtë ---

export const LIGHTER = {
  /** Ushtrimi i 3-të (indeksi 2) e tutje humbet një set. */
  fromIndex: 2,
  minSets: 1,
  maxRir: 4,
  weightShare: LIGHTER_SHARE,
} as const

const DEFAULT_STEP_KG = 2.5

/**
 * "Seanca më e lehtë": nga ushtrimi i 3-të një set më pak (jo nën 1); me RIR, RIR +1 (deri në 4); pa RIR,
 * pesha × 0,9 e rrumbullakosur poshtë sipas hapit (`stepKg` i ushtrimit, parazgjedhja 2,5; si peshat e
 * javës). Me `keepWeight` (p.sh. "Mirë se u ktheve": pesha është ulur tashmë me 0,9, V43) pesha nuk ulet përsëri. Nuk e ndryshon hyrjen.
 */
export function lighterSlots<T extends { sets: number; rir: number | null; weightKg: number | null; stepKg?: number }>(
  slots: T[],
  options: { keepWeight: boolean },
): T[] {
  return slots.map((slot, index) => {
    const sets = index >= LIGHTER.fromIndex ? Math.max(LIGHTER.minSets, slot.sets - 1) : slot.sets
    if (slot.rir !== null) return { ...slot, sets, rir: slot.rir < LIGHTER.maxRir ? slot.rir + 1 : slot.rir }
    if (options.keepWeight || slot.weightKg === null) return { ...slot, sets }
    return { ...slot, sets, weightKg: lighterWeight(slot.weightKg, slot.stepKg ?? DEFAULT_STEP_KG) }
  })
}

// --- Pamja e ditës ---

export type DayMode = 'tired' | 'normal' | 'energetic'

/** Pamja e ditës (V20): lodhur nën 60, energjike nga 85; pa gatishmëri ose pa çelësin "Pamja ndjek gjendjen", normale. */
export function dayMode(readiness: Readiness | null, follow: boolean): DayMode {
  if (!readiness || !follow) return 'normal'
  if (readiness.percent < LOW_BELOW) return 'tired'
  return readiness.percent >= HIGH_FROM ? 'energetic' : 'normal'
}
