import { type ReactNode, useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import type { Prescription } from '@/program/types'
import { cn } from '@/lib/cn'
import {
  PRESCRIPTION_TYPES,
  type PercentRow,
  type PrescriptionDraft,
  prescriptionDraft,
  prescriptionFromDraft,
  type RangeRow,
} from './prescription-form'

// Receta e një ushtrimi në editor (SPEC §4): lloji dhe fushat e tij. Javët e intervaleve dhe të
// përqindjeve janë rreshta që shtohen e hiqen; java 5 përdor rreshtin e parë përsëri.

const cellClass = cn(inputClass, 'px-2.5 text-center')

function NumberField({ label, value, onChange, decimal = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; decimal?: boolean; placeholder?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <input id={id} inputMode={decimal ? 'decimal' : 'numeric'} autoComplete="off" placeholder={placeholder} value={value} onChange={(event) => onChange(event.currentTarget.value)} className={inputClass} />
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex size-11 cursor-pointer items-center justify-center">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="size-5 accent-current" />
    </label>
  )
}

/** Tabela e javëve: kolonat me titull sipër, një rresht për javë, heqja në fund. */
function WeekTable<Row>({
  headers,
  rows,
  render,
  onAdd,
  onRemove,
}: {
  headers: [string, string, string]
  rows: Row[]
  render: (row: Row, index: number) => ReactNode
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  const grid = 'grid grid-cols-[2rem_1fr_1fr_2.75rem_2.75rem] items-center gap-2'
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className={cn(grid, 'text-xs leading-4 font-medium text-muted-foreground')}>
        <span />
        {headers.map((header) => (
          <span key={header} className="text-center">
            {header}
          </span>
        ))}
        <span />
      </div>
      {rows.map((row, index) => (
        <div key={index} className={grid}>
          <span className="text-sm leading-5 text-muted-foreground tabular-nums">J{index + 1}</span>
          {render(row, index)}
          <Button variant="ghost" size="icon" aria-label={`Hiq javën ${index + 1}`} disabled={rows.length === 1} onClick={() => onRemove(index)}>
            <Icon name="fshi" size={20} />
          </Button>
        </div>
      ))}
      <Button variant="outline" disabled={rows.length >= 12} onClick={onAdd}>
        <Icon name="shto" size={20} />
        Shto javë
      </Button>
    </div>
  )
}

export function PrescriptionSheet({
  scopeText,
  initial,
  onSave,
  onClear,
  onClose,
}: {
  scopeText: string
  initial: Prescription | undefined | null
  onSave: (prescription: Prescription) => Promise<void>
  onClear?: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PrescriptionDraft>(() => prescriptionDraft(initial))
  const [problem, setProblem] = useState<string | null>(null)
  const typeId = useId()
  const hintId = useId()
  const change = (next: Partial<PrescriptionDraft>) => {
    setDraft((current) => ({ ...current, ...next }))
    setProblem(null)
  }
  const setLadder = (index: number, row: Partial<RangeRow>) => change({ ladder: draft.ladder.map((current, at) => (at === index ? { ...current, ...row } : current)) })
  const setWeek = (index: number, row: Partial<PercentRow>) => change({ weeks: draft.weeks.map((current, at) => (at === index ? { ...current, ...row } : current)) })

  function save() {
    const result = prescriptionFromDraft(draft)
    if (!result.ok) {
      setProblem(result.error)
      return
    }
    void onSave(result.value)
  }

  return (
    <Sheet title="Receta" onClose={onClose}>
      <p className="text-sm leading-5 text-muted-foreground">Ndryshimi vlen {scopeText.charAt(0).toLowerCase() + scopeText.slice(1)}.</p>
      <label htmlFor={typeId} className="text-sm leading-5 font-medium">
        Lloji
      </label>
      <select id={typeId} value={draft.type} aria-describedby={hintId} onChange={(event) => change({ type: event.currentTarget.value as PrescriptionDraft['type'] })} className={inputClass}>
        {PRESCRIPTION_TYPES.map((option) => (
          <option key={option.type} value={option.type}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={hintId} className="-mt-1 text-sm leading-5 text-muted-foreground">
        {PRESCRIPTION_TYPES.find((option) => option.type === draft.type)?.hint}
      </p>

      {draft.type === 'rep_ladder' ? (
        <>
          <WeekTable
            headers={['Min', 'Max', 'Dështim']}
            rows={draft.ladder}
            onAdd={() => change({ ladder: [...draft.ladder, { ...(draft.ladder.at(-1) ?? { min: '8', max: '12', beyond: false }) }] })}
            onRemove={(index) => change({ ladder: draft.ladder.filter((_, at) => at !== index) })}
            render={(row, index) => (
              <>
                <input aria-label={`Java ${index + 1}, minimumi`} inputMode="numeric" value={row.min} onChange={(event) => setLadder(index, { min: event.currentTarget.value })} className={cellClass} />
                <input aria-label={`Java ${index + 1}, maksimumi`} inputMode="numeric" placeholder="pa kufi" value={row.max} onChange={(event) => setLadder(index, { max: event.currentTarget.value })} className={cellClass} />
                <Check label={`Java ${index + 1}, deri në dështim nëse mund më shumë`} checked={row.beyond} onChange={(beyond) => setLadder(index, { beyond })} />
              </>
            )}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm leading-5 font-semibold">Shtesa e peshës mes blloqeve</legend>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Min, kg" decimal value={draft.increaseMin} onChange={(increaseMin) => change({ increaseMin })} placeholder="pa shtesë" />
              <NumberField label="Max, kg" decimal value={draft.increaseMax} onChange={(increaseMax) => change({ increaseMax })} placeholder="pa shtesë" />
            </div>
          </fieldset>
        </>
      ) : null}

      {draft.type === 'timed' ? <NumberField label="Sekonda për set" value={draft.seconds} onChange={(seconds) => change({ seconds })} /> : null}

      {draft.type === 'percent_1rm' ? (
        <WeekTable
          headers={['% 1RM', 'Përsëritje', 'AMRAP']}
          rows={draft.weeks}
          onAdd={() => change({ weeks: [...draft.weeks, { ...(draft.weeks.at(-1) ?? { percent: '75', reps: '5', amrap: false }) }] })}
          onRemove={(index) => change({ weeks: draft.weeks.filter((_, at) => at !== index) })}
          render={(row, index) => (
            <>
              <input aria-label={`Java ${index + 1}, përqindja e 1RM`} inputMode="decimal" value={row.percent} onChange={(event) => setWeek(index, { percent: event.currentTarget.value })} className={cellClass} />
              <input aria-label={`Java ${index + 1}, përsëritjet`} inputMode="numeric" value={row.reps} onChange={(event) => setWeek(index, { reps: event.currentTarget.value })} className={cellClass} />
              <Check label={`Java ${index + 1}, seti i fundit sa më shumë përsëritje`} checked={row.amrap} onChange={(amrap) => setWeek(index, { amrap })} />
            </>
          )}
        />
      ) : null}

      {draft.type === 'linear' ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Pesha e nisjes, kg" decimal value={draft.startKg} onChange={(startKg) => change({ startKg })} />
          <NumberField label="Shtesa, kg" decimal value={draft.incrementKg} onChange={(incrementKg) => change({ incrementKg })} />
          <NumberField label="Përsëritje" value={draft.linearReps} onChange={(linearReps) => change({ linearReps })} />
          <NumberField label="Dështime para uljes" value={draft.failures} onChange={(failures) => change({ failures })} />
          <NumberField label="Ulja, %" decimal value={draft.deloadPercent} onChange={(deloadPercent) => change({ deloadPercent })} />
        </div>
      ) : null}

      {draft.type === 'rpe' || draft.type === 'rir' ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Përsëritje, min" value={draft.repsMin} onChange={(repsMin) => change({ repsMin })} />
          <NumberField label="Përsëritje, max" value={draft.repsMax} onChange={(repsMax) => change({ repsMax })} placeholder="pa kufi" />
          {draft.type === 'rpe' ? (
            <NumberField label="RPE" decimal value={draft.rpe} onChange={(rpe) => change({ rpe })} />
          ) : (
            <>
              <NumberField label="RIR, min" value={draft.rirMin} onChange={(rirMin) => change({ rirMin })} />
              <NumberField label="RIR, max" value={draft.rirMax} onChange={(rirMax) => change({ rirMax })} />
            </>
          )}
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
      <div className={cn('grid gap-2', onClear ? 'grid-cols-2' : 'grid-cols-1')}>
        {onClear ? (
          <Button variant="outline" onClick={onClear}>
            Hiq ndryshimin
          </Button>
        ) : null}
        <Button onClick={save}>Ruaj</Button>
      </div>
    </Sheet>
  )
}
