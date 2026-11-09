import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { surfaceClass } from '@/components/ui/surface'
import { store } from '@/data/app-data'
import { answerMissedDay } from '@/data/missed-day'
import type { TodayView } from '@/data/today'
import { missedNo, nameInSentence, programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { kcalText } from './nutrition-format'
import { capitalize } from './history-format'

// Dita e humbur (V38, V2-E2-09, bordi "Sot · Dita e humbur"): dje ishte ditë stërvitjeje pa seancë
// dhe sot është pushim. "Po" e bën sot ditë stërvitjeje me atë stërvitje; "Jo" e lë për ditën tjetër
// të stërvitjes. Deri sa të zgjedhë, sot mbetet pushim.

const atNoon = (date: string) => new Date(`${date}T12:00:00`)
const weekdayOf = (date: string) => atNoon(date).getDay() || 7

export function MissedDayCard({ view, className }: { view: TodayView; className?: string }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const { missed } = view
  const plan = view.snapshot?.plan
  if (!missed || !plan) return null
  const label = fmt.date(atNoon(missed.date))

  async function answer(train: boolean) {
    setBusy(true)
    setFailed(false)
    try {
      await answerMissedDay(store, train)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="missed-day" className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-4', className)}>
      <span className="type-label text-data">{capitalize(label, lang)}</span>
      <h2 id="missed-day" className="type-display-s">
        {t('today.missed.title')}
      </h2>
      <p className="text-[15px] leading-[1.45]">{t('today.missed.text', { number: plan.dayNumber, day: nameInSentence(programDayName(t, plan.dayName), lang) })}</p>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('today.missed.failed')}
        </p>
      ) : null}
      <div className="mt-1 flex flex-col gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void answer(true)}>
          {t('today.missed.yes', { time: missed.time })}
        </Button>
        <Button variant="outline" size="lg" disabled={busy} onClick={() => void answer(false)}>
          {missedNo(t, view.nextDate ? weekdayOf(view.nextDate) : null)}
        </Button>
      </div>
      <p className="text-[13px] leading-[1.4] text-muted-foreground">
        {missed.trainingKcal === null ? t('today.missed.noteNoKcal') : t('today.missed.note', { kcal: kcalText(i18n, missed.trainingKcal) })}{' '}
        {t('today.missed.restNote')}
      </p>
    </section>
  )
}
