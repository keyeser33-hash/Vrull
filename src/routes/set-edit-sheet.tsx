import { type FormEvent, useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { RirPicker } from '@/components/ui/rir-picker'
import { Stepper } from '@/components/ui/stepper'
import { store } from '@/data/app-data'
import { editSet } from '@/data/history'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { HistorySet } from '@/program/loads'
import { previewEdit } from '@/progress/history'

// Fleta "Ndrysho setin" (V2-E1-15): pesha, përsëritjet dhe RIR-i i një seti të ruajtur, me parapamjen
// e e1RM-së dhe të rekordit. E hapin seanca e kaluar te historiku dhe, që nga 0.41, tabela e seteve te seanca
// e hapur, pushimi dhe "Kontrollo setet". Ruajtja shkon te `editSet` (në telefon së pari, pastaj sinkronizimi).

const MAX_WEIGHT = 500
const MAX_REPS = 200
const roundWeight = (value: number) => Math.round(value * 100) / 100

/** Seti që ndryshohet: vlerat e ruajtura dhe nëse ishte rekord në kohën e vet. */
export interface EditableSet {
  id: string
  setNumber: number
  weightKg: number | null
  reps: number | null
  rir: number | null
  record: boolean
}

export function EditSetSheet({
  set,
  description,
  step,
  showRir,
  history,
  onClose,
}: {
  set: EditableSet
  /** "Bench Press · e diel, 8 nëntor" te historiku; emri i ushtrimit te seanca. */
  description: string
  /** Hapi i peshës së pajisjes (`weightStep`). */
  step: number
  /** RIR-i zgjidhet kur seti e ka, ose kur receta e kërkon. */
  showRir: boolean
  /** Historia e të gjitha seteve, për parapamjen e ndryshimit. */
  history: HistorySet[]
  onClose: () => void
}) {
  const { t, fmt } = useI18n()
  const [weight, setWeight] = useState(set.weightKg ?? 0)
  const [reps, setReps] = useState(set.reps ?? 1)
  const [rir, setRir] = useState<number | null>(set.rir)
  const [typing, setTyping] = useState<'weight' | 'reps' | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // Pa peshë mbetet pa peshë, derisa përdoruesi të vendosë një.
  const weightKg = set.weightKg === null && weight === 0 ? null : weight
  const changed = weightKg !== set.weightKg || reps !== set.reps || rir !== set.rir
  const preview = previewEdit(history, set.id, { weightKg, reps, rir })
  const value = preview.e1rmKg === null ? null : fmt.unit(preview.e1rmKg, 'kg', { minDigits: 1, maxDigits: 1 })
  const previewText =
    value === null
      ? t('history.edit.noE1rm')
      : preview.record
        ? t('history.edit.previewRecord', { value, gain: `+${fmt.unit(preview.record.gainKg, 'kg', { minDigits: 1, maxDigits: 1 })}` })
        : `${t('history.edit.preview', { value })}${set.record ? ` · ${t('history.edit.loseRecord')}` : ''}`

  async function save() {
    setBusy(true)
    setFailed(false)
    try {
      await editSet(store, set.id, { weightKg, reps, rir })
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={t('history.edit.title', { n: set.setNumber })}
      description={description}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" disabled={!changed || busy} onClick={() => void save()}>
          {t('history.edit.save')}
        </Button>
      }
    >
      <Stepper
        label={t('history.setN', { n: set.setNumber })}
        weight={weight}
        reps={reps}
        weightStep={step}
        canLowerWeight={weight > 0}
        canLowerReps={reps > 1}
        onWeightStep={(direction) => setWeight((current) => Math.min(MAX_WEIGHT, Math.max(0, roundWeight(current + direction * step))))}
        onRepsStep={(direction) => setReps((current) => Math.min(MAX_REPS, Math.max(1, current + direction)))}
        onEditWeight={() => setTyping('weight')}
        onEditReps={() => setTyping('reps')}
      />
      {typing ? (
        <TypeValue
          key={typing}
          kind={typing}
          initial={typing === 'weight' ? fmt.number(weight) : String(reps)}
          onApply={(next) => {
            if (typing === 'weight') setWeight(next)
            else setReps(next)
            setTyping(null)
          }}
        />
      ) : null}
      {showRir ? <RirPicker value={rir} onChange={setRir} /> : null}
      <p aria-live="polite" className="type-body text-muted-foreground tabular-nums">
        {previewText}
      </p>
      {failed ? (
        <p role="alert" className="type-caption text-danger">
          {t('history.edit.failed')}
        </p>
      ) : null}
    </Sheet>
  )
}

/** Prekja e numrit te stepper-i: pesha ose përsëritjet me tastierën numerike. */
function TypeValue({ kind, initial, onApply }: { kind: 'weight' | 'reps'; initial: string; onApply: (value: number) => void }) {
  const { t, fmt } = useI18n()
  const id = useId()
  const [text, setText] = useState(initial.replace(/\s/g, ''))
  const [error, setError] = useState<string | null>(null)
  function apply(event: FormEvent) {
    event.preventDefault()
    const normalized = text.trim().replace(',', '.')
    const value = Number(normalized)
    const ok =
      kind === 'weight'
        ? /^\d{1,3}(\.\d{1,2})?$/.test(normalized) && value <= MAX_WEIGHT
        : /^\d{1,3}$/.test(normalized) && value >= 1 && value <= MAX_REPS
    if (!ok) {
      setError(kind === 'weight' ? t('history.edit.invalidWeight', { max: MAX_WEIGHT, example: fmt.number(62.5) }) : t('history.edit.invalidReps', { max: MAX_REPS }))
      return
    }
    onApply(value)
  }
  return (
    <form onSubmit={apply} noValidate className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-caption font-medium">
        {kind === 'weight' ? t('history.edit.weight') : t('history.edit.reps')}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          autoFocus
          inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.currentTarget.value)
            setError(null)
          }}
          className={cn(inputClass, 'min-w-0 flex-1')}
        />
        <Button type="submit" variant="secondary" ground="card" className="h-auto min-h-touch">
          {t('history.edit.apply')}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="type-caption text-danger">
          {error}
        </p>
      ) : null}
    </form>
  )
}
