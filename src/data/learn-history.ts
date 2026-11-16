import { factById, jimFoodKey } from '@/learn/facts'
import type { FactPlace, SeenFact } from '@/learn/pick'
import { quizFacts, type QuizWeek } from '@/learn/quiz'
import { localDate, shiftDate } from '@/lib/calendar'
import { mondayOf, weekCardMonday } from '@/progress/weekly-goals'
import type { LocalStore } from './store'

// Historia e Mëso-s nga baza (V56, SPEC §0.3e), pa UI: faktet e para, kuizet e mbyllura dhe javët e kuizit (a ishte
// i mundshëm, kur u mbyll) për vargun dhe arritjen "Kuizi 4 javë". E lexojnë `data/learn.ts` dhe `data/achievements.ts`.

const day = (value: unknown) => String(value ?? '').slice(0, 10)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface SeenRow extends SeenFact {
  id: string
  dismissed: boolean
  /** Çasti kur u pa (radha brenda ditës). */
  at: string
}

export interface QuizRow {
  id: string
  monday: string
  answers: { fact: string; chosen: number }[]
  score: number
  closedOn: string
}

const PLACES: readonly FactPlace[] = ['today', 'rest', 'food']

/** Rreshtat e `learn_events`, të ndarë në fakte të para dhe kuize. */
export async function learnRows(store: LocalStore): Promise<{ seen: SeenRow[]; quizzes: QuizRow[] }> {
  const rows = await store.where('learn_events', 'kind', 'fact')
  const quizRows = await store.where('learn_events', 'kind', 'quiz')
  const seen = rows
    .filter((row) => typeof row.fact_id === 'string' && PLACES.includes(row.place as FactPlace))
    .map((row) => ({ id: row.id, factId: String(row.fact_id), date: day(row.date), place: row.place as FactPlace, dismissed: row.dismissed === true, at: String(row.created_at ?? '') }))
  const quizzes = quizRows.flatMap((row): QuizRow[] => {
    const answers = Array.isArray(row.answers) ? (row.answers as { fact?: unknown; chosen?: unknown }[]).filter((entry) => typeof entry?.fact === 'string' && Number.isInteger(entry?.chosen)) : []
    return row.closed_on ? [{ id: row.id, monday: day(row.date), answers: answers.map((entry) => ({ fact: String(entry.fact), chosen: Number(entry.chosen) })), score: Number(row.score ?? 0), closedOn: day(row.closed_on) }] : []
  })
  return { seen, quizzes }
}

/** Ushtrimet e seancave të mbyllura dhe ushqimet e Jimit të regjistruara, sipas javës (e hëna). */
export interface WeekActivity {
  exercises: Map<string, string[]>
  foods: Map<string, string[]>
}

/** Seancat e mbyllura (emrat e ushtrimeve me radhën e seteve) dhe ushqimet e Jimit, java pas jave. */
export async function weekActivity(store: LocalStore): Promise<WeekActivity> {
  const [sessions, sets, exercises, entries, foods] = await Promise.all([store.all('workout_sessions'), store.all('set_logs'), store.all('exercises'), store.all('diary_entries'), store.all('foods')])
  const completed = new Map(sessions.filter((row) => row.status === 'completed').map((row) => [row.id, day(row.date)]))
  const names = new Map(exercises.map((row) => [row.id, String(row.name ?? '')]))
  const byWeek = (map: Map<string, string[]>, date: string, value: string) => {
    const monday = mondayOf(date)
    const list = map.get(monday) ?? []
    if (!list.includes(value)) list.push(value)
    map.set(monday, list)
  }
  const exerciseWeeks = new Map<string, string[]>()
  const ordered = [...sets].sort((a, b) => String(a.logged_at ?? '').localeCompare(String(b.logged_at ?? '')))
  for (const set of ordered) {
    const date = completed.get(String(set.session_id))
    const name = names.get(String(set.exercise_id))
    if (date && name) byWeek(exerciseWeeks, date, name)
  }
  const keys = new Map(foods.map((row) => [row.id, jimFoodKey(row.source_id as string | null)]))
  const foodWeeks = new Map<string, string[]>()
  for (const entry of entries) {
    const key = keys.get(String(entry.food_id))
    if (key) byWeek(foodWeeks, day(entry.date), key)
  }
  return { exercises: exerciseWeeks, foods: foodWeeks }
}

/** Java e kuizit të hapur tani (e diela 20:00 deri të hënën në fund të ditës); null jashtë saj. */
export const openQuizMonday = (now: Date) => weekCardMonday(now)

/** Java e fundit që numërohet te vargu: e hapura, ose java e kaluar. */
export const lastQuizMonday = (now: Date) => openQuizMonday(now) ?? shiftDate(mondayOf(localDate(now)), -7)

/**
 * Javët e kuizit nga java e kuizit të parë të mbyllur deri te java e fundit që numërohet, me radhë: kur u mbyll dhe
 * nëse ishte i mundshëm (të paktën 5 fakte). Javët para kuizit të parë nuk ndikojnë as vargun, as arritjen.
 */
export async function quizHistory(store: LocalStore, now: Date = store.now()): Promise<{ weeks: QuizWeek[]; openMonday: string | null; seen: SeenRow[]; quizzes: QuizRow[]; activity: WeekActivity }> {
  const openMonday = openQuizMonday(now)
  const last = lastQuizMonday(now)
  const [{ seen, quizzes }, activity] = await Promise.all([learnRows(store), weekActivity(store)])
  const done = new Map(quizzes.map((quiz) => [quiz.monday, quiz.closedOn]))
  const first = [...done.keys()].sort()[0]
  const weeks: QuizWeek[] = []
  // Pa një datë të vlefshme (ora e telefonit e prishur) nuk ka javë: cikli më poshtë do të mos mbaronte.
  if (first && ISO_DATE.test(last)) {
    const visible = seen.filter((entry) => factById(entry.factId))
    for (let monday = first; monday <= last; monday = shiftDate(monday, 7)) {
      const doneOn = done.get(monday) ?? null
      const available = doneOn !== null || quizFacts({ monday, seen: visible, exercises: activity.exercises.get(monday) ?? [], foods: activity.foods.get(monday) ?? [] }) !== null
      weeks.push({ monday, doneOn, available })
    }
  }
  return { weeks, openMonday, seen, quizzes, activity }
}

/** Rreshti i ruajtur i kuizit të një jave, kur ka. */
export function quizOf(quizzes: readonly QuizRow[], monday: string): QuizRow | null {
  return quizzes.find((quiz) => quiz.monday === monday) ?? null
}
