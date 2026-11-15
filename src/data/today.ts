import { localDate, shiftDate, weekRange } from '@/lib/calendar'
import { dayTheme, type DayTheme } from '@/progress/history'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/program/muscles'
import { isMissed, missedYesterday } from '@/program/missed-day'
import { recoveryFor, type RecoveryStatus } from '@/program/recovery'
import { workoutMinutes } from '@/program/week-plan'
import type { Target, Tracking } from '@/program/types'
import type { MealKey } from '@/nutrition/meals'
import { weekCardMonday } from '@/progress/weekly-goals'
import { readDailyChoice } from './daily-state'
import { readMissedInput } from './missed-day'
import { minutesInFoodDay } from '@/nutrition/food-day'
import { currentFoodDate, dayTargets, nutritionDay } from './nutrition'
import { readProfile } from './profile'
import { readSchedule, trainingTimeOn } from './schedule-settings'
import type { LocalStore } from './store'
import { trainingHistory, trainingSnapshot, type TrainingSnapshot } from './training'
import { workoutWeights } from './week-weights'
import { type WelcomeBack, welcomeBack } from './welcome-back'

// Ekrani Sot (V2-E1-06, bordi "Sot"): çfarë i duhet nga baza lokale, në një vend. Java kalendarike
// me ditët e bëra dhe të pushimit, stërvitja e radhës me kohëzgjatjen (`workoutMinutes`, si te
// Programi), grupin kryesor, rikuperimin e tij dhe ushtrimin ku nis (me peshën e javës nga
// `workoutWeights`, si te seanca dhe Programi), dhe proteina e sotme (§9).
// Gatishmëria, uji, faktet, sfida dhe miqtë vijnë me Etapat 3 dhe 4.

/** missed: ditë stërvitjeje e kaluar pa seancë (V38). */
export type TodayDayState = 'done' | 'rest' | 'planned' | 'missed'

export interface TodayWeekDay {
  /** "2026-11-02" */
  date: string
  /** Dita ISO: 1 = e hënë ... 7 = e diel. */
  weekday: number
  /** Dita e muajit. */
  day: number
  state: TodayDayState
  today: boolean
  /** Seanca e mbyllur e ditës (e fundit, kur janë disa), që prekja e ditës ta hapë te historiku. */
  sessionId: string | null
}

const isoWeekday = (date: Date) => date.getDay() || 7
const atNoon = (date: string) => new Date(`${date}T12:00:00`)
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12)

/**
 * Java kalendarike (e hënë–e diel) që përmban `now`: një ditë me seancë të mbyllur është e bërë;
 * një ditë jashtë ditëve të stërvitjes është pushim; të tjerat janë ditë stërvitjeje. Seancat vijnë
 * me radhën e mbylljes: e fundit e një dite është ajo që hapet.
 */
export function calendarWeek(
  now: Date,
  trainingDays: number[],
  completed: { date: string; id: string }[],
  missed: (date: string) => boolean = () => false,
  /** Ditë me lloj të zgjedhur (stërvitja e shtyrë, V50): vlen mbi ditët e stërvitjes të profilit. */
  dayTypes: Record<string, 'training' | 'rest'> = {},
): TodayWeekDay[] {
  const [monday] = weekRange(now)
  const today = localDate(now)
  const done = new Map(completed.map((session) => [session.date, session.id]))
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(atNoon(monday), index)
    const key = localDate(date)
    const weekday = isoWeekday(date)
    return {
      date: key,
      weekday,
      day: date.getDate(),
      state: done.has(key) ? 'done' : missed(key) ? 'missed' : (dayTypes[key] ? dayTypes[key] === 'training' : trainingDays.includes(weekday)) ? 'planned' : 'rest',
      today: key === today,
      sessionId: done.get(key) ?? null,
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
 * Grupi kryesor: grupi i muskujve kryesorë të ushtrimit të parë që ka muskuj të njohur, me të gjithë
 * çelësat kryesorë të stërvitjes që bien brenda tij. Jep rikuperimin e kartës dhe ku shikon modeli 3D.
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
  /** Pesha e javës kur seanca e parë pas pushimit e ul `weightKg` në 90% (V43): "55 në vend të 62,5"; përndryshe null. */
  weekKg: number | null
}

export interface TodayWorkout {
  /** "Dita e gjoksit": si te historiku, nga muskuli kryesor i ushtrimit të parë. */
  theme: DayTheme | null
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
  /** Ushqimi i ditës së ushqimit (V46): kaloritë dhe proteina kundrejt objektivave, dhe vakti i radhës. */
  food: TodayFood
  /** Vaktet e orarit të ditës së ushqimit (V35), me çfarë u ngrënë, dhe orët e zgjimit e të gjumit (ritmi i ditës, V57). */
  meals: TodayMeal[]
  wakeTime: string
  sleepTime: string
  /** Çasti i tanishëm në minuta nga mesnata e ditës së ushqimit (V46). */
  nowMinutes: number
  /** Ora e stërvitjes së sotme (V35) dhe e ditës së radhës: "Sot · 17:15 · Stërvitja 1". */
  trainingTime: string
  nextTime: string | null
  /**
   * Karta "Java jote" (V43, SPEC §0.3c): e hëna e javës që përmbledh, nga e diela 20:00 deri në fund të
   * së hënës (`weekCardMonday`); null jashtë saj.
   */
  weekCard: string | null
  /** Data e ushqimit dhe e ujit, dhe nëse sot është ditë stërvitjeje (objektivi i ujit, V36). */
  date: string
  trainingDay: boolean
  /** Pyetja e ditës së humbur (V38): dje ishte ditë stërvitjeje pa seancë; null kur nuk ka. */
  missed: TodayMissed | null
  /**
   * "Mirë se u ktheve" (V43): 7 ditë ose më shumë pa seancë të mbyllur, me një program me stërvitje;
   * null kur nuk ka. Zë vendin e kartës së ditës së humbur. Çelësi: `setLighterFirstSession`.
   */
  welcomeBack: WelcomeBack | null
  /**
   * "Shtyje për nesër" (V50, V2-E3-06): stërvitja e sotme kalon nesër; sot është ditë pushimi (`mode: 'rest'`,
   * `nextDate` nesër) deri në "Ktheje për sot". Nuk vlen pasi seanca ka nisur.
   */
  postponed: boolean
}

/** Një vakt i orarit të ditës së ushqimit, për ritmin e ditës dhe segmentet e proteinës. */
export interface TodayMeal {
  meal: MealKey
  time: string
  /** Minutat nga mesnata e ditës së ushqimit (pas mesnate mbi 1440). */
  minutes: number
  /** Ka regjistrim ushqimi (proteina e shënuar "E mora" nuk e bën vaktin të ngrënë, V39). */
  eaten: boolean
  kcal: number
  proteinG: number
}

export interface TodayFood {
  kcal: number
  targetKcal: number | null
  proteinG: number
  targetProteinG: number | null
  /** Vakti i radhës me orën ("Snack pasdite, 17:45"); null kur s'ka më vakte sot. */
  next: { meal: MealKey; time: string } | null
}

export interface TodayMissed {
  /** Dita e humbur. */
  date: string
  /** Sa ditë stërvitjeje rresht janë humbur deri dje. */
  streak: number
  /** Ora e stërvitjes nëse bëhet sot. */
  time: string
  /** Kaloritë e sotme si ditë stërvitjeje. */
  trainingKcal: number | null
}

/** Sot ka stërvitje të radhës: dita e stërvitjes ose seanca e nisur. */
export const isTrainingMode = (view: Pick<TodayView, 'mode'>) => view.mode === 'train' || view.mode === 'session'

export async function todayView(store: LocalStore): Promise<TodayView> {
  const now = store.now()
  const today = localDate(now)
  // Ushqimi dhe uji ndjekin ditën e ushqimit (V46); stërvitja dhe java mbeten sipas kalendarit.
  const eatingDate = await currentFoodDate(store, now)
  const [snapshot, history, profile, sessions, nutrition, schedule] = await Promise.all([
    trainingSnapshot(store),
    trainingHistory(store),
    readProfile(store),
    store.all('workout_sessions'),
    nutritionDay(store, eatingDate, now),
    readSchedule(store),
  ])
  const completed = sessions
    .filter((row) => row.status === 'completed')
    .sort((a, b) => String(a.ended_at).localeCompare(String(b.ended_at)))
    .map((row) => ({ date: String(row.date), id: row.id }))
  // Dita e humbur ndjek ditën e ushqimit (V46): dita e stërvitjes nuk ka mbaruar para ndërrimit të saj.
  const [choice, previous, rawMissed] = await Promise.all([readDailyChoice(store, eatingDate), readDailyChoice(store, shiftDate(eatingDate, -1)), readMissedInput(store)])
  // Stërvitja e shtyrë (V50): sot pushim dhe nesër stërvitje, edhe pa objektiva të ruajtur (pa peshë nuk ka rresht
  // të llojit të ditës); dje e shtyrë këtu, sot është ditë stërvitjeje dhe dje nuk është ditë e humbur.
  const postponedHere = choice?.choice === 'tomorrow'
  const moved: Record<string, 'training' | 'rest'> = {
    ...(previous?.choice === 'tomorrow' ? { [shiftDate(eatingDate, -1)]: 'rest', [eatingDate]: 'training' } : {}),
    ...(postponedHere ? { [eatingDate]: 'rest', [shiftDate(eatingDate, 1)]: 'training' } : {}),
  }
  const missedInput = { ...rawMissed, dayTypes: { ...rawMissed.dayTypes, ...moved } }
  // Pa program me stërvitje (asnjë, ose i mbaruar) nuk ka ditë të humbura.
  const programmeOpen = !!snapshot && !snapshot.completed
  const week = calendarWeek(now, profile.trainingDays, completed, (date) => programmeOpen && isMissed(missedInput, date, eatingDate), missedInput.dayTypes)
  const question = programmeOpen && !snapshot.session ? missedYesterday(missedInput, eatingDate) : null
  const missed: TodayMissed | null = question
    ? { ...question, time: trainingTimeOn(schedule, eatingDate), trainingKcal: (await dayTargets(store, eatingDate, 'training'))?.kcal ?? null }
    : null
  const trainingToday = !postponedHere && (profile.trainingDays.includes(isoWeekday(now)) || missedInput.dayTypes[today] === 'training')
  // Me seancën të hapur "Mirë se u ktheve" matet në datën e saj, si peshat (`workoutWeights`).
  const openDate = snapshot?.session ? (await store.get('workout_sessions', snapshot.session.id))?.date : null
  const back = programmeOpen ? await welcomeBack(store, openDate ? String(openDate).slice(0, 10) : today) : null
  // Pa seancë të nisur dhe pa stërvitje të bërë sot, "Shtyje për nesër" vlen; stërvitja e radhës është nesër.
  const postponed = postponedHere && programmeOpen && !snapshot.session && !completed.some((session) => session.date === today)
  const nextDate = postponed ? shiftDate(eatingDate, 1) : nextTrainingDate(now, profile.trainingDays)
  const base = {
    now,
    snapshot,
    week,
    nextDate,
    firstEver: history.sets.length === 0,
    protein: { eatenG: Math.round(nutrition.totals.proteinG), targetG: nutrition.targets ? Math.round(nutrition.targets.proteinG) : null },
    food: {
      kcal: Math.round(nutrition.totals.kcal),
      targetKcal: nutrition.targets ? Math.round(nutrition.targets.kcal) : null,
      proteinG: Math.round(nutrition.totals.proteinG),
      targetProteinG: nutrition.targets ? Math.round(nutrition.targets.proteinG) : null,
      next: nutrition.next ? { meal: nutrition.next.meal, time: nutrition.next.time } : null,
    },
    meals: nutrition.meals.map((slot) => ({ meal: slot.meal, time: slot.time, minutes: slot.minutes, eaten: slot.status === 'done', kcal: Math.round(slot.totals.kcal), proteinG: Math.round(slot.totals.proteinG) })),
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    nowMinutes: minutesInFoodDay(now, eatingDate),
    trainingTime: trainingTimeOn(schedule, today),
    nextTime: nextDate ? trainingTimeOn(schedule, nextDate) : null,
    weekCard: weekCardMonday(now),
    date: eatingDate,
    trainingDay: nutrition.dayType === 'training',
    missed,
    welcomeBack: back,
    postponed,
  }
  if (!snapshot) return { ...base, mode: 'none', workout: null }

  const { plan, exercises, session } = snapshot
  const mode: TodayMode = snapshot.completed
    ? 'completed'
    : session
      ? 'session'
      : completed.some((session) => session.date === today)
        ? 'done'
        : trainingToday
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
    const weight = (await workoutWeights(store, plan)).get(current.slotId)
    first = {
      name: exercise?.name ?? '',
      tracking: exercise?.tracking ?? 'weight_reps',
      target: current.target,
      weightKg: weight?.weightKg ?? null,
      weekKg: weight?.weekKg ?? null,
    }
  }
  return {
    ...base,
    mode,
    workout: {
      theme: dayTheme(exercises[plan.slots[0]?.exerciseId ?? '']?.primary ?? []),
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
