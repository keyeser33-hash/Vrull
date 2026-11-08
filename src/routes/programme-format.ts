import type { I18n } from '@/i18n'
import type { Equipment, Target, Technique } from '@/program/types'

// Tekstet e programit (V2-E1-09) në të dyja gjuhët: emrat e blloqeve, javët, setet dhe intervalet.
// Emrat e blloqeve janë të dhëna; ato të Shortcut to Size ("Java 0", "Faza 1") përkthehen.

type T = I18n['t']
type Fmt = I18n['fmt']

/** "Faza 1" → "Phase 1" në anglisht; "Java 0" → "Week 0"; emrat e tjerë mbeten siç janë. */
export function blockName(t: T, name: string): string {
  const phase = /^Faza (\d+)$/.exec(name)
  if (phase) return t('programme.phase', { number: phase[1] })
  const week = /^Java (\d+)$/.exec(name)
  return week ? t('programme.week', { number: week[1] }) : name
}

// Emrat e ditëve të Shortcut to Size (të dhënat janë shqip, shortcut-to-size.ts); të tjerët mbeten.
const STS_DAYS = {
  'Gjoks, triceps, pulpa': 'programme.stsDay.1',
  'Shpinë, biceps, bark': 'programme.stsDay.2',
  'Shpatulla, trapez, pulpa': 'programme.stsDay.3',
  'Këmbë, bark': 'programme.stsDay.4',
} as const

/** "Gjoks, triceps, pulpa" → "Chest, triceps, calves" në anglisht; emrat e përdoruesit mbeten. */
export function dayName(t: T, name: string): string {
  const key = STS_DAYS[name as keyof typeof STS_DAYS]
  return key ? t(key) : name
}

/** "Faza 1 · Java 2", ose emri i bllokut kur ka një javë ("Java 0"). */
export function weekLabel(t: T, block: { blockName: string; blockWeeks: number; week: number }): string {
  const name = blockName(t, block.blockName)
  return block.blockWeeks === 1 ? name : t('programme.blockWeek', { block: name, week: String(block.week) })
}

/** "Java 2" (pa fazën), ose emri i bllokut kur ka një javë. */
export function weekShort(t: T, block: { blockName: string; blockWeeks: number; week: number }): string {
  return block.blockWeeks === 1 ? blockName(t, block.blockName) : t('programme.week', { number: String(block.week) })
}

/** Intervali i përsëritjeve ose koha: "9–11", "20–30+", "60 s", "5". */
export function rangeText(fmt: Fmt, target: Target): string {
  switch (target.kind) {
    case 'reps':
      if (target.max === null) return `${fmt.number(target.min)}+`
      return `${fmt.number(target.min)}–${fmt.number(target.max)}${target.beyond ? '+' : ''}`
    case 'timed':
      return fmt.unit(target.seconds, 's')
    case 'percent_1rm':
    case 'linear':
      return fmt.number(target.reps)
  }
}

/** "4 × 9–11", "3 × 60 s". */
export const setsText = (fmt: Fmt, sets: number, target: Target) => `${fmt.number(sets)} × ${rangeText(fmt, target)}`

export const groupName = (t: T, group: string) => t(`programme.group.${group}` as 'programme.group.gjoksi')
export const equipmentName = (t: T, equipment: Equipment) => t(`programme.equipment.${equipment}`)

/** "Shpatullat, trapezi": grupet me radhë, vetëm i pari me shkronjë të madhe. */
export const groupList = (t: T, groups: string[], lower = false) =>
  groups.map((group, index) => (index === 0 && !lower ? groupName(t, group) : groupName(t, group).toLowerCase())).join(', ')

/** "Shpatullat · gjoksi, tricepsi": kryesorët, pastaj ndihmësit. */
export const musclesLine = (t: T, primary: string[], secondary: string[]) =>
  dotted([groupList(t, primary), groupList(t, secondary.filter((group) => !primary.includes(group)), primary.length > 0)])

export function techniqueName(t: T, technique: Technique): string | null {
  return technique.type === 'none' ? null : t(`programme.technique.${technique.type}`)
}

/** Shkronja e parë e madhe, sipas gjuhës: "e hënë 9" → "E hënë 9". */
export const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)

/** "E hënë 9" / "Monday 9". */
export const dayShort = (fmt: Fmt, date: Date) => capitalize(`${fmt.weekday(date)} ${date.getDate()}`, fmt.locale)

/** Lista me " · ", pa vlerat bosh. */
export const dotted = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ')
