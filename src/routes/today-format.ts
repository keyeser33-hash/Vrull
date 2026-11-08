import type { TodayExercise } from '@/data/today'
import type { I18n } from '@/i18n'
import type { Target } from '@/program/types'

// Rreshti i ushtrimit të parë te karta e Sot (V2-E1-06), sipas gjuhës. Emrat e domenit (blloqet,
// ditët e Shortcut to Size, grupet e muskujve) vijnë nga `@/i18n/domain`.

/** Fjala e kohës mes dy numrave që nuk ndahen në dy rreshta ("9–11"). */
const DASH = '–\u2060'

/** Intervali i përsëritjeve: "9–11", "12+", "5+" (AMRAP); bosh për ushtrimet me kohë. */
export function repsText(target: Target): string {
  switch (target.kind) {
    case 'reps':
      return target.max === null ? `${target.min}+` : `${target.min}${DASH}${target.max}`
    case 'percent_1rm':
      return `${target.reps}${target.amrap ? '+' : ''}`
    case 'linear':
      return String(target.reps)
    case 'timed':
      return ''
  }
}

/** Rreshti i kartës: "Bench Press: synim 62,5 × 9–11." ose si të zgjidhet pesha. */
export function targetLine({ t, fmt }: Pick<I18n, 't' | 'fmt'>, exercise: TodayExercise): string {
  const { name, target, weightKg, tracking } = exercise
  const reps = repsText(target)
  if (target.kind === 'timed') return t('today.target.seconds', { exercise: name, seconds: target.seconds })
  if (tracking === 'weight_reps' && weightKg !== null) return t('today.target.weight', { exercise: name, weight: fmt.number(weightKg), reps })
  if (tracking !== 'weight_reps') return t('today.target.reps', { exercise: name, reps })
  if (target.kind === 'percent_1rm') return t('today.target.percent', { exercise: name, reps, percent: target.percent })
  return t('today.target.choose', { exercise: name, reps })
}
