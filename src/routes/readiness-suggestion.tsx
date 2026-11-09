import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { surfaceClass } from '@/components/ui/surface'
import { store } from '@/data/app-data'
import { chooseLighter, keepUsual, postponeWorkout, undoPostpone } from '@/data/day-choice'
import type { TodayView } from '@/data/today'
import { programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { capitalize } from './history-format'
import { kcalText } from './nutrition-format'
import { type Suggestion, useSuggestion } from './readiness-suggestion-state'
import { costText, whyText } from './readiness-suggestion-text'

// Karta e sugjerimit te Sot kur gatishmëria është e ulët, dhe stërvitja e shtyrë (V50, V2-E3-06; bordet
// "Sot · Gatishmëria e ulët", "Sot · Stërvitja shtyhet për nesër"). E njëjta kartë del edhe në krye të seancës,
// para setit të parë, kur vendimi s'është marrë (`session-lighter.tsx`). Logjika e fjalëve: readiness/lighter-session.ts.

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

function useAction() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setFailed(false)
    try {
      await action()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return { busy, failed, run }
}

/** Ikona e matësit (bordi): hark me akrep, në ngjyrën e prushit si tekst. */
function Gauge() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-ember-text">
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l-2.5-4.5" />
    </svg>
  )
}

/**
 * "Sot më lehtë?": pse, "Seanca më e lehtë" (veprimi kryesor, rërë), "Shtyje për nesër" (dytësor), "Jo sot" si
 * lidhje, dhe "Programi nuk ndryshon.". `postpone` mungon kur nuk vlen (seanca ka nisur).
 */
export function SuggestionCard({ suggestion, className }: { suggestion: Suggestion; className?: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const { busy, failed, run } = useAction()
  const cost = costText(i18n, suggestion.cost)
  const date = suggestion.date
  return (
    <section aria-label={t('lighter.card')} className={cn(surfaceClass, 'flex shrink-0 flex-col gap-3.5 rounded-xl p-4', className)}>
      <div className="flex items-start gap-3">
        <Gauge />
        <p className="type-body-l">
          <strong className="font-bold">{t('lighter.question')}</strong> {whyText(i18n, suggestion.reasons)}
        </p>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('lighter.failed')}
        </p>
      ) : null}
      <Button variant="primary" tired size="lg" className="h-auto min-h-16 w-full flex-col gap-0.5 py-2" disabled={busy} onClick={() => void run(() => chooseLighter(store, date))}>
        <span>{t('lighter.title')}</span>
        {cost ? <span className="font-sans text-[13px] leading-[1.2] font-semibold tracking-normal normal-case tabular-nums">{cost}</span> : null}
      </Button>
      <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={() => void run(() => postponeWorkout(store, date))}>
        {t('lighter.postpone')}
      </Button>
      <div className="flex flex-col items-center">
        <Button variant="ghost" className="font-sans text-[15px] font-semibold tracking-normal normal-case underline underline-offset-[3px]" disabled={busy} onClick={() => void run(() => keepUsual(store, date))}>
          {t('lighter.skip')}
        </Button>
        <span className="type-caption text-muted-foreground">{t('lighter.unchanged')}</span>
      </div>
    </section>
  )
}

/** "Ditë pushimi sot": stërvitja kalon nesër; "Ktheje për sot" vlen deri në setin e parë. */
function PostponedCard({ view, suggestion }: { view: TodayView; suggestion: Suggestion }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const { busy, failed, run } = useAction()
  const plan = view.snapshot?.plan
  if (!plan) return null
  const tomorrow = atNoon(view.nextDate ?? view.date)
  const date = `${fmt.weekday(tomorrow)} ${fmt.date(tomorrow, { weekday: false })}`
  return (
    <section aria-labelledby="lighter-postponed" className={cn(surfaceClass, 'flex shrink-0 flex-col gap-2 rounded-xl p-4')}>
      <span className="type-caption text-muted-foreground">{t('lighter.postponed.eyebrow')}</span>
      <h2 id="lighter-postponed" className="type-display-s">
        {t('lighter.postponed.title')}
      </h2>
      <p className="type-body">{t('lighter.postponed.text', { number: plan.dayNumber, day: capitalize(programDayName(t, plan.dayName), lang), date })}</p>
      {view.food.targetKcal !== null ? <p className="type-body">{t('lighter.postponed.food', { kcal: kcalText(i18n, view.food.targetKcal) })}</p> : null}
      <span className="type-caption text-muted-foreground">{t('lighter.postponed.pace')}</span>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('lighter.failed')}
        </p>
      ) : null}
      <Button variant="outline" size="lg" className="mt-2 w-full border-ember-text text-ember-text" disabled={busy} onClick={() => void run(() => undoPostpone(store, suggestion.date))}>
        {t('lighter.postponed.undo')}
      </Button>
      <span className="text-center type-caption text-muted-foreground">{t('lighter.postponed.until')}</span>
    </section>
  )
}

/** Vendi i sugjerimit te Sot (nën "Gati"): karta "Sot më lehtë?" ose stërvitja e shtyrë; përndryshe asgjë. */
export function ReadinessSuggestion({ view }: { view: TodayView }) {
  const suggestion = useSuggestion(view)
  if (suggestion?.kind === 'suggest') return <SuggestionCard suggestion={suggestion} />
  if (suggestion?.kind === 'postponed') return <PostponedCard view={view} suggestion={suggestion} />
  return null
}
