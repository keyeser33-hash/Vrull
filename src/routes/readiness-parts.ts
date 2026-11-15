import type { DailyState } from '@/data/daily-state'
import type { TodayView } from '@/data/today'
import { muscleName, nameInSentence } from '@/i18n/domain'
import type { I18n } from '@/i18n'
import type { ReadinessPart } from '@/readiness/readiness'
import { CHIP_LABEL, chipsOf, ENERGY, MOOD, QUALITY, SORENESS } from './readiness-format'

// Pjesët e gatishmërisë me fjalë (V50, V2-E3-05; story i 5-të i gjendjes së ditës, V57): emri i pjesës dhe vlera e
// rreshtit të ditës ("6 orë, Normal", "Gjoksi: gati"). Pa UI.

export const PART = {
  sleep: 'readiness.part.sleep',
  energy: 'readiness.part.energy',
  recovery: 'readiness.part.recovery',
  soreness: 'readiness.part.soreness',
  mood: 'readiness.part.mood',
} as const
const RECOVERY = { gati: 'readiness.recovery.gati', pothuajse_gati: 'readiness.recovery.pothuajse_gati', i_lodhur: 'readiness.recovery.i_lodhur' } as const

/** Vlera me fjalë e një pjese të gatishmërisë ("6 orë, Normal", "Gjoksi: gati"), nga rreshti i ditës. */
export function partValue(i18n: I18n, part: ReadinessPart, view: Pick<TodayView, 'workout'>, state: DailyState): string {
  const { t, lang } = i18n
  switch (part.key) {
    case 'sleep':
      return t('readiness.sleep.value', { hours: t('checkin.sleep.hours', { count: state.sleepMinutes / 60 }), quality: t(QUALITY[state.sleepQuality - 1]) })
    case 'energy':
      return t(ENERGY[state.energy - 1])
    case 'mood':
      return t(MOOD[state.mood - 1])
    case 'recovery': {
      // Vlera është ajo e check-in-it (rreshti); grupi vjen nga stërvitja e planifikuar, që emri ta ndjekë.
      const group = view.workout?.focus?.group.id
      const status = state.recovery
      return group && status ? t(RECOVERY[status], { group: muscleName(t, group) }) : t('readiness.recovery.unknown')
    }
    case 'soreness': {
      const level = t(SORENESS[state.soreness])
      if (state.soreness === 0 || state.soreGroups.length === 0) return level
      const groups = chipsOf(state.soreGroups)
        .map((chip) => nameInSentence(t(CHIP_LABEL[chip]), lang))
        .join(', ')
      return t(state.soreTrained ? 'readiness.sore.trained' : 'readiness.sore.value', { level, groups })
    }
  }
}

