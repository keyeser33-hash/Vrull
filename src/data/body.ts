import { allRecovery, keyLoad, loadLevel, muscleLoad } from '@/body/body-map'
import { type MeasurementRow, type ShapeComparison, shapeComparison, type ShapeScales, shapeScales } from '@/body/body-shape'
import { DEEP_ENTRIES, programRoles } from '@/body/layers'
import { MUSCLE_INFO } from '@/body/muscle-info'
import { localDay } from '@/lib/calendar'
import { planSession } from '@/program/engine'
import { previousValues, weightAverageBefore } from '@/progress/measure-form'
import { METRICS } from '@/progress/metrics'
import { type MuscleGroup, MUSCLE_GROUPS } from '@/program/muscles'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { RecoveryStatus } from '@/program/recovery'
import type { LocalStore } from './store'
import { activeProgram, trainingHistory } from './training'

// Trupi (SPEC §11, TH-19): për çdo grup muskujsh, setet e javës, niveli i hartës dhe rikuperimi.

export interface BodyGroup {
  group: MuscleGroup
  latin: string
  load: number
  level: 0 | 1 | 2 | 3
  recovery: RecoveryStatus
  hours: number | null
  /** Setet e javës për çdo çelës të grupit, me radhën e grupit, nga ushtrimet që i dinë çelësat. */
  parts: { key: string; load: number }[]
  /** Setet e grupit nga ushtrimet e bibliotekës, që dinë vetëm grupin: nuk ndahen sipas pjesëve. */
  unsplit: number
  /** Ushtrimet e javës së tanishme të programit që e punojnë grupin: kryesorët, pastaj vetëm ndihmësit (karta e muskulit, V53). */
  program: string[]
}

// Ushtrimet e Shortcut to Size kanë çelësat e saktë (Shtojca E); ato të shtuara nga biblioteka i
// marrin nga grupi i free-exercise-db (Shtojca D), p.sh. "shoulders" jep të tria kokat e deltoidit.
const PROGRAM_NAMES = new Set(SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.name.toLowerCase()))

type ExerciseRow = Awaited<ReturnType<LocalStore['all']>>[number]
const keysOf = (row: Record<string, unknown> | undefined, field: string) => (row?.[field] as string[] | undefined) ?? []

/** Ushtrimet e javës së tanishme të programit aktiv, me radhën e ditëve dhe të sloteve; bosh pa program. */
async function programWeek(store: LocalStore, exercises: ExerciseRow[]) {
  const loaded = await activeProgram(store)
  if (!loaded) return []
  const byId = new Map(exercises.map((row) => [row.id, row]))
  return [...loaded.engine.days]
    .sort((a, b) => a.position - b.position)
    .flatMap((day) => planSession(loaded.engine, { ...loaded.pointer, dayId: day.id, completed: false }).slots)
    .map((slot) => byId.get(slot.exerciseId))
    .filter((row) => row !== undefined)
    .map((row) => ({ name: String(row.name), primary: keysOf(row, 'primary_muscles'), secondary: keysOf(row, 'secondary_muscles') }))
}

export async function bodyView(store: LocalStore, now: Date): Promise<BodyGroup[]> {
  const [history, exercises] = await Promise.all([trainingHistory(store), store.all('exercises')])
  const week = await programWeek(store, exercises)
  const primary = Object.fromEntries(exercises.map((row) => [row.id, (row.primary_muscles as string[] | undefined) ?? []]))
  const secondary = Object.fromEntries(exercises.map((row) => [row.id, (row.secondary_muscles as string[] | undefined) ?? []]))
  const load = muscleLoad(history.sets, primary, secondary, MUSCLE_GROUPS, now)
  const recovery = allRecovery(MUSCLE_GROUPS, history.worked, now)
  const groupOnly = new Set(exercises.filter((row) => !PROGRAM_NAMES.has(String(row.name).toLowerCase())).map((row) => row.id))
  const byKey = keyLoad(history.sets.filter((set) => !groupOnly.has(set.exerciseId)), primary, secondary, now)
  const unsplit = muscleLoad(history.sets.filter((set) => groupOnly.has(set.exerciseId)), primary, secondary, MUSCLE_GROUPS, now)
  return MUSCLE_GROUPS.map((group) => ({
    group,
    latin: MUSCLE_INFO[group.id]?.latin ?? '',
    load: load.get(group.id) ?? 0,
    level: loadLevel(load.get(group.id) ?? 0),
    recovery: recovery.get(group.id)!.status,
    hours: recovery.get(group.id)!.hours,
    parts: group.keys.map((key) => ({ key, load: byKey.get(key) ?? 0 })),
    unsplit: unsplit.get(group.id) ?? 0,
    program: Object.values(programRoles(group.keys, week)).flat(),
  }))
}

export interface LayerEntry {
  /** Id-ja e zgjedhjes te `DEEP_ENTRIES` (body/layers.ts). */
  id: string
  /** Setet e kësaj jave për muskulin e thellë (kryesori 1, ndihmësi 0,5), si pjesët e grupit. */
  load: number
  /** Ushtrimet e javës së tanishme të programit ku punon: kryesor, pastaj vetëm ndihmës. */
  roles: { primary: string[]; secondary: string[] }
}

/** Shtresat (V2-E1-14, TH-19): për çdo muskul të thellë, setet e javës dhe ku punon te programi. */
export async function layersView(store: LocalStore, now: Date): Promise<LayerEntry[]> {
  const [history, exercises] = await Promise.all([trainingHistory(store), store.all('exercises')])
  const primary = Object.fromEntries(exercises.map((row) => [row.id, keysOf(row, 'primary_muscles')]))
  const secondary = Object.fromEntries(exercises.map((row) => [row.id, keysOf(row, 'secondary_muscles')]))
  // Si te pjesët e grupit: vetëm ushtrimet që i dinë çelësat (jo ato të bibliotekës me grupin).
  const groupOnly = new Set(exercises.filter((row) => !PROGRAM_NAMES.has(String(row.name).toLowerCase())).map((row) => row.id))
  const sets = history.sets.filter((set) => !groupOnly.has(set.exerciseId))
  const load = muscleLoad(sets, primary, secondary, DEEP_ENTRIES.map((entry) => ({ id: entry.id, name: entry.id, keys: entry.keys })), now)
  const week = await programWeek(store, exercises)
  return DEEP_ENTRIES.map((entry) => ({ id: entry.id, load: load.get(entry.id) ?? 0, roles: programRoles(entry.keys, week) }))
}

export interface ShapeView {
  comparison: ShapeComparison | null
  /** Dita kur nisi programi aktiv (Java 0); null pa program ose para stërvitjes së parë. */
  start: string | null
  /** Emri i bllokut të parë të programit ("Java 0"); null pa program. */
  startLabel: string | null
  /** Shkalla e modelit "Sot" për çdo zonë. */
  scales: ShapeScales
  /** Pesha e fundit e matur (kg), për modelin bazë të gjendjes bosh; null pa peshë. */
  weightKg: number | null
  /** A ka të paktën një perimetër të matur (pa peshën). */
  hasCircumference: boolean
}

/** Trupi sipas matjeve (V12, V2-E1-14): perimetrat nga Java 0 te matja e fundit. */
export async function shapeView(store: LocalStore): Promise<ShapeView> {
  const [measurements, loaded] = await Promise.all([measurementRows(store), activeProgram(store)])
  const startedAt = loaded?.state.started_at as string | null | undefined
  const start = startedAt ? localDay(startedAt) : null
  const first = loaded ? [...loaded.engine.blocks].sort((a, b) => a.position - b.position)[0] : undefined
  const comparison = shapeComparison(measurements, start)
  const weights = measurements.filter((row) => row.values.weight_kg !== null && row.values.weight_kg !== undefined).sort((a, b) => a.date.localeCompare(b.date))
  const hasCircumference = measurements.some((row) => METRICS.some((metric) => metric.key !== 'weight_kg' && row.values[metric.key] !== null && row.values[metric.key] !== undefined))
  return { comparison, start, startLabel: first?.name ?? null, scales: shapeScales(comparison), weightKg: weights.at(-1)?.values.weight_kg ?? null, hasCircumference }
}

/** Të gjitha matjet, një rresht për datë, me vlerat si numra (null kur mungojnë). */
async function measurementRows(store: LocalStore): Promise<MeasurementRow[]> {
  const rows = await store.all('body_measurements')
  return rows.map((row) => ({
    date: String(row.date),
    values: Object.fromEntries(METRICS.map((metric) => [metric.key, row[metric.key] === null || row[metric.key] === undefined ? null : Number(row[metric.key])])),
  }))
}

export interface MeasureContext {
  /** Data e formës; ekrani pret kontekstin e datës së re para se ta mbushë. */
  date: string
  /** Matja e ruajtur në këtë datë (ndryshohet), ose null për një matje të re. */
  saved: MeasurementRow['values'] | null
  /** Vlera e fundit e çdo matjeje para datës. */
  previous: ReturnType<typeof previousValues>
  /** Mesatarja 7-ditore e peshës para datës. */
  average: number | null
}

/** Çfarë i duhet formës "Shto matjen" për një datë (bordi "Trupi · Shto matjen"). */
export async function measureContext(store: LocalStore, date: string): Promise<MeasureContext> {
  const rows = await measurementRows(store)
  return { date, saved: rows.find((row) => row.date === date)?.values ?? null, previous: previousValues(rows, date), average: weightAverageBefore(rows, date) }
}

