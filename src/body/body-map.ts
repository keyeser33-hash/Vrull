import { type LibraryExercise, muscleKeys } from '@/program/library'
import type { HistorySet } from '@/program/loads'
import type { MuscleGroup } from '@/program/muscles'
import { recoveryStatus, type RecoveryStatus, type WorkedSession } from '@/program/recovery'

// Harta e trupit (SPEC §11): ngarkesa e javës për çdo grup (kryesori 1 set, ndihmësi 0,5) dhe
// gjendja e rikuperimit sipas orëve nga seanca e fundit ku grupi ishte kryesor.

const pad = (value: number) => String(value).padStart(2, '0')
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Setet e kësaj jave (nga e hëna) për çdo grup, sipas id-së së grupit. */
export function muscleLoad(
  sets: HistorySet[],
  primary: Record<string, string[]>,
  secondary: Record<string, string[]>,
  groups: MuscleGroup[],
  now: Date,
): Map<string, number> {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const start = isoDate(monday)
  const end = isoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))
  const load = new Map(groups.map((group) => [group.id, 0]))
  for (const set of sets) {
    const date = set.loggedAt.slice(0, 10)
    if (set.isWarmup || date < start || date >= end) continue
    for (const group of groups) {
      if ((primary[set.exerciseId] ?? []).some((key) => group.keys.includes(key))) load.set(group.id, load.get(group.id)! + 1)
      else if ((secondary[set.exerciseId] ?? []).some((key) => group.keys.includes(key))) load.set(group.id, load.get(group.id)! + 0.5)
    }
  }
  return load
}

export const LOAD_LEVELS = [
  { level: 0, label: 'Pa sete' },
  { level: 1, label: '1–5 sete' },
  { level: 2, label: '6–11 sete' },
  { level: 3, label: '12+ sete' },
] as const

export function loadLevel(load: number): 0 | 1 | 2 | 3 {
  if (load <= 0) return 0
  if (load < 6) return 1
  if (load < 12) return 2
  return 3
}

/** Gjendja e rikuperimit e çdo grupi, sipas id-së. */
export function allRecovery(groups: MuscleGroup[], sessions: WorkedSession[], now: Date): Map<string, { status: RecoveryStatus; hours: number | null }> {
  return new Map(
    groups.map((group) => {
      const times = sessions.filter((session) => session.primaryKeys.some((key) => group.keys.includes(key))).map((session) => Date.parse(session.endedAt))
      const hours = times.length ? Math.round((now.getTime() - Math.max(...times)) / 3_600_000) : null
      return [group.id, { status: recoveryStatus(hours), hours }]
    }),
  )
}

/** Ushtrimet e bibliotekës ku grupi është kryesor, sipas emrit. */
export function libraryExercisesFor(library: LibraryExercise[], group: MuscleGroup, limit = 12): LibraryExercise[] {
  return library
    .filter((exercise) => muscleKeys(exercise.primary).some((key) => group.keys.includes(key)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
}
