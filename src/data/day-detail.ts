import { advance, planSession } from '@/program/engine'
import { workoutMinutes } from '@/program/week-plan'
import type { SessionPlan } from '@/program/types'
import { type Readiness } from '@/readiness/readiness'
import { FOOD_SHARE, WATER_SHARE } from '@/progress/weekly-goals'
import { readDailyState, readinessOfState } from './daily-state'
import { pastSession } from './history'
import { nutritionDay } from './nutrition'
import type { LocalStore } from './store'
import { activeProgram } from './training'
import { waterDay } from './water'

// Fleta e ditës te Sot (V57, SPEC §0.3f): çdo datë e javës preket. Dita e kaluar: seanca (emri, koha, setet,
// rekordet), ushqimi (kalorit, proteina), uji dhe gjendja e ditës; "arritur" sipas të njëjtave rregulla si pikat e
// rripit (V43: ushqimi të paktën 60% e kalorive të ditës, uji objektivi i plotë). Dita e ardhshme: stërvitja e
// planifikuar, vetëm për t'u parë (`plannedWorkout`).

export interface DaySession {
  id: string
  /** "Stërvitja 2" nga numri i ditës së programit; null kur programi s'e njeh më. */
  dayNumber: number | null
  dayName: string | null
  exercises: number
  minutes: number | null
  workSets: number
  records: number
  lighter: boolean
}

export interface DayDetail {
  date: string
  session: DaySession | null
  food: { kcal: number; proteinG: number; targetKcal: number | null; targetProteinG: number | null; reached: boolean | null }
  water: { ml: number; targetMl: number | null; reached: boolean | null }
  /** Gatishmëria e ruajtur e ditës; null pa gjendje. */
  readiness: Pick<Readiness, 'percent' | 'level'> | null
}

export async function dayDetail(store: LocalStore, date: string): Promise<DayDetail> {
  const sessions = (await store.where('workout_sessions', 'date', date))
    .filter((row) => row.status === 'completed' && row.ended_at)
    .sort((a, b) => String(a.ended_at).localeCompare(String(b.ended_at)))
  const last = sessions.at(-1)
  const [past, nutrition, water, state] = await Promise.all([last ? pastSession(store, last.id) : null, nutritionDay(store, date, store.now()), waterDay(store, date), readDailyState(store, date)])
  const targetKcal = nutrition.targets ? Math.round(nutrition.targets.kcal) : null
  const kcal = Math.round(nutrition.totals.kcal)
  const readiness = state ? readinessOfState(state) : null
  return {
    date,
    session: past
      ? {
          id: past.id,
          dayNumber: past.dayNumber,
          dayName: past.dayName,
          exercises: past.exercises.length,
          minutes: past.minutes,
          workSets: past.workSets,
          records: past.recordsCount,
          lighter: past.lighter,
        }
      : null,
    food: {
      kcal,
      proteinG: Math.round(nutrition.totals.proteinG),
      targetKcal,
      targetProteinG: nutrition.targets ? Math.round(nutrition.targets.proteinG) : null,
      reached: targetKcal === null ? null : kcal >= targetKcal * FOOD_SHARE - 1e-9,
    },
    water: { ml: water.totalMl, targetMl: water.targetMl, reached: water.targetMl === null ? null : water.totalMl >= water.targetMl * WATER_SHARE - 1e-9 },
    readiness: readiness ? { percent: readiness.percent, level: readiness.level } : null,
  }
}

export interface PlannedWorkout {
  plan: Pick<SessionPlan, 'run' | 'blockName' | 'blockWeeks' | 'week' | 'dayName' | 'dayNumber'>
  minutes: number
  exercises: { name: string; sets: number }[]
}

/**
 * Stërvitja e planifikuar `ahead` stërvitje pas asaj të radhës (0 = e radhës), sipas programit aktiv: vetëm për
 * t'u parë te fleta e ditës së ardhshme (peshat dalin kur nis stërvitja). Null pa program, ose pas përfundimit të tij.
 */
export async function plannedWorkout(store: LocalStore, ahead: number): Promise<PlannedWorkout | null> {
  const loaded = await activeProgram(store)
  if (!loaded || loaded.pointer.completed) return null
  let pointer = loaded.pointer
  for (let step = 0; step < ahead; step += 1) pointer = advance(loaded.engine, pointer)
  if (pointer.completed) return null
  const plan = planSession(loaded.engine, pointer)
  return {
    plan: { run: plan.run, blockName: plan.blockName, blockWeeks: plan.blockWeeks, week: plan.week, dayName: plan.dayName, dayNumber: plan.dayNumber },
    minutes: workoutMinutes(plan.slots),
    exercises: plan.slots.map((slot) => ({ name: loaded.exercises[slot.exerciseId]?.name ?? '', sets: slot.sets })),
  }
}
