import { localDate, shiftDate } from '@/lib/calendar'
import { planSession } from '@/program/engine'
import type { ProgramWeek, SessionPlan } from '@/program/types'
import { upcomingDates, workoutMinutes } from '@/program/week-plan'
import { durationMinutes, recordsAtTheTime, sessionRecords } from '@/progress/history'
import {
  average,
  blockKey,
  completeWeek,
  foodGoal,
  type GoalSession,
  type IntakeGoal,
  mondayOf,
  parseBlockKey,
  streakAt,
  type TrainingDay,
  trainingDays,
  type TrainingInput,
  trainingLedger,
  type TrainingWeek,
  waterGoal,
  weekDates,
  weekRecords,
  weekWeight,
} from '@/progress/weekly-goals'
import { isLoggedDay } from '@/nutrition/weekly-check'
import { readMissedInput } from './missed-day'
import { currentFoodDate, dayTargets } from './nutrition'
import { readSchedule, trainingTimeOn } from './schedule-settings'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { activeProgram, trainingHistory } from './training'
import { waterDay } from './water'

// Qëllimet e javës në bazë (V43, SPEC §0.3c, V2-E2-20): java e tanishme për Sot dhe faqen Qëllimet e
// javës, dhe përmbledhja e një jave për kartën e së dielës dhe Progresi › Përmbledhja. Rregullat jetojnë
// te `progress/weekly-goals.ts`; ky modul lexon seancat, ushqimin (dita e ushqimit, V46), ujin, peshën
// dhe programin. Asgjë nuk ruhet: dita rezervë dhe vargu rillogariten nga historia në çdo lexim.

export type { IntakeDayState, IntakeDayView, IntakeGoal, TrainingDayState } from '@/progress/weekly-goals'

export interface WeekTrainingDay extends TrainingDay {
  /** Dita ISO e javës: 1 = e hënë ... 7 = e diel. */
  weekday: number
  /** Dita e muajit. */
  day: number
  /** Data kalendarike e sotme (si rripi i Sot). */
  today: boolean
}

export interface TrainingGoal {
  /** Seancat e mbyllura të javës. */
  done: number
  /** Ditët e stërvitjes të javës (4 nga 4 për përdoruesin); 0 kur java s'ka ditë stërvitjeje. */
  target: number
  /** I arritur (me ditën rezervë te java e mbyllur); null pa ditë stërvitjeje. */
  met: boolean | null
}

export interface SpareStatus {
  blockId: string
  run: number
  /** Emri i bllokut siç ruhet ("Faza 1"); në gjuhën e app-it me `programBlockName`. */
  blockName: string
  /** Java (e hëna) dhe dita e stërvitjes që mbuloi, kur blloku e ka përdorur; null kur është e lirë. */
  used: { monday: string; date: string | null } | null
  /** Java e tanishme është një stërvitje më pak se objektivi dhe dita rezervë është e lirë: po të mbyllej sot, do ta mbulonte. */
  wouldCover: boolean
  /** E diela e javës ku pritet stërvitja e fundit e bllokut (parashikim, si datat te Programi); null kur blloku s'është i treguesit. */
  endsOn: string | null
}

export interface WeekGoalsView {
  monday: string
  sunday: string
  /** Data kalendarike e sotme dhe dita e ushqimit (V46), që mund të jetë e djeshmja pas mesnate. */
  today: string
  foodToday: string
  training: TrainingGoal & { days: WeekTrainingDay[] }
  /** 5 ditë nga 7; null pa objektiva (pa profil). */
  food: IntakeGoal | null
  water: IntakeGoal | null
  /** Të tre qëllimet ("Java e plotë"). */
  complete: boolean
  /** Dita rezervë e bllokut të javës; null pa program dhe pa seancë. */
  spare: SpareStatus | null
  /** Javë rresht me qëllimin e stërvitjes ("Vargu: 2 javë"), me të tanishmen kur e ka arritur. */
  streak: number
}

export interface WeekRecordLine {
  exerciseId: string
  /** Emri i ushtrimit (në anglisht, si ruhet). */
  name: string
  e1rmKg: number
  /** Kundrejt më të mirit para javës. */
  gainKg: number
}

export interface NextWorkout {
  /** Data e parashikuar (dita e parë e stërvitjes pas javës, ose sot); null pa ditë stërvitjeje. */
  date: string | null
  /** Ora e stërvitjes së asaj dite; null pa datë. */
  time: string | null
  /** Stërvitja e radhës (treguesi): blloku, java, dita dhe slotet me recetat. */
  plan: SessionPlan
  minutes: number
}

export interface WeekSummary {
  monday: string
  sunday: string
  /** Java mbaroi. E diela në mbrëmje java e tanishme përmblidhet si do të mbyllej (dita rezervë, vargu). */
  closed: boolean
  /** Java e programit e seancës së fundit të mbyllur të javës ("Faza 1 · Java 3"); null pa seancë. */
  programWeek: ProgramWeek | null
  goals: { training: TrainingGoal; food: IntakeGoal | null; water: IntakeGoal | null; complete: boolean }
  trainingDays: WeekTrainingDay[]
  /** Dita rezervë që u përdor këtë javë ("Për të premten, 27 nëntor"); null kur nuk u përdor. */
  spare: { blockId: string; run: number; blockName: string; date: string | null } | null
  /** Vargu në fund të kësaj jave. */
  streak: number
  training: {
    sessions: number
    /** Setet e punës, pa ngrohjet. */
    workSets: number
    /** Koha e seancave, në minuta. */
    minutes: number
    /** Të gjitha rekordet e e1RM-së (si te Historiku) dhe tri më të mëdhatë, një për ushtrim. */
    records: { count: number; top: WeekRecordLine[] }
  }
  /** Mesatarja e ditës mbi ditët e regjistruara (≥ 50% e objektivit, `isLoggedDay` si kontrolli javor); null pa to. */
  food: { averageKcal: number | null; averageProteinG: number | null }
  /** Mesatarja mbi ditët me ujë të regjistruar, në ml. */
  water: { averageMl: number | null }
  /** Mesatarja 7-ditore e së dielës dhe ndryshimi javor. */
  weight: { averageKg: number | null; changeKg: number | null }
  /** Stërvitja e radhës, për javën e tanishme (e diela) ose të fundit të mbyllur; null për javët e tjera. */
  next: NextWorkout | null
}

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position
const isoWeekday = (date: string) => new Date(`${date}T12:00:00`).getDay() || 7
const noon = (date: string) => new Date(`${date}T12:00:00`)

function toGoalSession(row: LocalRow): GoalSession {
  return {
    id: row.id,
    date: String(row.date).slice(0, 10),
    at: String(row.started_at ?? row.ended_at ?? ''),
    status: row.status as GoalSession['status'],
    block: row.block_id ? blockKey(Number(row.run ?? 1), String(row.block_id)) : null,
  }
}

/** Seancat, ditët e stërvitjes, blloqet dhe programi aktiv: gjithçka që i duhet qëllimit të stërvitjes. */
async function readTraining(store: LocalStore) {
  const [days, rows, blocks, loaded] = await Promise.all([readMissedInput(store), store.all('workout_sessions'), store.all('program_blocks'), activeProgram(store)])
  const input: TrainingInput = {
    days,
    sessions: rows.map(toGoalSession),
    pointerBlock: loaded ? blockKey(loaded.pointer.run, loaded.pointer.blockId) : null,
  }
  return { input, rows, blocks: new Map(blocks.map((row) => [row.id, row])), loaded, programmeOpen: !!loaded && !loaded.pointer.completed }
}

type TrainingContext = Awaited<ReturnType<typeof readTraining>>

function weekDays(context: TrainingContext, week: TrainingWeek, today: string, foodToday: string): WeekTrainingDay[] {
  return trainingDays(context.input, week, { foodToday, programmeOpen: context.programmeOpen }).map((day) => ({
    ...day,
    weekday: isoWeekday(day.date),
    day: Number(day.date.slice(8, 10)),
    today: day.date === today,
  }))
}

/** Ushqimi dhe uji i shtatë ditëve (sipas ditës së ushqimit): kaloritë, proteina, mililitrat dhe objektivat. */
async function intakeDays(store: LocalStore, monday: string) {
  return Promise.all(
    weekDates(monday).map(async (date) => {
      const [entries, targets, water] = await Promise.all([store.where('diary_entries', 'date', date), dayTargets(store, date), waterDay(store, date)])
      return {
        date,
        kcal: entries.reduce((total, row) => total + Number(row.kcal ?? 0), 0),
        proteinG: entries.reduce((total, row) => total + Number(row.protein_g ?? 0), 0),
        targetKcal: targets?.kcal ?? null,
        waterMl: water.totalMl,
        targetMl: water.targetMl,
      }
    }),
  )
}

/** Ushqimi dhe uji i javës si qëllime. */
async function intakeGoals(store: LocalStore, monday: string, foodToday: string) {
  const days = await intakeDays(store, monday)
  return {
    days,
    food: foodGoal(
      days.map((day) => ({ date: day.date, amount: day.kcal, target: day.targetKcal })),
      foodToday,
    ),
    water: waterGoal(
      days.map((day) => ({ date: day.date, amount: day.waterMl, target: day.targetMl })),
      foodToday,
    ),
  }
}

const trainingGoal = (week: TrainingWeek): TrainingGoal => ({ done: week.done, target: week.target, met: week.met })

/** E diela e javës ku pritet stërvitja e fundit e bllokut të treguesit, sipas ditëve të stërvitjes. */
function blockEndsOn(context: TrainingContext, key: string, now: Date): string | null {
  const { loaded, input } = context
  if (!loaded || loaded.pointer.completed || blockKey(loaded.pointer.run, loaded.pointer.blockId) !== key) return null
  const days = [...loaded.engine.days].sort(byPosition)
  const block = loaded.engine.blocks.find((candidate) => candidate.id === loaded.pointer.blockId)
  const dayIndex = days.findIndex((day) => day.id === loaded.pointer.dayId)
  if (!block || dayIndex < 0) return null
  const remaining = (block.weeks - loaded.pointer.week) * days.length + (days.length - dayIndex)
  const today = localDate(now)
  const trainedToday = input.sessions.some((entry) => entry.status === 'completed' && entry.date === today)
  const last = upcomingDates({ count: remaining, trainingDays: [...input.days.trainingDays], today: now, trainedToday }).at(-1)
  return last ? shiftDate(mondayOf(localDate(last)), 6) : null
}

/** Qëllimet e javës kalendarike të sotme, për Sot dhe faqen Qëllimet e javës. */
export async function weekGoalsView(store: LocalStore): Promise<WeekGoalsView> {
  const now = store.now()
  const today = localDate(now)
  const [foodToday, context] = await Promise.all([currentFoodDate(store, now), readTraining(store)])
  const ledger = trainingLedger(context.input, today)
  const week = ledger.weeks[ledger.weeks.length - 1]
  const { food, water } = await intakeGoals(store, week.monday, foodToday)
  let spare: SpareStatus | null = null
  if (week.block) {
    const { run, blockId } = parseBlockKey(week.block)
    const usedOn = ledger.spareUsed.get(week.block)
    const usedWeek = usedOn ? ledger.weeks.find((candidate) => candidate.monday === usedOn) : undefined
    spare = {
      blockId,
      run,
      blockName: String(context.blocks.get(blockId)?.name ?? ''),
      used: usedWeek ? { monday: usedWeek.monday, date: usedWeek.spare?.date ?? null } : null,
      wouldCover: !usedWeek && week.target > 0 && week.done === week.target - 1,
      endsOn: blockEndsOn(context, week.block, now),
    }
  }
  return {
    monday: week.monday,
    sunday: shiftDate(week.monday, 6),
    today,
    foodToday,
    training: { ...trainingGoal(week), days: weekDays(context, week, today, foodToday) },
    food,
    water,
    complete: completeWeek(week.met, food, water),
    spare,
    streak: streakAt(ledger.weeks, week.monday),
  }
}

/** Stërvitja e radhës (treguesi) nga një datë: sot kur s'është stërvitur ende, përndryshe dita e parë që vjen. */
async function nextWorkout(store: LocalStore, context: TrainingContext, from: string, today: string): Promise<NextWorkout | null> {
  const { loaded } = context
  if (!loaded || loaded.pointer.completed) return null
  const plan = planSession(loaded.engine, loaded.pointer)
  const trainedToday = from === today && context.input.sessions.some((entry) => entry.status === 'completed' && entry.date === today)
  const [first] = upcomingDates({ count: 1, trainingDays: [...context.input.days.trainingDays], today: noon(from), trainedToday })
  const date = first ? localDate(first) : null
  return { date, time: date ? trainingTimeOn(await readSchedule(store), date) : null, plan, minutes: workoutMinutes(plan.slots) }
}

/**
 * Përmbledhja e javës që nis të hënën `monday` (çdo datë e javës vlen): e mbyllur, ose e tanishmja si do
 * të mbyllej (karta "Java jote" nga e diela 20:00). Null për një javë që s'ka ardhur ose para fillimit.
 */
export async function weekSummary(store: LocalStore, monday: string): Promise<WeekSummary | null> {
  const now = store.now()
  const today = localDate(now)
  const start = mondayOf(monday)
  const current = mondayOf(today)
  if (start > current) return null
  const sunday = shiftDate(start, 6)
  const [foodToday, context] = await Promise.all([currentFoodDate(store, now), readTraining(store)])
  // Java e tanishme përmblidhet si do të mbyllej të hënën: dita rezervë dhe vargu si pas të dielës.
  const ledger = trainingLedger(context.input, today > sunday ? today : shiftDate(sunday, 1))
  const week = ledger.weeks.find((candidate) => candidate.monday === start)
  if (!week) return null

  const completed = context.rows
    .filter((row) => row.status === 'completed' && String(row.date).slice(0, 10) >= start && String(row.date).slice(0, 10) <= sunday)
    .sort((a, b) => String(a.ended_at ?? '').localeCompare(String(b.ended_at ?? '')))
  const [intake, history, exercises, measurements] = await Promise.all([
    intakeGoals(store, start, foodToday),
    trainingHistory(store),
    store.all('exercises'),
    store.all('body_measurements'),
  ])
  const ids = new Set(completed.map((row) => row.id))
  const records = recordsAtTheTime(history.sets)
  const names = new Map(exercises.map((row) => [row.id, String(row.name)]))
  const weekly = weekRecords(completed.flatMap((row) => sessionRecords(history.sets, row.id, records)))
  const lastBlock = completed.at(-1)?.block_id ? context.blocks.get(String(completed.at(-1)!.block_id)) : undefined
  // Mesatarja e ushqimit në ditët e regjistruara (SPEC §0.3c), me rregullin e kontrollit javor (≥ 50%).
  const logged = intake.days.filter(isLoggedDay)
  const spareBlock = week.spare ? parseBlockKey(week.spare.block) : null
  const weights = measurements
    .filter((row) => row.weight_kg !== null && row.weight_kg !== undefined)
    .map((row) => ({ date: String(row.date).slice(0, 10), kg: Number(row.weight_kg) }))
  const round = (value: number | null) => (value === null ? null : Math.round(value))

  return {
    monday: start,
    sunday,
    closed: today > sunday,
    programWeek: lastBlock
      ? { blockName: String(lastBlock.name), blockWeeks: Number(lastBlock.weeks), week: Number(completed.at(-1)!.week ?? 1), run: Number(completed.at(-1)!.run ?? 1) }
      : null,
    goals: { training: trainingGoal(week), food: intake.food, water: intake.water, complete: completeWeek(week.met, intake.food, intake.water) },
    trainingDays: weekDays(context, week, today, foodToday),
    spare:
      week.spare && spareBlock
        ? { ...spareBlock, blockName: String(context.blocks.get(spareBlock.blockId)?.name ?? ''), date: week.spare.date }
        : null,
    streak: streakAt(ledger.weeks, start),
    training: {
      sessions: completed.length,
      workSets: history.sets.filter((set) => ids.has(set.sessionId) && !set.isWarmup).length,
      minutes: completed.reduce((total, row) => total + (durationMinutes((row.started_at as string | null) ?? null, (row.ended_at as string | null) ?? null) ?? 0), 0),
      records: { count: weekly.count, top: weekly.top.map((record) => ({ ...record, name: names.get(record.exerciseId) ?? '' })) },
    },
    food: { averageKcal: round(average(logged.map((day) => day.kcal))), averageProteinG: round(average(logged.map((day) => day.proteinG))) },
    water: { averageMl: round(average(intake.days.filter((day) => day.waterMl > 0).map((day) => day.waterMl))) },
    weight: weekWeight(weights, sunday),
    next: start === current ? await nextWorkout(store, context, shiftDate(sunday, 1), today) : shiftDate(start, 7) === current ? await nextWorkout(store, context, today, today) : null,
  }
}
