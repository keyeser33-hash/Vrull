import { type Fact, factById, jimFoodKey } from '@/learn/facts'
import { type FactPlace, foodCandidates, pickFact, restCandidates, todayCandidates } from '@/learn/pick'
import { QUIZ_SIZE, quizAchievement, quizFacts, quizScore, QUIZ_STREAK_TARGET, quizStreak, type QuizWeek } from '@/learn/quiz'
import { localDate, shiftDate } from '@/lib/calendar'
import { awardAchievements } from './achievements'
import { lastQuizMonday, learnRows, quizHistory, quizOf, type QuizRow, type SeenRow, type WeekActivity } from './learn-history'
import { naturalId } from './natural-id'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'
import type { TodayView } from './today'

// Mëso në bazë (V56, V57, SPEC §0.3e): "A e dije?" në tri vende, kuizi i së dielës, faqja Mëso dhe çelësi i
// Cilësimeve. Rregullat jetojnë te `src/learn/` (pa bazë); ky modul lexon historinë dhe shkruan tabelën
// `learn_events` (sinkronizohet): një rresht për çdo fakt të parë (dita e ushqimit, vendi, fakti) dhe një për çdo
// kuiz (java, përgjigjet, rezultati). Id-ja vjen nga çelësi natyror (dita dhe vendi; java), me `revive`, që dy
// telefona të shkruajnë të njëjtin rresht dhe një rresht i fshirë të kthehet në vend që indeksi unik ta refuzojë.

export type { FactPlace } from '@/learn/pick'

/** Id e faktit të ditës për një vend: një rresht për ditë ushqimi dhe vend, në çdo telefon. */
export const factEventId = (userId: string, date: string, place: FactPlace) => naturalId(['learn_events', 'fact', userId, date, place])

/** Id e kuizit të një jave (e hëna). */
export const quizEventId = (userId: string, monday: string) => naturalId(['learn_events', 'quiz', userId, monday])

// --- Çelësi "A e dije?" (Cilësimet › Mëso) ---

/** "A e dije?" del (i ndezur si parazgjedhje; `user_settings.learn_facts`, sinkronizohet). */
export async function factsEnabled(store: LocalStore): Promise<boolean> {
  return (await settingsRow(store))?.learn_facts !== false
}

/** Ndez ose fik "A e dije?"; pa rreshtin e cilësimeve (para hapave të parë) nuk ruhet. */
export async function setFactsEnabled(store: LocalStore, on: boolean): Promise<void> {
  const row = await settingsRow(store)
  if (row && row.learn_facts !== on) await store.put('user_settings', { id: row.id, learn_facts: on })
}

// --- "A e dije?" ---

export interface DayFact {
  fact: Fact
  place: FactPlace
  /** Dita e ushqimit (V46). */
  date: string
  /** Fakti u pa (rreshti ekziston); përndryshe është ai që do të dalë. */
  seen: boolean
  /** "×": karta u mbyll për sot. */
  dismissed: boolean
}

/**
 * Fakti i ditës për një vend: ai i parë sot (rreshti), ose një i ri nga kandidatët, pa përsëritje derisa të shihen
 * të gjithë faktet e atij vendi (`pickFact` me historinë e vendit para sot). Null me çelësin të fikur ose pa
 * kandidatë; një fakt i parë sot që nuk është më në paketë nuk zëvendësohet (një në ditë).
 */
async function dayFact(store: LocalStore, place: FactPlace, date: string, candidates: readonly Fact[]): Promise<DayFact | null> {
  if (!(await factsEnabled(store))) return null
  const { seen } = await learnRows(store)
  const today = seen.find((entry) => entry.place === place && entry.date === date)
  if (today) {
    const fact = factById(today.factId)
    return fact ? { fact, place, date, seen: true, dismissed: today.dismissed } : null
  }
  const history = seen.filter((entry) => entry.place === place && entry.date < date)
  const fact = pickFact(candidates, history)
  return fact ? { fact, place, date, seen: false, dismissed: false } : null
}

/** Shënon faktin e parë të ditës në një vend (një herë; një rresht i fshirë kthehet). */
export async function markFactSeen(store: LocalStore, place: FactPlace, date: string, factId: string): Promise<void> {
  const userId = store.userId()
  if (!userId || !factById(factId)) return
  const id = await factEventId(userId, date, place)
  const existing = await store.get('learn_events', id)
  if (existing) return
  await store.put('learn_events', { id, kind: 'fact', date, place, fact_id: factId, dismissed: false, answers: null, score: null, closed_on: null }, { revive: true })
}

/** "×": mbyll kartën e vendit për atë ditë. */
export async function dismissFact(store: LocalStore, place: FactPlace, date: string): Promise<void> {
  const userId = store.userId()
  if (!userId) return
  const id = await factEventId(userId, date, place)
  if (await store.get('learn_events', id)) await store.put('learn_events', { id, dismissed: true })
}

/** Emrat e ushtrimeve të stërvitjes së sotme: seanca e hapur ose stërvitja e radhës; pas mbylljes, ajo e sotmja. */
async function todayExercises(store: LocalStore, view: Pick<TodayView, 'mode' | 'snapshot' | 'now'>): Promise<string[] | null> {
  if ((view.mode === 'train' || view.mode === 'session') && view.snapshot) {
    const { plan, exercises } = view.snapshot
    return plan.slots.map((slot) => exercises[slot.exerciseId]?.name ?? '').filter(Boolean)
  }
  if (view.mode !== 'done') return null
  const today = localDate(view.now)
  const sessions = (await store.where('workout_sessions', 'date', today)).filter((row) => row.status === 'completed')
  const [sets, exercises] = await Promise.all([Promise.all(sessions.map((row) => store.where('set_logs', 'session_id', row.id))), store.all('exercises')])
  const names = new Map(exercises.map((row) => [row.id, String(row.name ?? '')]))
  return sets
    .flat()
    .sort((a, b) => String(a.logged_at ?? '').localeCompare(String(b.logged_at ?? '')))
    .map((set) => names.get(String(set.exercise_id)) ?? '')
    .filter(Boolean)
}

/** Sot: story "A e dije?", me faktet e ushtrimeve të sotme; në ditë pushimi rikuperimi. */
export async function todayFact(store: LocalStore, view: Pick<TodayView, 'mode' | 'snapshot' | 'now' | 'date'>): Promise<DayFact | null> {
  return dayFact(store, 'today', view.date, todayCandidates(await todayExercises(store, view)))
}

/**
 * Pushimi mes seteve: fakti i ushtrimit aktual. Fakti i ditës del vetëm te pushimet e ushtrimit të vet (një në
 * ditë): te ushtrimet e tjera, asgjë.
 */
export async function restFact(store: LocalStore, date: string, exercise: string | null | undefined): Promise<DayFact | null> {
  const found = await dayFact(store, 'rest', date, restCandidates(exercise))
  if (!found || found.fact.topic.kind !== 'exercise' || !exercise) return null
  return found.fact.topic.exercise.toLocaleLowerCase('en') === exercise.trim().toLocaleLowerCase('en') ? found : null
}

export interface FoodDayFact extends DayFact {
  /** Çelësi i ushqimit të Jimit të faktit (karta del poshtë vaktit ku u regjistrua). */
  food: string
}

/** Pas regjistrimit të një ushqimi: një fakt i ushqimeve të regjistruara sot, i fundit i pari. */
export async function foodFact(store: LocalStore, date: string): Promise<FoodDayFact | null> {
  const entries = await store.where('diary_entries', 'date', date)
  const foods = await Promise.all(entries.map((entry) => store.get('foods', String(entry.food_id))))
  const keys = entries
    .map((entry, index) => ({ key: jimFoodKey(foods[index]?.source_id as string | null | undefined), at: String(entry.created_at ?? '') }))
    .filter((entry): entry is { key: string; at: string } => entry.key !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry) => entry.key)
  const found = await dayFact(store, 'food', date, foodCandidates(keys))
  return found && found.fact.topic.kind === 'food' ? { ...found, food: found.fact.topic.food } : null
}

// --- Kuizi i së dielës ---

export interface QuizAnswer {
  fact: string
  chosen: number
}

export interface QuizView {
  /** E hëna e javës së kuizit. */
  monday: string
  /** Pesë faktet (të ruajtura kur kuizi është bërë); null kur java ka më pak se 5 fakte. */
  facts: Fact[] | null
  /** Kuizi i mbyllur këtë javë; null kur pret. */
  done: { answers: QuizAnswer[]; score: number; closedOn: string } | null
  /** Vargu para kuizit të kësaj jave (pa të). */
  streakBefore: number
  /** Vargu me kuizin e kësaj jave, kur është bërë (përndryshe si `streakBefore`). */
  streak: number
  /** "Java 3": java e programit e seancës së fundit të mbyllur të javës; null pa seancë. */
  programWeek: number | null
  /** Arritja "Kuizi 4 javë": fituar (dita) ose sa mungon. */
  achievement: { earnedOn: string | null; current: number; target: number }
  /** Rrathët e vargut (4): javët e vargut (të mbyllura) dhe ato që vijnë, me të dielën e secilës. */
  dots: QuizDot[]
}

export interface QuizDot {
  /** E diela e javës. */
  sunday: string
  state: 'done' | 'open' | 'ahead'
}

/** Java e programit e seancës së fundit të mbyllur të javës. */
async function programWeekOf(store: LocalStore, monday: string): Promise<number | null> {
  const sunday = shiftDate(monday, 6)
  const sessions = (await store.all('workout_sessions'))
    .filter((row) => row.status === 'completed' && String(row.date).slice(0, 10) >= monday && String(row.date).slice(0, 10) <= sunday)
    .sort((a, b) => String(a.ended_at ?? a.date).localeCompare(String(b.ended_at ?? b.date)))
  const last = sessions.at(-1)
  return last ? Number(last.week ?? 1) : null
}

/**
 * Rrathët e vargut (4): javët e fundit të vargut të mbyllura, pastaj java e hapur pa kuiz ende (`open`) dhe ato që
 * vijnë, me të dielën e secilës. `last` është java e fundit që numërohet (`lastQuizMonday`).
 */
function streakDots(weeks: readonly QuizWeek[], streak: number, last: string, open: string | null): QuizDot[] {
  const count = Math.min(streak, QUIZ_STREAK_TARGET)
  const done = count > 0 ? weeks.filter((week) => week.doneOn).slice(-count) : []
  const dots: QuizDot[] = done.map((week) => ({ sunday: shiftDate(week.monday, 6), state: 'done' }))
  let monday = open && !done.some((week) => week.monday === open) ? open : shiftDate(last, 7)
  while (dots.length < QUIZ_STREAK_TARGET) {
    dots.push({ sunday: shiftDate(monday, 6), state: monday === open ? 'open' : 'ahead' })
    monday = shiftDate(monday, 7)
  }
  return dots
}

function savedAnswers(quiz: QuizRow): QuizAnswer[] {
  return quiz.answers.slice(0, QUIZ_SIZE)
}

/** Faktet e kuizit të një jave sipas historisë (si te `quizFacts`). */
function weekQuizFacts(monday: string, seen: readonly SeenRow[], activity: WeekActivity): Fact[] | null {
  return quizFacts({ monday, seen: seen.filter((entry) => factById(entry.factId)), exercises: activity.exercises.get(monday) ?? [], foods: activity.foods.get(monday) ?? [] })
}

/**
 * Kuizi i së dielës: nga e diela 20:00 deri të hënën në fund të ditës (`weekCardMonday`); null jashtë saj. Me më
 * pak se 5 fakte `facts` është null (kuizi nuk hapet atë javë). I bërë: faktet dhe përgjigjet e ruajtura.
 */
export async function quizView(store: LocalStore, now: Date = store.now()): Promise<QuizView | null> {
  const history = await quizHistory(store, now)
  const monday = history.openMonday
  if (!monday) return null
  return quizViewOf(store, monday, history, now)
}

async function quizViewOf(store: LocalStore, monday: string, history: Awaited<ReturnType<typeof quizHistory>>, now: Date): Promise<QuizView> {
  const saved = quizOf(history.quizzes, monday)
  const facts = saved ? savedAnswers(saved).map((answer) => factById(answer.fact)).filter((fact): fact is Fact => !!fact) : weekQuizFacts(monday, history.seen, history.activity)
  // Javët para kësaj (pa të) dhe me të, për vargun para dhe pas kuizit.
  const earlier = history.weeks.filter((week) => week.monday < monday)
  const pending: QuizWeek = { monday, doneOn: null, available: true }
  const streakBefore = quizStreak([...earlier, pending], monday)
  const streak = quizStreak(history.weeks, history.openMonday)
  const state = quizAchievement(history.weeks, history.openMonday)
  const earned = (await store.all('achievements')).find((row) => row.key === 'quiz_4')
  const earnedOn = earned ? String(earned.earned_on).slice(0, 10) : (state.met?.date ?? null)
  return {
    monday,
    facts: facts && facts.length === QUIZ_SIZE ? facts : null,
    done: saved ? { answers: savedAnswers(saved), score: saved.score, closedOn: saved.closedOn } : null,
    streakBefore,
    streak: saved ? streak : streakBefore,
    programWeek: await programWeekOf(store, monday),
    achievement: { earnedOn, current: earnedOn ? QUIZ_STREAK_TARGET : state.progress.current, target: QUIZ_STREAK_TARGET },
    dots: streakDots(history.weeks, saved ? streak : streakBefore, lastQuizMonday(now), history.openMonday),
  }
}

/**
 * Ruan kuizin e mbyllur (një herë në javë): përgjigjet me faktin, rezultati dhe dita; pastaj jep arritjet që
 * mungojnë ("Kuizi 4 javë" merr ditën kur u mbyll kuizi i katërt). Një kuiz i ruajtur nuk ndryshon.
 */
export async function saveQuiz(store: LocalStore, monday: string, facts: readonly Fact[], chosen: readonly number[]): Promise<void> {
  const userId = store.userId()
  if (!userId || facts.length !== QUIZ_SIZE || chosen.length !== QUIZ_SIZE) return
  const id = await quizEventId(userId, monday)
  if (await store.get('learn_events', id)) return
  const answers = facts.map((fact, index) => ({ fact: fact.id, chosen: Math.min(Math.max(Math.trunc(chosen[index]), 0), fact.quiz.options.length - 1) }))
  const score = quizScore(
    facts,
    answers.map((answer) => answer.chosen),
  )
  const closedOn = localDate(store.now())
  await store.put('learn_events', { id, kind: 'quiz', date: monday, place: null, fact_id: null, dismissed: false, answers, score, closed_on: closedOn < monday ? monday : closedOn }, { revive: true })
  await awardAchievements(store)
}

// --- Faqja Mëso ---

export interface SeenEntry {
  fact: Fact
  date: string
  place: FactPlace
}

export interface PastQuiz {
  monday: string
  score: number
  closedOn: string
  programWeek: number | null
}

export interface LearnPage {
  /** Faktet e para, një herë secili (dita e fundit kur u pa), më të rejat sipër. */
  seen: SeenEntry[]
  /** Kuizet e mbyllura, më i riu sipër. */
  quizzes: PastQuiz[]
  streak: number
  dots: QuizDot[]
  achievement: { earnedOn: string | null; current: number; target: number }
  /** Kuizi i kësaj jave është hapur dhe pret (e diela 20:00 deri të hënën): e hëna e tij. */
  openQuiz: string | null
}

const PLACE_ORDER: readonly FactPlace[] = ['food', 'rest', 'today']

/** Faqja Mëso (Progresi › Mëso): faktet e para, kuizet e kaluara dhe vargu. */
export async function learnPage(store: LocalStore): Promise<LearnPage> {
  const now = store.now()
  const history = await quizHistory(store, now)
  const latest = new Map<string, SeenRow>()
  const later = (a: SeenRow, b: SeenRow) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || PLACE_ORDER.indexOf(b.place) - PLACE_ORDER.indexOf(a.place)
  for (const entry of history.seen) {
    const current = latest.get(entry.factId)
    if (factById(entry.factId) && (!current || later(entry, current) > 0)) latest.set(entry.factId, entry)
  }
  const seen = [...latest.values()].sort((a, b) => later(b, a)).map((entry) => ({ fact: factById(entry.factId)!, date: entry.date, place: entry.place }))
  const quizzes = await Promise.all(
    [...history.quizzes].sort((a, b) => b.monday.localeCompare(a.monday)).map(async (quiz) => ({ monday: quiz.monday, score: quiz.score, closedOn: quiz.closedOn, programWeek: await programWeekOf(store, quiz.monday) })),
  )
  const streak = quizStreak(history.weeks, history.openMonday)
  const state = quizAchievement(history.weeks, history.openMonday)
  const earned = (await store.all('achievements')).find((row) => row.key === 'quiz_4')
  const earnedOn = earned ? String(earned.earned_on).slice(0, 10) : (state.met?.date ?? null)
  const open = history.openMonday
  const openQuiz = open && !quizOf(history.quizzes, open) && weekQuizFacts(open, history.seen, history.activity) ? open : null
  return {
    seen,
    quizzes,
    streak,
    dots: streakDots(history.weeks, streak, lastQuizMonday(now), open),
    achievement: { earnedOn, current: earnedOn ? QUIZ_STREAK_TARGET : state.progress.current, target: QUIZ_STREAK_TARGET },
    openQuiz,
  }
}
