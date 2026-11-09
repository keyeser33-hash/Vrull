import { localDate } from '@/lib/calendar'
import { planSession } from '@/program/engine'
import { upcomingDates } from '@/program/week-plan'
import { readMissedInput } from './missed-day'
import type { LocalStore } from './store'
import { activeProgram } from './training'
import { weekGoalsView } from './weekly-goals'

// Java te mbyllja e seancës (V43, bordi "Mbyllja · java dhe rekordet"): stërvitjet e javës kalendarike
// kundrejt qëllimit, me segmentin e kësaj seance, stërvitja e radhës, dhe ditët e ushqimit dhe ujit. Qëllimet
// vijnë nga `weekGoalsView` (rregullat e `progress/weekly-goals.ts`); arritja e re nga `data/achievements.ts`.

export interface CloseWeek {
  /** Data kalendarike e sotme ("Sot", "Nesër" te stërvitja e radhës). */
  today: string
  monday: string
  /** Seancat e mbyllura të javës kundrejt objektivit (4 nga 4 për përdoruesin). */
  done: number
  target: number
  met: boolean | null
  /** Segmenti i kësaj seance (nga 0) te seancat e mbyllura të javës; null kur seanca s'është e mbyllur. */
  sessionIndex: number | null
  /** Ditët e numëruara kundrejt qëllimit (5 nga 7); null pa objektiva. */
  food: { counted: number; goal: number } | null
  water: { counted: number; goal: number } | null
  /** Stërvitja e radhës (treguesi) dhe dita kur pritet; null kur programi mbaroi ose mungon. */
  next: { date: string | null; dayNumber: number; dayName: string } | null
}

const day = (value: unknown) => String(value ?? '').slice(0, 10)

/** Java e seancës së sapombyllur; null kur seanca nuk është në javën e sotme (një mbyllje e vjetër). */
export async function sessionCloseWeek(store: LocalStore, sessionId: string): Promise<CloseWeek | null> {
  const [session, view, rows, loaded, days] = await Promise.all([
    store.get('workout_sessions', sessionId),
    weekGoalsView(store),
    store.all('workout_sessions'),
    activeProgram(store),
    readMissedInput(store),
  ])
  if (!session) return null
  const date = day(session.date)
  if (date < view.monday || date > view.sunday) return null
  const completed = rows
    .filter((row) => row.status === 'completed' && day(row.date) >= view.monday && day(row.date) <= view.sunday)
    .sort((a, b) => day(a.date).localeCompare(day(b.date)) || String(a.started_at ?? a.ended_at ?? '').localeCompare(String(b.started_at ?? b.ended_at ?? '')))
  const index = completed.findIndex((row) => row.id === sessionId)
  let next: CloseWeek['next'] = null
  if (loaded && !loaded.pointer.completed) {
    const plan = planSession(loaded.engine, loaded.pointer)
    const now = store.now()
    const today = localDate(now)
    const trainedToday = rows.some((row) => row.status === 'completed' && day(row.date) === today)
    const [first] = upcomingDates({ count: 1, trainingDays: [...days.trainingDays], today: now, trainedToday })
    next = { date: first ? localDate(first) : null, dayNumber: plan.dayNumber, dayName: plan.dayName }
  }
  return {
    today: view.today,
    monday: view.monday,
    done: view.training.done,
    target: view.training.target,
    met: view.training.met,
    sessionIndex: index >= 0 ? index : null,
    food: view.food ? { counted: view.food.counted, goal: view.food.goal } : null,
    water: view.water ? { counted: view.water.counted, goal: view.water.goal } : null,
    next,
  }
}
