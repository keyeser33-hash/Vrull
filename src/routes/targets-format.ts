import type { I18n } from '@/i18n'
import type { Activity, Goal } from '@/nutrition/calculator'

// Tekstet e objektivave (V32) për faqen te Ushqimi dhe hapin te hapat e parë.

export const ACTIVITY_ORDER: readonly Activity[] = ['sedentary', 'light', 'standing', 'physical']
/** Qëllimi i parazgjedhur (V32): masë muskulore, si te Shortcut to Size. */
export const DEFAULT_GOAL: Goal = 'gain'
export const GOAL_ORDER: readonly Goal[] = ['gain', 'maintain', 'lose']

/** "+0,25%" / "−0,5%" / "0%". */
export function rateText({ fmt }: Pick<I18n, 'fmt'>, goal: Goal, pct: number): string {
  if (goal === 'maintain') return `${fmt.number(0)}%`
  return `${goal === 'gain' ? '+' : '−'}${fmt.number(pct, { maxDigits: 2 })}%`
}

/** "Masë muskulore · +0,25% në javë" / "Mirëmbajtje". */
export function goalSummary(i18n: Pick<I18n, 't' | 'fmt'>, goal: Goal, pct: number): string {
  const label = i18n.t(`food.targets.goal.${goal}`)
  return goal === 'maintain' ? label : i18n.t('food.targets.summary', { goal: label, rate: rateText(i18n, goal, pct) })
}

export function activityText({ t }: Pick<I18n, 't'>, activity: Activity): string {
  switch (activity) {
    case 'sedentary':
      return t('food.targets.activity.sedentaryText', { steps: 5000 })
    case 'light':
      return t('food.targets.activity.lightText', { from: 5000, to: 8000 })
    case 'standing':
      return t('food.targets.activity.standingText', { from: 8000, to: 12000 })
    case 'physical':
      return t('food.targets.activity.physicalText', { steps: 12000 })
  }
}
