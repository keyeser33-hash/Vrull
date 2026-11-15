import type { T } from '@/i18n'
import { untilParts } from '@/today/rhythm'

/** "3 orë 30 min", "1 orë", "45 min": koha që mbetet, sipas gjuhës. */
export function untilText(t: T, minutes: number): string {
  const { hours, minutes: rest } = untilParts(minutes)
  return [hours > 0 ? t('sot.until.hours', { count: hours }) : '', rest > 0 || hours === 0 ? t('sot.until.minutes', { count: rest }) : ''].filter(Boolean).join(' ')
}
