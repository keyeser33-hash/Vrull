import { useId, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// Vlera me − dhe + (SPEC §14, drejtimi Fokus): butonat 52 px, vlera e madhe që mund edhe të
// shkruhet me tastierë. `row` rri në një rresht me etiketën (seanca); `hero` mban vlerën në
// qendër të ekranit (hapat e parë).

export interface ValueStepperProps {
  label: string
  /** Teksti që shfaqet: "47,5", "12", "18:00". Bosh kur s'ka ende vlerë. */
  text: string
  unit?: string
  placeholder?: string
  inputMode: 'decimal' | 'numeric'
  minusLabel: string
  plusLabel: string
  onMinus: () => void
  onPlus: () => void
  /** Teksti i shkruar me tastierë; vlera e pavlefshme nuk ndryshon asgjë. */
  onCommit: (text: string) => void
  variant?: 'row' | 'hero'
  invalid?: boolean
  describedBy?: string
}

export function ValueStepper({
  label,
  text,
  unit,
  placeholder,
  inputMode,
  minusLabel,
  plusLabel,
  onMinus,
  onPlus,
  onCommit,
  variant = 'row',
  invalid,
  describedBy,
}: ValueStepperProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()
  const shown = draft ?? text
  const hero = variant === 'hero'

  const commit = () => {
    if (draft === null) return
    onCommit(draft)
    setDraft(null)
  }

  const button = (name: 'hiq' | 'shto', aria: string, onClick: () => void) => (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      className="flex size-[52px] shrink-0 items-center justify-center rounded-full border border-input text-foreground hover:bg-accent"
    >
      <Icon name={name} size={28} />
    </button>
  )

  const input = (
    <span className="flex min-w-0 items-baseline justify-center">
      <input
        id={id}
        inputMode={inputMode}
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onFocus={(event) => {
          setDraft(text)
          event.currentTarget.select()
        }}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
            event.currentTarget.blur()
          }
        }}
        className={cn(
          'h-11 min-w-0 bg-transparent font-bold outline-none placeholder:text-muted-foreground',
          hero ? 'h-16 text-center text-5xl leading-[52px] tracking-[-0.03em]' : 'text-right text-3xl leading-9 tracking-[-0.025em]',
          invalid && 'text-destructive',
        )}
        style={{ width: `${Math.max(2, (shown || placeholder || '').length) + 0.5}ch` }}
      />
      {unit ? <span className={cn('ml-1 font-medium text-muted-foreground', hero ? 'text-lg' : 'text-sm')}>{unit}</span> : null}
    </span>
  )

  if (hero) {
    return (
      <div className="flex flex-col items-center gap-3 tabular-nums">
        <label htmlFor={id} className="text-sm leading-5 font-medium text-muted-foreground">
          {label}
        </label>
        <div className="flex w-full items-center justify-between gap-3">
          {button('hiq', minusLabel, onMinus)}
          {input}
          {button('shto', plusLabel, onPlus)}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_52px_minmax(0,112px)_52px] items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-1.5 pl-5 tabular-nums">
      <label htmlFor={id} className="text-sm leading-5 text-muted-foreground">
        {label}
      </label>
      {button('hiq', minusLabel, onMinus)}
      {input}
      {button('shto', plusLabel, onPlus)}
    </div>
  )
}
