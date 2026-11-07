// Matjet e trupit (SPEC §8): pesha, % e yndyrës dhe perimetrat; kufijtë janë ata të bazës.

export type MetricKey =
  | 'weight_kg'
  | 'body_fat_pct'
  | 'neck_cm'
  | 'shoulders_cm'
  | 'chest_cm'
  | 'waist_cm'
  | 'hips_cm'
  | 'arm_left_cm'
  | 'arm_right_cm'
  | 'forearm_left_cm'
  | 'forearm_right_cm'
  | 'thigh_left_cm'
  | 'thigh_right_cm'
  | 'calf_left_cm'
  | 'calf_right_cm'

export interface Metric {
  key: MetricKey
  label: string
  unit: 'kg' | '%' | 'cm'
  min: number
  max: number
}

const cm = (key: MetricKey, label: string): Metric => ({ key, label, unit: 'cm', min: 10, max: 250 })

export const METRICS: Metric[] = [
  { key: 'weight_kg', label: 'Pesha', unit: 'kg', min: 20, max: 400 },
  { key: 'body_fat_pct', label: 'Yndyra', unit: '%', min: 2, max: 70 },
  cm('neck_cm', 'Qafa'),
  cm('shoulders_cm', 'Shpatullat'),
  cm('chest_cm', 'Gjoksi'),
  cm('waist_cm', 'Beli'),
  cm('hips_cm', 'Vithet'),
  cm('arm_left_cm', 'Krahu majtas'),
  cm('arm_right_cm', 'Krahu djathtas'),
  cm('forearm_left_cm', 'Parakrahu majtas'),
  cm('forearm_right_cm', 'Parakrahu djathtas'),
  cm('thigh_left_cm', 'Kofsha majtas'),
  cm('thigh_right_cm', 'Kofsha djathtas'),
  cm('calf_left_cm', 'Pulpa majtas'),
  cm('calf_right_cm', 'Pulpa djathtas'),
]

export const metricByKey = (key: string) => METRICS.find((metric) => metric.key === key)

export type MetricParse = { ok: true; value: number | null } | { ok: false; error: string }

export function parseMetric(metric: Metric, text: string): MetricParse {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return { ok: true, value: null }
  const value = Number(trimmed)
  if (!/^\d+(\.\d+)?$/.test(trimmed) || value < metric.min || value > metric.max) {
    return { ok: false, error: `${metric.label} duhet të jetë nga ${metric.min} deri në ${metric.max} ${metric.unit}.` }
  }
  return { ok: true, value: Math.round(value * 10) / 10 }
}

export interface Point {
  date: string
  value: number
}

const DAY_MS = 86_400_000
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)

/** Për çdo matje, mesatarja e vlerave të 7 ditëve deri në atë datë (dy shifra pas presjes). */
export function movingAverage(points: Point[], days = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((point) => {
    const day = dayNumber(point.date)
    const window = sorted.filter((other) => dayNumber(other.date) <= day && day - dayNumber(other.date) < days)
    return { date: point.date, value: Math.round((window.reduce((total, other) => total + other.value, 0) / window.length) * 100) / 100 }
  })
}

/**
 * Ndryshimi i vlerës së fundit kundrejt asaj që ishte `days` ditë më parë (ose e para pas saj kur
 * nuk ka të mëparshme). Null kur ka vetëm një vlerë.
 */
export function change(points: Point[], days: number): { from: Point; delta: number } | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted.at(-1)!
  const limit = dayNumber(last.date) - days
  const before = sorted.filter((point) => dayNumber(point.date) <= limit).at(-1)
  const from = before ?? sorted[0]
  return { from, delta: Math.round((last.value - from.value) * 100) / 100 }
}
