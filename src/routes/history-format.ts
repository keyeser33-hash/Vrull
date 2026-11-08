import type { PastSet } from '@/data/history'
import type { Format, T } from '@/i18n'
import type { Language } from '@/i18n/language'
import { muscleName } from '@/i18n/domain'
import type { RepRange, TargetSummary } from '@/progress/history'

// Tekstet e historikut (V2-E1-15) sipas gjuhës. Emrat e programit dhe të muskujve: `@/i18n/domain`.

export const capitalize = (text: string, lang: Language) => text.charAt(0).toLocaleUpperCase(lang) + text.slice(1)

/** Data lokale "YYYY-MM-DD" si mesditë e asaj dite, që ndërrimi i orës të mos e zhvendosë. */
export const dayDate = (date: string) => new Date(`${date}T12:00:00`)

export { programBlockName as blockText, programDayName as dayNameText, programWeekLabel as weekLabel } from '@/i18n/domain'

const pad = (value: number) => String(value).padStart(2, '0')

/** "1:04" dhe "orë", ose "58" dhe "min". */
export function durationParts(t: T, minutes: number): { value: string; unit: string } {
  if (minutes >= 60) return { value: `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`, unit: t('history.unitHours') }
  return { value: String(minutes), unit: t('history.unitMinutes') }
}

/** "1:04 orë", "58 min". */
export function durationText(t: T, minutes: number): string {
  const { value } = durationParts(t, minutes)
  return minutes >= 60 ? t('history.hours', { time: value }) : t('history.minutes', { minutes: value })
}

/** "1 orë e 6 minuta", për lexuesin e ekranit. */
export function spokenDuration(t: T, minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return t('history.spoken.minutes', { count: rest })
  if (rest === 0) return t('history.spoken.hours', { count: hours })
  return t('history.spoken.hoursMinutes', { hours: t('history.spoken.hours', { count: hours }), minutes: t('history.spoken.minutes', { count: rest }) })
}

/** "Sot, e diel 8 nëntor", "Dje, …", "E enjte, 5 nëntor". */
export function sessionDateText(t: T, fmt: Format, lang: Language, date: string, today: string): string {
  const at = dayDate(date)
  const short = `${fmt.weekday(at)} ${fmt.date(at, { weekday: false })}`
  if (date === today) return t('history.todayDate', { date: short })
  const yesterday = new Date(dayDate(today).getTime() - 86_400_000)
  if (date === `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`) return t('history.yesterdayDate', { date: short })
  return capitalize(fmt.date(at), lang)
}

/** "nëntor" / "November": emri i muajit nga data e app-it ("1 nëntor"), pa ditën. */
export function monthName(fmt: Format, year: number, monthIndex: number): string {
  return fmt.date(new Date(year, monthIndex, 1, 12), { weekday: false }).replace(/^1\s/, '')
}

/** "Nëntor 2026" / "November 2026". */
export function monthTitle(fmt: Format, lang: Language, year: number, monthIndex: number): string {
  return capitalize(`${monthName(fmt, year, monthIndex)} ${year}`, lang)
}

/** "1, 2, 3, 5 dhe 8". */
export function listText(t: T, items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${t('history.and')} ${items.at(-1)}`
}

/** "86,0": e1RM-ja me një shifër pas presjes, si te bordet. */
export const kg1 = (fmt: Format, value: number) => fmt.number(value, { minDigits: 1, maxDigits: 1 })

/** "60 × 13", "15" (pa peshë), "60 s". */
export function setText(fmt: Format, set: Pick<PastSet, 'weightKg' | 'reps' | 'seconds'>): string {
  if (set.reps === null && set.seconds !== null) return fmt.unit(set.seconds, 's')
  if (!set.weightKg) return fmt.number(set.reps ?? 0)
  return `${fmt.number(set.weightKg)} × ${fmt.number(set.reps ?? 0)}`
}

/** Segmentet pas setit: "+ 4" me të njëjtën peshë, "+ 40 × 6" me peshë tjetër. */
export function segmentsText(fmt: Format, set: Pick<PastSet, 'weightKg' | 'segments'>): string {
  return set.segments
    .map((segment) => `+ ${segment.weightKg && segment.weightKg !== set.weightKg ? `${fmt.number(segment.weightKg)} × ${fmt.number(segment.reps)}` : fmt.number(segment.reps)}`)
    .join(' ')
}

/** "50 kg" dhe "12, 11, 10 + 3" kur setet kanë një peshë; përndryshe çdo set me peshën e vet. */
export function setsSummary(fmt: Format, sets: PastSet[]): { weight: string | null; reps: string } {
  const weights = [...new Set(sets.map((set) => set.weightKg ?? 0))]
  const same = weights.length === 1 && sets.every((set) => set.seconds === null || set.reps !== null)
  const one = (set: PastSet) => {
    const base = same ? (set.reps === null && set.seconds !== null ? fmt.unit(set.seconds, 's') : fmt.number(set.reps ?? 0)) : setText(fmt, set)
    const extra = segmentsText(fmt, set)
    return extra ? `${base} ${extra}` : base
  }
  return { weight: same && weights[0] > 0 ? fmt.unit(weights[0], 'kg') : null, reps: sets.map(one).join(', ') }
}

const rangeText = (fmt: Format, range: RepRange) => (range.max === null ? `${fmt.number(range.min)}+` : `${fmt.number(range.min)}–${fmt.number(range.max)}`)

/** "12–15 · pulpat 25–30 · + rest-pause". */
export function summaryText(t: T, fmt: Format, lang: Language, summary: TargetSummary | null): string {
  if (!summary?.main) return ''
  const others = summary.others.map((entry) => {
    const groups = entry.groupIds.map((id) => muscleName(t, id).toLocaleLowerCase(lang)).join(', ')
    return groups ? `${groups} ${rangeText(fmt, entry.range)}` : rangeText(fmt, entry.range)
  })
  const techniques = summary.techniques.map((type) => `+ ${t(`history.technique.${type}`)}`)
  return [rangeText(fmt, summary.main), ...others, ...techniques].join(' · ')
}
