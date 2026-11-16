import { shiftDate } from '@/lib/calendar'
import { exerciseFacts, type Fact, factById, foodFacts } from './facts'
import { FACT_PLACES, type SeenFact } from './pick'

// Kuizi i së dielës pa UI dhe pa bazë (V56, SPEC §0.3e): 5 pyetje me 3–4 përgjigje, një herë në javë, hapet bashkë me
// përmbledhjen e javës (e diela 20:00 deri të hënën në fund të ditës, `weekCardMonday`). Pyetjet dalin së pari nga
// faktet e para atë javë (e hëna–e diela), pastaj nga faktet e ushtrimeve të seancave dhe të ushqimeve të regjistruara;
// me më pak se 5 fakte kuizi nuk hapet. Vargu dhe arritja "Kuizi 4 javë" (e 11-ta, §0.3c) vijnë nga javët me kuiz.
// Ruajtja (një rresht për kuiz, me përgjigjet dhe rezultatin) është te `data/learn.ts`.

export const QUIZ_SIZE = 5
/** Arritja "Kuizi 4 javë": kaq javë rresht me kuizin e mbyllur. */
export const QUIZ_STREAK_TARGET = 4

export interface QuizInput {
  /** E hëna e javës së kuizit. */
  monday: string
  /** Faktet e para (çdo vend, çdo ditë); merren ato të javës. */
  seen: readonly SeenFact[]
  /** Emrat e ushtrimeve të seancave të mbyllura të javës. */
  exercises: readonly string[]
  /** Çelësat e ushqimeve të Jimit të regjistruara atë javë. */
  foods: readonly string[]
}

/** Një numër i qëndrueshëm nga teksti (FNV-1a), që e njëjta javë të japë të njëjtat pyetje. */
function hash(text: string): number {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

const byHash = (monday: string) => (a: Fact, b: Fact) => hash(`${monday}|${a.id}`) - hash(`${monday}|${b.id}`) || a.id.localeCompare(b.id)

/**
 * Pesë faktet e kuizit të javës, ose null kur janë më pak se 5. Faktet e para atë javë dalin të parat, me radhën kur
 * u panë (kur janë më shumë se 5, zgjidhen 5 prej tyre); pastaj faktet e ushtrimeve dhe të ushqimeve të javës, me një
 * radhë që ndryshon nga java në javë.
 */
export function quizFacts(input: QuizInput): Fact[] | null {
  const sunday = shiftDate(input.monday, 6)
  const first = new Map<string, SeenFact>()
  const week = input.seen
    .filter((entry) => entry.date >= input.monday && entry.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date) || FACT_PLACES.indexOf(a.place) - FACT_PLACES.indexOf(b.place))
  for (const entry of week) if (!first.has(entry.factId) && factById(entry.factId)) first.set(entry.factId, entry)
  const order = [...first.keys()]
  const seenFacts = order.map((id) => factById(id)!)
  const chosen = seenFacts.length > QUIZ_SIZE ? [...seenFacts].sort(byHash(input.monday)).slice(0, QUIZ_SIZE).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : seenFacts
  const taken = new Set(chosen.map((fact) => fact.id))
  const others = [...new Map([...input.exercises.flatMap(exerciseFacts), ...input.foods.flatMap(foodFacts)].map((fact) => [fact.id, fact])).values()]
    .filter((fact) => !taken.has(fact.id))
    .sort(byHash(input.monday))
  const facts = [...chosen, ...others].slice(0, QUIZ_SIZE)
  return facts.length === QUIZ_SIZE ? facts : null
}

/** Sa përgjigje janë të sakta (`answers[i]` është indeksi i zgjedhur te pyetja i). */
export function quizScore(facts: readonly Fact[], answers: readonly number[]): number {
  return facts.reduce((total, fact, index) => total + Number(answers[index] === fact.quiz.correct), 0)
}

/** Një javë për vargun: kuizi u mbyll (dita) dhe nëse kuizi ishte i hapur atë javë (të paktën 5 fakte). */
export interface QuizWeek {
  monday: string
  /** Dita kur u mbyll kuizi i javës; null pa kuiz. */
  doneOn: string | null
  /** Java kishte të paktën 5 fakte: pa kuiz, vargu ndërpritet. */
  available: boolean
}

/**
 * Vargu i kuizit në fund të listës (javët me radhë, e vjetra e para): javët me kuizin e mbyllur, nga e fundit mbrapa.
 * Një javë pa kuiz të mundshëm kapërcehet; java e hapur (`openMonday`, e diela 20:00 deri të hënën) pa kuiz ende nuk
 * e ndërpret; çdo javë tjetër me kuiz të pabërë e ndal.
 */
export function quizStreak(weeks: readonly QuizWeek[], openMonday: string | null): number {
  let streak = 0
  for (let index = weeks.length - 1; index >= 0; index--) {
    const week = weeks[index]
    if (week.doneOn) streak += 1
    else if (!week.available || week.monday === openMonday) continue
    else break
  }
  return streak
}

export interface QuizAchievementState {
  /** Dita kur u mbyll kuizi i katërt rresht; null pa u plotësuar. */
  met: { date: string } | null
  progress: { current: number; target: number }
}

/** Arritja "Kuizi 4 javë": kur vargu arriti 4 për herë të parë (dita e kuizit të katërt); përndryshe vargu i tanishëm. */
export function quizAchievement(weeks: readonly QuizWeek[], openMonday: string | null): QuizAchievementState {
  let run = 0
  for (const week of weeks) {
    if (week.doneOn) {
      run += 1
      if (run === QUIZ_STREAK_TARGET) return { met: { date: week.doneOn }, progress: { current: QUIZ_STREAK_TARGET, target: QUIZ_STREAK_TARGET } }
    } else if (week.available && week.monday !== openMonday) run = 0
  }
  return { met: null, progress: { current: Math.min(quizStreak(weeks, openMonday), QUIZ_STREAK_TARGET), target: QUIZ_STREAK_TARGET } }
}
