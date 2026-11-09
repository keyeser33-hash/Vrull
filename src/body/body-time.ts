import type { MetricKey } from '@/progress/metrics'
import { baseline, type MeasurementRow, round1, series, SHAPE_MEASURES, type ShapeMeasure, type ShapePoint, type ShapeScales } from './body-shape'

// Makina e kohës (V52, V2-E3-09; SPEC §11). Vija e kohës e trupit: çdo datë me matje është një
// ndalesë, nga baza e "Trupit sipas matjeve" (body-shape.ts) te matja e fundit. Në çdo ndalesë një
// zonë mban matjen e saj të fundit deri atë ditë, ndaj asnjë vlerë nuk shpiket mes dy matjeve; modeli
// vetëm lëviz nga njëra formë te tjetra (`scalesAt`). Në fund, kur një zonë ka mjaft matje, një
// ndalesë parashikimi: vija e drejtë e matjeve, e vazhduar, me intervalin e saj.

export interface StopZone {
  id: ShapeMeasure
  /** Vlera e zonës në këtë ndalesë (mesatarja e anëve), një shifër pas presjes. */
  value: number
  /** Ndryshimi nga baza, në cm. */
  delta: number
  /** value / baza: shkalla e modelit për këtë zonë. */
  ratio: number
  /** Data e matjes nga vjen vlera (e ndalesës, ose një më e hershme kur zona nuk u mat atë ditë). */
  measuredOn: string
  /** Vetëm te parashikimi: kufijtë e intervalit. */
  range?: [number, number]
}

export interface TimeStop {
  date: string
  kind: 'measured' | 'forecast'
  /** Zonat që kanë bazë deri në këtë datë, me radhën e SHAPE_MEASURES. */
  zones: StopZone[]
}

export interface ZoneBase {
  id: ShapeMeasure
  /** Anët që numërohen (te trungu, vetëm një çelës). */
  keys: MetricKey[]
  date: string
  value: number
}

export interface BodyTimeline {
  base: ZoneBase[]
  /** E para është baza; e fundit mund të jetë parashikimi. */
  stops: TimeStop[]
}

const DAY_MS = 86_400_000
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
const dateOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length

/** Javët mes dy datave, të rrumbullakuara ("3 javë nga Java 0"). */
export const weeksBetween = (from: string, to: string) => Math.round((dayNumber(to) - dayNumber(from)) / 7)

/** Elementi me datën më të fundit deri në `date` (përfshirë): matja ose fotoja që vlen atë ditë. */
export function latestUpTo<T extends { date: string }>(items: T[], date: string): T | undefined {
  let found: T | undefined
  for (const item of items) {
    if (item.date <= date && (!found || item.date > found.date)) found = item
  }
  return found
}

interface Side {
  key: MetricKey
  from: ShapePoint
  /** Matjet pas bazës, me radhën e datave. */
  after: ShapePoint[]
}

interface Zone extends ZoneBase {
  sides: Side[]
}

/** Zonat me të paktën dy matje me data të ndryshme, si te `shapeComparison`. */
function zonesOf(rows: MeasurementRow[], start: string | null): Zone[] {
  return SHAPE_MEASURES.flatMap((measure) => {
    const sides = measure.keys.flatMap((key): Side[] => {
      const points = series(rows, key)
      const from = baseline(points, start)
      const after = from ? points.filter((point) => point.date > from.date) : []
      return from && after.length > 0 ? [{ key, from, after }] : []
    })
    if (sides.length === 0) return []
    return [{ id: measure.id, keys: sides.map((side) => side.key), date: sides.map((side) => side.from.date).sort()[0], value: round1(mean(sides.map((side) => side.from.value))), sides }]
  })
}

/** Zona në një datë: çdo anë me matjen e saj të fundit deri atëherë; para bazës së anës, vetë baza. */
function zoneAt(zone: Zone, date: string): StopZone {
  const points = zone.sides.map((side) => latestUpTo(side.after, date) ?? side.from)
  const value = round1(mean(points.map((point) => point.value)))
  const measured = points.map((point) => point.date).filter((day) => day <= date)
  return { id: zone.id, value, delta: round1(value - zone.value), ratio: value / zone.value, measuredOn: measured.sort().at(-1) ?? zone.date }
}

/** Rregullat e parashikimit (SPEC §11, "Makina e kohës"). */
export const FORECAST = {
  /** Sa matje të zonës duhen, me bazën. */
  minPoints: 4,
  /** Sa ditë duhet të mbulojnë matjet e zonës. */
  minSpanDays: 21,
  /** Sa larg shkon parashikimi; kurrë më larg se sa gjatë është matur trupi. */
  horizonDays: 28,
  /** Gabimi i matjes me shirit, cm: dyshemeja e shpërndarjes, që katër pika në vijë të mos japin interval zero. */
  tapeErrorCm: 0.3,
} as const

// Student t, kuantili 0,90 (interval dyanësh 80%), për 1–30 shkallë lirie; mbi 30, normalja.
const T_80 = [
  3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372, 1.363, 1.356, 1.35, 1.345, 1.341, 1.337, 1.333, 1.33, 1.328, 1.325, 1.323, 1.321, 1.319, 1.318, 1.316, 1.315, 1.314, 1.313, 1.311,
  1.31,
]
const NORMAL_80 = 1.282

export interface Forecast {
  value: number
  low: number
  high: number
}

/**
 * Vlera e pritshme në `date`: vija e drejtë e katrorëve më të vegjël mbi matjet, me intervalin e
 * parashikimit 80% (8 nga 10 raste). Null kur matjet janë më pak se `minPoints` ose mbulojnë më pak
 * se `minSpanDays`.
 */
export function forecastPoint(points: ShapePoint[], date: string): Forecast | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const count = sorted.length
  if (count < FORECAST.minPoints) return null
  const first = dayNumber(sorted[0].date)
  const xs = sorted.map((point) => dayNumber(point.date) - first)
  if (xs.at(-1)! < FORECAST.minSpanDays) return null
  const ys = sorted.map((point) => point.value)
  const xMean = mean(xs)
  const yMean = mean(ys)
  const spread = xs.reduce((total, x) => total + (x - xMean) ** 2, 0)
  const slope = xs.reduce((total, x, index) => total + (x - xMean) * (ys[index] - yMean), 0) / spread
  const at = (x: number) => yMean + slope * (x - xMean)
  const squared = xs.reduce((total, x, index) => total + (ys[index] - at(x)) ** 2, 0)
  const deviation = Math.max(Math.sqrt(squared / (count - 2)), FORECAST.tapeErrorCm)
  const target = dayNumber(date) - first
  const half = (T_80[count - 3] ?? NORMAL_80) * deviation * Math.sqrt(1 + 1 / count + (target - xMean) ** 2 / spread)
  const value = at(target)
  return { value: round1(value), low: round1(value - half), high: round1(value + half) }
}

/**
 * Vija e kohës nga baza (`start`: dita kur nisi programi; null pa program) te matja e fundit, me
 * ndalesën e parashikimit në fund kur të paktën një zonë e ka. Null pa asnjë zonë me dy matje.
 */
export function bodyTimeline(rows: MeasurementRow[], start: string | null): BodyTimeline | null {
  const zones = zonesOf(rows, start)
  if (zones.length === 0) return null
  const dates = [...new Set(zones.flatMap((zone) => zone.sides.flatMap((side) => [side.from.date, ...side.after.map((point) => point.date)])))].sort()
  const stops: TimeStop[] = dates.map((date) => ({ date, kind: 'measured', zones: zones.filter((zone) => zone.date <= date).map((zone) => zoneAt(zone, date)) }))

  const last = stops.at(-1)!
  const horizon = Math.min(FORECAST.horizonDays, dayNumber(last.date) - dayNumber(stops[0].date))
  const target = dateOf(dayNumber(last.date) + horizon)
  let forecasts = 0
  const ahead = last.zones.map((current): StopZone => {
    // Pikat e zonës: ndalesat ku ajo u mat vërtet, me vlerën e zonës atë ditë.
    const measured = stops.flatMap((stop) => stop.zones.filter((entry) => entry.id === current.id && entry.measuredOn === stop.date).map((entry) => ({ date: stop.date, value: entry.value })))
    const forecast = forecastPoint(measured, target)
    if (!forecast) return current
    forecasts++
    const base = zones.find((zone) => zone.id === current.id)!.value
    return { ...current, value: forecast.value, delta: round1(forecast.value - base), ratio: forecast.value / base, range: [forecast.low, forecast.high] }
  })
  if (forecasts > 0) stops.push({ date: target, kind: 'forecast', zones: ahead })

  return { base: zones.map(({ id, keys, date, value }) => ({ id, keys, date, value })), stops }
}

/**
 * Forma e modelit në një pozicion të vijës (0 = baza, 1 = ndalesa e dytë; 1,5 = në mes të së dytës
 * dhe së tretës). Një zonë që mungon te njëra ndalesë merret pa ndryshim (1). `emphasis` shumëzon
 * largësinë nga 1 ("Thekso ndryshimin"), që 1–3% të shihet me sy; numrat nuk e ndjekin.
 */
export function scalesAt(stops: TimeStop[], position: number, emphasis = 1): ShapeScales {
  const clamped = Math.min(Math.max(position, 0), stops.length - 1)
  const lower = stops[Math.floor(clamped)]
  const upper = stops[Math.ceil(clamped)]
  const share = clamped - Math.floor(clamped)
  const ratioIn = (stop: TimeStop, id: ShapeMeasure) => stop.zones.find((zone) => zone.id === id)?.ratio ?? 1
  const scales: ShapeScales = {}
  for (const id of new Set([...lower.zones, ...upper.zones].map((zone) => zone.id))) {
    const from = ratioIn(lower, id)
    const ratio = share === 0 ? from : from + (ratioIn(upper, id) - from) * share
    scales[id] = emphasis === 1 ? ratio : 1 + (ratio - 1) * emphasis
  }
  return scales
}

/**
 * Sa ka ndryshuar një zonë nga baza, në tri shkallë për ngjyrën e modelit: 1 nën 1%, 2 nga 1% deri
 * në 3%, 3 mbi 3%, në të dy drejtimet; 0 pa ndryshim. Përqindja rrumbullakoset në një shifër.
 */
export function changeLevel(ratio: number): 0 | 1 | 2 | 3 {
  const percent = Math.round(Math.abs(ratio - 1) * 1000) / 10
  return percent === 0 ? 0 : percent < CHANGE_STEPS[0] ? 1 : percent <= CHANGE_STEPS[1] ? 2 : 3
}

/** Kufijtë e shkallëve të ndryshimit, në përqind. */
export const CHANGE_STEPS = [1, 3] as const

/** Zona e matjeve e çdo çelësi muskuli që ndjek një perimetër. */
export const MUSCLE_ZONE: Record<string, ShapeMeasure | undefined> = Object.fromEntries(SHAPE_MEASURES.flatMap((measure) => measure.muscles.map((key) => [key, measure.id])))
