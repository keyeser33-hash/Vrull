import { cn } from '@/lib/cn'

// Java kalendarike te Sot: shtatë rrathë 34 px. Ditët e stërvitjes së bërë në prush, sot me unazë
// 2 px `ember-text`, pushimet `mark`. Çdo rreth e thotë ditën dhe gjendjen me fjalë ("E hënë 2,
// e bërë"); prekja e një dite të bërë hap seancën e saj. Në ditë të lodhura rrathët e bërë mbeten
// prush: historia nuk ndryshon ngjyrë.

export type WeekDayState = 'done' | 'rest' | 'planned'

export interface WeekDay {
  key: string
  /** Shkronja sipër rrethit ("H", "Sh"). */
  letter: string
  /** Emri i plotë me datën, për lexuesin e ekranit ("E hënë 2"). */
  name: string
  day: number
  state: WeekDayState
  today?: boolean
  onSelect?: () => void
}

const STATE_TEXT: Record<WeekDayState, string> = {
  done: 'e bërë',
  rest: 'pushim',
  planned: 'stërvitje',
}

function spoken(day: WeekDay) {
  const state = day.today && day.state === 'planned' ? 'stërvitja e radhës' : STATE_TEXT[day.state]
  const name = day.today ? `Sot, ${day.name.charAt(0).toLowerCase()}${day.name.slice(1)}` : day.name
  return `${name}, ${state}`
}

export function WeekStrip({ days, label = 'Java', className }: { days: WeekDay[]; label?: string; className?: string }) {
  return (
    <ol aria-label={label} className={cn('m-0 grid list-none grid-cols-7 gap-1 p-0', className)}>
      {days.map((day) => {
        const content = (
          <>
            <span aria-hidden className={cn('text-xs leading-[1.2]', day.today ? 'font-bold text-foreground' : 'text-muted-foreground')}>
              {day.letter}
            </span>
            <span
              role={day.onSelect ? undefined : 'img'}
              aria-label={day.onSelect ? undefined : spoken(day)}
              className={cn(
                'box-border flex size-[34px] items-center justify-center rounded-pill text-sm tabular-nums',
                day.state === 'done' && 'bg-ember font-bold text-on-ember',
                day.state === 'rest' && 'bg-mark text-muted-foreground',
                day.state === 'planned' && 'font-bold text-foreground',
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
              <button
                type="button"
                aria-label={spoken(day)}
                onClick={day.onSelect}
                className="flex min-h-row flex-1 flex-col items-center justify-center gap-1 rounded-md"
              >
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
}
