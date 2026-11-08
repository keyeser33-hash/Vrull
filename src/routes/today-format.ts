import type { TodayExercise } from '@/data/today'
import type { I18n, T } from '@/i18n'
import type { SessionPlan, Target } from '@/program/types'

// Tekstet e ekranit Sot (V2-E1-06) sipas gjuhës. Emrat e blloqeve dhe të ditëve të Shortcut to Size
// ruhen shqip në bazë; në anglisht përkthehen këtu. Emrat që shkruan përdoruesi mbeten si janë.

/** Fjala e kohës mes dy numrave që nuk ndahen në dy rreshta ("9–11"). */
const DASH = '–\u2060'

/** "Java 0" → "Week 0", "Faza 2" → "Phase 2"; çdo emër tjetër mbetet. */
export function blockText(t: T, name: string): string {
  if (name === 'Java 0') return t('today.block.week0')
  const phase = /^Faza (\d+)$/.exec(name)
  return phase ? t('today.block.phase', { number: phase[1] }) : name
}

/** "Faza 1 · Java 2" / "Phase 1 · Week 2"; një bllok me një javë vetëm me emrin ("Java 0"). */
export function programLabel(t: T, plan: Pick<SessionPlan, 'blockName' | 'blockWeeks' | 'week'>): string {
  const block = blockText(t, plan.blockName)
  return plan.blockWeeks === 1 ? block : t('today.blockWeek', { block, week: plan.week })
}

const DAY_NAMES: Record<string, `today.programDay.${'chest' | 'back' | 'shoulders' | 'legs'}`> = {
  'Gjoks, triceps, pulpa': 'today.programDay.chest',
  'Shpinë, biceps, bark': 'today.programDay.back',
  'Shpatulla, trapez, pulpa': 'today.programDay.shoulders',
  'Këmbë, bark': 'today.programDay.legs',
}

/** Emri i ditës së programit në gjuhën e tanishme ("Chest, triceps, calves"). */
export function programDayName(t: T, name: string): string {
  const key = DAY_NAMES[name]
  return key ? t(key) : name
}

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
