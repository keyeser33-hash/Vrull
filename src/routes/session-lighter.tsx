import { useState } from 'react'
import { store } from '@/data/app-data'
import { keepUsual } from '@/data/day-choice'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { surfaceClass } from '@/components/ui/surface'
import { SuggestionCard } from './readiness-suggestion'
import { barCostText } from './readiness-suggestion-text'
import type { TrainingSnapshot } from '@/data/training'
import { useSessionSuggestion } from './readiness-suggestion-state'

// Sugjerimi dhe shiriti i seancës më të lehtë në krye të seancës (V50, V2-E3-06; bordi "Seanca më e lehtë"):
// para setit të parë, kur sugjerimi s'është vendosur, e njëjta kartë si te Sot; kur seanca është më e lehtë,
// shiriti "Seanca më e lehtë sot · −1 set, pesha −10%" me "Kthe si zakonisht".
export function SessionLighter({ snapshot, started }: { snapshot: TrainingSnapshot; started: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const suggestion = useSessionSuggestion(snapshot, started)
  const [busy, setBusy] = useState(false)
  if (!suggestion) return null
  if (suggestion.kind === 'suggest') return <SuggestionCard suggestion={suggestion} className="mx-4 mt-1" />
  if (suggestion.kind !== 'lighter') return null
  const detail = barCostText(i18n, suggestion.cost)
  return (
    <div role="status" className={cn(surfaceClass, 'mx-4 mt-1 flex min-h-[52px] shrink-0 items-center justify-between gap-2 rounded-md py-1 pr-1 pl-3')}>
      <span className="flex items-center gap-2 text-[13px] leading-[1.3]">
        <span aria-hidden className="size-2 shrink-0 rounded-pill bg-sand" />
        {detail ? `${t('lighter.bar')} · ${detail}` : t('lighter.bar')}
      </span>
      <button
        type="button"
        disabled={busy}
        className="flex min-h-touch shrink-0 items-center px-2 text-[13px] font-semibold text-ember-text underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground"
        onClick={() => {
          setBusy(true)
          void keepUsual(store, suggestion.date).finally(() => setBusy(false))
        }}
      >
        {t('lighter.back')}
      </button>
    </div>
  )
}
