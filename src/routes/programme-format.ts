import type { I18n } from '@/i18n'
import { muscleName, programBlockName, programWeekLabel } from '@/i18n/domain'
import type { Equipment, Target, Technique } from '@/program/types'

// Tekstet e programit (V2-E1-09) në të dyja gjuhët: javët, setet, intervalet dhe pajisjet. Emrat e
// domenit (grupet e muskujve, blloqet dhe ditët e Shortcut to Size) vijnë nga `@/i18n/domain`.

type T = I18n['t']
type Fmt = I18n['fmt']

/** "Faza 1 · Java 2", ose emri i bllokut kur ka një javë ("Java 0"); xhiro e dytë e thotë. */
export function weekLabel(t: T, block: { blockName: string; blockWeeks: number; week: number; run?: number }): string {
  return programWeekLabel(t, { ...block, run: block.run ?? 1 })
}

/** "Java 2" (pa fazën), ose emri i bllokut kur ka një javë. */
export function weekShort(t: T, block: { blockName: string; blockWeeks: number; week: number }): string {
  return block.blockWeeks === 1 ? programBlockName(t, block.blockName) : t('plan.week', { week: block.week })
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

export const equipmentName = (t: T, equipment: Equipment) => t(`programme.equipment.${equipment}`)

/** "Shpatullat, trapezi": grupet me radhë, vetëm i pari me shkronjë të madhe. */
export const groupList = (t: T, groups: string[], lower = false) =>
  groups.map((group, index) => (index === 0 && !lower ? muscleName(t, group) : muscleName(t, group).toLowerCase())).join(', ')

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
