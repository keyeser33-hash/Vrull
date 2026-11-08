import { cn } from '@/lib/cn'

// Zgjedhja e RIR-it për setin: pesë çipa 44 px. I zgjedhuri në bojë të plotë (`foreground` mbi
// `background`), jo në prush: prushi mbetet për "Ruaj setin". Parazgjedhja vjen nga receta e slotit.

const VALUES = [0, 1, 2, 3, 4] as const

export function RirPicker({
  value,
  onChange,
  legend = 'Sa të kishin mbetur (RIR)',
  className,
}: {
  value: number | null
  onChange: (value: number) => void
  legend?: string
  className?: string
}) {
  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className="mb-2 p-0 type-caption text-muted-foreground">{legend}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {VALUES.map((option) => {
          const selected = value === option
          const last = option === VALUES[VALUES.length - 1]
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={last ? `${option} ose më shumë` : undefined}
              onClick={() => onChange(option)}
              className={cn(
                'h-touch rounded-md border font-display text-xl font-bold tabular-nums',
                selected ? 'border-foreground bg-foreground text-background' : 'border-surface-border bg-surface text-foreground',
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
