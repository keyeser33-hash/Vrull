import { shiftDate } from '@/lib/calendar'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { I18n } from '@/i18n'
import type { ReadinessLevel } from '@/readiness/readiness'

// Ndihmësit e pastër të check-in-it dhe të fletës "Gati" (V50, V2-E3-04/05): çipat e grupeve me dhimbje,
// gjumi nga profili, 14 ditët. Pa UI dhe pa bazë.

/** Çipat e fletës: çdo çip ruan id-të e grupeve të muskujve (`MUSCLE_GROUPS`), jo vetë çipin. */
export const SORE_CHIPS = [
  { id: 'gjoksi', groups: ['gjoksi'] },
  { id: 'shpina', groups: ['shpina', 'mesi', 'trapezi'] },
  { id: 'shpatullat', groups: ['shpatullat'] },
  { id: 'krahet', groups: ['bicepsi', 'tricepsi', 'parakrahet'] },
  { id: 'kembet', groups: ['kuadricepsi', 'kofshet-e-pasme', 'pulpat', 'vithet', 'aduktoret'] },
  { id: 'barku', groups: ['barku'] },
] as const

export type SoreChip = (typeof SORE_CHIPS)[number]['id']

/** Çipat e ndezur për grupet e ruajtura: një çip është i ndezur kur ka të paktën një nga grupet e tij. */
export function chipsOf(groups: readonly string[]): SoreChip[] {
  return SORE_CHIPS.filter((chip) => chip.groups.some((group) => groups.includes(group))).map((chip) => chip.id)
}

/** Id-të e grupeve për çipat e zgjedhur, pa përsëritje, sipas radhës së çipave. */
export function groupsOf(chips: readonly SoreChip[]): string[] {
  return SORE_CHIPS.filter((chip) => chips.includes(chip.id)).flatMap((chip) => [...chip.groups])
}

/** Çelësat e muskujve të grupeve (për ngjyrosjen e figurës). */
export function keysOfGroups(groups: readonly string[]): Set<string> {
  return new Set(MUSCLE_GROUPS.filter((group) => groups.includes(group.id)).flatMap((group) => group.keys))
}

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Vlera e parë e gjumit: nga ora e gjumit te ora e zgjimit e profilit, e rrumbullakosur në 30 min (0–14 orë). */
export function profileSleepMinutes(sleepTime: string, wakeTime: string): number {
  const span = (minutesOf(wakeTime) - minutesOf(sleepTime) + 1440) % 1440
  return Math.min(14 * 60, Math.round(span / 30) * 30)
}

/** Hapi i gjumit me −0,5 / +0,5 orë, brenda 0–14 orë. */
export function stepSleep(minutes: number, direction: -1 | 1): number {
  return Math.min(14 * 60, Math.max(0, minutes + direction * 30))
}

/** 14 ditët e fundit, nga më e vjetra te sot. */
export function lastDays(today: string, count = 14): string[] {
  return Array.from({ length: count }, (_, index) => shiftDate(today, index - (count - 1)))
}

export interface DayBar {
  date: string
  /** Gatishmëria e ruajtur (sot: e tanishmja); null pa check-in. */
  percent: number | null
  today: boolean
}

/** Shiritat e fletës: ditët e kaluara me vlerën e ruajtur, sot me vlerën e tanishme. */
export function dayBars(today: string, stored: ReadonlyMap<string, { readiness: number | null }>, current: number | null): DayBar[] {
  return lastDays(today).map((date) => ({
    date,
    today: date === today,
    percent: date === today ? current : (stored.get(date)?.readiness ?? null),
  }))
}

/** Mesatarja e ditëve me vlerë, e rrumbullakosur; null kur asnjë ditë nuk ka. */
export function averagePercent(bars: readonly DayBar[]): number | null {
  const values = bars.map((bar) => bar.percent).filter((value): value is number => value !== null)
  return values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/** Pika e nivelit: rërë për të ulët, jeshile për të lartë. */
export const LEVEL_TONE: Record<ReadinessLevel, string> = { low: 'bg-sand', normal: 'bg-muted-foreground', high: 'bg-success' }

// Çelësat e katalogut për përgjigjet e check-in-it (shkallët 1–5; dhimbjet 0–4) dhe çipat.
export const MOOD = ['checkin.mood.1', 'checkin.mood.2', 'checkin.mood.3', 'checkin.mood.4', 'checkin.mood.5'] as const
export const ENERGY = ['checkin.energy.1', 'checkin.energy.2', 'checkin.energy.3', 'checkin.energy.4', 'checkin.energy.5'] as const
export const QUALITY = ['checkin.sleep.quality.1', 'checkin.sleep.quality.2', 'checkin.sleep.quality.3', 'checkin.sleep.quality.4', 'checkin.sleep.quality.5'] as const
export const SORENESS = ['checkin.soreness.0', 'checkin.soreness.1', 'checkin.soreness.2', 'checkin.soreness.3', 'checkin.soreness.4'] as const
export const CHIP_LABEL = {
  gjoksi: 'checkin.sore.gjoksi',
  shpina: 'checkin.sore.shpina',
  shpatullat: 'checkin.sore.shpatullat',
  krahet: 'checkin.sore.krahet',
  kembet: 'checkin.sore.kembet',
  barku: 'checkin.sore.barku',
} as const

const LEVEL = { low: 'readiness.level.low', normal: 'readiness.level.normal', high: 'readiness.level.high' } as const

/** "E ulët" / "Normale" / "E lartë" në gjuhën e app-it. */
export function levelLabel(t: I18n['t'], level: ReadinessLevel): string {
  return t(LEVEL[level])
}
