import { shiftDate } from '@/lib/calendar'
import type { MissedInput } from '@/program/missed-day'
import {
  completeWeek,
  FOOD_SHARE,
  GOAL_DAYS,
  type GoalSession,
  type IntakeDay,
  intakeGoal,
  type IntakeGoal,
  mondayOf,
  streakAt,
  trainingLedger,
  type TrainingWeek,
  WATER_SHARE,
  weekDates,
} from './weekly-goals'

// Arritjet (V43, SPEC §0.3c, V2-E2-21), pa UI dhe pa bazë: dhjetë shenja me rregull të qartë, secila
// jepet një herë. Për çdo arritje: kur u plotësua rregulli për herë të parë sipas historisë (data e
// ngjarjes, jo "sot", që rillogaritja të japë gjithmonë të njëjtën datë) dhe sa mungon. Qëllimet e javës,
// dita rezervë dhe vargu vijnë nga `weekly-goals.ts`; rekordet nga `sessionRecords` (vetëm me një e1RM të
// mëparshme, `e1rmRecord`). Ruajtja (një herë, pa ndryshuar datën) është te `data/achievements.ts`.

/** Çelësat e arritjeve, me radhën e SPEC-ut (forma e kolonës `key`: ^[a-z0-9_]{1,40}$). */
export const ACHIEVEMENT_KEYS = ['first_session', 'first_record', 'full_week', 'streak_4', 'records_10', 'phase_1', 'sessions_25', 'food_7', 'water_7', 'programme'] as const

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number]

/** Javë rresht me qëllimin e stërvitjes. */
export const STREAK_WEEKS = 4
export const RECORDS_TARGET = 10
export const SESSIONS_TARGET = 25
/** Ushqimi dhe uji: çdo ditë e javës. */
export const ALL_WEEK = 7
/** "E re": e fituar në kaq ditët e fundit, sot përfshirë. */
export const NEW_DAYS = 7

export interface AchievementSession {
  id: string
  /** Data e seancës (YYYY-MM-DD), si te rripi i Sot. */
  date: string
  startedAt: string | null
  /** Çasti i mbylljes; radha e seancave. */
  endedAt: string | null
  status: 'completed' | 'skipped' | 'in_progress'
  programId: string | null
  /** Xhiroja e programit (nga 1). */
  run: number
  blockId: string | null
  week: number
  dayId: string | null
}

export interface AchievementProgramme {
  id: string
  blocks: { id: string; position: number; weeks: number }[]
  /** Ditët e programit që përsëriten çdo javë. */
  dayIds: string[]
}

export interface AchievementInput {
  /** Data kalendarike e sotme. */
  today: string
  /** Ditët e stërvitjes (profili, fillimi, ditët me dorë), si te qëllimet e javës. */
  days: MissedInput
  /** Blloku i treguesit (dita rezervë e javëve pa seancë); null pa program. */
  pointer: { run: number; blockId: string } | null
  sessions: readonly AchievementSession[]
  /** Një rresht për çdo rekord të e1RM-së (seancë × ushtrim, `sessionRecords`), si te Historiku. */
  records: readonly { sessionId: string }[]
  programmes: readonly AchievementProgramme[]
  activeProgrammeId: string | null
  /** Ditët me ushqim të regjistruar (dita e ushqimit, V46): kaloritë dhe objektivi i ditës. */
  food: readonly IntakeDay[]
  /** Ditët me ujë: mililitrat dhe objektivi i ditës. */
  water: readonly IntakeDay[]
}

export interface AchievementProgress {
  current: number
  /** 0 kur arritja s'ka objektiv pa program (Faza 1, Programi). */
  target: number
}

export interface StreakWeek {
  monday: string
  done: number
  target: number
  /** Java u plotësua me ditën rezervë ("3+1"). */
  spare: boolean
}

export interface AchievementState {
  key: AchievementKey
  /** Kur u plotësua rregulli për herë të parë, me seancën që e plotësoi (kur ishte një seancë); null pa u plotësuar. */
  met: { date: string; sessionId: string | null } | null
  /** Sa ka (ose më e mira deri tani) kundrejt objektivit; i plotë kur rregulli u plotësua. */
  progress: AchievementProgress
  /** Vetëm vargu: javët që e bënë (ose vargu i tanishëm), e vjetra e para. */
  weeks?: StreakWeek[]
}

type Met = AchievementState['met']

const completedOrder = (session: AchievementSession) => session.endedAt ?? session.date

/** Seanca si te qëllimet e javës: blloku si çelës i xhiros dhe bllokut (dita rezervë është një për bllok). */
const goalSession = (session: AchievementSession): GoalSession => ({
  id: session.id,
  date: session.date,
  at: session.startedAt ?? session.endedAt ?? '',
  status: session.status,
  block: session.blockId ? `${session.run}:${session.blockId}` : null,
})

const full = (target: number): AchievementProgress => ({ current: target, target })
const counted = (target: number, current: number): AchievementProgress => ({ current: Math.min(current, target), target })

/** Arritja e n-të (nga 1) në një listë me radhë: data dhe seanca e saj. */
function nth(sessions: readonly AchievementSession[], n: number): Met {
  const entry = sessions[n - 1]
  return entry ? { date: entry.date, sessionId: entry.id } : null
}

// --- Vargu dhe java e plotë ---

/** Kur u arrit qëllimi i stërvitjes së javës: seanca që e plotësoi, ose e diela kur e plotësoi dita rezervë. */
function trainingMet(week: TrainingWeek, sessions: readonly GoalSession[]): Met {
  if (week.met !== true) return null
  const sunday = shiftDate(week.monday, 6)
  if (week.spare) return { date: sunday, sessionId: null }
  const done = sessions
    .filter((entry) => entry.status === 'completed' && entry.date >= week.monday && entry.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
  const entry = done[week.target - 1]
  return entry ? { date: entry.date, sessionId: entry.id } : null
}

/** Javët që numëron `streakAt` te java me indeksin e dhënë, e vjetra e para. */
function streakRun(weeks: readonly TrainingWeek[], index: number): TrainingWeek[] {
  const run: TrainingWeek[] = []
  let at = index
  if (at >= 0 && !weeks[at].closed) {
    if (weeks[at].met) run.unshift(weeks[at])
    at -= 1
  }
  for (; at >= 0; at--) {
    const { met } = weeks[at]
    if (met === null) continue
    if (!met) break
    run.unshift(weeks[at])
  }
  return run
}

const streakWeek = (week: TrainingWeek): StreakWeek => ({ monday: week.monday, done: week.done, target: week.target, spare: week.spare !== null })

/** Ushqimi ose uji i një jave nga ditët me regjistrime; ditët pa to s'kanë objektiv. */
function weekIntake(days: ReadonlyMap<string, IntakeDay>, monday: string, share: number, today: string): IntakeGoal | null {
  return intakeGoal(
    weekDates(monday).map((date) => days.get(date) ?? { date, amount: 0, target: null }),
    share,
    today,
  )
}

const countedDates = (goal: IntakeGoal | null) => goal?.days.filter((day) => day.state === 'counted').map((day) => day.date) ?? []

/** Ushqimi ose uji 7 nga 7: java e parë me çdo ditë të numëruar (fitohet të dielën), ose më e mira deri tani. */
function allWeek(days: readonly IntakeDay[], share: number, today: string): { met: Met; progress: AchievementProgress } {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const mondays = [...new Set(days.map((day) => mondayOf(day.date)))].sort()
  let best = 0
  for (const monday of mondays) {
    const dates = countedDates(weekIntake(byDate, monday, share, today))
    if (dates.length >= ALL_WEEK) return { met: { date: dates[ALL_WEEK - 1], sessionId: null }, progress: full(ALL_WEEK) }
    best = Math.max(best, dates.length)
  }
  return { met: null, progress: counted(ALL_WEEK, best) }
}

// --- Faza 1 dhe programi ---

interface ProgrammeResult {
  phase: { met: Met; progress: AchievementProgress }
  programme: { met: Met; progress: AchievementProgress }
}

/**
 * Faza 1: blloku i parë pas Javës 0 (blloku hyrës prej një jave në krye, kur pas tij vjen një tjetër),
 * ose blloku i parë kur programi s'ka Javë 0. Stërvitjet numërohen një herë (blloku, java, dita), nga
 * çdo xhiro: një stërvitje e kapërcyer mbetet pa u numëruar derisa të bëhet në një xhiro tjetër. Programi:
 * çdo javë e çdo blloku me të gjitha stërvitjet e saj.
 */
function programmeProgress(programme: AchievementProgramme, sessions: readonly AchievementSession[]): ProgrammeResult | null {
  const blocks = [...programme.blocks].sort((a, b) => a.position - b.position)
  const dayIds = new Set(programme.dayIds)
  if (blocks.length === 0 || dayIds.size === 0) return null
  const phase = blocks[blocks.length > 1 && blocks[0].weeks === 1 ? 1 : 0]
  const phaseTotal = phase.weeks * dayIds.size
  const weeksTotal = blocks.reduce((total, block) => total + block.weeks, 0)
  const byId = new Map(blocks.map((block) => [block.id, block]))
  const done = new Set<string>()
  const weekDays = new Map<string, number>()
  let phaseDone = 0
  let weeksDone = 0
  let phaseMet: Met = null
  let programmeMet: Met = null
  for (const session of sessions) {
    const block = session.blockId ? byId.get(session.blockId) : undefined
    if (session.programId !== programme.id || !block || !session.dayId || !dayIds.has(session.dayId) || session.week < 1 || session.week > block.weeks) continue
    const key = `${block.id}|${session.week}|${session.dayId}`
    if (done.has(key)) continue
    done.add(key)
    if (block.id === phase.id && ++phaseDone === phaseTotal) phaseMet ??= { date: session.date, sessionId: session.id }
    const week = `${block.id}|${session.week}`
    const days = (weekDays.get(week) ?? 0) + 1
    weekDays.set(week, days)
    if (days === dayIds.size && ++weeksDone === weeksTotal) programmeMet ??= { date: session.date, sessionId: session.id }
  }
  return {
    phase: { met: phaseMet, progress: counted(phaseTotal, phaseDone) },
    programme: { met: programmeMet, progress: counted(weeksTotal, weeksDone) },
  }
}

const earlier = (a: Met, b: Met): Met => (!a ? b : !b ? a : b.date < a.date ? b : a)

/** E fituar nga cilido program (më e hershmja); progresi i programit aktiv, ose i më të mirit pa të. */
function acrossProgrammes(results: { id: string; result: ProgrammeResult['phase'] }[], activeId: string | null): ProgrammeResult['phase'] {
  const met = results.reduce<Met>((first, entry) => earlier(first, entry.result.met), null)
  if (met) {
    const source = results.find((entry) => entry.result.met?.date === met.date && entry.result.met.sessionId === met.sessionId)!
    return { met, progress: full(source.result.progress.target) }
  }
  const active = results.find((entry) => entry.id === activeId)
  if (active) return active.result
  const ratio = (progress: AchievementProgress) => (progress.target > 0 ? progress.current / progress.target : 0)
  const best = results.reduce<(typeof results)[number] | null>((top, entry) => (top && ratio(top.result.progress) >= ratio(entry.result.progress) ? top : entry), null)
  return best?.result ?? { met: null, progress: { current: 0, target: 0 } }
}

// --- Të gjitha ---

/** Gjendja e dhjetë arritjeve sipas historisë, me radhën e `ACHIEVEMENT_KEYS`. */
export function achievementStates(input: AchievementInput): AchievementState[] {
  const { today } = input
  const completed = input.sessions.filter((entry) => entry.status === 'completed').sort((a, b) => completedOrder(a).localeCompare(completedOrder(b)))
  const order = new Map(completed.map((entry, index) => [entry.id, index]))
  const records = input.records
    .filter((record) => order.has(record.sessionId))
    .map((record) => completed[order.get(record.sessionId)!])
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)

  // Qëllimet e javës: stërvitja (me ditën rezervë), ushqimi dhe uji, java pas jave.
  const goalSessions = input.sessions.map(goalSession)
  const { weeks } = trainingLedger({ days: input.days, sessions: goalSessions, pointerBlock: input.pointer ? `${input.pointer.run}:${input.pointer.blockId}` : null }, today)
  const food = new Map(input.food.map((day) => [day.date, day]))
  const water = new Map(input.water.map((day) => [day.date, day]))

  let streak: AchievementState | null = null
  let fullWeek: Met = null
  let bestGoals = 0
  for (const [index, week] of weeks.entries()) {
    const training = trainingMet(week, goalSessions)
    if (!streak && training && streakAt(weeks, week.monday) >= STREAK_WEEKS) {
      streak = { key: 'streak_4', met: training, progress: full(STREAK_WEEKS), weeks: streakRun(weeks, index).slice(-STREAK_WEEKS).map(streakWeek) }
    }
    const foodGoal = weekIntake(food, week.monday, FOOD_SHARE, today)
    const waterGoal = weekIntake(water, week.monday, WATER_SHARE, today)
    bestGoals = Math.max(bestGoals, Number(week.met === true) + Number(!!foodGoal?.met) + Number(!!waterGoal?.met))
    if (!fullWeek && training && completeWeek(week.met, foodGoal, waterGoal)) {
      // Java bëhet e plotë ditën kur arrihet i fundit nga tre qëllimet.
      const last = [countedDates(foodGoal)[GOAL_DAYS - 1], countedDates(waterGoal)[GOAL_DAYS - 1]].reduce((max, date) => (date > max ? date : max), training.date)
      fullWeek = last === training.date ? training : { date: last, sessionId: null }
    }
  }
  const currentIndex = weeks.length - 1
  const streakState: AchievementState = streak ?? {
    key: 'streak_4',
    met: null,
    progress: counted(STREAK_WEEKS, currentIndex >= 0 ? streakAt(weeks, weeks[currentIndex].monday) : 0),
    weeks: streakRun(weeks, currentIndex).map(streakWeek),
  }

  const programmes = input.programmes.flatMap((programme) => {
    const result = programmeProgress(programme, completed)
    return result ? [{ id: programme.id, result }] : []
  })
  const phase = acrossProgrammes(
    programmes.map((entry) => ({ id: entry.id, result: entry.result.phase })),
    input.activeProgrammeId,
  )
  const programme = acrossProgrammes(
    programmes.map((entry) => ({ id: entry.id, result: entry.result.programme })),
    input.activeProgrammeId,
  )

  const byCount = (key: AchievementKey, list: readonly AchievementSession[], target: number): AchievementState => {
    const met = nth(list, target)
    return { key, met, progress: met ? full(target) : counted(target, list.length) }
  }
  const foodWeek = allWeek(input.food, FOOD_SHARE, today)
  const waterWeek = allWeek(input.water, WATER_SHARE, today)
  const states: Record<AchievementKey, AchievementState> = {
    first_session: byCount('first_session', completed, 1),
    first_record: byCount('first_record', records, 1),
    full_week: { key: 'full_week', met: fullWeek, progress: fullWeek ? full(3) : counted(3, bestGoals) },
    streak_4: streakState,
    records_10: byCount('records_10', records, RECORDS_TARGET),
    phase_1: { key: 'phase_1', ...phase },
    sessions_25: byCount('sessions_25', completed, SESSIONS_TARGET),
    food_7: { key: 'food_7', ...foodWeek },
    water_7: { key: 'water_7', ...waterWeek },
    programme: { key: 'programme', ...programme },
  }
  return ACHIEVEMENT_KEYS.map((key) => states[key])
}

// --- Për ekranet ---

interface Listed {
  key: AchievementKey
  earnedOn: string | null
  progress: AchievementProgress
}

const canonical = (key: AchievementKey) => ACHIEVEMENT_KEYS.indexOf(key)

/** Faqja Arritjet: të fituarat sipas datës (më e reja e para), pastaj të tjerat me radhën e rregullave. */
export function orderAchievements<T extends Listed>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.earnedOn && b.earnedOn) return b.earnedOn.localeCompare(a.earnedOn) || canonical(a.key) - canonical(b.key)
    if (a.earnedOn || b.earnedOn) return a.earnedOn ? -1 : 1
    return canonical(a.key) - canonical(b.key)
  })
}

/** "E re": e fituar në 7 ditët e fundit. */
export function isNewAchievement(earnedOn: string | null, today: string): boolean {
  return earnedOn !== null && earnedOn <= today && earnedOn >= shiftDate(today, 1 - NEW_DAYS)
}

/**
 * "Më afër tani": nga arritjet e pafituara, ajo me pjesën më të madhe të objektivit (me radhën e
 * rregullave kur janë njësoj); pa ato të `exclude` dhe pa ato pa objektiv. Null kur s'mbetet asnjë.
 */
export function nearestAchievement<T extends Listed>(list: readonly T[], exclude: readonly AchievementKey[] = []): T | null {
  const open = list.filter((entry) => entry.earnedOn === null && entry.progress.target > 0 && !exclude.includes(entry.key))
  const ratio = (entry: T) => entry.progress.current / entry.progress.target
  return open.reduce<T | null>((top, entry) => {
    if (!top) return entry
    const difference = ratio(entry) - ratio(top)
    return difference > 1e-9 || (Math.abs(difference) <= 1e-9 && canonical(entry.key) < canonical(top.key)) ? entry : top
  }, null)
}
