import { store, useLocalQuery } from '@/data/app-data'
import type { TodayView } from '@/data/today'
import { readinessView } from '@/data/readiness-view'
import { useI18n } from '@/i18n/use-i18n'

// Fjalia e pamjes së ditës nën kreun e Sot (V20, V50, V2-E3-07; bordet "Sot · Gatishmëria e ulët" dhe "e lartë"):
// "Ritëm i butë sot." në ditë të lodhur (ngjyra e theksit, që atë ditë është rëra), "Je në formë sot. Shko fort."
// në ditë me energji, asgjë në ditë normale, pa check-in ose me "Pamja ndjek gjendjen" të fikur.
export function DayLine({ view }: { view: TodayView }) {
  const { t } = useI18n()
  const mode = useLocalQuery(async () => (await readinessView(store, view.date)).mode, [view.date])
  // Karta e stërvitjes së shtyrë e thotë vetë "Ritëm i butë sot." (bordi "Sot · Stërvitja shtyhet për nesër").
  if (view.postponed) return null
  if (mode === 'tired') return <p className="type-body-strong -mt-1 text-ember-text">{t('daymode.tired')}</p>
  if (mode === 'energetic') return <p className="type-body-strong -mt-1">{t('daymode.energetic')}</p>
  return null
}
