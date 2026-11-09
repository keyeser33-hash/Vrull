import { localDate, shiftDate } from '@/lib/calendar'
import { trendWeight, type Weight } from '@/nutrition/weekly-check'
import { roundDown } from '@/program/loads'
import { isMissed, isTrainingDay, type MissedInput } from '@/program/missed-day'

// Qëllimet e javës (V43, SPEC §0.3c, V2-E2-20), pa UI dhe pa bazë. Java është kalendarike, e hënë–e
// diel, si rripi i Sot. Tri qëllime: stërvitja (seancat e mbyllura kundrejt ditëve të stërvitjes së
// javës), ushqimi (5 ditë nga 7 me të paktën 60% të kalorive të ditës) dhe uji (5 ditë nga 7 me
// objektivin e ditës). Dita rezervë (një për bllok) dhe vargu nuk ruhen: rillogariten nga historia,
// nga java më e vjetër te më e reja, ndaj një seancë e ndryshuar ose e sinkronizuar më vonë i ndreq vetë.

/** Pjesa e kalorive të ditës që e bën ditën të numëruar te ushqimi. */
export const FOOD_SHARE = 0.6
/** Uji numëron ditën kur arrin gjithë objektivin. */
export const WATER_SHARE = 1
/** Ushqimi dhe uji: 5 ditë nga 7. */
export const GOAL_DAYS = 5
/** "Mirë se u ktheve": kaq ditë ose më shumë nga seanca e fundit e mbyllur. */
export const WELCOME_BACK_DAYS = 7
/** "Seanca e parë më e lehtë": pjesa e peshës së javës. */
export const LIGHTER_SHARE = 0.9

const DAY_MS = 86_400_000
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
/** Ditët nga një datë te tjetra ("2026-11-27" → "2026-12-07" = 10). */
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from)
/** Dita ISO e javës (1 = e hënë ... 7 = e diel); 1 janari 1970 ishte e enjte. */
const isoWeekday = (date: string) => ((((dayNumber(date) + 3) % 7) + 7) % 7) + 1

/** E hëna e javës kalendarike të një date. */
export function mondayOf(date: string): string {
  return shiftDate(date, 1 - isoWeekday(date))
}

/** Shtatë datat e javës, nga e hëna te e diela. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index))
}

// --- Stërvitja ---

export interface GoalSession {
  id: string
  /** Data e seancës (YYYY-MM-DD), si te rripi i Sot. */
  date: string
  /** Çasti i fillimit ose i mbylljes: radha brenda ditës. */
  at: string
  status: 'completed' | 'skipped' | 'in_progress'
  /** Blloku i programit si çelës (xhiroja dhe blloku, `blockKey` te data); null kur mungon. */
  block: string | null
}

export interface TrainingInput {
  /** Ditët e stërvitjes së profilit, fillimi, datat me seancë dhe ditët e zgjedhura me dorë (V38). */
  days: MissedInput
  sessions: readonly GoalSession[]
  /** Blloku i treguesit së programit; null pa program. */
  pointerBlock: string | null
}

export interface TrainingWeek {
  monday: string
  /** Ditët e stërvitjes që numërohen: të profilit dhe ato me dorë, nga fillimi (V38). */
  trainingDates: string[]
  /** Objektivi: ditët e stërvitjes, të shumtën sa ditë ka profili (dita e humbur e zhvendosur nuk e rrit). */
  target: number
  /** Seancat e mbyllura të javës. */
  done: number
  /** Blloku i javës: i seancës së fundit të saj; pa seancë, i seancës pas saj; pa të, i treguesit. */
  block: string | null
  /** Java mbaroi (sot është pas së dielës së saj). */
  closed: boolean
  /** Dita rezervë që mbuloi javën (vetëm një javë e mbyllur), me ditën e stërvitjes pa seancë. */
  spare: { block: string; date: string | null } | null
  /** Qëllimi u arrit (me ditën rezervë kur u përdor); null kur java s'ka ditë stërvitjeje. */
  met: boolean | null
}

export interface TrainingLedger {
  /** Nga java e parë (e fillimit ose e seancës së parë) te java e `today`, e vjetra e para. */
  weeks: TrainingWeek[]
  /** Blloqet që e përdorën ditën rezervë, me të hënën e javës. */
  spareUsed: Map<string, string>
}

const chronological = (a: GoalSession, b: GoalSession) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at)

function weekTraining(input: TrainingInput, ordered: GoalSession[], monday: string) {
  const sunday = shiftDate(monday, 6)
  const { days } = input
  const trainingDates = weekDates(monday).filter((date) => (days.startedOn === null || date >= days.startedOn) && isTrainingDay(days, date))
  const inWeek = ordered.filter((entry) => entry.date >= monday && entry.date <= sunday)
  const block = inWeek.length > 0 ? inWeek[inWeek.length - 1].block : (ordered.find((entry) => entry.date > sunday)?.block ?? input.pointerBlock)
  return {
    monday,
    trainingDates,
    target: Math.min(trainingDates.length, days.trainingDays.length),
    done: inWeek.filter((entry) => entry.status === 'completed').length,
    block,
    inWeek,
  }
}

/**
 * Javët e stërvitjes nga e para te ajo e `today`, me ditën rezervë: kur java mbyllet një stërvitje
 * më pak se objektivi dhe blloku i saj s'e ka përdorur ende, dita rezervë e plotëson qëllimin. Nuk
 * mbulon dy stërvitje dhe nuk kalon te blloku tjetër. Java e `today` mbetet e hapur (pa ditë rezervë).
 */
export function trainingLedger(input: TrainingInput, today: string): TrainingLedger {
  const ordered = [...input.sessions].sort(chronological)
  const current = mondayOf(today)
  const first = [input.days.startedOn, ordered[0]?.date].filter((date): date is string => !!date).sort()[0]
  const start = first && mondayOf(first) < current ? mondayOf(first) : current
  const spareUsed = new Map<string, string>()
  const weeks: TrainingWeek[] = []
  for (let monday = start; monday <= current; monday = shiftDate(monday, 7)) {
    const { inWeek, ...week } = weekTraining(input, ordered, monday)
    const closed = shiftDate(monday, 6) < today
    let met: boolean | null = week.target > 0 ? week.done >= week.target : null
    let spare: TrainingWeek['spare'] = null
    if (closed && met === false && week.done === week.target - 1 && week.block !== null && !spareUsed.has(week.block)) {
      const trained = new Set(inWeek.filter((entry) => entry.status === 'completed').map((entry) => entry.date))
      spareUsed.set(week.block, monday)
      spare = { block: week.block, date: week.trainingDates.filter((date) => !trained.has(date)).at(-1) ?? null }
      met = true
    }
    weeks.push({ ...week, closed, met, spare })
  }
  return { weeks, spareUsed }
}

/**
 * Vargu te java e dhënë: javët e mbyllura rresht me qëllimin e stërvitjes (me ditën rezervë), plus
 * java e hapur kur e ka arritur qëllimin para të dielës. Një javë pa ditë stërvitjeje nuk e ndërpret.
 */
export function streakAt(weeks: readonly TrainingWeek[], monday: string): number {
  let index = weeks.findIndex((week) => week.monday === monday)
  if (index < 0) return 0
  let streak = 0
  if (!weeks[index].closed) {
    if (weeks[index].met) streak += 1
    index -= 1
  }
  for (; index >= 0; index--) {
    const { met } = weeks[index]
    if (met === null) continue
    if (!met) break
    streak += 1
  }
  return streak
}

/** done: seancë e mbyllur; spare: e mbuluar nga dita rezervë; missed: ditë stërvitjeje e kaluar pa seancë (V38). */
export type TrainingDayState = 'done' | 'skipped' | 'spare' | 'missed' | 'planned' | 'rest'

export interface TrainingDay {
  date: string
  /** Ditë stërvitjeje që numërohet te objektivi. */
  training: boolean
  state: TrainingDayState
  /** Seanca e mbyllur e ditës (e fundit, kur janë disa). */
  sessionId: string | null
}

/**
 * Ditët e një jave për rripin e qëllimeve. Dita e humbur ndjek ditën e ushqimit (V46), si te Sot, dhe
 * vetëm me një program me stërvitje; një ditë stërvitjeje e kaluar pa program është pushim.
 */
export function trainingDays(input: TrainingInput, week: TrainingWeek, options: { foodToday: string; programmeOpen: boolean }): TrainingDay[] {
  const ordered = [...input.sessions].sort(chronological)
  return weekDates(week.monday).map((date) => {
    const training = week.trainingDates.includes(date)
    const sessions = ordered.filter((entry) => entry.date === date)
    const done = sessions.filter((entry) => entry.status === 'completed').at(-1)
    const state: TrainingDayState = done
      ? 'done'
      : week.spare?.date === date
        ? 'spare'
        : sessions.some((entry) => entry.status === 'skipped')
          ? 'skipped'
          : !training
            ? 'rest'
            : !options.programmeOpen
              ? date < options.foodToday
                ? 'rest'
                : 'planned'
              : isMissed(input.days, date, options.foodToday)
                ? 'missed'
                : 'planned'
    return { date, training, state, sessionId: done?.id ?? null }
  })
}

// --- Ushqimi dhe uji ---

export interface IntakeDay {
  date: string
  /** Kaloritë e regjistruara, ose mililitrat e ujit. */
  amount: number
  /** Objektivi i ditës; null kur dita s'ka objektiva (pa peshë). */
  target: number | null
}

/** counted: dita numërohet; missed: ditë e kaluar nën kufi; partial: sot, ende nën kufi; none: pa objektiv. */
export type IntakeDayState = 'counted' | 'missed' | 'partial' | 'upcoming' | 'none'

export interface IntakeDayView extends IntakeDay {
  /** Sa për qind e objektivit ("Sot: 54%"); null pa objektiv. */
  percent: number | null
  state: IntakeDayState
}

export interface IntakeGoal {
  /** 5 ditë nga 7. */
  goal: number
  counted: number
  met: boolean
  days: IntakeDayView[]
}

/**
 * Qëllimi i ushqimit ose i ujit për shtatë ditët e javës (sipas ditës së ushqimit, V46): një ditë
 * numërohet kur arrin `share` të objektivit të vet. Null kur asnjë ditë s'ka objektiv (pa profil).
 */
export function intakeGoal(days: readonly IntakeDay[], share: number, today: string): IntakeGoal | null {
  if (days.every((day) => day.target === null || day.target <= 0)) return null
  const views = days.map((day): IntakeDayView => {
    const target = day.target !== null && day.target > 0 ? day.target : null
    const state: IntakeDayState =
      target !== null && day.amount >= target * share - 1e-9 ? 'counted' : target === null ? 'none' : day.date < today ? 'missed' : day.date === today ? 'partial' : 'upcoming'
    return { ...day, percent: target === null ? null : Math.round((day.amount / target) * 100), state }
  })
  const counted = views.filter((day) => day.state === 'counted').length
  return { goal: GOAL_DAYS, counted, met: counted >= GOAL_DAYS, days: views }
}

export const foodGoal = (days: readonly IntakeDay[], today: string) => intakeGoal(days, FOOD_SHARE, today)
export const waterGoal = (days: readonly IntakeDay[], today: string) => intakeGoal(days, WATER_SHARE, today)

/** Java e plotë: të tre qëllimet; një javë pa objektiva ushqimi dhe uji nuk është e plotë. */
export function completeWeek(training: boolean | null, food: IntakeGoal | null, water: IntakeGoal | null): boolean {
  return training === true && !!food?.met && !!water?.met
}

// --- Mirë se u ktheve ---

/** Ditët pa stërvitje kur janë 7 ose më shumë nga seanca e fundit e mbyllur; përndryshe null. */
export function welcomeBackDays(lastCompleted: string | null, today: string): number | null {
  if (lastCompleted === null) return null
  const days = daysBetween(lastCompleted, today)
  return days >= WELCOME_BACK_DAYS ? days : null
}

/** 90% e peshës së javës, poshtë sipas hapit të pajisjes (si çdo peshë e propozuar, §7); nën një hap mbetet pesha. */
export function lighterWeight(weightKg: number, stepKg: number): number {
  const lighter = roundDown(weightKg * LIGHTER_SHARE, stepKg)
  return lighter > 0 ? lighter : weightKg
}

// --- Përmbledhja e javës ---

/** Ora e së dielës kur vjen përmbledhja ("Java jote është gati"). */
export const WEEK_CARD_HOUR = 20

/**
 * Karta "Java jote" te Sot (V43): nga e diela 20:00 deri në fund të së hënës, sipas kalendarit. Kthen të
 * hënën e javës që përmbledh (`weekSummary`), ose null kur karta nuk del.
 */
export function weekCardMonday(now: Date): string | null {
  const today = localDate(now)
  const weekday = isoWeekday(today)
  if (weekday === 7 && now.getHours() >= WEEK_CARD_HOUR) return mondayOf(today)
  if (weekday === 1) return shiftDate(today, -7)
  return null
}

export interface WeekRecordInput {
  exerciseId: string
  e1rmKg: number
  /** Më i miri para seancës së rekordit (`sessionRecords`). */
  previousBestKg: number
}

export interface WeekRecord {
  exerciseId: string
  e1rmKg: number
  /** Kundrejt më të mirit para javës. */
  gainKg: number
}

/**
 * Rekordet e javës nga rekordet e seancave (`sessionRecords`, me radhën e seancave): numri i të gjithave
 * (si te Historiku) dhe tri më të mëdhatë, një për ushtrim, me e1RM-në më të lartë të javës kundrejt
 * më të mirit para javës (ai para rekordit të parë të ushtrimit në javë).
 */
export function weekRecords(records: readonly WeekRecordInput[], limit = 3): { count: number; top: WeekRecord[] } {
  const byExercise = new Map<string, { e1rmKg: number; baseKg: number }>()
  for (const record of records) {
    const entry = byExercise.get(record.exerciseId)
    if (entry) entry.e1rmKg = Math.max(entry.e1rmKg, record.e1rmKg)
    else byExercise.set(record.exerciseId, { e1rmKg: record.e1rmKg, baseKg: record.previousBestKg })
  }
  const top = [...byExercise.entries()]
    .map(([exerciseId, entry]) => ({ exerciseId, e1rmKg: entry.e1rmKg, gainKg: entry.e1rmKg - entry.baseKg }))
    .sort((a, b) => b.gainKg - a.gainKg)
    .slice(0, limit)
  return { count: records.length, top }
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Pesha e javës: mesatarja 7-ditore e së dielës (`trendWeight`, si kontrolli javor) dhe ndryshimi kundrejt së dielës para. */
export function weekWeight(weights: readonly Weight[], sunday: string): { averageKg: number | null; changeKg: number | null } {
  const now = trendWeight(weights, sunday)
  const before = trendWeight(weights, shiftDate(sunday, -7))
  return { averageKg: now === null ? null : round2(now), changeKg: now === null || before === null ? null : round2(now - before) }
}

/** Mesatarja; null pa vlera. */
export function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length
}
