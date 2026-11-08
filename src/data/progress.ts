import { MUSCLE_GROUPS } from '@/program/muscles'
import { change, METRICS, type Metric, type MetricKey, movingAverage, type Point } from '@/progress/metrics'
import { type StrengthRow, strengthSummary, type VolumeRow, weeklyVolume } from '@/progress/strength'
import { localDate } from '@/lib/calendar'
import type { LocalStore } from './store'
import { trainingHistory } from './training'

// Matjet e trupit (SPEC §8, TH-12): një rresht për datë te `body_measurements`. Pesha shfaqet me
// mesataren 7-ditore; çdo matje tjetër me vlerën e fundit dhe ndryshimin në 4 javë.

export type MeasurementValues = Partial<Record<MetricKey, number | null>>

export async function saveMeasurement(store: LocalStore, date: string, values: MeasurementValues) {
  const [existing] = await store.where('body_measurements', 'date', date)
  await store.put('body_measurements', { id: existing?.id, date, ...values })
}

/** Vlerat e një matjeje sipas datës, nga e vjetra te e reja. */
export async function metricHistory(store: LocalStore, key: MetricKey): Promise<Point[]> {
  const rows = await store.all('body_measurements')
  return rows
    .filter((row) => row[key] !== null && row[key] !== undefined)
    .map((row) => ({ date: String(row.date), value: Number(row[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface ProgressStart {
  /** Asgjë për grafikë: pa set, pa foto, pa perimetër dhe me të shumtën një peshë (e hapave të parë). */
  empty: boolean
  /** Pesha e fundit, për gjendjen bosh ("80,0 kg sot"). */
  weightKg: number | null
}

/** Gjendja bosh e Progresit (bordi "Gjendje · Bosh"): grafikët nisin me setin e parë. */
export async function progressStart(store: LocalStore): Promise<ProgressStart> {
  const [sets, photos, measurements] = await Promise.all([store.all('set_logs'), store.all('progress_photos'), store.all('body_measurements')])
  const has = (row: Record<string, unknown>, key: MetricKey) => row[key] !== null && row[key] !== undefined
  const weights = measurements.filter((row) => has(row, 'weight_kg')).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const otherMetrics = measurements.some((row) => METRICS.some((metric) => metric.key !== 'weight_kg' && has(row, metric.key)))
  const latest = weights.at(-1)
  return {
    empty: sets.length === 0 && photos.length === 0 && !otherMetrics && weights.length <= 1,
    weightKg: latest ? Number(latest.weight_kg) : null,
  }
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

export interface ComplianceDay {
  date: string
  kcal: number
  /** Objektivi i ruajtur i ditës; null kur dita nuk ka objektiva. */
  target: number | null
}

export interface TrainingProgress {
  strength: StrengthRow[]
  /** Vetëm grupet me sete këtë javë ose javën e kaluar. */
  volume: VolumeRow[]
  compliance: ComplianceDay[]
}

/** Forca, volumi javor dhe përputhja me objektivat e ushqimit në 7 ditët e fundit (TH-13). */
export async function trainingProgress(store: LocalStore, now: Date): Promise<TrainingProgress> {
  const [history, exercises, entries, targets] = await Promise.all([
    trainingHistory(store),
    store.all('exercises'),
    store.all('diary_entries'),
    store.all('nutrition_targets'),
  ])
  const names = Object.fromEntries(exercises.map((row) => [row.id, String(row.name)]))
  const primary = Object.fromEntries(exercises.map((row) => [row.id, (row.primary_muscles as string[] | undefined) ?? []]))
  const days = Array.from({ length: 7 }, (_, index) => localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index)))
  return {
    strength: strengthSummary(history.sets, names),
    volume: weeklyVolume(history.sets, primary, MUSCLE_GROUPS, now).filter((row) => row.thisWeek > 0 || row.lastWeek > 0),
    compliance: days.map((date) => {
      const target = targets.find((row) => row.date === date)
      return {
        date,
        kcal: Math.round(entries.filter((row) => row.date === date).reduce((total, row) => total + Number(row.kcal ?? 0), 0)),
        target: target ? Number(target.kcal) : null,
      }
    }),
  }
}
