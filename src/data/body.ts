import { allRecovery, loadLevel, muscleLoad } from '@/body/body-map'
import { MUSCLE_INFO } from '@/body/muscle-info'
import { type MuscleGroup, MUSCLE_GROUPS } from '@/program/muscles'
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
}

export async function bodyView(store: LocalStore, now: Date): Promise<BodyGroup[]> {
  const [history, exercises] = await Promise.all([trainingHistory(store), store.all('exercises')])
  const primary = Object.fromEntries(exercises.map((row) => [row.id, (row.primary_muscles as string[] | undefined) ?? []]))
  const secondary = Object.fromEntries(exercises.map((row) => [row.id, (row.secondary_muscles as string[] | undefined) ?? []]))
  const load = muscleLoad(history.sets, primary, secondary, MUSCLE_GROUPS, now)
  const recovery = allRecovery(MUSCLE_GROUPS, history.worked, now)
  return MUSCLE_GROUPS.map((group) => ({
    group,
    latin: MUSCLE_INFO[group.id]?.latin ?? '',
    role: MUSCLE_INFO[group.id]?.role ?? '',
    load: load.get(group.id) ?? 0,
    level: loadLevel(load.get(group.id) ?? 0),
    recovery: recovery.get(group.id)!.status,
    hours: recovery.get(group.id)!.hours,
  }))
}
