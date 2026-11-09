import type { RecoveryStatus } from '@/program/recovery'
import { type Readiness, readiness } from '@/readiness/readiness'
import { naturalId } from './natural-id'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Gjendja e ditës (V50, V2-E3-03; SPEC §0.3d) në bazë, në dy tabela, secila me një rresht për ditë ushqimi (V46; data
// e jep thirrësi, p.sh. `currentFoodDate` te nutrition.ts):
// - `daily_states`: check-in-i i mëngjesit, me rikuperimin e grupit kryesor dhe nëse një grup me dhimbje stërvitej
//   në çastin e check-in-it, që gatishmëria të llogaritet vetëm nga rreshti (`readinessOfState`) dhe të mos
//   ndryshojë kur stërvitja shtyhet ose mbyllet;
// - `daily_choices`: vendimi i sugjerimit me stërvitjen ku vlen dhe llojet e ditëve para shtyrjes. Është tabelë
//   më vete, që check-in-i i një telefoni tjetër të mos e mbishkruajë (rreshtat sinkronizohen të tërë).
// Id-të vijnë nga (përdoruesi, data), që dy telefona të shkruajnë një rresht; kufijtë janë ata të migrimeve
// 20261110080000_daily_states.sql dhe 20261110120000_daily_states_v2.sql, që serveri të mos e refuzojë rreshtin
// (MESIMET › Supabase). Pikët dhe nivelet i llogarit `src/readiness/readiness.ts`; këtu vetëm ruhet.

export type Scale = 1 | 2 | 3 | 4 | 5
export type Soreness = 0 | 1 | 2 | 3 | 4
/** "Seanca më e lehtë", "Shtyje për nesër" ose "Jo sot" te karta e sugjerimit. */
export type ReadinessChoice = 'lighter' | 'tomorrow' | 'normal'

/** Përgjigjet e check-in-it, me të njëjtat emra si `CheckIn` te readiness.ts. */
export interface CheckInAnswers {
  mood: Scale
  energy: Scale
  sleepMinutes: number
  sleepQuality: Scale
  soreness: Soreness
  soreGroups: string[]
}

/** Çfarë dinte pamja e Sot në çastin e check-in-it (`checkInContext` te readiness-view.ts). */
export interface CheckInContext {
  /** Rikuperimi i grupit kryesor; null në ditë pa stërvitje. */
  recovery: RecoveryStatus | null
  /** Një nga grupet me dhimbje stërvitej sot. */
  soreTrained: boolean
}

export interface DailyState extends CheckInAnswers, CheckInContext {
  date: string
  /** Gatishmëria e llogaritur nga rreshti (0–100), për historinë e 14 ditëve. */
  readiness: number | null
}

/** Vendimi i kartës së sugjerimit për një ditë ushqimi. */
export interface DailyChoice {
  date: string
  choice: ReadinessChoice
  /** Stërvitja ku vlen ("blloku|java|dita"); null kur s'dihej. */
  workout: string | null
  /** Llojet e zgjedhura me dorë para "Shtyje për nesër" (null = automatik). */
  prevToday: DayType | null
  prevTomorrow: DayType | null
}

export type DayType = 'training' | 'rest'

const MAX_SLEEP_MINUTES = 14 * 60
const MAX_SORE_GROUPS = 15
const GROUP = /^[a-z][a-z0-9_-]{0,39}$/
const CHOICES: readonly ReadinessChoice[] = ['lighter', 'tomorrow', 'normal']
const RECOVERIES: readonly RecoveryStatus[] = ['gati', 'pothuajse_gati', 'i_lodhur']
const DAY_TYPES: readonly DayType[] = ['training', 'rest']
const SKIP_KEY = (date: string) => `checkin-skip:${date}`
const FOLLOW_KEY = 'day-mode-follow'

export function dailyStateId(userId: string, date: string): Promise<string> {
  return naturalId(['daily_states', userId, date])
}

export function dailyChoiceId(userId: string, date: string): Promise<string> {
  return naturalId(['daily_choices', userId, date])
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))

/** Përgjigjet brenda kufijve të serverit: shkallët të plota, gjumi me hap 30 min (0–14 orë), grupet pa përsëritje. */
export function normalizeCheckIn(answers: CheckInAnswers): CheckInAnswers {
  const soreness = clamp(answers.soreness, 0, 4) as Soreness
  const groups = soreness === 0 ? [] : [...new Set(answers.soreGroups.filter((group) => GROUP.test(group)))].slice(0, MAX_SORE_GROUPS)
  return {
    mood: clamp(answers.mood, 1, 5) as Scale,
    energy: clamp(answers.energy, 1, 5) as Scale,
    sleepMinutes: clamp(Math.round(answers.sleepMinutes / 30) * 30, 0, MAX_SLEEP_MINUTES),
    sleepQuality: clamp(answers.sleepQuality, 1, 5) as Scale,
    soreness,
    soreGroups: groups,
  }
}

function fromRow(row: LocalRow): DailyState {
  return {
    date: String(row.date).slice(0, 10),
    mood: Number(row.mood) as Scale,
    energy: Number(row.energy) as Scale,
    sleepMinutes: Number(row.sleep_minutes),
    sleepQuality: Number(row.sleep_quality) as Scale,
    soreness: Number(row.soreness) as Soreness,
    soreGroups: Array.isArray(row.sore_groups) ? row.sore_groups.map(String) : [],
    readiness: typeof row.readiness === 'number' ? row.readiness : null,
    recovery: RECOVERIES.includes(row.recovery as RecoveryStatus) ? (row.recovery as RecoveryStatus) : null,
    soreTrained: row.sore_trained === true,
  }
}

/** Gatishmëria e ditës nga rreshti vetëm: e njëjtë para dhe pas shtyrjes ose mbylljes së stërvitjes. */
export function readinessOfState(state: Pick<DailyState, keyof CheckInAnswers | keyof CheckInContext>): Readiness {
  return readiness({ checkIn: state, recovery: state.recovery, trainedGroups: state.soreTrained ? state.soreGroups : [] })
}

async function rowFor(store: LocalStore, date: string): Promise<LocalRow | undefined> {
  return (await store.where('daily_states', 'date', date))[0]
}

export async function readDailyState(store: LocalStore, date: string): Promise<DailyState | null> {
  const row = await rowFor(store, date)
  return row ? fromRow(row) : null
}

/** Gjendjet e disa ditëve (p.sh. 14 ditët e fletës "Gati"); ditët pa check-in mungojnë. */
export async function dailyStates(store: LocalStore, dates: string[]): Promise<Map<string, DailyState>> {
  const rows = await Promise.all(dates.map((date) => rowFor(store, date)))
  return new Map(rows.filter((row): row is LocalRow => !!row).map((row) => [String(row.date).slice(0, 10), fromRow(row)]))
}

/**
 * Ruan ose ndryshon check-in-in e datës, me rikuperimin dhe dhimbjen e stërvitur të atij çasti (`checkInContext`
 * te readiness-view.ts) dhe gatishmërinë e llogaritur prej tyre. Vendimi i sugjerimit është rresht tjetër.
 */
export async function saveDailyState(store: LocalStore, date: string, answers: CheckInAnswers, context: CheckInContext = { recovery: null, soreTrained: false }): Promise<DailyState> {
  const values = normalizeCheckIn(answers)
  const existing = await rowFor(store, date)
  const userId = store.userId()
  const id = existing?.id ?? (userId ? await dailyStateId(userId, date) : undefined)
  const percent = readinessOfState({ ...values, ...context }).percent
  const row = await store.put(
    'daily_states',
    {
      ...(id ? { id } : {}),
      date,
      mood: values.mood,
      energy: values.energy,
      sleep_minutes: values.sleepMinutes,
      sleep_quality: values.sleepQuality,
      soreness: values.soreness,
      sore_groups: values.soreGroups,
      readiness: percent,
      recovery: context.recovery,
      sore_trained: context.soreTrained,
    },
    { revive: true },
  )
  return fromRow(row)
}

function choiceFromRow(row: LocalRow): DailyChoice | null {
  if (!CHOICES.includes(row.choice as ReadinessChoice)) return null
  const type = (value: unknown) => (DAY_TYPES.includes(value as DayType) ? (value as DayType) : null)
  return {
    date: String(row.date).slice(0, 10),
    choice: row.choice as ReadinessChoice,
    workout: typeof row.workout === 'string' ? row.workout : null,
    prevToday: type(row.prev_today),
    prevTomorrow: type(row.prev_tomorrow),
  }
}

export async function readDailyChoice(store: LocalStore, date: string): Promise<DailyChoice | null> {
  const [row] = await store.where('daily_choices', 'date', date)
  return row ? choiceFromRow(row) : null
}

/** Të gjitha vendimet e gjalla (historiku dhe peshat e propozuara). */
export async function dailyChoices(store: LocalStore): Promise<DailyChoice[]> {
  return (await store.all('daily_choices')).map(choiceFromRow).filter((choice): choice is DailyChoice => choice !== null)
}

/**
 * Vendimi i kartës së sugjerimit për një ditë ushqimi: një rresht me id nga (përdoruesi, data), që dy telefona të
 * shkruajnë të njëjtin. Null e fshin; një vendim i ri e kthen rreshtin e fshirë (`revive`).
 */
export async function setReadinessChoice(
  store: LocalStore,
  date: string,
  choice: ReadinessChoice | null,
  extras: { workout?: string | null; prevToday?: DayType | null; prevTomorrow?: DayType | null } = {},
): Promise<void> {
  const userId = store.userId()
  const [existing] = await store.where('daily_choices', 'date', date)
  if (choice === null) {
    if (existing) await store.remove('daily_choices', existing.id)
    return
  }
  const id = existing?.id ?? (userId ? await dailyChoiceId(userId, date) : undefined)
  await store.put(
    'daily_choices',
    { ...(id ? { id } : {}), date, choice, workout: extras.workout ?? null, prev_today: extras.prevToday ?? null, prev_tomorrow: extras.prevTomorrow ?? null },
    { revive: true },
  )
}

/** "Jo sot" te karta "Si ndihesh sot?": e fsheh për atë ditë, vetëm në këtë telefon. */
export async function checkInSkipped(store: LocalStore, date: string): Promise<boolean> {
  return (await store.readDevice(SKIP_KEY(date))) === true
}

export async function skipCheckIn(store: LocalStore, date: string): Promise<void> {
  await store.writeDevice(SKIP_KEY(date), true)
}

/** "Pamja ndjek gjendjen" (Cilësimet › Pamja): ndezur si parazgjedhje, vetëm në këtë telefon. */
export async function followDayState(store: LocalStore): Promise<boolean> {
  return (await store.readDevice(FOLLOW_KEY)) !== false
}

export async function setFollowDayState(store: LocalStore, on: boolean): Promise<void> {
  await store.writeDevice(FOLLOW_KEY, on)
}
