import type { MeasurementRow, ShapePoint } from '@/body/body-shape'
import { METRICS, type MetricKey, movingAverage } from './metrics'

// "Shto matjen" (bordi "Trupi · Shto matjen", V2-E1-14): çfarë dihet para datës së matjes, që forma
// ta tregojë pranë çdo fushe ("1 nëntor 34,4 · +0,2 cm", "Dje 80,0 kg", mesatarja 7-ditore), dhe
// hapat ±0,1 të fushave.

const DAY_MS = 86_400_000

/** Vlera e fundit e çdo matjeje para `date` (pa vetë datën). */
export function previousValues(rows: MeasurementRow[], date: string): Partial<Record<MetricKey, ShapePoint>> {
  const result: Partial<Record<MetricKey, ShapePoint>> = {}
  const sorted = rows.filter((row) => row.date < date).sort((a, b) => a.date.localeCompare(b.date))
  for (const row of sorted) {
    for (const metric of METRICS) {
      const value = row.values[metric.key]
      if (typeof value === 'number') result[metric.key] = { date: row.date, value }
    }
  }
  return result
}

/** Mesatarja 7-ditore e peshës te matja e fundit para `date`, me një shifër pas presjes; null pa peshë. */
export function weightAverageBefore(rows: MeasurementRow[], date: string): number | null {
  const points = rows
    .filter((row) => row.date < date && typeof row.values.weight_kg === 'number')
    .map((row) => ({ date: row.date, value: row.values.weight_kg as number }))
  const last = movingAverage(points).at(-1)
  return last ? Math.round(last.value * 10) / 10 : null
}

/** A është `previous` dita para `date` ("Dje"). */
export const isDayBefore = (previous: string, date: string) => Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === DAY_MS

/**
 * Një hap ±0,1 nga vlera e fushës; kur fusha është bosh, nga vlera e mëparshme. Brenda kufijve të
 * bazës; null kur nuk ka nga të nisë.
 */
export function stepValue(limits: { min: number; max: number }, current: number | null, previous: number | null, direction: -1 | 1): number | null {
  const from = current ?? previous
  if (from === null) return null
  const next = Math.round((from + direction * 0.1) * 10) / 10
  return Math.min(limits.max, Math.max(limits.min, next))
}
