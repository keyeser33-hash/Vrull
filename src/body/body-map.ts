import { type LibraryExercise, muscleKeys } from '@/program/library'
import type { HistorySet } from '@/program/loads'
import type { MuscleGroup } from '@/program/muscles'
import { recoveryStatus, type RecoveryStatus, type WorkedSession } from '@/program/recovery'
import { localDay, weekRange } from '@/lib/calendar'

// Harta e trupit (SPEC §11): volumi i javës për çdo grup (kryesori 1 set, ndihmësi 0,5) dhe
// gjendja e rikuperimit sipas orëve nga seanca e fundit ku grupi ishte kryesor.

/** Setet e punës të javës kalendarike të `now`, sipas orës së telefonit. */
function workSetsOfWeek(sets: HistorySet[], now: Date) {
  const [start, end] = weekRange(now)
  return sets.filter((set) => {
    const date = localDay(set.loggedAt)
    return !set.isWarmup && date >= start && date < end
  })
}

/** Setet e kësaj jave (nga e hëna) për çdo grup, sipas id-së së grupit. */
export function muscleLoad(
  sets: HistorySet[],
  primary: Record<string, string[]>,
  secondary: Record<string, string[]>,
  groups: MuscleGroup[],
  now: Date,
): Map<string, number> {
  const load = new Map(groups.map((group) => [group.id, 0]))
  for (const set of workSetsOfWeek(sets, now)) {
    for (const group of groups) {
      if ((primary[set.exerciseId] ?? []).some((key) => group.keys.includes(key))) load.set(group.id, load.get(group.id)! + 1)
      else if ((secondary[set.exerciseId] ?? []).some((key) => group.keys.includes(key))) load.set(group.id, load.get(group.id)! + 0.5)
    }
  }
  return load
}

/**
 * Nivelet e hartës sipas objektivit javor për grup: 10–20 sete (Baz-Valle et al. 2022; me
 * numërimin kryesori 1, ndihmësi 0,5 si te Pelland et al. 2026). Mbi 20 fitimi shtesë është i vogël.
 */
export const WEEKLY_TARGET = { min: 10, max: 20 } as const

export const LOAD_LEVELS = [
  { level: 0, label: 'Pa sete' },
  { level: 1, label: `Nën ${WEEKLY_TARGET.min}` },
  { level: 2, label: `${WEEKLY_TARGET.min}–${WEEKLY_TARGET.max} · objektivi` },
  { level: 3, label: `Mbi ${WEEKLY_TARGET.max}` },
] as const

export function loadLevel(load: number): 0 | 1 | 2 | 3 {
  if (load <= 0) return 0
  if (load < WEEKLY_TARGET.min) return 1
  if (load <= WEEKLY_TARGET.max) return 2
  return 3
}

/** Ku bie volumi i javës kundrejt objektivit, me fjalë; pa sete është nën objektiv. */
export function targetText(load: number) {
  return ['Nën objektiv', 'Nën objektiv', 'Në objektiv', 'Mbi objektiv'][loadLevel(load)]
}

/** Setet e kësaj jave për çdo çelës muskuli (kryesori 1, ndihmësi 0,5): pjesët brenda një grupi. */
export function keyLoad(sets: HistorySet[], primary: Record<string, string[]>, secondary: Record<string, string[]>, now: Date): Map<string, number> {
  const load = new Map<string, number>()
  const add = (key: string, value: number) => load.set(key, (load.get(key) ?? 0) + value)
  for (const set of workSetsOfWeek(sets, now)) {
    const main = primary[set.exerciseId] ?? []
    for (const key of main) add(key, 1)
    for (const key of secondary[set.exerciseId] ?? []) if (!main.includes(key)) add(key, 0.5)
  }
  return load
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
