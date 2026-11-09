import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { store, useLocalQuery } from '@/data/app-data'
import { dailyStates } from '@/data/daily-state'
import type { ReadinessView } from '@/data/readiness-view'
import { trainedGroups } from '@/data/readiness-view'
import type { TodayView } from '@/data/today'
import { muscleName, nameInSentence } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import type { I18n } from '@/i18n'
import { cn } from '@/lib/cn'
import type { ReadinessPart } from '@/readiness/readiness'
import { capitalize } from './history-format'
import { averagePercent, CHIP_LABEL, chipsOf, dayBars, ENERGY, LEVEL_TONE, lastDays, levelLabel, MOOD, QUALITY, SORENESS } from './readiness-format'

// Fleta "Gati" (V50, V2-E3-05; bordi "Fleta Gati"): përqindja e madhe me nivelin, pesë pjesët (katër në ditë
// pushimi, pa rikuperim) me vlerën me fjalë, pikët dhe peshën, shiritat e 14 ditëve dhe "Ndrysho gjendjen".
// Përqindja vjen nga `readinessView`, rillogaritet çdo herë; 14 ditët marrin vlerën e ruajtur të ditëve të kaluara.

const PART = {
  sleep: 'readiness.part.sleep',
  energy: 'readiness.part.energy',
  recovery: 'readiness.part.recovery',
  soreness: 'readiness.part.soreness',
  mood: 'readiness.part.mood',
} as const
const RECOVERY = { gati: 'readiness.recovery.gati', pothuajse_gati: 'readiness.recovery.pothuajse_gati', i_lodhur: 'readiness.recovery.i_lodhur' } as const

function partValue(i18n: I18n, part: ReadinessPart, view: TodayView, rv: ReadinessView & { state: NonNullable<ReadinessView['state']> }): string {
  const { t, lang } = i18n
  const { state } = rv
  switch (part.key) {
    case 'sleep':
      return t('readiness.sleep.value', { hours: t('checkin.sleep.hours', { count: state.sleepMinutes / 60 }), quality: t(QUALITY[state.sleepQuality - 1]) })
    case 'energy':
      return t(ENERGY[state.energy - 1])
    case 'mood':
      return t(MOOD[state.mood - 1])
    case 'recovery': {
      const group = view.workout?.focus?.group.id
      const status = view.workout?.recovery
      return group && status ? t(RECOVERY[status], { group: muscleName(t, group) }) : t('readiness.recovery.unknown')
    }
    case 'soreness': {
      const level = t(SORENESS[state.soreness])
      if (state.soreness === 0 || state.soreGroups.length === 0) return level
      const groups = chipsOf(state.soreGroups)
        .map((chip) => nameInSentence(t(CHIP_LABEL[chip]), lang))
        .join(', ')
      const today = rv.training ? trainedGroups(view.workout?.primary ?? []) : []
      return t(state.soreGroups.some((group) => today.includes(group)) ? 'readiness.sore.trained' : 'readiness.sore.value', { level, groups })
    }
  }
}

export function ReadinessSheet({ view, rv, onClose, onChange }: { view: TodayView; rv: ReadinessView; onClose: () => void; onChange: () => void }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const stored = useLocalQuery(() => dailyStates(store, lastDays(view.date)), [view.date])
  const { readiness, state } = rv
  if (!readiness || !state) return null
  const percent = readiness.percent
  const level = levelLabel(t, readiness.level)
  const bars = dayBars(view.date, stored ?? new Map(), percent)
  const average = averagePercent(bars)
  const dateLabel = (date: string) => fmt.date(new Date(`${date}T12:00:00`))
  const number = (value: number) => fmt.number(value)

  return (
    <Sheet
      title={t('readiness.sheet.title')}
      description={capitalize(dateLabel(view.date), lang)}
      onClose={onClose}
      footer={
        <Button variant="secondary" size="xl" onClick={onChange}>
          {t('readiness.change')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <section aria-label={t('readiness.sheet.aria', { percent: number(percent), level })} className="flex flex-col gap-2">
          <div aria-hidden className="flex items-baseline gap-3">
            <span className="type-display-hero tabular-nums">{number(percent)}%</span>
            <span className="flex items-center gap-2 text-base font-semibold">
              <span className={cn('size-2 rounded-pill', LEVEL_TONE[readiness.level])} />
              {level}
            </span>
          </div>
          {readiness.level === 'low' ? <p className="type-body text-muted-foreground">{t('readiness.low.line')}</p> : null}
        </section>

        <section aria-labelledby="readiness-parts" className="flex flex-col gap-1">
          <h3 id="readiness-parts" className="type-label text-muted-foreground">
            {t('readiness.parts.title')}
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {readiness.parts.map((part) => (
              <li key={part.key} className="flex min-h-row flex-col gap-1.5 border-b border-border py-2.5 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="type-body-strong">{t(PART[part.key])}</span>
                    <span className="type-caption text-muted-foreground">{partValue(i18n, part, view, { ...rv, state })}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-display text-xl font-bold tabular-nums">{t('readiness.points', { count: Math.round(part.score) })}</span>
                    <span className="type-caption text-muted-foreground tabular-nums">{t('readiness.weight', { percent: number(Math.round(part.weight * 100)) })}</span>
                  </div>
                </div>
                <ProgressTrack ratio={part.score / 100} tone="data" />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="readiness-days" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="readiness-days" className="type-label text-muted-foreground">
              {t('readiness.days.title')}
            </h3>
            <span className="type-caption text-muted-foreground tabular-nums">
              {average === null ? t('readiness.days.none') : t('readiness.days.average', { percent: number(average) })}
            </span>
          </div>
          <ol className="m-0 grid h-28 list-none grid-cols-14 items-end gap-1 p-0">
            {bars.map((bar) => {
              const label =
                bar.percent === null
                  ? t('readiness.day.empty', { date: dateLabel(bar.date) })
                  : bar.today
                    ? t('readiness.day.today', { date: dateLabel(bar.date), percent: number(bar.percent), level })
                    : t('readiness.day.aria', { date: dateLabel(bar.date), percent: number(bar.percent) })
              return (
                <li key={bar.date} aria-label={label} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
                  <span aria-hidden className="text-[11px] leading-none text-muted-foreground tabular-nums">
                    {bar.percent === null ? '—' : number(bar.percent)}
                  </span>
                  <span
                    aria-hidden
                    className={cn('w-full rounded-sm', bar.percent === null ? 'h-0.5 bg-border' : bar.today ? LEVEL_TONE[readiness.level] : 'bg-subtle')}
                    style={bar.percent === null ? undefined : { height: `${Math.max(4, Math.round(bar.percent * 0.6))}px` }}
                  />
                  <span aria-hidden className={cn('text-[11px] leading-none tabular-nums', bar.today ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                    {Number(bar.date.slice(8))}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <p className="type-caption text-muted-foreground">{t('readiness.disclaimer')}</p>
      </div>
    </Sheet>
  )
}
