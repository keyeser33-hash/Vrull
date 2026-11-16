import { FactCard } from '@/components/ui/fact-card'
import { store, useLocalQuery } from '@/data/app-data'
import { type DayFact, dismissFact, restFact } from '@/data/learn'
import { currentFoodDate } from '@/data/nutrition'
import { useI18n } from '@/i18n/use-i18n'
import { factMore, factSource, factText, factTopic } from './learn-format'
import { useMarkSeen } from './learn-hooks'

// Karta "A e dije?" (`FactCard`) gjatë pushimit dhe pas regjistrimit të një ushqimi (V56, SPEC §0.3e; bordet "Pushimi ·
// A e dije?" dhe "Ushqimi · Pas regjistrimit"): një fakt në ditë ushqimi në secilin vend. Fakti shënohet i parë kur karta
// del (një rresht te `learn_events`); "×" e mbyll për atë ditë. Vetëm "Më shumë" (shpjegimi dhe burimi) dhe "×".

function DayFactCard({ entry }: { entry: DayFact }) {
  const i18n = useI18n()
  const more = factMore(i18n, entry.fact)
  return (
    <FactCard
      fact={factText(i18n, entry.fact)}
      source={factSource(i18n, entry.fact)}
      context={factTopic(i18n, entry.fact)}
      more={more ?? undefined}
      href={entry.fact.source.url}
      onDismiss={() => void dismissFact(store, entry.place, entry.date)}
    />
  )
}

/** Pushimi mes seteve: fakti i ushtrimit aktual, poshtë kohëmatësit dhe mbi "Ruaj setin" (pa e mbuluar). */
export function RestFactCard({ exercise }: { exercise: string | null }) {
  const entry = useLocalQuery(async () => restFact(store, await currentFoodDate(store, store.now()), exercise), [exercise])
  useMarkSeen(entry)
  if (!entry || entry.dismissed) return null
  return <DayFactCard entry={entry} />
}

export { DayFactCard as FoodFactCard }
