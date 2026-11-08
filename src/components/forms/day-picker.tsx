import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { WEEK_DAYS } from './week-days'

// Ditët e stërvitjes (bordi "Hyrja · Ditët dhe oraret"): shtatë segmente 52 px që ndizen e fiken.
// E zgjedhura në bojë të plotë (`foreground` mbi `background`), si çipat e Vrullit, jo në prush;
// gjendja e thotë edhe aria-pressed, dhe emri i plotë i ditës është për lexuesin e ekranit.
export function DayPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
  dayLabel,
}: {
  value: number[]
  onChange: (days: number[]) => void
  labelledBy: string
  describedBy?: string
  /** Teksti i butonit për ditën ISO (1 = e hënë); parazgjedhja "Hën", hapat e parë japin shkronjën. */
  dayLabel?: (day: number) => string
}) {
  const { t } = useI18n()
  function toggle(day: number) {
    const next = value.includes(day) ? value.filter((item) => item !== day) : [...value, day]
    onChange(next.sort((a, b) => a - b))
  }
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="grid grid-cols-7 gap-1.5">
      {WEEK_DAYS.map((day) => {
        const selected = value.includes(day.value)
        return (
          <button
            key={day.value}
            type="button"
            aria-pressed={selected}
            aria-label={t(`day.${day.value}`)}
            onClick={() => toggle(day.value)}
            className={cn(
              'h-button min-w-0 rounded-md border px-0 font-display text-xl font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
              selected ? 'border-foreground bg-foreground text-background' : 'border-subtle bg-surface text-muted-foreground',
            )}
          >
            {dayLabel ? dayLabel(day.value) : t(`day.short.${day.value}`)}
          </button>
        )
      })}
    </div>
  )
}
