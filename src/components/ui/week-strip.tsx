import { type T } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Java kalendarike te Sot: shtatë rrathë 34 px. Ditët e stërvitjes së bërë në prush, sot me unazë
// 2 px `ember-text`, pushimet `mark`. Ditët e humbura (V38) kanë unazë të ndërprerë dhe sjellin legjendën poshtë javës. Çdo rreth e thotë ditën dhe gjendjen me fjalë ("E hënë 2,
// e bërë"); prekja e një dite të bërë hap seancën e saj. Në ditë të lodhura rrathët e bërë mbeten
// prush: historia nuk ndryshon ngjyrë.

export type WeekDayState = 'done' | 'rest' | 'planned' | 'missed'

export interface WeekDay {
  key: string
  /** Shkronja sipër rrethit ("H", "Sh"). */
  letter: string
  /** Dita me datën, si në mes të fjalisë ("e hënë 2" / "Monday 2"); fillon me shkronjë të madhe vetë. */
  name: string
  day: number
  state: WeekDayState
  today?: boolean
  onSelect?: () => void
}

function spoken(t: T, day: WeekDay) {
  const name = day.today ? t('ui.week.today', { day: day.name }) : day.name
  const text =
    day.state === 'done'
      ? t('ui.week.done', { day: name })
      : day.state === 'rest'
        ? t('ui.week.rest', { day: name })
        : day.state === 'missed'
          ? t('ui.week.missed', { day: name })
          : t(day.today ? 'ui.week.next' : 'ui.week.planned', { day: name })
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

export function WeekStrip({ days, className }: { days: WeekDay[]; className?: string }) {
  const { t } = useI18n()
  const strip = (
    <ol aria-label={t('ui.week.label')} className={cn('m-0 grid list-none grid-cols-7 gap-1 p-0', className)}>
      {days.map((day) => {
        const label = spoken(t, day)
        const content = (
          <>
            <span aria-hidden className={cn('text-xs leading-[1.2]', day.today ? 'font-bold text-foreground' : 'text-muted-foreground')}>
              {day.letter}
            </span>
            <span
              role={day.onSelect ? undefined : 'img'}
              aria-label={day.onSelect ? undefined : label}
              className={cn(
                'box-border flex size-[34px] items-center justify-center rounded-pill text-sm tabular-nums',
                day.state === 'done' && 'bg-ember font-bold text-on-ember',
                day.state === 'rest' && 'bg-mark text-muted-foreground',
                day.state === 'planned' && 'border-2 border-subtle font-bold text-foreground',
                day.state === 'missed' && 'border-2 border-dashed border-muted-foreground font-bold text-muted-foreground',
                day.today && day.state !== 'done' && 'border-2 border-ember-text',
                day.today && day.state === 'done' && 'outline-2 outline-offset-2 outline-ember-text',
              )}
            >
              {day.day}
            </span>
          </>
        )
        return (
          <li key={day.key} className="flex">
            {day.onSelect ? (
              <button type="button" aria-label={label} onClick={day.onSelect} className="flex min-h-row flex-1 flex-col items-center justify-center gap-1 rounded-md">
                {content}
              </button>
            ) : (
              <div className="flex min-h-row flex-1 flex-col items-center justify-center gap-1">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
  if (!days.some((day) => day.state === 'missed')) return strip
  const legend = [
    { key: 'done', swatch: 'bg-ember' },
    { key: 'missed', swatch: 'border-2 border-dashed border-muted-foreground' },
    { key: 'planned', swatch: 'border-2 border-subtle' },
    { key: 'rest', swatch: 'bg-mark' },
  ] as const
  return (
    <div className="flex flex-col gap-2">
      {strip}
      <div aria-hidden className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {legend.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5">
            <span className={cn('box-border size-3 rounded-pill', item.swatch)} />
            {t(`ui.week.legend.${item.key}`)}
          </span>
        ))}
      </div>
    </div>
  )
}
