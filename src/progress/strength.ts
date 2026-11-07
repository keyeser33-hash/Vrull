import { e1rm, type HistorySet } from '@/program/loads'
import type { MuscleGroup } from '@/program/muscles'
import { change, type Point } from './metrics'

// Forca dhe volumi (SPEC §8, TH-13): e1RM më i mirë i çdo dite për ushtrim dhe setet e punës në
// javë për grupin kryesor të muskujve. Setet e ngrohjes nuk numërohen.

const round1 = (value: number) => Math.round(value * 10) / 10

export function e1rmSeries(sets: HistorySet[], exerciseId: string): Point[] {
  const best = new Map<string, number>()
  for (const set of sets) {
    if (set.exerciseId !== exerciseId || set.isWarmup) continue
    const value = e1rm(set.weightKg, set.reps, set.rir)
    if (value === null) continue
    const date = set.loggedAt.slice(0, 10)
    best.set(date, Math.max(best.get(date) ?? 0, value))
  }
  return [...best.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: round1(value) }))
}

export interface StrengthRow {
  exerciseId: string
  name: string
  latest: Point
  change: { from: Point; delta: number } | null
  points: number
}

export function strengthSummary(sets: HistorySet[], names: Record<string, string>): StrengthRow[] {
  const ids = [...new Set(sets.map((set) => set.exerciseId))]
  return ids
    .flatMap((exerciseId) => {
      const series = e1rmSeries(sets, exerciseId)
      const latest = series.at(-1)
      if (!latest) return []
      const delta = change(series, 28)
      return [{ exerciseId, name: names[exerciseId] ?? 'Ushtrim', latest, change: delta ? { ...delta, delta: round1(delta.delta) } : null, points: series.length }]
    })
    .sort((a, b) => b.latest.date.localeCompare(a.latest.date) || a.name.localeCompare(b.name))
}

export interface VolumeRow {
  group: MuscleGroup
  thisWeek: number
  lastWeek: number
}

const pad = (value: number) => String(value).padStart(2, '0')
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Setet e punës të kësaj jave (nga e hëna) dhe të javës së kaluar, për çdo grup muskujsh. */
export function weeklyVolume(sets: HistorySet[], primary: Record<string, string[]>, groups: MuscleGroup[], now: Date): VolumeRow[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const start = isoDate(monday)
  const previous = isoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7))
  const end = isoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))
  return groups.map((group) => {
    let thisWeek = 0
    let lastWeek = 0
    for (const set of sets) {
      if (set.isWarmup || !(primary[set.exerciseId] ?? []).some((key) => group.keys.includes(key))) continue
      const date = set.loggedAt.slice(0, 10)
      if (date >= start && date < end) thisWeek++
      else if (date >= previous && date < start) lastWeek++
    }
    return { group, thisWeek, lastWeek }
  })
}
