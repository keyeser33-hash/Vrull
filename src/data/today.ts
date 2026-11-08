import { localDate, weekRange } from '@/lib/calendar'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/program/muscles'
import { recoveryFor, type RecoveryStatus } from '@/program/recovery'
import type { Target, Tracking } from '@/program/types'
import { nutritionDay } from './nutrition'
import { readProfile } from './profile'
import type { LocalStore } from './store'
import { trainingHistory, trainingSnapshot, type TrainingSnapshot } from './training'
import { weekWeightsView } from './week-weights'

// Ekrani Sot (V2-E1-06, bordi "Sot"): çfarë i duhet nga baza lokale, në një vend. Java kalendarike
// me ditët e bëra dhe të pushimit, stërvitja e radhës me kohëzgjatjen, grupin kryesor, rikuperimin
// e tij dhe ushtrimin ku nis (me peshën e javës, §7 dhe V23), dhe proteina e sotme (§9).
// Gatishmëria, uji, faktet, sfida dhe miqtë vijnë me Etapat 3 dhe 4.

/** Koha e punës së një seti pa pushimin, për kohëzgjatjen e stërvitjes. */
const SET_SECONDS = 45

/** Kohëzgjatja e stërvitjes në minuta: çdo set 45 s plus pushimi i slotit, te 5 minutat më të afërta. */
export function workoutMinutes(slots: { sets: number; restSeconds: number }[]): number {
  const seconds = slots.reduce((total, slot) => total + slot.sets * (SET_SECONDS + slot.restSeconds), 0)
  if (seconds === 0) return 0
  return Math.max(5, Math.round(seconds / 300) * 5)
}

export type TodayDayState = 'done' | 'rest' | 'planned'

export interface TodayWeekDay {
  /** "2026-11-02" */
  date: string
  /** Dita ISO: 1 = e hënë ... 7 = e diel. */
  weekday: number
  /** Dita e muajit. */
  day: number
  state: TodayDayState
  today: boolean
}

const isoWeekday = (date: Date) => date.getDay() || 7
const atNoon = (date: string) => new Date(`${date}T12:00:00`)
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12)

/**
 * Java kalendarike (e hënë–e diel) që përmban `now`: një ditë me seancë të mbyllur është e bërë;
 * një ditë jashtë ditëve të stërvitjes është pushim; të tjerat janë ditë stërvitjeje.
 */
export function calendarWeek(now: Date, trainingDays: number[], doneDates: string[]): TodayWeekDay[] {
  const [monday] = weekRange(now)
  const today = localDate(now)
  const done = new Set(doneDates)
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(atNoon(monday), index)
    const key = localDate(date)
    const weekday = isoWeekday(date)
    return {
      date: key,
      weekday,
      day: date.getDate(),
      state: done.has(key) ? 'done' : trainingDays.includes(weekday) ? 'planned' : 'rest',
      today: key === today,
    }
  })
}

/** Dita e parë pas sotme që është ditë stërvitjeje; null pa ditë stërvitjeje. */
export function nextTrainingDate(now: Date, trainingDays: number[]): string | null {
  if (trainingDays.length === 0) return null
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = addDays(now, offset)
    if (trainingDays.includes(isoWeekday(date))) return localDate(date)
  }
  return null
}

export interface FocusGroup {
  group: MuscleGroup
  /** Çelësat kryesorë të stërvitjes brenda grupit: ku shikon modeli 3D. */
  keys: string[]
}

/**
 * Grupi që i jep emrin ditës ("Dita e gjoksit"): grupi i muskujve kryesorë të ushtrimit të parë
 * që ka muskuj të njohur, me të gjithë çelësat kryesorë të stërvitjes që bien brenda tij.
 */
export function mainGroup(slots: { exerciseId: string }[], exercises: Record<string, { primary: string[] } | undefined>): FocusGroup | null {
  const primary = [...new Set(slots.flatMap((slot) => exercises[slot.exerciseId]?.primary ?? []))]
  for (const slot of slots) {
    for (const key of exercises[slot.exerciseId]?.primary ?? []) {
      const group = MUSCLE_GROUPS.find((candidate) => candidate.keys.includes(key))
      if (group) return { group, keys: primary.filter((candidate) => group.keys.includes(candidate)) }
    }
  }
  return null
}

/**
 * train: ditë stërvitjeje; session: seanca e nisur; rest: ditë pushimi; done: stërvitja e sotme u mbyll;
 * completed: programi u përfundua; none: pa program aktiv.
 */
export type TodayMode = 'train' | 'session' | 'rest' | 'done' | 'completed' | 'none'

export interface TodayExercise {
  name: string
  tracking: Tracking
  target: Target
  /** Pesha e javës (vendimi i përdoruesit ose propozimi); null kur zgjidhet te seti. */
  weightKg: number | null
}

export interface TodayWorkout {
  exercises: number
  sets: number
  minutes: number
  /** Setet e ruajtura te seanca e hapur. */
  loggedSets: number
  /** Muskujt kryesorë të gjithë stërvitjes (modeli 3D). */
  primary: string[]
  focus: FocusGroup | null
  /** Rikuperimi i grupit kryesor (§11). */
  recovery: RecoveryStatus | null
  /** Ushtrimi ku nis stërvitja, ose ku mbeti seanca e hapur. */
  first: TodayExercise | null
}

export interface TodayView {
  /** Ora e telefonit kur u lexua pamja (data te kreu). */
  now: Date
  mode: TodayMode
  snapshot: TrainingSnapshot | null
  week: TodayWeekDay[]
  /** Dita e radhës e stërvitjes pas sotme (dita e pushimit, pas mbylljes). */
  nextDate: string | null
  /** Asnjë set i ruajtur ende: stërvitja e parë. */
  firstEver: boolean
  workout: TodayWorkout | null
  protein: { eatenG: number; targetG: number | null }
}

export async function todayView(store: LocalStore): Promise<TodayView> {
  const now = store.now()
  const today = localDate(now)
  const [snapshot, history, profile, sessions, nutrition] = await Promise.all([
    trainingSnapshot(store),
    trainingHistory(store),
    readProfile(store),
    store.all('workout_sessions'),
    nutritionDay(store, today, now),
  ])
  const doneDates = sessions.filter((row) => row.status === 'completed').map((row) => String(row.date))
  const week = calendarWeek(now, profile.trainingDays, doneDates)
  const base = {
    now,
    snapshot,
    week,
    nextDate: nextTrainingDate(now, profile.trainingDays),
    firstEver: history.sets.length === 0,
    protein: { eatenG: Math.round(nutrition.totals.proteinG), targetG: nutrition.targets ? Math.round(nutrition.targets.proteinG) : null },
  }
  if (!snapshot) return { ...base, mode: 'none', workout: null }

  const { plan, exercises, session } = snapshot
  const mode: TodayMode = snapshot.completed
    ? 'completed'
    : session
      ? 'session'
      : doneDates.includes(today)
        ? 'done'
        : profile.trainingDays.includes(isoWeekday(now))
          ? 'train'
          : 'rest'
  if (mode === 'completed') return { ...base, mode, workout: null }

  const primary = [...new Set(plan.slots.flatMap((slot) => exercises[slot.exerciseId]?.primary ?? []))]
  const focus = mainGroup(plan.slots, exercises)
  const recovery = focus ? (recoveryFor([focus.group], primary, history.worked, now)[0]?.status ?? null) : null
  const logged = (slotId: string) => session?.sets.filter((set) => set.slotId === slotId).length ?? 0
  const current = plan.slots.find((slot) => logged(slot.slotId) < slot.sets) ?? plan.slots[0]
  let first: TodayExercise | null = null
  if (current) {
    const exercise = exercises[current.exerciseId]
    const weights = exercise?.tracking === 'weight_reps' ? await weekWeightsView(store, { blockId: plan.blockId, week: plan.week }) : null
    const row = weights?.rows.find((candidate) => candidate.slotId === current.slotId && candidate.dayId === plan.dayId)
    first = {
      name: exercise?.name ?? '',
      tracking: exercise?.tracking ?? 'weight_reps',
      target: current.target,
      weightKg: row?.weightKg ?? null,
    }
  }
  return {
    ...base,
    mode,
    workout: {
      exercises: plan.slots.length,
      sets: plan.slots.reduce((total, slot) => total + slot.sets, 0),
      minutes: workoutMinutes(plan.slots),
      loggedSets: session?.sets.length ?? 0,
      primary,
      focus,
      recovery,
      first,
    },
  }
}
