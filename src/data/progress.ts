import { change, METRICS, type Metric, type MetricKey, movingAverage, type Point } from '@/progress/metrics'
import type { LocalStore } from './store'

// Matjet e trupit (SPEC §8, TH-12): një rresht për datë te `body_measurements`. Pesha shfaqet me
// mesataren 7-ditore; çdo matje tjetër me vlerën e fundit dhe ndryshimin në 4 javë.

export type MeasurementValues = Partial<Record<MetricKey, number | null>>

export async function saveMeasurement(store: LocalStore, date: string, values: MeasurementValues) {
  const [existing] = await store.where('body_measurements', 'date', date)
  await store.put('body_measurements', { id: existing?.id, date, ...values })
}

export async function measurementsOn(store: LocalStore, date: string): Promise<MeasurementValues> {
  const [row] = await store.where('body_measurements', 'date', date)
  if (!row) return {}
  return Object.fromEntries(METRICS.map((metric) => [metric.key, row[metric.key] === null || row[metric.key] === undefined ? null : Number(row[metric.key])]))
}

/** Vlerat e një matjeje sipas datës, nga e vjetra te e reja. */
export async function metricHistory(store: LocalStore, key: MetricKey): Promise<Point[]> {
  const rows = await store.all('body_measurements')
  return rows
    .filter((row) => row[key] !== null && row[key] !== undefined)
    .map((row) => ({ date: String(row.date), value: Number(row[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface MetricSummary {
  metric: Metric
  latest: Point | null
  change: { from: Point; delta: number } | null
}

export interface ProgressView {
  weight: { points: Point[]; averages: Point[]; latest: Point | null; change: { from: Point; delta: number } | null }
  metrics: MetricSummary[]
}

export async function progressView(store: LocalStore): Promise<ProgressView> {
  const histories = await Promise.all(METRICS.map(async (metric) => ({ metric, points: await metricHistory(store, metric.key) })))
  const [weight, ...others] = histories
  const averages = movingAverage(weight.points)
  return {
    weight: { points: weight.points, averages, latest: averages.at(-1) ?? null, change: change(averages, 28) },
    metrics: others.map(({ metric, points }) => ({ metric, latest: points.at(-1) ?? null, change: change(points, 28) })),
  }
}
