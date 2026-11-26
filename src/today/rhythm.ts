import type { MealKey } from '@/nutrition/meals'

// Ritmi i ditës te Sot (V57, SPEC §0.3f), pa UI dhe pa bazë: pozicionet e pikave nga zgjimi te gjumi (vaktet e
// orarit, stërvitja dhe "Tani"), vakti i radhës, pika më e afërt me gishtin dhe lëvizja e një vakti që vjen
// (V35). Orët janë minuta nga mesnata e ditës së ushqimit (V46): pas mesnate kalojnë 1440, si te `mealSchedule`.

/** Një vakt i orarit të ditës, me çfarë ka ngrënë përdoruesi në të (kcal dhe proteina të regjistruara). */
export interface RhythmMeal {
  meal: MealKey
  time: string
  minutes: number
  eaten: boolean
  /** I kapërcyer (V71): pika del e mbyllur, si një vakt i ngrënë. */
  skipped?: boolean
  kcal: number
  proteinG: number
}

export interface RhythmInput {
  wakeTime: string
  sleepTime: string
  meals: readonly RhythmMeal[]
  /** Stërvitja e sotme: ora e fillimit dhe nëse u bë; null kur sot s'ka stërvitje. */
  workout: { time: string; done: boolean } | null
  /** Çasti i tanishëm, në minuta nga mesnata e ditës së ushqimit. */
  nowMinutes: number
}

export interface RhythmPoint {
  /** Çelësi i vaktit, ose "workout". */
  id: MealKey | 'workout'
  kind: 'meal' | 'workout'
  minutes: number
  time: string
  /** Pozicioni mbi vijë: 0 te zgjimi, 1 te gjumi. */
  fraction: number
  /** Vakti i ngrënë, ose stërvitja e bërë. */
  done: boolean
  /** Ora e pikës ka kaluar. */
  past: boolean
  kcal: number
  proteinG: number
}

export interface Rhythm {
  wakeTime: string
  sleepTime: string
  startMinutes: number
  endMinutes: number
  nowMinutes: number
  /** "Tani" mbi vijë, brenda 0–1 (para zgjimit 0, pas gjumit 1). */
  nowFraction: number
  nowTime: string
  points: RhythmPoint[]
  /** Vakti i radhës: i pari pa regjistrim që nuk ka kaluar më shumë se 1 orë. */
  next: RhythmPoint | null
  /** Minutat deri te vakti i radhës (0 kur ora e tij ka kaluar tashmë). */
  nextInMinutes: number | null
  eatenMeals: number
  totalMeals: number
}

/** Një vakt pa regjistrim vazhdon të jetë "i radhës" deri 1 orë pas orës së tij (si te Ushqimi). */
export const MEAL_GRACE_MINUTES = 60
/** Hendeku më i vogël mes dy pikave kur lëviz një vakt. */
export const MIN_GAP_MINUTES = 10
const SNAP_MINUTES = 5
/** Vaktet që ndjekin stërvitjen ose gjumin dhe nuk lëvizen me dorë në ritëm. */
const ANCHORED: readonly MealKey[] = ['pre_workout', 'post_workout', 'bedtime']

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Ora e ditës "HH:MM" nga minutat, edhe mbi 24 orë. */
export function clockText(minutes: number): string {
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

/** Orët dhe minutat e plota të një kohe "pas": 90 → 1 orë, 30 min. */
export function untilParts(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

export function rhythmOf(input: RhythmInput): Rhythm {
  const startMinutes = toMinutes(input.wakeTime)
  let endMinutes = toMinutes(input.sleepTime)
  if (endMinutes <= startMinutes) endMinutes += 1440
  const span = endMinutes - startMinutes
  const fractionOf = (minutes: number) => Math.min(1, Math.max(0, (minutes - startMinutes) / span))
  const { nowMinutes } = input

  const meals = input.meals.map(
    (meal): RhythmPoint => ({
      id: meal.meal,
      kind: 'meal',
      minutes: meal.minutes,
      time: meal.time,
      fraction: fractionOf(meal.minutes),
      done: meal.eaten || meal.skipped === true,
      past: meal.minutes < nowMinutes,
      kcal: meal.kcal,
      proteinG: meal.proteinG,
    }),
  )
  const points = [...meals]
  if (input.workout) {
    let minutes = toMinutes(input.workout.time)
    if (minutes < startMinutes - 60) minutes += 1440
    points.push({
      id: 'workout',
      kind: 'workout',
      minutes,
      time: input.workout.time,
      fraction: fractionOf(minutes),
      done: input.workout.done,
      past: minutes < nowMinutes,
      kcal: 0,
      proteinG: 0,
    })
  }
  points.sort((a, b) => a.minutes - b.minutes)

  const next = meals.find((point) => !point.done && point.minutes >= nowMinutes - MEAL_GRACE_MINUTES) ?? null
  return {
    wakeTime: input.wakeTime,
    sleepTime: input.sleepTime,
    startMinutes,
    endMinutes,
    nowMinutes,
    nowFraction: fractionOf(nowMinutes),
    nowTime: clockText(nowMinutes),
    points,
    next,
    nextInMinutes: next ? Math.max(0, next.minutes - nowMinutes) : null,
    eatenMeals: meals.filter((point) => point.done).length,
    totalMeals: meals.length,
  }
}

/** Pika më e afërt me një pozicion mbi vijë (0–1); në mes të dyve, e para. */
export function nearestPoint(points: readonly RhythmPoint[], fraction: number): RhythmPoint | null {
  let best: RhythmPoint | null = null
  for (const point of points) {
    if (best === null || Math.abs(point.fraction - fraction) < Math.abs(best.fraction - fraction) - 1e-9) best = point
  }
  return best
}

/** Një vakt që vjen lëviz me dorë: jo i ngrënë, jo stërvitja, jo vaktet para dhe pas saj, jo vakti para gjumit. */
export function canMoveMeal(point: RhythmPoint, nowMinutes: number): boolean {
  return point.kind === 'meal' && !point.done && !ANCHORED.includes(point.id as MealKey) && point.minutes >= nowMinutes - MEAL_GRACE_MINUTES
}

export interface MealMove {
  meal: MealKey
  /** Ora e re e vaktit që lëviz, në minuta (e rrumbullakuar në 5 minuta, brenda kufijve). */
  minutes: number
  /** Sa minuta lëvizi vakti (i njëjti numër për vaktet që vijnë pas tij). */
  delta: number
  /** Vaktet pas tij që lëvizin bashkë me të. */
  shifts: { meal: MealKey; from: number; to: number }[]
  /** Ora e kërkuar ra jashtë kufijve (e kaluara, vaktet fqinje) dhe u përshtat. */
  clamped: boolean
}

/**
 * Lëvizja e një vakti që vjen te `wanted` (minuta): vaktet e zakonshme pas tij që s'janë ngrënë lëvizin bashkë me
 * të me të njëjtën diferencë; vaktet para dhe pas stërvitjes, ai para gjumit dhe të ngrënat mbeten, dhe asnjë vakt
 * nuk i afrohet një pike të fiksuar më pak se `MIN_GAP_MINUTES`. Nuk futet në të kaluarën. Null kur vakti nuk lëviz.
 */
export function moveMeals(points: readonly RhythmPoint[], meal: MealKey, wanted: number, nowMinutes: number): MealMove | null {
  const ordered = [...points].sort((a, b) => a.minutes - b.minutes)
  const index = ordered.findIndex((point) => point.id === meal)
  const dragged = ordered[index]
  if (!dragged || !canMoveMeal(dragged, nowMinutes)) return null

  const group = ordered.filter((point, at) => at >= index && point.kind === 'meal' && (at === index || (!point.done && !ANCHORED.includes(point.id as MealKey))))
  const inGroup = new Set(group)
  const before = ordered[index - 1]
  // Poshtë: jo para "Tani", jo para pikës para tij me hendek.
  const low = Math.max(nowMinutes, before ? before.minutes + MIN_GAP_MINUTES : -Infinity) - dragged.minutes
  // Lart: çdo anëtar i grupit mban hendek para pikës së parë të fiksuar pas tij.
  let high = Infinity
  for (const member of group) {
    const fixed = ordered.find((point) => point.minutes > member.minutes && !inGroup.has(point))
    if (fixed) high = Math.min(high, fixed.minutes - MIN_GAP_MINUTES - member.minutes)
  }
  if (low > high) return null

  const target = Math.round(wanted / SNAP_MINUTES) * SNAP_MINUTES
  const wantedDelta = target - dragged.minutes
  const delta = Math.min(high, Math.max(low, wantedDelta))
  return {
    meal,
    minutes: dragged.minutes + delta,
    delta,
    shifts: group.slice(1).map((member) => ({ meal: member.id as MealKey, from: member.minutes, to: member.minutes + delta })),
    clamped: delta !== wantedDelta,
  }
}
