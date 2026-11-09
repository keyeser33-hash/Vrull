import type { MetricKey } from '@/progress/metrics'

// Trupi sipas matjeve (V12, V2-E1-14; bordi "Matjet"). Për çdo perimetër, vlera e Javës 0 (e fundit
// deri në nisjen e programit, ose e para pas saj) dhe matja e fundit. Modeli 3D e ndjek me raportin
// e dy vlerave: perimetri është proporcional me rrezen, ndaj muskujt e zonës largohen nga boshti i saj
// (x dhe z) me të njëjtin raport; lartësia nuk ndryshon. Trungu ka një bosht në mes të trupit
// (modeli është i qendërzuar në x = 0, z = 0); krahët dhe këmbët kanë boshtin e secilës anë.

export type ShapeMeasure = 'arm' | 'chest' | 'waist' | 'thigh' | 'shoulders' | 'neck' | 'hips' | 'forearm' | 'calf'

export interface ShapeDef {
  id: ShapeMeasure
  /** Matjet e bazës; te gjymtyrët ana e djathtë e para (ajo e formës "Shto matjen"), pastaj e majta. */
  keys: MetricKey[]
  /** Çelësat e modelit (Shtojca D) që ndjekin perimetrin. */
  muscles: string[]
  /** `trunk`: një bosht në mes; `limb`: boshti i secilës anë. */
  axis: 'trunk' | 'limb'
  /** Ku lidhet etiketa te figura: në mes të trupit ose te ana. */
  anchor: 'mid' | 'side'
}

/** Me radhën e bordit (krahu, gjoksi, beli, kofsha), pastaj të tjerat. */
export const SHAPE_MEASURES: ShapeDef[] = [
  { id: 'arm', keys: ['arm_right_cm', 'arm_left_cm'], muscles: ['biceps_brachii', 'brachialis', 'triceps_brachii'], axis: 'limb', anchor: 'side' },
  { id: 'chest', keys: ['chest_cm'], muscles: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor'], axis: 'trunk', anchor: 'mid' },
  { id: 'waist', keys: ['waist_cm'], muscles: ['rectus_abdominis', 'external_oblique'], axis: 'trunk', anchor: 'mid' },
  {
    id: 'thigh',
    keys: ['thigh_right_cm', 'thigh_left_cm'],
    muscles: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'biceps_femoris', 'semitendinosus', 'semimembranosus', 'adductor_magnus', 'adductor_longus'],
    axis: 'limb',
    anchor: 'side',
  },
  { id: 'shoulders', keys: ['shoulders_cm'], muscles: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'], axis: 'trunk', anchor: 'side' },
  { id: 'neck', keys: ['neck_cm'], muscles: ['sternocleidomastoid'], axis: 'trunk', anchor: 'mid' },
  { id: 'hips', keys: ['hips_cm'], muscles: ['gluteus_maximus', 'gluteus_medius', 'tensor_fasciae_latae'], axis: 'trunk', anchor: 'mid' },
  { id: 'forearm', keys: ['forearm_right_cm', 'forearm_left_cm'], muscles: ['brachioradialis', 'forearm_flexors'], axis: 'limb', anchor: 'side' },
  { id: 'calf', keys: ['calf_right_cm', 'calf_left_cm'], muscles: ['gastrocnemius', 'soleus'], axis: 'limb', anchor: 'side' },
]

export interface MeasurementRow {
  date: string
  values: Partial<Record<MetricKey, number | null>>
}

export interface ShapePoint {
  date: string
  value: number
}

export interface ShapeChange {
  id: ShapeMeasure
  /** Anët e matura në të dyja skajet (te trungu, vetëm një çelës). */
  keys: MetricKey[]
  from: ShapePoint
  to: ShapePoint
  /** Ndryshimi në cm, një shifër pas presjes. */
  delta: number
  /** to / from: shkalla e modelit për këtë zonë. */
  ratio: number
}

export interface ShapeComparison {
  /** Data më e hershme e bazës dhe data e matjes së fundit. */
  from: string
  to: string
  changes: ShapeChange[]
}

export const round1 = (value: number) => Math.round(value * 10) / 10
const DAY_MS = 86_400_000

/** Matjet e një çelësi me radhën e datave. */
export function series(rows: MeasurementRow[], key: MetricKey): ShapePoint[] {
  return rows
    .filter((row) => typeof row.values[key] === 'number')
    .map((row) => ({ date: row.date, value: Number(row.values[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Baza e një matjeje: e fundit deri në `start` (përfshirë), përndryshe e para pas saj. */
export function baseline(points: ShapePoint[], start: string | null): ShapePoint | undefined {
  if (!start) return points[0]
  return points.filter((point) => point.date <= start).at(-1) ?? points.find((point) => point.date > start)
}

/**
 * Perimetrat nga Java 0 (`start`: dita kur nisi programi; null pa program) te matja e fundit. Një
 * perimetër hyn kur ka të paktën dy matje me data të ndryshme; te gjymtyrët merret mesatarja e
 * anëve të matura në të dyja skajet. Null kur asnjë perimetër nuk ka ndryshim për të treguar.
 */
export function shapeComparison(rows: MeasurementRow[], start: string | null): ShapeComparison | null {
  const changes: ShapeChange[] = []
  for (const measure of SHAPE_MEASURES) {
    const sides = measure.keys
      .map((key) => {
        const points = series(rows, key)
        return { key, from: baseline(points, start), to: points.at(-1) }
      })
      .filter((side): side is { key: MetricKey; from: ShapePoint; to: ShapePoint } => Boolean(side.from && side.to && side.to.date > side.from.date))
    if (sides.length === 0) continue
    const mean = (values: number[]) => round1(values.reduce((total, value) => total + value, 0) / values.length)
    const from = { date: sides.map((side) => side.from.date).sort()[0], value: mean(sides.map((side) => side.from.value)) }
    const to = { date: sides.map((side) => side.to.date).sort().at(-1)!, value: mean(sides.map((side) => side.to.value)) }
    changes.push({ id: measure.id, keys: sides.map((side) => side.key), from, to, delta: round1(to.value - from.value), ratio: to.value / from.value })
  }
  if (changes.length === 0) return null
  return {
    from: changes.map((change) => change.from.date).sort()[0],
    to: changes.map((change) => change.to.date).sort().at(-1)!,
    changes,
  }
}

export type ShapeScales = Partial<Record<ShapeMeasure, number>>

/** Shkalla e modelit "Sot" për çdo zonë me ndryshim; modeli i Javës 0 merr {}. */
export function shapeScales(comparison: ShapeComparison | null): ShapeScales {
  return Object.fromEntries((comparison?.changes ?? []).map((change) => [change.id, change.ratio]))
}

/**
 * Si quhet baza te krahasimi: me emrin e bllokut të parë ("Java 0") kur bie deri në fund të javës
 * së nisjes, përndryshe "matja e parë" (p.sh. perimetrat u matën vetëm në javën e tretë).
 */
export function baselineKind(from: string, start: string | null): 'start' | 'first' {
  if (!start) return 'first'
  const days = (Date.parse(`${from}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS
  return days < 7 ? 'start' : 'first'
}

export type Vec3 = [number, number, number]
export interface Box {
  min: Vec3
  max: Vec3
}

/** Kutia e kulmeve të një ane (majtas x < 0, djathtas x ≥ 0) ose të të gjithave; null kur s'ka kulme. */
export function sideBox(arrays: ArrayLike<number>[], side: 'left' | 'right' | 'all'): Box | null {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  let found = false
  for (const positions of arrays) {
    for (let index = 0; index + 2 < positions.length; index += 3) {
      const x = positions[index]
      if ((side === 'left' && x >= 0) || (side === 'right' && x < 0)) continue
      found = true
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[index + axis]
        if (value < min[axis]) min[axis] = value
        if (value > max[axis]) max[axis] = value
      }
    }
  }
  return found ? { min, max } : null
}

/** Qendra e një kutie, [x, y, z]. */
export const boxCenter = (box: Box): Vec3 => [0, 1, 2].map((axis) => (box.min[axis] + box.max[axis]) / 2) as Vec3

export type AxisCenters = [number, number] | { left: [number, number]; right: [number, number] }

/** Boshti i secilës anë të një gjymtyre: mesi i kutisë së anës në x dhe z. */
export function limbCenters(arrays: ArrayLike<number>[]): { left: [number, number]; right: [number, number] } {
  const center = (side: 'left' | 'right'): [number, number] => {
    const box = sideBox(arrays, side)
    if (!box) return [0, 0]
    const [x, , z] = boxCenter(box)
    return [x, z]
  }
  return { left: center('left'), right: center('right') }
}

/**
 * Kulmet e një muskuli me perimetrin e shkallëzuar: largësia nga boshti (x, z) shumëzohet me
 * `scale`, lartësia mbetet. Kthen një kopje; burimi mbetet modeli origjinal.
 */
export function morphPositions(source: ArrayLike<number>, scale: number, centers: AxisCenters): Float32Array {
  const result = Float32Array.from(source)
  if (scale === 1) return result
  for (let index = 0; index + 2 < result.length; index += 3) {
    const [cx, cz] = Array.isArray(centers) ? centers : result[index] < 0 ? centers.left : centers.right
    result[index] = cx + (result[index] - cx) * scale
    result[index + 2] = cz + (result[index + 2] - cz) * scale
  }
  return result
}
