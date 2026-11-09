import type { ContextWorkout, DraftExercise } from '../../supabase/functions/log-parse/shared'
import type { LocalStore } from './store'
import { activeProgram, exerciseFromLibrary, finishWorkout, saveSet, sessionForNext, trainingHistory } from './training'
import type { I18n } from '@/i18n'
import { programDayName } from '@/i18n/domain'
import { localDate, shiftDate } from '@/lib/calendar'
import { planSession } from '@/program/engine'
import type { Pointer } from '@/program/types'
import { loadLibrary } from '@/program/library'
import { e1rm, e1rmRecord, type HistorySet } from '@/program/loads'

type DraftSetRow = DraftExercise['sets'][number]
/** Seti i mesazhit si set historie, vetëm për rregullin e rekordit (nuk ruhet). */
const BOX_SET: HistorySet = { id: 'box', exerciseId: '', sessionId: 'box', run: 0, blockPosition: 0, blockName: '', blockWeeks: 0, week: 0, setNumber: 1, weightKg: null, reps: null, rir: null, isWarmup: false, loggedAt: '' }

// Setet nga kutia e AI-së (V40, V2-E2-14; bordi V22-Kutia-Setet): stërvitjet që mund të marrin sete (e sotmja
// ose e radhës dhe ato të 7 ditëve të fundit), setet e zgjidhura te sloti i tyre me e1RM-në dhe rekordin,
// dhe regjistrimi. Një ushtrim që nuk është te stërvitja shtohet vetëm kur përdoruesi thotë "Po, si shtesë".

const DAYS_BACK = 7

interface WorkoutRef {
  /** null: stërvitja e radhës, pa seancë ende. */
  sessionId: string | null
  date: string | null
  label: string
  slots: { slotId: string; exerciseId: string; position: number }[]
}

export interface TrainingRefs {
  workouts: Map<string, WorkoutRef>
  exercises: Map<
    string,
    {
      workoutRef: string
      slotId: string
      exerciseId: string
      position: number
      name: string
    }
  >
}

const daysBefore = (date: string, days: number) => shiftDate(date, -days)

/** Stërvitjet e kontekstit: seancat e bëra ose të hapura të 7 ditëve dhe e radha kur s'është nisur. */
export async function workoutContext(store: LocalStore, today: string, { t }: I18n): Promise<{ workouts: ContextWorkout[]; refs: TrainingRefs }> {
  const refs: TrainingRefs = { workouts: new Map(), exercises: new Map() }
  const workouts: ContextWorkout[] = []
  const loaded = await activeProgram(store)
  if (!loaded) return { workouts, refs }
  const { row, engine, pointer, exercises } = loaded
  const from = daysBefore(today, DAYS_BACK)
  const sessions = (await store.where('workout_sessions', 'program_id', row.id))
    .filter((session) => (session.status === 'completed' || session.status === 'in_progress') && String(session.date) >= from && String(session.date) <= today)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const add = (sessionId: string | null, date: string | null, status: ContextWorkout['status'], at: Pointer) => {
    let plan
    try {
      plan = planSession(engine, at)
    } catch {
      return
    }
    const ref = `w${workouts.length + 1}`
    const label = `${t('history.workout', { n: plan.dayNumber })} · ${programDayName(t, plan.dayName)}`
    const slots = plan.slots.map((slot) => ({
      slotId: slot.slotId,
      exerciseId: slot.exerciseId,
      position: slot.position,
    }))
    refs.workouts.set(ref, { sessionId, date, label, slots })
    const list = slots.map((slot) => {
      const exerciseRef = `e${refs.exercises.size + 1}`
      const name = exercises[slot.exerciseId]?.name ?? ''
      refs.exercises.set(exerciseRef, { workoutRef: ref, ...slot, name })
      return { ref: exerciseRef, name }
    })
    workouts.push({ ref, date, label, status, exercises: list })
  }
  const nextOpen = sessions.find(
    (session) => session.status === 'in_progress' && session.block_id === pointer.blockId && session.week === pointer.week && session.day_id === pointer.dayId,
  )
  if (!pointer.completed && !nextOpen) add(null, null, 'next', pointer)
  for (const session of sessions.slice(0, 7)) {
    add(session.id, String(session.date), session.status === 'completed' ? 'done' : 'open', {
      run: Number(session.run ?? 1),
      blockId: String(session.block_id),
      week: Number(session.week),
      dayId: String(session.day_id),
      completed: false,
    })
  }
  return { workouts, refs }
}

export interface BoxExercise {
  key: string
  said: string
  workoutRef: string
  /** Data ku shkojnë setet: e seancës, ose dita që tha përdoruesi për stërvitjen e radhës. */
  date: string
  workoutLabel: string
  /** null: nuk është te stërvitja; pret "Po, si shtesë". */
  slot: { slotId: string; exerciseId: string; position: number } | null
  exerciseName: string
  sets: { reps: number; weightKg: number | null; rir: number | null }[]
  /** Ushtrimi shtesë i pranuar nga përdoruesi. */
  extra: boolean
  /** Për një ushtrim jashtë stërvitjes: ai i përdoruesit ose i bibliotekës me emrin më të afërt. */
  match: {
    exerciseId: string | null
    libraryId: string | null
    name: string
  } | null
  e1rmKg: number | null
  previousBestKg: number | null
  record: boolean
}

let nextKey = 0

const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
const words = (value: string) =>
  plain(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * Ushtrimi me emrin më të afërt: i njëjti emër, pastaj ai që fillon me të, pastaj ai që ka të gjitha fjalët
 * ("Dips" → "Dips - Chest Version"); më i shkurtri fiton. Së pari ushtrimet e përdoruesit, pastaj biblioteka.
 */
export function closestName<T extends { name: string }>(items: readonly T[], name: string): T | null {
  const wanted = plain(name)
  const wantedWords = words(name)
  if (!wantedWords.length) return null
  const shortest = (list: T[]) => [...list].sort((a, b) => a.name.length - b.name.length)[0] ?? null
  return (
    items.find((item) => plain(item.name) === wanted) ??
    shortest(items.filter((item) => plain(item.name).startsWith(wanted))) ??
    shortest(items.filter((item) => wantedWords.every((word) => words(item.name).includes(word))))
  )
}

async function matchExercise(store: LocalStore, name: string): Promise<BoxExercise['match']> {
  const own = closestName(
    (await store.all('exercises')).map((row) => ({
      id: row.id,
      name: String(row.name),
    })),
    name,
  )
  if (own) return { exerciseId: own.id, libraryId: null, name: own.name }
  const library = closestName(await loadLibrary(), name)
  return library ? { exerciseId: null, libraryId: library.id, name: library.name } : null
}

/** Setet e draftit te stërvitja dhe sloti i tyre, me e1RM-në më të mirë dhe rekordin kundrejt historisë. */
export async function resolveSets(store: LocalStore, sets: DraftExercise[], refs: TrainingRefs, today: string): Promise<{ exercises: BoxExercise[]; unmatched: string[] }> {
  if (sets.length === 0) return { exercises: [], unmatched: [] }
  const history = (await trainingHistory(store)).sets
  const yesterday = daysBefore(today, 1)
  const unmatched: string[] = []
  const exercises: BoxExercise[] = []
  for (const item of sets) {
    const workout = refs.workouts.get(item.workoutRef)
    if (!workout) continue
    const exercise = item.exerciseRef ? refs.exercises.get(item.exerciseRef) : undefined
    const slot =
      exercise && exercise.workoutRef === item.workoutRef
        ? {
            slotId: exercise.slotId,
            exerciseId: exercise.exerciseId,
            position: exercise.position,
          }
        : null
    const match = slot ? null : await matchExercise(store, item.exerciseName)
    if (!slot && !match) {
      unmatched.push(item.said)
      continue
    }
    const exerciseId = slot?.exerciseId ?? match?.exerciseId ?? null
    const best = Math.max(0, ...item.sets.map((set) => e1rm(set.weightKg, set.reps, set.rir) ?? 0))
    const previous = exerciseId
      ? Math.max(0, ...history.filter((set) => set.exerciseId === exerciseId && !set.isWarmup).map((set) => e1rm(set.weightKg, set.reps, set.rir) ?? 0))
      : 0
    // Rregulli i rekordit vetëm te e1rmRecord (MESIMET): seti më i mirë i mesazhit kundrejt historisë.
    const top = item.sets.reduce<DraftSetRow | null>((winner, set) => ((e1rm(set.weightKg, set.reps, set.rir) ?? 0) > (winner ? (e1rm(winner.weightKg, winner.reps, winner.rir) ?? 0) : 0) ? set : winner), null)
    const record = exerciseId && top ? e1rmRecord({ ...BOX_SET, exerciseId, weightKg: top.weightKg, reps: top.reps, rir: top.rir }, history) : null
    exercises.push({
      key: `exercise-${++nextKey}`,
      said: item.said,
      workoutRef: item.workoutRef,
      date: workout.date ?? (item.day === -1 ? yesterday : today),
      workoutLabel: workout.label,
      slot,
      exerciseName: exercise?.name ?? match?.name ?? item.exerciseName,
      sets: item.sets,
      extra: false,
      match,
      e1rmKg: best > 0 ? Math.round(best * 10) / 10 : null,
      previousBestKg: previous > 0 ? Math.round(previous * 10) / 10 : null,
      record: record !== null,
    })
  }
  return { exercises, unmatched }
}

/** Rreshti te exercises për ushtrimin shtesë: ai i përdoruesit, ose i krijuar nga biblioteka. */
async function extraExerciseId(store: LocalStore, match: NonNullable<BoxExercise['match']>): Promise<string | null> {
  if (match.exerciseId) return match.exerciseId
  const library = (await loadLibrary()).find((item) => item.id === match.libraryId)
  return library ? exerciseFromLibrary(store, library) : null
}

/**
 * Regjistron setet e pranuara: te seanca e tyre (ose te një seancë e re për stërvitjen e radhës; kur data ka
 * kaluar, ajo mbyllet dhe programi kalon te e radha). Numri i setit vazhdon pas seteve që ka sloti.
 */
export async function logSets(store: LocalStore, exercises: BoxExercise[], refs: TrainingRefs): Promise<number> {
  let saved = 0
  const created = new Map<string, string>()
  const toClose = new Set<string>()
  const today = localDate(store.now())
  for (const item of exercises) {
    if (!item.slot && !item.extra) continue
    const workout = refs.workouts.get(item.workoutRef)
    if (!workout) continue
    let sessionId = workout.sessionId ?? created.get(item.workoutRef) ?? null
    if (!sessionId) {
      sessionId = await sessionForNext(store, item.date)
      if (!sessionId) continue
      created.set(item.workoutRef, sessionId)
      if (item.date < today) toClose.add(sessionId)
    }
    const existing = await store.where('set_logs', 'session_id', sessionId)
    let slot: {
      slotId: string | null
      exerciseId: string
      position: number
    } | null = item.slot
    if (!slot) {
      const exerciseId = item.match ? await extraExerciseId(store, item.match) : null
      if (!exerciseId) continue
      const same = existing.find((row) => row.exercise_id === exerciseId && row.slot_id == null)
      const position = same ? Number(same.position) : Math.max(-1, ...workout.slots.map((entry) => entry.position), ...existing.map((row) => Number(row.position))) + 1
      slot = { slotId: null, exerciseId, position }
    }
    const target = slot
    const used = existing.filter((row) => (target.slotId ? row.slot_id === target.slotId : row.exercise_id === target.exerciseId && row.slot_id == null))
    let setNumber = Math.max(0, ...used.map((row) => Number(row.set_number)))
    for (const set of item.sets) {
      setNumber += 1
      await saveSet(store, {
        sessionId,
        slot: target,
        setNumber,
        weightKg: set.weightKg,
        reps: set.reps,
        // set_logs.rir në server: numër i plotë 0–10.
        rir: set.rir === null ? null : Math.min(10, Math.max(0, Math.round(set.rir))),
      })
      saved += 1
    }
  }
  for (const sessionId of toClose) await finishWorkout(store, sessionId)
  return saved
}
