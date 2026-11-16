import { localDate } from '@/lib/calendar'
import {
  type AchievementKey,
  type AchievementProgramme,
  type AchievementProgress,
  type AchievementSession,
  achievementStates,
  type AchievementState,
  isNewAchievement,
  nearestAchievement,
  orderAchievements,
  type StreakWeek,
} from '@/progress/achievements'
import { recordsAtTheTime, sessionRecords } from '@/progress/history'
import type { IntakeDay } from '@/progress/weekly-goals'
import { quizHistory } from './learn-history'
import { readMissedInput } from './missed-day'
import { naturalId } from './natural-id'
import { dayTargets } from './nutrition'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'
import { trainingHistory } from './training'
import { waterDay } from './water'

// Arritjet në bazë (V43, SPEC §0.3c, V2-E2-21). Rregullat jetojnë te `progress/achievements.ts`; ky modul
// lexon historinë, ruan një herë çdo arritje të plotësuar (tabela `achievements`, sinkronizohet) dhe jep
// listat për ekranet. Një rresht i ruajtur nuk fshihet dhe nuk ri-datohet kurrë: arritja mbetet edhe kur
// historia ndryshon. Id-ja vjen nga çelësi (`achievementId`), që dy telefona të shkruajnë një rresht.
//
// Kur jepen: në hapjen e app-it (`useDataUpgrades`), te Progresi › Arritjet dhe te mbyllja e seancës;
// çdo lexim i mëposhtëm i jep vetë ato që mungojnë para se të kthejë listën. Vetëm pasi ky telefon ka
// marrë një herë tabelën `achievements` nga serveri (`store.pulled`), që të mos ri-datojë një arritje
// të dhënë nga një telefon tjetër.

export type { AchievementKey, AchievementProgress, StreakWeek } from '@/progress/achievements'

export interface Achievement {
  key: AchievementKey
  /** Data kur u fitua (e ruajtur); null pa u fituar. */
  earnedOn: string | null
  /** E fituar në 7 ditët e fundit ("E re"). */
  isNew: boolean
  /** Sa ka kundrejt objektivit; i plotë kur është fituar. */
  progress: AchievementProgress
  /** Vetëm vargu: javët e vargut (që e fituan, ose vargu i tanishëm), e vjetra e para; bosh për të tjerat. */
  weeks: StreakWeek[]
  /** Seanca që e plotësoi rregullin sipas historisë së tanishme; null kur e plotësoi ushqimi, uji ose e diela. */
  sessionId: string | null
}

export interface AchievementsView {
  today: string
  /** Sa janë fituar ("3 nga 10"). */
  earned: number
  total: number
  /** Të fituarat (më e reja e para), pastaj të tjerat me radhën e rregullave. */
  achievements: Achievement[]
  /** Emri i programit aktiv ("13 javët e Shortcut to Size"); null pa program. */
  programmeName: string | null
}

/** Id e rreshtit nga çelësi natyror (përdoruesi, arritja): një rresht për arritje, në çdo telefon. */
export function achievementId(userId: string, key: AchievementKey): Promise<string> {
  return naturalId(['achievements', userId, key])
}

const day = (value: unknown) => String(value ?? '').slice(0, 10)
const numberOr = (value: unknown, fallback: number) => (value === null || value === undefined || Number.isNaN(Number(value)) ? fallback : Number(value))

function toSession(row: LocalRow): AchievementSession {
  return {
    id: row.id,
    date: day(row.date),
    startedAt: (row.started_at as string | null | undefined) ?? null,
    endedAt: (row.ended_at as string | null | undefined) ?? null,
    status: row.status as AchievementSession['status'],
    programId: (row.program_id as string | null | undefined) ?? null,
    run: numberOr(row.run, 1),
    blockId: (row.block_id as string | null | undefined) ?? null,
    week: numberOr(row.week, 1),
    dayId: (row.day_id as string | null | undefined) ?? null,
  }
}

/** Arritjet e ruajtura sipas çelësit; kur ka dy rreshta të gjallë për një çelës, vlen data më e hershme. */
async function savedRows(store: LocalStore): Promise<Map<string, string>> {
  const saved = new Map<string, string>()
  for (const row of await store.all('achievements')) {
    const key = String(row.key)
    const earnedOn = day(row.earned_on)
    if (!saved.has(key) || earnedOn < saved.get(key)!) saved.set(key, earnedOn)
  }
  return saved
}

/** Ushqimi ose uji i çdo dite me regjistrime, me objektivin e ditës (ditët pa regjistrime s'numërohen). */
async function intakeDays(rows: LocalRow[], amount: (row: LocalRow) => number, target: (date: string) => Promise<number | null>): Promise<IntakeDay[]> {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(day(row.date), (totals.get(day(row.date)) ?? 0) + amount(row))
  return Promise.all([...totals.entries()].map(async ([date, total]) => ({ date, amount: total, target: await target(date) })))
}

/** Historia që i duhet rregullave: seancat, rekordet, programet, ditët e stërvitjes, ushqimi dhe uji. */
async function computeStates(store: LocalStore, saved: Map<string, string>) {
  const today = localDate(store.now())
  const [days, sessionRows, history, programs, blocks, programDays, settings] = await Promise.all([
    readMissedInput(store),
    store.all('workout_sessions'),
    trainingHistory(store),
    store.all('programs'),
    store.all('program_blocks'),
    store.all('program_days'),
    store.all('user_settings'),
  ])
  const activeId = (settings[0]?.active_program_id as string | null | undefined) ?? null
  const [state] = activeId ? await store.where('program_state', 'program_id', activeId) : []
  // Ushqimi dhe uji lexohen vetëm kur ndonjë arritje e tyre mungon: objektivi i çdo dite kushton disa lexime.
  const needFood = !saved.has('food_7') || !saved.has('full_week')
  const needWater = !saved.has('water_7') || !saved.has('full_week')
  // Javët e kuizit (§0.3e) vetëm kur "Kuizi 4 javë" mungon.
  const quiz = saved.has('quiz_4') ? { weeks: [], openMonday: null } : await quizHistory(store, store.now())
  const [food, water] = await Promise.all([
    needFood
      ? intakeDays(
          await store.all('diary_entries'),
          (row) => Number(row.kcal ?? 0),
          async (date) => (await dayTargets(store, date))?.kcal ?? null,
        )
      : [],
    needWater
      ? intakeDays(
          await store.all('water_logs'),
          (row) => Number(row.ml ?? 0),
          async (date) => (await waterDay(store, date)).targetMl,
        )
      : [],
  ])
  const sessions = sessionRows.map(toSession)
  // Rekordet si te Historiku: një për ushtrim në çdo seancë, secili kundrejt seteve para tij.
  const atTheTime = recordsAtTheTime(history.sets)
  const records = sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => sessionRecords(history.sets, session.id, atTheTime).map(() => ({ sessionId: session.id })))
  const programmes: AchievementProgramme[] = programs.map((program) => ({
    id: program.id,
    blocks: blocks
      .filter((block) => block.program_id === program.id)
      .map((block) => ({ id: block.id, position: numberOr(block.position, 0), weeks: numberOr(block.weeks, 1) })),
    dayIds: programDays.filter((row) => row.program_id === program.id).map((row) => row.id),
  }))
  const states = achievementStates({
    today,
    days,
    pointer: state?.block_id ? { run: numberOr(state.run, 1), blockId: String(state.block_id) } : null,
    sessions,
    records,
    programmes,
    activeProgrammeId: activeId,
    food,
    water,
    quizWeeks: quiz.weeks,
    quizOpenMonday: quiz.openMonday,
  })
  const programmeName = activeId ? (programs.find((program) => program.id === activeId)?.name as string | undefined) ?? null : null
  return { today, states, programmeName }
}

/**
 * Ruan arritjet e plotësuara që s'janë ruajtur ende, me datën kur u plotësuan; kthen çelësat e rinj. Pa marrë
 * një herë tabelën nga serveri telefoni nuk jep asgjë: një telefon tjetër mund ta ketë dhënë me datën e vet,
 * dhe një shkrim i ri do ta ri-datonte te të gjithë (rishikimi i 0.23).
 */
async function persist(store: LocalStore, states: AchievementState[], saved: Map<string, string>): Promise<AchievementKey[]> {
  const userId = store.userId()
  if (!userId || !states.some((state) => state.met && !saved.has(state.key)) || !(await store.pulled('achievements'))) return []
  const added: AchievementKey[] = []
  for (const state of states) {
    if (!state.met || saved.has(state.key)) continue
    const id = await achievementId(userId, state.key)
    // Një rresht që ekziston (edhe i fshirë) mban datën e vet. `revive`: i fshiri kthehet, në vend që
    // indeksi unik i serverit ta refuzojë.
    const existing = await store.get('achievements', id, { deleted: true })
    const earnedOn = existing?.earned_on ? day(existing.earned_on) : state.met.date
    await store.put('achievements', { id, key: state.key, earned_on: earnedOn }, { revive: true })
    saved.set(state.key, earnedOn)
    added.push(state.key)
  }
  return added
}

// Një dhënie në një kohë për çdo store: hapja e app-it dhe një ekran mund ta nisin njëkohësisht.
const queues = new WeakMap<LocalStore, Promise<unknown>>()

function serialized<T>(store: LocalStore, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(store) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(work)
  queues.set(store, next)
  return next
}

/** Lexon historinë, ruan ato që mungojnë dhe kthen gjithçka për ekranet. */
function evaluate(store: LocalStore) {
  return serialized(store, async () => {
    const saved = await savedRows(store)
    const computed = await computeStates(store, saved)
    const added = await persist(store, computed.states, saved)
    const achievements = computed.states.map(
      (state): Achievement => {
        const earnedOn = saved.get(state.key) ?? null
        return {
          key: state.key,
          earnedOn,
          isNew: isNewAchievement(earnedOn, computed.today),
          progress: earnedOn ? { current: state.progress.target, target: state.progress.target } : state.progress,
          weeks: state.weeks ?? [],
          sessionId: state.met?.sessionId ?? null,
        }
      },
    )
    return { ...computed, added, achievements }
  })
}

/**
 * Jep arritjet e plotësuara që s'janë ruajtur ende (hapja e app-it, mbyllja e seancës). Kthen çelësat e
 * ruajtur tani; një arritje e ruajtur më parë nuk ndryshon.
 */
export async function awardAchievements(store: LocalStore): Promise<AchievementKey[]> {
  return (await evaluate(store)).added
}

/** Progresi › Arritjet: "N nga 10", pllakat me radhë dhe progresi i të pafituarave. */
export async function achievementsView(store: LocalStore): Promise<AchievementsView> {
  const { today, achievements, programmeName } = await evaluate(store)
  return {
    today,
    earned: achievements.filter((entry) => entry.earnedOn !== null).length,
    total: achievements.length,
    achievements: orderAchievements(achievements),
    programmeName,
  }
}

/**
 * "Arritje e re" për përmbledhjen e javës (dhe çdo periudhë): arritjet e fituara nga `since` deri te
 * `until` (përfshirë; parazgjedhje sot), datat YYYY-MM-DD, më e reja e para. Jep më parë ato që mungojnë.
 * P.sh. përmbledhja e së dielës: `newAchievements(store, { since: monday, until: sunday })`.
 */
export async function newAchievements(store: LocalStore, range: { since: string; until?: string }): Promise<Achievement[]> {
  const { today, achievements } = await evaluate(store)
  const until = range.until ?? today
  return orderAchievements(achievements.filter((entry) => entry.earnedOn !== null && entry.earnedOn >= range.since && entry.earnedOn <= until))
}

export interface SessionAchievements {
  /** Arritjet që i plotësoi kjo seancë ("Arritje e re"). */
  earned: Achievement[]
  /** Pa arritje të re: më e afërta nga të pafituarat; null kur janë fituar të gjitha. */
  nearest: Achievement | null
}

/** Mbyllja e seancës: jep ato që mungojnë, pastaj arritjet që i plotësoi kjo seancë ose më e afërta. */
export async function sessionAchievements(store: LocalStore, sessionId: string): Promise<SessionAchievements> {
  const [{ achievements }, session] = await Promise.all([evaluate(store), store.get('workout_sessions', sessionId)])
  const date = day(session?.date)
  const earned = orderAchievements(achievements.filter((entry) => entry.earnedOn === date && entry.sessionId === sessionId))
  return { earned, nearest: earned.length ? null : nearestAchievement(achievements) }
}
