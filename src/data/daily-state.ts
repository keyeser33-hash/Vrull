import { naturalId } from './natural-id'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Gjendja e ditës (V50, V2-E3-03; SPEC §0.3d) në bazë: check-in-i i mëngjesit dhe vendimi i sugjerimit, një rresht
// për ditë ushqimi (V46; data e jep thirrësi, p.sh. `currentFoodDate` te nutrition.ts). Id-ja vjen nga
// (përdoruesi, data), që dy telefona të shkruajnë një rresht; kufijtë janë ata të migrimit
// 20261110080000_daily_states.sql, që serveri të mos e refuzojë rreshtin (MESIMET › Supabase). Pikët dhe nivelet
// i llogarit `src/readiness/readiness.ts`; këtu vetëm ruhet.

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

export interface DailyState extends CheckInAnswers {
  date: string
  /** Gatishmëria në çastin e check-in-it (0–100), për historinë e 14 ditëve; null kur s'u llogarit. */
  readiness: number | null
  choice: ReadinessChoice | null
}

const MAX_SLEEP_MINUTES = 14 * 60
const MAX_SORE_GROUPS = 12
const GROUP = /^[a-z][a-z0-9_-]{0,39}$/
const CHOICES: readonly ReadinessChoice[] = ['lighter', 'tomorrow', 'normal']
const SKIP_KEY = (date: string) => `checkin-skip:${date}`
const FOLLOW_KEY = 'day-mode-follow'

export function dailyStateId(userId: string, date: string): Promise<string> {
  return naturalId(['daily_states', userId, date])
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
  const choice = CHOICES.includes(row.choice as ReadinessChoice) ? (row.choice as ReadinessChoice) : null
  return {
    date: String(row.date).slice(0, 10),
    mood: Number(row.mood) as Scale,
    energy: Number(row.energy) as Scale,
    sleepMinutes: Number(row.sleep_minutes),
    sleepQuality: Number(row.sleep_quality) as Scale,
    soreness: Number(row.soreness) as Soreness,
    soreGroups: Array.isArray(row.sore_groups) ? row.sore_groups.map(String) : [],
    readiness: typeof row.readiness === 'number' ? row.readiness : null,
    choice,
  }
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
 * Ruan ose ndryshon check-in-in e datës, me gatishmërinë e atij çasti (`readinessFor` te readiness-view.ts);
 * vendimi i sugjerimit mbetet.
 */
export async function saveDailyState(store: LocalStore, date: string, answers: CheckInAnswers, readiness: number | null = null): Promise<DailyState> {
  const values = normalizeCheckIn(answers)
  const existing = await rowFor(store, date)
  const userId = store.userId()
  const id = existing?.id ?? (userId ? await dailyStateId(userId, date) : undefined)
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
      readiness: readiness === null || !Number.isFinite(readiness) ? null : Math.min(100, Math.max(0, Math.round(readiness))),
      choice: existing?.choice ?? null,
    },
    { revive: true },
  )
  return fromRow(row)
}

/** Vendimi i kartës së sugjerimit; pa check-in nuk ka sugjerim, ndaj as vendim. */
export async function setReadinessChoice(store: LocalStore, date: string, choice: ReadinessChoice | null): Promise<void> {
  const existing = await rowFor(store, date)
  if (!existing) return
  await store.put('daily_states', { id: existing.id, choice })
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
