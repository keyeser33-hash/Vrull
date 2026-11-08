import { planSession } from '@/program/engine'
import { e1rm, type HistorySet } from '@/program/loads'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { Equipment, PlannedSlot, Target, Technique, Tracking } from '@/program/types'
import {
  byProgramWeek,
  type DayTheme,
  dayTheme,
  durationMinutes,
  type ExerciseRecord,
  recordsAtTheTime,
  sessionRecords,
  sessionVolume,
  type SetRecord,
  targetSummary,
  type TargetSummary,
} from '@/progress/history'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { programModel, trainingHistory } from './training'

// Historiku i seancave (V2-E1-15; bordet "Hist-Seancat" dhe "Hist-Seanca"): seancat e mbyllura sipas
// javës së programit, seanca e kaluar me setet dhe rekordet, dhe ndryshimi i një seti. Rekordet nuk
// ruhen: llogariten nga setet (src/progress/history.ts), ndaj një set i ndryshuar i rillogarit kudo,
// edhe te një telefon tjetër pas sinkronizimit. Logjika e stërvitjes mbetet te training.ts.

export interface SessionRecordLine {
  exerciseId: string
  name: string
  e1rmKg: number
}

export interface HistorySession {
  id: string
  programId: string | null
  run: number
  blockId: string | null
  week: number
  /** Data lokale e seancës (YYYY-MM-DD). */
  date: string
  startedAt: string | null
  endedAt: string
  minutes: number | null
  /** "Java 0", "Faza 1"; null kur blloku nuk ekziston më. */
  blockName: string | null
  blockWeeks: number
  dayNumber: number | null
  dayName: string | null
  /** Setet e punës (pa ngrohjet); segmentet e rest-pause janë pjesë e setit. */
  workSets: number
  records: SessionRecordLine[]
}

export interface HistoryWeek {
  key: string
  programName: string | null
  run: number
  blockName: string | null
  blockWeeks: number
  week: number
  /** Stërvitjet e mbyllura të javës dhe ditët e programit ("1 nga 4"). */
  done: number
  days: number
  sessions: HistorySession[]
}

export interface HistoryOverview {
  /** Programi aktiv ("Shortcut to Size"). */
  programName: string | null
  total: number
  /** Data e seancës së parë. */
  first: string | null
  /** Dita e javës kur nis java e programit: 0 = e diel … 6 = e shtunë. */
  weekStart: number
  weeks: HistoryWeek[]
  /** Seancat dhe rekordet e çdo date, për kalendarin e muajit. */
  byDate: Record<string, { sessions: number; records: number }>
}

const byPosition = (a: LocalRow, b: LocalRow) => Number(a.position) - Number(b.position)

async function activeProgramId(store: LocalStore) {
  const [settings] = await store.all('user_settings')
  return (settings?.active_program_id as string | null | undefined) ?? null
}

interface Context {
  history: HistorySet[]
  records: Map<string, SetRecord>
  names: Map<string, string>
  blocks: Map<string, LocalRow>
  days: Map<string, LocalRow[]>
}

async function context(store: LocalStore): Promise<Context & { sessions: LocalRow[]; programs: LocalRow[] }> {
  const [sessions, blocks, dayRows, exercises, programs, history] = await Promise.all([
    store.all('workout_sessions'),
    store.all('program_blocks'),
    store.all('program_days'),
    store.all('exercises'),
    store.all('programs'),
    trainingHistory(store),
  ])
  const days = new Map<string, LocalRow[]>()
  for (const day of [...dayRows].sort(byPosition)) days.set(String(day.program_id), [...(days.get(String(day.program_id)) ?? []), day])
  return {
    sessions,
    programs,
    history: history.sets,
    records: recordsAtTheTime(history.sets),
    names: new Map(exercises.map((row) => [row.id, String(row.name)])),
    blocks: new Map(blocks.map((row) => [row.id, row])),
    days,
  }
}

function toSession(row: LocalRow, data: Context): HistorySession {
  const block = row.block_id ? data.blocks.get(String(row.block_id)) : undefined
  const days = data.days.get(String(row.program_id)) ?? []
  const dayIndex = days.findIndex((day) => day.id === row.day_id)
  const sets = data.history.filter((entry) => entry.sessionId === row.id && !entry.isWarmup)
  return {
    id: row.id,
    programId: (row.program_id as string | null) ?? null,
    run: Number(row.run ?? 1),
    blockId: (row.block_id as string | null) ?? null,
    week: Number(row.week ?? 1),
    date: String(row.date),
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: String(row.ended_at),
    minutes: durationMinutes((row.started_at as string | null) ?? null, (row.ended_at as string | null) ?? null),
    blockName: block ? String(block.name) : null,
    blockWeeks: Number(block?.weeks ?? 1),
    dayNumber: dayIndex >= 0 ? dayIndex + 1 : null,
    dayName: dayIndex >= 0 ? String(days[dayIndex].name) : null,
    workSets: sets.length,
    records: sessionRecords(data.history, row.id, data.records).map((record) => ({
      exerciseId: record.exerciseId,
      name: data.names.get(record.exerciseId) ?? '',
      e1rmKg: record.e1rmKg,
    })),
  }
}

const completed = (row: LocalRow) => row.status === 'completed' && Boolean(row.ended_at)

/** Seancat e mbyllura sipas javës së programit, për ekranin Historiku. */
export async function historyOverview(store: LocalStore): Promise<HistoryOverview> {
  const data = await context(store)
  const activeId = await activeProgramId(store)
  const programs = new Map(data.programs.map((row) => [row.id, String(row.name)]))
  const sessions = data.sessions.filter(completed).map((row) => toSession(row, data))
  const weeks = byProgramWeek(sessions).map(({ key, sessions: list }): HistoryWeek => {
    const [newest] = list
    return {
      key,
      programName: newest.programId ? (programs.get(newest.programId) ?? null) : null,
      run: newest.run,
      blockName: newest.blockName,
      blockWeeks: newest.blockWeeks,
      week: newest.week,
      done: list.length,
      days: newest.programId ? (data.days.get(newest.programId)?.length ?? 0) : 0,
      sessions: list,
    }
  })
  const byDate: HistoryOverview['byDate'] = {}
  for (const session of sessions) {
    const entry = (byDate[session.date] ??= { sessions: 0, records: 0 })
    entry.sessions += 1
    entry.records += session.records.length
  }
  const dates = sessions.map((session) => session.date).sort()
  const [state] = activeId ? await store.where('program_state', 'program_id', activeId) : []
  // Java e programit nis ditën kur nisi programi (Shortcut to Size: e diela e Javës 0).
  const startedAt = (state?.started_at as string | null | undefined) ?? sessions.map((session) => session.startedAt).filter(Boolean).sort()[0] ?? null
  return {
    programName: activeId ? (programs.get(activeId) ?? null) : null,
    total: sessions.length,
    first: dates[0] ?? null,
    weekStart: startedAt ? new Date(startedAt).getDay() : 1,
    weeks,
    byDate,
  }
}

export interface PastSet {
  id: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  seconds: number | null
  rir: number | null
  technique: Technique['type']
  segments: { weightKg: number | null; reps: number }[]
  e1rmKg: number | null
  /** Rekordi i setit në kohën kur u bë. */
  record: SetRecord | null
}

export interface PastExercise {
  exerciseId: string
  name: string
  /** ID-ja e free-exercise-db për foton (`ExercisePhoto`); null për ushtrimin e përdoruesit. */
  libraryId: string | null
  equipment: Equipment
  tracking: Tracking
  primary: string[]
  sets: PastSet[]
  bestE1rmKg: number | null
  record: ExerciseRecord | null
  /** Receta e javës për slotin, kur programi ekziston ende. */
  target: Target | null
  technique: Technique | null
}

export interface PastSession extends HistorySession {
  theme: DayTheme | null
  recordsCount: number
  exercises: PastExercise[]
  volume: { groupId: string; sets: number }[]
  summary: TargetSummary | null
  /** Historia e të gjitha seteve, për parapamjen e një ndryshimi. */
  history: HistorySet[]
  weightSteps: Partial<Record<Equipment, number>>
}

const numberOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value))

function plannedSlots(model: Awaited<ReturnType<typeof programModel>>, row: LocalRow): Map<string, PlannedSlot> {
  if (!model || !row.block_id || !row.day_id) return new Map()
  try {
    const plan = planSession(model.engine, { run: Number(row.run ?? 1), blockId: String(row.block_id), week: Number(row.week ?? 1), dayId: String(row.day_id), completed: false })
    return new Map(plan.slots.map((slot) => [slot.slotId, slot]))
  } catch {
    // Blloku ose dita u fshi nga editori: seanca shfaqet pa recetat.
    return new Map()
  }
}

const groupOf = (primary: string[]) => MUSCLE_GROUPS.find((group) => primary.some((key) => group.keys.includes(key)))?.id ?? null

/** Seanca e kaluar me ushtrimet, setet, e1RM-në, rekordet, volumin dhe recetat e javës. */
export async function pastSession(store: LocalStore, id: string): Promise<PastSession | null> {
  const row = await store.get('workout_sessions', id)
  if (!row || !row.ended_at) return null
  const [data, setRows, exerciseRows, [settings]] = await Promise.all([
    context(store),
    store.where('set_logs', 'session_id', id),
    store.all('exercises'),
    store.all('user_settings'),
  ])
  const model = row.program_id ? await programModel(store, String(row.program_id)) : null
  const slots = plannedSlots(model, row)
  const exercises = new Map(exerciseRows.map((exercise) => [exercise.id, exercise]))
  const working = setRows
    .filter((set) => !set.is_warmup)
    .sort((a, b) => Number(a.position) - Number(b.position) || String(a.logged_at).localeCompare(String(b.logged_at)))
  const order = [...new Set(working.map((set) => String(set.exercise_id)))]
  const records = sessionRecords(data.history, id, data.records)

  const list = order.map((exerciseId): PastExercise => {
    const exercise = exercises.get(exerciseId)
    const sets = working
      .filter((set) => set.exercise_id === exerciseId)
      .sort((a, b) => Number(a.set_number) - Number(b.set_number) || String(a.logged_at).localeCompare(String(b.logged_at)))
      .map((set): PastSet => {
        const weightKg = numberOrNull(set.weight_kg)
        const reps = numberOrNull(set.reps)
        const rir = numberOrNull(set.rir)
        return {
          id: set.id,
          setNumber: Number(set.set_number),
          weightKg,
          reps,
          seconds: numberOrNull(set.seconds),
          rir,
          technique: (set.technique as Technique['type'] | null) ?? 'none',
          segments: ((set.segments as { weight_kg: number | null; reps: number }[] | null) ?? []).map((segment) => ({ weightKg: segment.weight_kg, reps: segment.reps })),
          e1rmKg: e1rm(weightKg, reps, rir),
          record: data.records.get(set.id) ?? null,
        }
      })
    const planned = slots.get(String(working.find((set) => set.exercise_id === exerciseId)?.slot_id))
    const values = sets.map((set) => set.e1rmKg).filter((value): value is number => value !== null)
    return {
      exerciseId,
      name: String(exercise?.name ?? ''),
      libraryId: (exercise?.library_id as string | null | undefined) ?? null,
      equipment: (exercise?.equipment as Equipment | undefined) ?? 'other',
      tracking: (exercise?.tracking as Tracking | undefined) ?? 'weight_reps',
      primary: (exercise?.primary_muscles as string[] | undefined) ?? [],
      sets,
      bestE1rmKg: values.length ? Math.max(...values) : null,
      record: records.find((record) => record.exerciseId === exerciseId) ?? null,
      target: planned?.target ?? null,
      technique: planned?.technique ?? null,
    }
  })

  const muscles = Object.fromEntries(
    exerciseRows.map((exercise) => [
      exercise.id,
      { primary: (exercise.primary_muscles as string[] | undefined) ?? [], secondary: (exercise.secondary_muscles as string[] | undefined) ?? [] },
    ]),
  )
  const planned = list.filter((exercise) => exercise.target && exercise.technique)
  return {
    ...toSession(row, data),
    theme: dayTheme(list[0]?.primary ?? []),
    recordsCount: records.length,
    exercises: list,
    volume: sessionVolume(
      working.map((set) => ({ exerciseId: String(set.exercise_id), isWarmup: false })),
      muscles,
      MUSCLE_GROUPS,
    ),
    summary: planned.length ? targetSummary(planned.map((exercise) => ({ target: exercise.target!, technique: exercise.technique!, groupId: groupOf(exercise.primary) }))) : null,
    history: data.history,
    weightSteps: (settings?.weight_steps as PastSession['weightSteps'] | undefined) ?? {},
  }
}

/** Sa seanca të mbyllura ka dhe data e së fundit, për rreshtin "Historiku" te Progresi. */
export async function historyGlance(store: LocalStore): Promise<{ total: number; last: string | null }> {
  const sessions = (await store.all('workout_sessions')).filter(completed)
  const dates = sessions.map((row) => String(row.date)).sort()
  return { total: sessions.length, last: dates.at(-1) ?? null }
}

export interface SetChange {
  weightKg: number | null
  reps: number
  rir: number | null
}

/** Kufijtë e kolonave të `set_logs` (numeric(6,2), smallint 0–200, RIR 0–10). */
function validChange({ weightKg, reps, rir }: SetChange): boolean {
  const weightOk = weightKg === null || (Number.isFinite(weightKg) && weightKg >= 0 && weightKg <= 9999.99)
  const repsOk = Number.isInteger(reps) && reps >= 1 && reps <= 200
  const rirOk = rir === null || (Number.isInteger(rir) && rir >= 0 && rir <= 10)
  return weightOk && repsOk && rirOk
}

/**
 * "Ndrysho një set": pesha, përsëritjet dhe RIR-i i një seti të ruajtur, në telefon së pari dhe pastaj
 * në Supabase me sinkronizimin. Numri, koha, teknika dhe segmentet mbeten; e1RM-ja, rekordet dhe
 * peshat e sugjeruara rillogariten nga setet.
 */
export async function editSet(store: LocalStore, id: string, change: SetChange) {
  if (!validChange(change)) throw new Error('Vlerat e setit nuk vlejnë.')
  const row = await store.get('set_logs', id)
  if (!row) throw new Error('Seti nuk ekziston.')
  await store.put('set_logs', { id, weight_kg: change.weightKg, reps: change.reps, rir: change.rir })
}
