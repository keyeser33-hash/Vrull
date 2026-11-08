import { localDate, localDay } from '@/lib/calendar'
import { groupsOf } from '@/program/exercise-catalog'
import type { DayStatus } from '@/program/overview'
import type { HistorySet } from '@/program/loads'
import type { Equipment, Target, Technique } from '@/program/types'
import { upcomingDates, workoutMinutes } from '@/program/week-plan'
import type { WeekRef, WeekWeightRow } from '@/progress/week-weights'
import type { LocalStore } from './store'
import { programView, type TrainingHistory, trainingHistory, trainingSnapshot } from './training'
import { weekWeightsView, workoutWeights } from './week-weights'

// Ekrani Programi (V2-E1-09, bordi "Programi"): blloqet me javët, java e treguesit me ditët, datat e
// parashikuara dhe kohën, stërvitja e radhës me ushtrimin e parë dhe peshën e javës (§7, V23), dhe
// peshat e javës që shqyrtohet. Radha ecën sipas stërvitjeve (Q3): datat janë vetëm parashikim.

export interface ProgrammeBlock {
  id: string
  name: string
  weeks: number
  /** Javët me çdo stërvitje të bërë ose të kapërcyer. */
  doneWeeks: number
  /** Java e treguesit brenda bllokut (nga 1), kur treguesi është këtu. */
  currentWeek: number | null
}

export interface ProgrammeDay {
  dayId: string
  dayNumber: number
  name: string
  status: DayStatus
  /** Data e parashikuar për stërvitjet që vijnë; null për ato të bëra ose të kapërcyera. */
  date: Date | null
  minutes: number
  /** Emrat e ushtrimeve me radhë. */
  exercises: string[]
  /** Ushtrimi i parë i dy grupeve të para të muskujve (rreshtat e ditëve të tjera). */
  lead: string[]
}

export interface ProgrammeHome {
  programId: string
  programName: string
  source: 'shortcut_to_size' | 'custom'
  completed: boolean
  blocks: ProgrammeBlock[]
  /** Java e treguesit në gjithë programin (nga 1) dhe sa javë ka programi. */
  weekNumber: number
  totalWeeks: number
  week: { blockId: string; blockName: string; blockWeeks: number; week: number; run: number }
  days: ProgrammeDay[]
  doneDays: number
  next: {
    dayId: string
    inProgress: boolean
    first: { exerciseId: string; name: string; sets: number; target: Target; weightKg: number | null } | null
  } | null
  /** Peshat e javës që shqyrtohet (§7): presin vendimin, të pranuara ose për më vonë. */
  review: {
    week: WeekRef
    block: { blockName: string; blockWeeks: number; week: number; run: number }
    startsOn: Date | null
    /** Datat e parashikuara të ditëve të asaj jave. */
    dates: Record<string, Date | null>
    status: 'pending' | 'accepted' | 'postponed'
  } | null
}

const isFinished = (status: DayStatus) => status === 'done' || status === 'skipped'

export async function programmeHome(store: LocalStore, now: Date): Promise<ProgrammeHome | null> {
  const view = await programView(store)
  if (!view) return null
  const [snapshot, [settings], sessions, program] = await Promise.all([
    trainingSnapshot(store),
    store.all('user_settings'),
    store.where('workout_sessions', 'program_id', view.programId),
    store.get('programs', view.programId),
  ])
  const { programId, overview, pointer, exercises } = view
  const current = overview.weeks[overview.currentWeek]
  const today = localDate(now)
  const trainedToday = sessions.some((session) => session.status === 'completed' && session.ended_at && localDay(String(session.ended_at)) === today)
  const trainingDays = (settings?.training_days as number[] | undefined) ?? []

  const blocks = [...new Map(overview.weeks.map((entry) => [entry.blockId, entry])).values()].map((first) => {
    const weeks = overview.weeks.filter((entry) => entry.blockId === first.blockId)
    return {
      id: first.blockId,
      name: first.blockName,
      weeks: weeks.length,
      doneWeeks: weeks.filter((entry) => entry.days.every((day) => isFinished(day.status))).length,
      currentWeek: !pointer.completed && first.blockId === current.blockId ? current.week : null,
    }
  })

  const ahead = current.days.filter((day) => !isFinished(day.status))
  // Ditët që mbeten dhe java pas saj, për peshat e javës.
  const dates = pointer.completed ? [] : upcomingDates({ count: ahead.length + current.days.length, trainingDays, today: now, trainedToday })
  const days: ProgrammeDay[] = current.days.map((day) => {
    const plan = view.plan(current.blockId, current.week, day.dayId)
    const names = plan.slots.map((slot) => exercises[slot.exerciseId]?.name ?? '')
    const index = ahead.indexOf(day)
    return {
      dayId: day.dayId,
      dayNumber: day.dayNumber,
      name: day.name,
      status: day.status,
      date: index >= 0 ? (dates[index] ?? null) : null,
      minutes: workoutMinutes(plan.slots),
      exercises: names,
      lead: leadExercises(plan.slots.map((slot) => exercises[slot.exerciseId])),
    }
  })

  let next: ProgrammeHome['next'] = null
  if (snapshot && snapshot.programId === programId && !snapshot.completed) {
    const [slot] = snapshot.plan.slots
    const weights = slot ? await workoutWeights(store, snapshot.plan) : null
    next = {
      dayId: pointer.dayId,
      inProgress: snapshot.session !== null,
      first: slot
        ? {
            exerciseId: slot.exerciseId,
            name: snapshot.exercises[slot.exerciseId]?.name ?? '',
            sets: slot.sets,
            target: slot.target,
            weightKg: weights?.get(slot.slotId)?.weightKg ?? null,
          }
        : null,
    }
  }

  return {
    programId: view.programId,
    programName: view.programName,
    source: program?.source === 'shortcut_to_size' ? 'shortcut_to_size' : 'custom',
    completed: pointer.completed,
    blocks,
    weekNumber: overview.currentWeek + 1,
    totalWeeks: overview.weeks.length,
    week: {
      blockId: current.blockId,
      blockName: current.blockName,
      blockWeeks: blocks.find((block) => block.id === current.blockId)!.weeks,
      week: current.week,
      run: pointer.run,
    },
    days,
    doneDays: current.days.filter((day) => day.status === 'done').length,
    next,
    review: await reviewOf(),
  }

  /** Peshat e javës që shqyrtohet: e treguesit kur ai është te dita e parë, përndryshe java pas saj. */
  async function reviewOf(): Promise<ProgrammeHome['review']> {
    if (pointer.completed) return null
    const weights = await weekWeightsView(store)
    // Programi aktiv mund të ndërrohet ndërkohë (editori, sinkronizimi): peshat e një programi tjetër
    // nuk tregohen; leximi i radhës sjell programin e ri të tërë.
    const block = blocks.find((candidate) => candidate.id === weights?.week.blockId)
    if (!weights || weights.programId !== programId || !block || weights.rows.length === 0) return null
    const decided = weights.rows.filter((row) => row.decision)
    const status = decided.length === 0 ? 'pending' : decided.some((row) => row.decision?.status === 'postponed') ? 'postponed' : 'accepted'
    const sameWeek = weights.week.blockId === pointer.blockId && weights.week.week === pointer.week
    const reviewDates = Object.fromEntries(
      current.days.map((day, index) => [day.dayId, sameWeek ? (days[index].date ?? null) : (dates[ahead.length + index] ?? null)]),
    )
    return {
      week: weights.week,
      block: { blockName: block.name, blockWeeks: block.weeks, week: weights.week.week, run: pointer.run },
      status,
      startsOn: reviewDates[current.days[0].dayId] ?? null,
      dates: reviewDates,
    }
  }
}

/** Ushtrimi i parë i çdo grupi (sipas muskulit të parë kryesor), për dy grupet e para të ditës. */
function leadExercises(list: ({ name: string; primary: string[] } | undefined)[]): string[] {
  const seen = new Set<string>()
  const lead: string[] = []
  for (const exercise of list) {
    const [group] = exercise ? groupsOf(exercise.primary.slice(0, 1)) : []
    if (!exercise || !group || seen.has(group)) continue
    seen.add(group)
    lead.push(exercise.name)
    if (lead.length === 2) break
  }
  return lead
}

export interface WeekReview {
  week: WeekRef
  block: { blockName: string; blockWeeks: number; week: number; run: number }
  /** Java para saj në program, edhe në bllokun e mëparshëm; null te java e parë. */
  previous: { blockName: string; blockWeeks: number; week: number } | null
  /** Treguesi është te dita e parë e kësaj jave: java e kaluar sapo u mbyll. */
  closed: boolean
  days: { dayId: string; dayNumber: number; name: string; date: Date | null }[]
  rows: WeekWeightRow[]
  exercises: Record<string, { name: string; equipment: Equipment; libraryId: string | null }>
  /** Për llogarinë e çdo rreshti: kur u arrit 1RM dhe hapat e peshës. */
  history: HistorySet[]
  overrides: TrainingHistory['overrides']
  steps: TrainingHistory['weightSteps']
  /** Intervali dhe teknika e ushtrimit të parë me peshë të javës ("6–8 përsëritje, drop set"). */
  headline: { target: Target; technique: Technique } | null
}

/** "Peshat e javës" (bordi "Sugjerimi"): java që shqyrtohet me propozimet, vendimet dhe llogaritë. */
export async function weekReview(store: LocalStore, now: Date): Promise<WeekReview | null> {
  const [home, weights, view, history] = await Promise.all([programmeHome(store, now), weekWeightsView(store), programView(store), trainingHistory(store)])
  const review = home?.review
  // Të katër leximet duhet të jenë i njëjti program: ndërrimi i tij në mes nuk jep pamje të përzier.
  if (!review || !weights || !view || home.programId !== view.programId || weights.programId !== view.programId) return null
  const index = view.overview.weeks.findIndex((entry) => entry.blockId === weights.week.blockId && entry.week === weights.week.week)
  const entry = view.overview.weeks[index]
  if (!entry) return null
  const before = view.overview.weeks[index - 1]
  const blockWeeks = (blockId: string) => view.overview.weeks.filter((candidate) => candidate.blockId === blockId).length
  const firstWeighted = entry.days
    .flatMap((day) => view.plan(entry.blockId, entry.week, day.dayId).slots)
    .find((slot) => view.exercises[slot.exerciseId]?.tracking === 'weight_reps')
  return {
    week: weights.week,
    block: review.block,
    previous: before ? { blockName: before.blockName, blockWeeks: blockWeeks(before.blockId), week: before.week } : null,
    closed: weights.week.blockId === view.pointer.blockId && weights.week.week === view.pointer.week,
    days: entry.days.map((day) => ({ dayId: day.dayId, dayNumber: day.dayNumber, name: day.name, date: review.dates[day.dayId] ?? null })),
    rows: weights.rows,
    exercises: Object.fromEntries(
      Object.values(view.exercises).map((exercise) => [exercise.id, { name: exercise.name, equipment: exercise.equipment, libraryId: exercise.libraryId }]),
    ),
    history: history.sets,
    overrides: history.overrides,
    steps: history.weightSteps,
    headline: firstWeighted ? { target: firstWeighted.target, technique: firstWeighted.technique } : null,
  }
}
