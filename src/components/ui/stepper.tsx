import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './button'

// Stepper-i i Vrullit: pesha dhe përsëritjet e setit që po regjistrohet, si tabelë rezultatesh. Dy
// numra `display-hero`, × `subtle` dhe katër butona 52 px poshtë. Numri që ndryshoi i fundit merr
// `ember-text`. Vlerat vijnë të formatuara nga ekrani (gjuha, presja dhjetore); hapi i peshës
// varet nga pajisja (2,5 kg shufër, 2 kg dumbbell).

type Part = 'weight' | 'reps'

export interface StepperProps {
  /** Pesha e formatuar ("62,5"). */
  weight: string
  /** Përsëritjet e formatuara ("9"). */
  reps: string
  /** Hapi i peshës, i formatuar ("2,5"). */
  weightStep: string
  onWeightStep: (direction: -1 | 1) => void
  onRepsStep: (direction: -1 | 1) => void
  /** Prekja e numrit hap tastierën numerike; ekrani vendos si. */
  onEditWeight?: () => void
  onEditReps?: () => void
  weightUnit?: string
  repsUnit?: string
  /** Para vlerave te lexuesi i ekranit ("Seti 1"). */
  label?: string
  /** Numri që ndryshoi i fundit. Pa të, komponenti e mban vetë sipas butonave. */
  live?: Part | null
  canLowerWeight?: boolean
  canLowerReps?: boolean
  className?: string
}

export function Stepper({
  weight,
  reps,
  weightStep,
  onWeightStep,
  onRepsStep,
  onEditWeight,
  onEditReps,
  weightUnit = 'kg',
  repsUnit = 'përsëritje',
  label,
  live,
  canLowerWeight = true,
  canLowerReps = true,
  className,
}: StepperProps) {
  const [changed, setChanged] = useState<Part | null>(null)
  const current = live !== undefined ? live : changed
  const summary = `${weight} ${weightUnit}, ${reps} ${repsUnit}`
  const step = (part: Part, direction: -1 | 1) => {
    setChanged(part)
    if (part === 'weight') onWeightStep(direction)
    else onRepsStep(direction)
  }

  return (
    <div role="group" aria-label={label ? `${label}: ${summary}` : summary} className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-end justify-center gap-4">
        <BigNumber text={weight} unit={weightUnit} live={current === 'weight'} onEdit={onEditWeight} editLabel={`Shkruaj peshën, ${weight} ${weightUnit}`} />
        <span aria-hidden className="pb-[26px] font-display text-[56px] leading-none font-bold text-subtle">
          ×
        </span>
        <BigNumber text={reps} unit={repsUnit} live={current === 'reps'} onEdit={onEditReps} editLabel={`Shkruaj përsëritjet, ${reps}`} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StepKey label={`Ul peshën me ${weightStep} ${weightUnit}`} disabled={!canLowerWeight} onClick={() => step('weight', -1)}>
          −{weightStep}
        </StepKey>
        <StepKey label={`Rrit peshën me ${weightStep} ${weightUnit}`} onClick={() => step('weight', 1)}>
          +{weightStep}
        </StepKey>
        <StepKey label="Ul përsëritjet" disabled={!canLowerReps} onClick={() => step('reps', -1)}>
          −1
        </StepKey>
        <StepKey label="Rrit përsëritjet" onClick={() => step('reps', 1)}>
          +1
        </StepKey>
      </div>
    </div>
  )
}

function BigNumber({ text, unit, live, onEdit, editLabel }: { text: string; unit: string; live: boolean; onEdit?: () => void; editLabel: string }) {
  const number = <span className={cn('type-display-hero', live ? 'text-ember-text' : 'text-foreground')}>{text}</span>
  return (
    <div className="flex flex-col items-center gap-1">
      {onEdit ? (
        <button type="button" aria-label={editLabel} onClick={onEdit} className="min-h-touch rounded-md">
          {number}
        </button>
      ) : (
        <span aria-hidden>{number}</span>
      )}
      <span aria-hidden className="type-body text-muted-foreground">
        {unit}
      </span>
    </div>
  )
}

function StepKey({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant="secondary"
      ground="page"
      size="lg"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="px-0 text-xl tabular-nums"
    >
      {children}
    </Button>
  )
}
