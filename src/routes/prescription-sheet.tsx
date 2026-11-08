import { type ReactNode, useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { Prescription } from '@/program/types'
import { type PercentRow, PRESCRIPTION_TYPES, type PrescriptionDraft, prescriptionDraft, prescriptionFromDraft, type RangeRow } from './prescription-form'

// Receta e një ushtrimi te ndërtuesi (SPEC §4; bordi "Sloti" › "Përsëritjet"): lloji dhe fushat e tij.
// Intervali me RIR është i pari (RIR-in e zgjedh karta e recetës); javët e intervaleve dhe të
// përqindjeve janë rreshta që shtohen e hiqen, dhe java 5 përdor rreshtin e parë përsëri. "Përdor
// recetën" e kalon te karta, që e ruan me "Ruaj për…" në nivelin e zgjedhur.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
const fieldClass = cn('h-touch w-full min-w-0 rounded-sm border border-border bg-surface-2 px-3 text-base text-foreground tabular-nums placeholder:text-muted-foreground', focusRing)
const cellClass = cn(fieldClass, 'px-2 text-center')

function NumberField({ label, value, onChange, decimal = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; decimal?: boolean; placeholder?: string }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="type-caption text-muted-foreground">
        {label}
      </label>
      <input id={id} inputMode={decimal ? 'decimal' : 'numeric'} autoComplete="off" placeholder={placeholder} value={value} onChange={(event) => onChange(event.currentTarget.value)} className={fieldClass} />
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex size-touch cursor-pointer items-center justify-center">
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
  const { t } = useI18n()
  const grid = 'grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-1.5'
  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden className={cn(grid, 'type-caption text-muted-foreground')}>
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
          <span className="type-caption text-muted-foreground tabular-nums">{t('builder.recipe.week', { number: index + 1 })}</span>
          {render(row, index)}
          <Button variant="ghost" size="icon" aria-label={t('builder.recipe.removeWeek', { number: index + 1 })} disabled={rows.length === 1} onClick={() => onRemove(index)}>
            <Icon name="fshi" size={20} />
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="default" disabled={rows.length >= 12} onClick={onAdd}>
        <Icon name="plus" size={20} />
        {t('builder.recipe.addWeek')}
      </Button>
    </div>
  )
}

export function PrescriptionSheet({
  levelText,
  initial,
  onApply,
  onClose,
}: {
  /** Niveli ku do të ruhet ("blloku Forca"). */
  levelText: string
  initial: Prescription | undefined | null
  onApply: (prescription: Prescription) => void
  onClose: () => void
}) {
  const { t, fmt } = useI18n()
  const [draft, setDraft] = useState<PrescriptionDraft>(() => prescriptionDraft(initial, (value) => fmt.number(value)))
  const [problem, setProblem] = useState<ReturnType<typeof prescriptionFromDraft> | null>(null)
  const typeId = useId()
  const hintId = useId()
  const change = (next: Partial<PrescriptionDraft>) => {
    setDraft((current) => ({ ...current, ...next }))
    setProblem(null)
  }
  const setLadder = (index: number, row: Partial<RangeRow>) => change({ ladder: draft.ladder.map((current, at) => (at === index ? { ...current, ...row } : current)) })
  const setWeek = (index: number, row: Partial<PercentRow>) => change({ weeks: draft.weeks.map((current, at) => (at === index ? { ...current, ...row } : current)) })

  function apply() {
    const result = prescriptionFromDraft(draft)
    if (!result.ok) return setProblem(result)
    onApply(result.value)
  }

  const footer = (
    <Button variant="primary" size="xl" onClick={apply}>
      {t('builder.recipe.apply')}
    </Button>
  )

  return (
    <Sheet title={t('builder.recipe.title')} description={t('builder.recipe.scope', { level: levelText })} onClose={onClose} footer={footer}>
      <label htmlFor={typeId} className="type-label text-muted-foreground">
        {t('builder.recipe.type')}
      </label>
      <div className="relative">
        <select
          id={typeId}
          value={draft.type}
          aria-describedby={hintId}
          onChange={(event) => change({ type: event.currentTarget.value as PrescriptionDraft['type'] })}
          className={cn(fieldClass, 'h-button appearance-none pr-10 text-lg font-semibold')}
        >
          {PRESCRIPTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`builder.recipe.type.${type}`)}
            </option>
          ))}
        </select>
        <Icon name="chevron-poshte" size={18} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      <p id={hintId} className="-mt-1 type-caption text-muted-foreground">
        {t(`builder.recipe.hint.${draft.type}`)}
      </p>

      {draft.type === 'rep_ladder' ? (
        <>
          <WeekTable
            headers={[t('builder.recipe.min'), t('builder.recipe.max'), t('builder.recipe.failure')]}
            rows={draft.ladder}
            onAdd={() => change({ ladder: [...draft.ladder, { ...(draft.ladder.at(-1) ?? { min: '8', max: '12', beyond: false }) }] })}
            onRemove={(index) => change({ ladder: draft.ladder.filter((_, at) => at !== index) })}
            render={(row, index) => (
              <>
                <input aria-label={t('builder.recipe.weekMin', { number: index + 1 })} inputMode="numeric" value={row.min} onChange={(event) => setLadder(index, { min: event.currentTarget.value })} className={cellClass} />
                <input
                  aria-label={t('builder.recipe.weekMax', { number: index + 1 })}
                  inputMode="numeric"
                  placeholder={t('builder.recipe.noMax')}
                  value={row.max}
                  onChange={(event) => setLadder(index, { max: event.currentTarget.value })}
                  className={cellClass}
                />
                <Check label={t('builder.recipe.weekBeyond', { number: index + 1 })} checked={row.beyond} onChange={(beyond) => setLadder(index, { beyond })} />
              </>
            )}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 type-body-strong">{t('builder.recipe.increase')}</legend>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label={t('builder.recipe.increaseMin')} decimal value={draft.increaseMin} onChange={(increaseMin) => change({ increaseMin })} placeholder={t('builder.recipe.noIncrease')} />
              <NumberField label={t('builder.recipe.increaseMax')} decimal value={draft.increaseMax} onChange={(increaseMax) => change({ increaseMax })} placeholder={t('builder.recipe.noIncrease')} />
            </div>
          </fieldset>
        </>
      ) : null}

      {draft.type === 'timed' ? <NumberField label={t('builder.recipe.seconds')} value={draft.seconds} onChange={(seconds) => change({ seconds })} /> : null}

      {draft.type === 'percent_1rm' ? (
        <WeekTable
          headers={[t('builder.recipe.percent'), t('builder.recipe.repsShort'), t('builder.recipe.amrap')]}
          rows={draft.weeks}
          onAdd={() => change({ weeks: [...draft.weeks, { ...(draft.weeks.at(-1) ?? { percent: '75', reps: '5', amrap: false }) }] })}
          onRemove={(index) => change({ weeks: draft.weeks.filter((_, at) => at !== index) })}
          render={(row, index) => (
            <>
              <input aria-label={t('builder.recipe.weekPercent', { number: index + 1 })} inputMode="decimal" value={row.percent} onChange={(event) => setWeek(index, { percent: event.currentTarget.value })} className={cellClass} />
              <input aria-label={t('builder.recipe.weekReps', { number: index + 1 })} inputMode="numeric" value={row.reps} onChange={(event) => setWeek(index, { reps: event.currentTarget.value })} className={cellClass} />
              <Check label={t('builder.recipe.weekAmrap', { number: index + 1 })} checked={row.amrap} onChange={(amrap) => setWeek(index, { amrap })} />
            </>
          )}
        />
      ) : null}

      {draft.type === 'linear' ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('builder.recipe.startKg')} decimal value={draft.startKg} onChange={(startKg) => change({ startKg })} />
          <NumberField label={t('builder.recipe.incrementKg')} decimal value={draft.incrementKg} onChange={(incrementKg) => change({ incrementKg })} />
          <NumberField label={t('builder.recipe.repsShort')} value={draft.linearReps} onChange={(linearReps) => change({ linearReps })} />
          <NumberField label={t('builder.recipe.failures')} value={draft.failures} onChange={(failures) => change({ failures })} />
          <NumberField label={t('builder.recipe.deload')} decimal value={draft.deloadPercent} onChange={(deloadPercent) => change({ deloadPercent })} />
        </div>
      ) : null}

      {draft.type === 'rpe' || draft.type === 'rir' ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('builder.recipe.repsMin')} value={draft.repsMin} onChange={(repsMin) => change({ repsMin })} />
          <NumberField label={t('builder.recipe.repsMax')} value={draft.repsMax} onChange={(repsMax) => change({ repsMax })} placeholder={t('builder.recipe.noMax')} />
          {draft.type === 'rpe' ? <NumberField label={t('builder.recipe.rpe')} decimal value={draft.rpe} onChange={(rpe) => change({ rpe })} /> : null}
        </div>
      ) : null}

      {problem && !problem.ok ? (
        <p role="alert" className="type-caption text-danger">
          {problem.error.params ? t(problem.error.key as 'builder.recipe.error.weekReps', problem.error.params) : t(problem.error.key as 'builder.recipe.error.reps')}
        </p>
      ) : null}
    </Sheet>
  )
}
