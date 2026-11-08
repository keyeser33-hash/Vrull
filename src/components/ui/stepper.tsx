import { type ReactNode, useState } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { Button } from './button'

// Stepper-i i Vrullit: pesha dhe përsëritjet e setit që po regjistrohet, si tabelë rezultatesh. Dy
// numra `display-hero`, × `subtle` dhe katër butona 52 px poshtë. Numri që ndryshoi i fundit merr
// `ember-text`. Numrat formatohen sipas gjuhës (62,5 / 62.5); hapi i peshës varet nga pajisja
// (2,5 kg shufër, 2 kg dumbbell). Lexuesi i ekranit dëgjon "Seti 1: 62,5 kg, 9 përsëritje".

type Part = 'weight' | 'reps'

export interface StepperProps {
  /** Pesha në kg. */
  weight: number
  reps: number
  /** Hapi i peshës në kg. */
  weightStep: number
  onWeightStep: (direction: -1 | 1) => void
  onRepsStep: (direction: -1 | 1) => void
  /** Prekja e numrit hap tastierën numerike; ekrani vendos si. */
  onEditWeight?: () => void
  onEditReps?: () => void
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
  label,
  live,
  canLowerWeight = true,
  canLowerReps = true,
  className,
}: StepperProps) {
  const { t, fmt } = useI18n()
  const [changed, setChanged] = useState<Part | null>(null)
  const current = live !== undefined ? live : changed
  const summary = t('ui.stepper.summary', { weight, count: reps })
  const step = fmt.number(weightStep)
  const press = (part: Part, direction: -1 | 1) => {
    setChanged(part)
    if (part === 'weight') onWeightStep(direction)
    else onRepsStep(direction)
  }

  return (
    <div role="group" aria-label={label ? t('ui.stepper.labelled', { label, summary }) : summary} className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-end justify-center gap-4">
        <BigNumber text={fmt.number(weight)} unit="kg" live={current === 'weight'} onEdit={onEditWeight} editLabel={t('ui.stepper.editWeight', { weight })} />
        <span aria-hidden className="pb-[26px] font-display text-[56px] leading-none font-bold text-subtle">
          ×
        </span>
        <BigNumber
          text={fmt.number(reps)}
          unit={t('ui.stepper.repsUnit', { count: reps })}
          live={current === 'reps'}
          onEdit={onEditReps}
          editLabel={t('ui.stepper.editReps', { reps })}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StepKey label={t('ui.stepper.lowerWeight', { step: weightStep })} disabled={!canLowerWeight} onClick={() => press('weight', -1)}>
          −{step}
        </StepKey>
        <StepKey label={t('ui.stepper.raiseWeight', { step: weightStep })} onClick={() => press('weight', 1)}>
          +{step}
        </StepKey>
        <StepKey label={t('ui.stepper.lowerReps')} disabled={!canLowerReps} onClick={() => press('reps', -1)}>
          −1
        </StepKey>
        <StepKey label={t('ui.stepper.raiseReps')} onClick={() => press('reps', 1)}>
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
