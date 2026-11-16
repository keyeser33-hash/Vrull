import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Zgjedhja e RIR-it për setin: pesë çipa 44 px. I zgjedhuri në bojë të plotë (`foreground` mbi
// `background`), jo në prush: prushi mbetet për "Ruaj setin". Parazgjedhja vjen nga receta e slotit.

const VALUES = [0, 1, 2, 3, 4] as const

export function RirPicker({
  value,
  onChange,
  ground = 'page',
  className,
}: {
  value: number | null
  onChange: (value: number) => void
  /** Çipat e pazgjedhur: `surface` mbi faqe, `surface-2` brenda kartës (rreshti aktiv i seancës). */
  ground?: 'page' | 'card'
  className?: string
}) {
  const { t } = useI18n()
  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className="mb-2 p-0 type-caption text-muted-foreground">{t('ui.rir.legend')}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {VALUES.map((option) => {
          const selected = value === option
          const last = option === VALUES[VALUES.length - 1]
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={last ? t('ui.rir.orMore', { value: option }) : undefined}
              onClick={() => onChange(option)}
              className={cn(
                'h-touch rounded-md border font-display text-xl font-bold tabular-nums',
                selected ? 'border-foreground bg-foreground text-background' : cn('border-surface-border text-foreground', ground === 'card' ? 'bg-surface-2' : 'bg-surface'),
              )}
            >
              {last ? `${option}+` : option}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
