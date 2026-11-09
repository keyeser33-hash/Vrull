import type { Achievement } from '@/data/achievements'
import type { I18n } from '@/i18n'

// Tekstet e arritjeve (V43): emri, rregulli i shkurtër te pllaka dhe gjendja (data, sa mungon), për
// faqen Progresi › Arritjet, fletën dhe mbylljen e seancës.

export type Listed = Pick<Achievement, 'key' | 'earnedOn' | 'isNew' | 'progress'>

/** "Seanca e parë" / "First session". */
export function achievementName({ t }: Pick<I18n, 't'>, key: Achievement['key']): string {
  return t(`achievements.${key}.name`)
}

/** Rregulli i shkurtër te pllaka: "Të 16 stërvitjet e fazës", "13 javët e Shortcut to Size". */
export function achievementRule({ t }: Pick<I18n, 't'>, achievement: Listed, programmeName: string | null): string {
  const { key, progress } = achievement
  if (key === 'phase_1') return progress.target > 0 ? t('achievements.phase_1.rule', { count: progress.target }) : t('achievements.phase_1.ruleAny')
  if (key === 'programme') {
    return progress.target > 0 && programmeName ? t('achievements.programme.rule', { count: progress.target, programme: programmeName }) : t('achievements.programme.ruleAny')
  }
  return t(`achievements.${key}.rule`)
}

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** Gjendja pas rregullit te pllaka: "3 nëntor", "fituar sot", "8 nga 10", "edhe 1", "më e mira 6". */
export function achievementStatus({ t, fmt }: Pick<I18n, 't' | 'fmt'>, achievement: Listed, today: string): string | null {
  const { key, earnedOn, progress } = achievement
  if (earnedOn) return earnedOn === today ? t('achievements.earnedToday') : fmt.date(atNoon(earnedOn), { weekday: false })
  if (progress.target <= 0) return null
  if (key === 'streak_4') return t('achievements.left', { count: progress.target - progress.current })
  if (key === 'food_7' || key === 'water_7') return t('achievements.best', { count: progress.current })
  return t('achievements.progress', { current: progress.current, target: progress.target })
}

/** Rreshti poshtë titullit te fleta: "Fituar më 29 nëntor", "8 nga 10", "Vargu tani: 3 nga 4 javë". */
export function achievementSheetStatus({ t, fmt }: Pick<I18n, 't' | 'fmt'>, achievement: Listed, today: string): string | null {
  const { key, earnedOn, progress } = achievement
  if (earnedOn) return earnedOn === today ? t('achievements.sheet.earnedToday') : t('achievements.sheet.earnedOn', { date: fmt.date(atNoon(earnedOn), { weekday: false }) })
  if (progress.target <= 0) return null
  if (key === 'streak_4') return t('achievements.sheet.streak', { current: progress.current, target: progress.target })
  if (key === 'food_7' || key === 'water_7') return t('achievements.sheet.best', { current: progress.current, target: progress.target })
  return t('achievements.progress', { current: progress.current, target: progress.target })
}
