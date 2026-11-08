import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { WEEK_DAYS } from './week-days'

// Ditët e stërvitjes: shtatë butona 44 px që ndizen e fiken. Gjendja shihet nga kufiri 2 px,
// shkronjat e trasha dhe aria-pressed, jo vetëm nga ngjyra.
export function DayPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: number[]
  onChange: (days: number[]) => void
  labelledBy: string
  describedBy?: string
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
              'h-11 rounded-full text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected
                ? 'border-2 border-foreground bg-selected font-semibold text-foreground'
                : 'border border-input bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            {t(`day.short.${day.value}`)}
          </button>
        )
      })}
    </div>
  )
}
