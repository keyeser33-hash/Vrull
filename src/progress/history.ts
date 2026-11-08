import { localDate } from '@/lib/calendar'
import { e1rm, e1rmRecord, type HistorySet } from '@/program/loads'
import type { MuscleGroup } from '@/program/muscles'
import type { Target, Technique } from '@/program/types'

// Historiku i seancave (V2-E1-15), pa UI dhe pa bazë. Rekordet nuk ruhen: llogariten nga setet,
// secili kundrejt vetëm seteve para tij (`e1rmRecord` i §0.3a), ndaj ndryshimi i një seti të kaluar
// i rillogarit vetë, edhe rekordet që vijnë pas tij.

export interface SetRecord {
  e1rmKg: number
  previousBestKg: number
  gainKg: number
}

const chronological = (a: HistorySet, b: HistorySet) => a.loggedAt.localeCompare(b.loggedAt) || a.id.localeCompare(b.id)

/** Rekordi i e1RM-së i çdo seti në kohën kur u bë: krahasuar vetëm me setet e ushtrimit para tij. */
export function recordsAtTheTime(history: HistorySet[]): Map<string, SetRecord> {
  const byExercise = new Map<string, HistorySet[]>()
  for (const entry of [...history].sort(chronological)) {
    byExercise.set(entry.exerciseId, [...(byExercise.get(entry.exerciseId) ?? []), entry])
  }
  const records = new Map<string, SetRecord>()
  for (const sets of byExercise.values()) {
    sets.forEach((entry, index) => {
      const record = e1rmRecord(entry, sets.slice(0, index))
      if (record) records.set(entry.id, record)
    })
  }
  return records
}

const setE1rm = (entry: HistorySet) => (entry.isWarmup ? null : e1rm(entry.weightKg, entry.reps, entry.rir))

/** Parapamja e një seti të ndryshuar: e1RM-ja e re dhe nëse do të ishte rekord në kohën e vet. */
export function previewEdit(
  history: HistorySet[],
  setId: string,
  change: { weightKg: number | null; reps: number; rir: number | null },
): { e1rmKg: number | null; record: SetRecord | null } {
  const edited = history.map((entry) => (entry.id === setId ? { ...entry, ...change } : entry))
  const target = edited.find((entry) => entry.id === setId)
  if (!target) return { e1rmKg: null, record: null }
  return { e1rmKg: setE1rm(target), record: recordsAtTheTime(edited).get(setId) ?? null }
}

export interface ExerciseRecord {
  exerciseId: string
  setId: string
  e1rmKg: number
  /** Më i miri para seancës (0 kur setet e mëparshme s'kanë e1RM). */
  previousBestKg: number
  gainKg: number
  /** Seti që mbante më të mirin para seancës ("50 × 14, RIR 2" i Javës 0). */
  previous: HistorySet | null
}

/**
 * Rekordi i çdo ushtrimi të seancës: seti me e1RM-në më të lartë nga ata që thyen rekord, me
 * shtesën kundrejt më të mirit para seancës. Radha: si ushtrimet në seancë.
 */
export function sessionRecords(history: HistorySet[], sessionId: string, records = recordsAtTheTime(history)): ExerciseRecord[] {
  const sorted = [...history].sort(chronological)
  const mine = sorted.filter((entry) => entry.sessionId === sessionId && !entry.isWarmup)
  const exerciseIds = [...new Set(mine.map((entry) => entry.exerciseId))]
  return exerciseIds.flatMap((exerciseId) => {
    const sets = mine.filter((entry) => entry.exerciseId === exerciseId)
    const best = sets
      .filter((entry) => records.has(entry.id))
      .reduce<HistorySet | null>((top, entry) => (top && (setE1rm(top) ?? 0) >= (setE1rm(entry) ?? 0) ? top : entry), null)
    if (!best) return []
    const firstAt = sets[0].loggedAt
    const before = sorted.filter((entry) => entry.exerciseId === exerciseId && entry.sessionId !== sessionId && entry.loggedAt < firstAt && setE1rm(entry) !== null)
    // I fundit nga më të mirët e barabartë: referenca më e afërt në kohë.
    const previous = before.reduce<HistorySet | null>((top, entry) => (top && (setE1rm(top) ?? 0) > (setE1rm(entry) ?? 0) ? top : entry), null)
    const e1rmKg = setE1rm(best)!
    const previousBestKg = previous ? setE1rm(previous)! : 0
    return [{ exerciseId, setId: best.id, e1rmKg, previousBestKg, gainKg: e1rmKg - previousBestKg, previous }]
  })
}

/** Setet e seancës për çdo grup (kryesori 1, ndihmësi 0,5, si te Volumi javor), nga më i madhi. */
export function sessionVolume(
  sets: { exerciseId: string; isWarmup: boolean }[],
  muscles: Record<string, { primary: string[]; secondary: string[] }>,
  groups: MuscleGroup[],
): { groupId: string; sets: number }[] {
  const load = new Map(groups.map((group) => [group.id, 0]))
  for (const entry of sets) {
    if (entry.isWarmup) continue
    const { primary = [], secondary = [] } = muscles[entry.exerciseId] ?? {}
    for (const group of groups) {
      if (primary.some((key) => group.keys.includes(key))) load.set(group.id, load.get(group.id)! + 1)
      else if (secondary.some((key) => group.keys.includes(key))) load.set(group.id, load.get(group.id)! + 0.5)
    }
  }
  return groups
    .map((group) => ({ groupId: group.id, sets: load.get(group.id)! }))
    .filter((entry) => entry.sets > 0)
    .sort((a, b) => b.sets - a.sets)
}

export type DayTheme = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'abs'

const THEME_KEYS: [DayTheme, string[]][] = [
  ['chest', ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor']],
  ['back', ['latissimus_dorsi', 'rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus', 'erector_spinae']],
  ['shoulders', ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'trapezius']],
  ['arms', ['biceps_brachii', 'brachialis', 'triceps_brachii', 'brachioradialis', 'forearm_flexors']],
  ['abs', ['rectus_abdominis', 'external_oblique']],
  [
    'legs',
    [
      'rectus_femoris',
      'vastus_lateralis',
      'vastus_medialis',
      'biceps_femoris',
      'semitendinosus',
      'semimembranosus',
      'gluteus_maximus',
      'gluteus_medius',
      'tensor_fasciae_latae',
      'adductor_magnus',
      'adductor_longus',
      'gastrocnemius',
      'soleus',
    ],
  ],
]

/** "Dita e gjoksit": nga muskuli kryesor i parë i ushtrimit të parë të seancës; null kur s'njihet. */
export function dayTheme(primary: string[]): DayTheme | null {
  for (const key of primary) {
    const found = THEME_KEYS.find(([, keys]) => keys.includes(key))
    if (found) return found[0]
  }
  return null
}

/** Minutat e seancës, të rrumbullakosura; null pa fillim ose pa mbyllje. */
export function durationMinutes(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null
  const minutes = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000)
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null
}

export interface WeekGroup<S> {
  /** programi|xhiro|blloku|java */
  key: string
  sessions: S[]
}

/** Seancat sipas javës së programit (xhiro, bllok, javë), java më e re e para dhe brenda saj seanca më e re. */
export function byProgramWeek<S extends { programId: string | null; run: number; blockId: string | null; week: number; endedAt: string }>(
  sessions: S[],
): WeekGroup<S>[] {
  const groups = new Map<string, S[]>()
  for (const session of [...sessions].sort((a, b) => b.endedAt.localeCompare(a.endedAt))) {
    const key = `${session.programId ?? ''}|${session.run}|${session.blockId ?? ''}|${session.week}`
    groups.set(key, [...(groups.get(key) ?? []), session])
  }
  return [...groups.entries()].map(([key, list]) => ({ key, sessions: list }))
}

export interface DayMark {
  date: string
  day: number
  kind: 'session' | 'rest' | 'future'
  today: boolean
  /** Dita e parë e javës së programit (etiketat 1, 8, 15… poshtë shiritave). */
  weekStart: boolean
}

/** Ditët e muajit (monthIndex 0–11) për kalendarin e historikut; weekStartDay 0 = e diel … 6 = e shtunë. */
export function monthMarks(year: number, monthIndex: number, sessionDates: Set<string>, today: string, weekStartDay: number): DayMark[] {
  const days = new Date(year, monthIndex + 1, 0).getDate()
  return Array.from({ length: days }, (_, index) => {
    const at = new Date(year, monthIndex, index + 1)
    const date = localDate(at)
    const kind = sessionDates.has(date) ? 'session' : date > today ? 'future' : 'rest'
    return { date, day: index + 1, kind, today: date === today, weekStart: at.getDay() === weekStartDay }
  })
}

export interface RepRange {
  min: number
  max: number | null
}

export interface TargetSummary {
  /** Intervali i shumicës së ushtrimeve ("12–15"). */
  main: RepRange | null
  /** Të tjerët, me grupin e ushtrimeve ("pulpat 25–30"). */
  others: { groupIds: string[]; range: RepRange }[]
  techniques: Exclude<Technique['type'], 'none'>[]
}

/** "12–15 · pulpat 25–30 · + rest-pause": recetat e seancës me intervale përsëritjesh. */
export function targetSummary(slots: { target: Target; technique: Technique; groupId: string | null }[]): TargetSummary {
  const ranges = new Map<string, { range: RepRange; count: number; groupIds: string[] }>()
  for (const slot of slots) {
    if (slot.target.kind !== 'reps' || slot.target.min <= 0) continue
    const range = { min: slot.target.min, max: slot.target.max }
    const key = `${range.min}-${range.max}`
    const entry = ranges.get(key) ?? { range, count: 0, groupIds: [] }
    entry.count += 1
    if (slot.groupId && !entry.groupIds.includes(slot.groupId)) entry.groupIds.push(slot.groupId)
    ranges.set(key, entry)
  }
  const entries = [...ranges.values()]
  const main = entries.reduce<(typeof entries)[number] | null>((top, entry) => (top && top.count >= entry.count ? top : entry), null)
  const techniques = [...new Set(slots.map((slot) => slot.technique.type))].filter((type): type is TargetSummary['techniques'][number] => type !== 'none')
  return {
    main: main?.range ?? null,
    others: entries.filter((entry) => entry !== main).map((entry) => ({ groupIds: entry.groupIds, range: entry.range })),
    techniques,
  }
}
