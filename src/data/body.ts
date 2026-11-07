import { allRecovery, keyLoad, loadLevel, muscleLoad } from '@/body/body-map'
import { MUSCLE_INFO } from '@/body/muscle-info'
import { type MuscleGroup, MUSCLE_GROUPS } from '@/program/muscles'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { RecoveryStatus } from '@/program/recovery'
import type { LocalStore } from './store'
import { trainingHistory } from './training'

// Trupi (SPEC §11, TH-19): për çdo grup muskujsh, setet e javës, niveli i hartës dhe rikuperimi.

export interface BodyGroup {
  group: MuscleGroup
  latin: string
  role: string
  load: number
  level: 0 | 1 | 2 | 3
  recovery: RecoveryStatus
  hours: number | null
  /** Setet e javës për çdo çelës të grupit, me radhën e grupit, nga ushtrimet që i dinë çelësat. */
  parts: { key: string; load: number }[]
  /** Setet e grupit nga ushtrimet e bibliotekës, që dinë vetëm grupin: nuk ndahen sipas pjesëve. */
  unsplit: number
}

// Ushtrimet e Shortcut to Size kanë çelësat e saktë (Shtojca E); ato të shtuara nga biblioteka i
// marrin nga grupi i free-exercise-db (Shtojca D), p.sh. "shoulders" jep të tria kokat e deltoidit.
const PROGRAM_NAMES = new Set(SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.name.toLowerCase()))

export async function bodyView(store: LocalStore, now: Date): Promise<BodyGroup[]> {
  const [history, exercises] = await Promise.all([trainingHistory(store), store.all('exercises')])
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
    role: MUSCLE_INFO[group.id]?.role ?? '',
    load: load.get(group.id) ?? 0,
    level: loadLevel(load.get(group.id) ?? 0),
    recovery: recovery.get(group.id)!.status,
    hours: recovery.get(group.id)!.hours,
    parts: group.keys.map((key) => ({ key, load: byKey.get(key) ?? 0 })),
    unsplit: unsplit.get(group.id) ?? 0,
  }))
}
