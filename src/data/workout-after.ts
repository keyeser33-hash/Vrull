import { localDate } from '@/lib/calendar'
import { reference } from '@/program/loads'
import { setDefaults } from '@/program/next-set'
import type { PlannedSlot } from '@/program/types'
import { cancelPostponement } from './day-choice'
import type { LocalStore } from './store'
import { type ExerciseRecord, finishWorkout, saveSet, sessionForNext, trainingHistory, trainingSnapshot } from './training'
import { workoutWeights } from './week-weights'

// "E bëra, po e shënoj" (V74, V75): e gjithë stërvitja e radhës shënohet pas palestrës në një tabelë. Çdo set vjen i
// mbushur: ai i ruajtur në seancën e hapur, përndryshe i njëjti set herën e kaluar (`reference`, si te seanca),
// përndryshe pesha e javës dhe kufiri i poshtëm i intervalit. Ruajtja përdor të njëjtat rrugë si seanca (`saveSet`,
// `finishWorkout`), ndaj rekordet, peshat e javës dhe historiku i shohin setet njësoj.

export interface AfterSet {
  weightKg: number | null
  reps: number | null
  seconds: number | null
}

export interface AfterRow {
  slot: PlannedSlot
  exercise: ExerciseRecord
  sets: AfterSet[]
  /** Nga vijnë vlerat: seanca e hapur, hera e kaluar, ose plani (pa histori). */
  source: 'saved' | 'last' | 'plan'
}

export interface WorkoutAfter {
  /** "Java 0" ose "Faza 1 · Java 2". */
  label: string
  dayNumber: number
  dayName: string
  rows: AfterRow[]
}

/** Stërvitja e radhës si tabelë e mbushur; null pa program aktiv ose kur programi ka mbaruar. */
export async function workoutAfter(store: LocalStore): Promise<WorkoutAfter | null> {
  const snapshot = await trainingSnapshot(store)
  if (!snapshot || snapshot.completed) return null
  const [history, weights] = await Promise.all([trainingHistory(store), workoutWeights(store, snapshot.plan)])
  const { plan, session } = snapshot
  const rows: AfterRow[] = []
  for (const slot of plan.slots) {
    const exercise = snapshot.exercises[slot.exerciseId]
    if (!exercise) continue
    const fallback = setDefaults(slot, undefined, weights.get(slot.slotId)?.weightKg ?? null)
    let source: AfterRow['source'] = 'plan'
    const sets: AfterSet[] = []
    for (let setNumber = 1; setNumber <= slot.sets; setNumber++) {
      const saved = session?.sets.find((set) => set.slotId === slot.slotId && set.setNumber === setNumber)
      if (saved) {
        source = 'saved'
        sets.push({ weightKg: saved.weightKg, reps: saved.reps, seconds: saved.seconds })
        continue
      }
      const last = reference(history.sets, { exerciseId: slot.exerciseId, blockPosition: plan.blockPosition, week: plan.week, setNumber, sessionId: session?.id })
      if (last && source === 'plan') source = 'last'
      sets.push({
        weightKg: exercise.tracking === 'weight_reps' ? (last?.weightKg ?? (fallback.weightKg > 0 ? fallback.weightKg : null)) : null,
        reps: exercise.tracking === 'timed' ? null : (last?.reps ?? fallback.reps),
        seconds: exercise.tracking === 'timed' ? fallback.seconds : null,
      })
    }
    rows.push({ slot, exercise, sets, source })
  }
  return { label: snapshot.label, dayNumber: plan.dayNumber, dayName: plan.dayName, rows }
}

/** A mund të ruhet seti: përsëritje (ose sekonda) mbi zero, dhe peshë kur ushtrimi matet me peshë. */
export function validAfterSet(set: AfterSet, tracking: ExerciseRecord['tracking']): boolean {
  if (tracking === 'timed') return (set.seconds ?? 0) > 0
  if ((set.reps ?? 0) <= 0) return false
  return tracking !== 'weight_reps' || (set.weightKg ?? 0) > 0
}

/**
 * Ruan ushtrimet e shënuara "Bërë" dhe mbyll stërvitjen në `date` (sot ose dje, V75). Setet pa vlerë të plotë
 * kapërcehen. Seti i fundit ruhet pa teknikë (rest-pause, drop set): segmentet nuk shënohen këtu. Kthen id-në e
 * seancës, ose null kur s'ka asnjë set për të ruajtur ose s'ka stërvitje të radhës.
 */
export async function saveWorkoutAfter(store: LocalStore, date: string, rows: readonly Pick<AfterRow, 'slot' | 'exercise' | 'sets'>[]): Promise<string | null> {
  const wanted = rows.flatMap((row) => row.sets.map((set, index) => ({ row, set, setNumber: index + 1 })).filter((item) => validAfterSet(item.set, row.exercise.tracking)))
  if (wanted.length === 0) return null
  const now = store.now()
  const today = date === localDate(now)
  // Stërvitja u bë sot: një shtyrje "për nesër" nuk vlen më.
  if (today) await cancelPostponement(store)
  const sessionId = await sessionForNext(store, date)
  if (!sessionId) return null
  // Setet marrin orë njëra pas tjetrës, që radha e tyre të mbetet ajo e tabelës; dje bien në mesditë.
  const end = today ? now.getTime() : new Date(`${date}T12:00:00`).getTime() + wanted.length * 1000
  for (const [index, { row, set, setNumber }] of wanted.entries()) {
    await saveSet(store, {
      sessionId,
      slot: row.slot,
      setNumber,
      weightKg: row.exercise.tracking === 'weight_reps' ? set.weightKg : null,
      reps: row.exercise.tracking === 'timed' ? null : set.reps,
      seconds: row.exercise.tracking === 'timed' ? set.seconds : null,
      technique: 'none',
      loggedAt: new Date(end - (wanted.length - index) * 1000).toISOString(),
    })
  }
  await finishWorkout(store, sessionId)
  // Një stërvitje e mbyllur nga tabela nuk ka kohëzgjatje të matur, edhe kur seanca ishte hapur më parë: fillimi
  // dhe mbyllja marrin të njëjtën orë, dhe përmbledhja e fsheh kohëzgjatjen.
  const at = new Date(end).toISOString()
  await store.put('workout_sessions', { id: sessionId, started_at: at, ended_at: at })
  return sessionId
}
