import { useId, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Choice } from '@/components/forms/choice'
import { LibraryPicker } from '@/components/forms/library-picker'
import { ValueStepper } from '@/components/forms/value-stepper'
import { Group, Row } from '@/components/layout/list-group'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { store, useLocalQuery } from '@/data/app-data'
import { editSlot, moveSlot, programEditor, type ProgramEditorView, removeSlot, type RuleFields, setSlotExercise } from '@/data/program-editor'
import { describeScope, type RuleField, sameScope, type Scope } from '@/program/rules'
import type { Technique } from '@/program/types'
import { cn } from '@/lib/cn'
import { useSheet } from './editor-nav'
import { ConfirmSheet, NotFound } from './program-editor'
import { PrescriptionSheet } from './prescription-sheet'
import { prescriptionSummary } from './prescription-form'
import { setsText, techniqueLabel, techniqueText } from './training-format'

// Një ushtrim në program (TH-11). Sipër zgjidhet niveli ku vlen ndryshimi: i gjithë programi,
// një bllok, një javë në çdo bllok, ose një javë e një blloku. Çdo rresht tregon vlerën që vlen
// aty dhe nga vjen; poshtë, plani javë pas jave tregon si del në të vërtetë.

const BASE_FIELDS = new Set<RuleField>(['exerciseId', 'sets', 'restSeconds'])

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-xs leading-4 font-medium text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === value}
              onClick={() => onChange(option.value)}
              className={cn(
                'h-11 min-w-11 rounded-full border px-4 text-sm font-semibold tabular-nums',
                option.value === value ? 'border-foreground bg-selected text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type FieldSheet = 'ushtrimi' | 'setet' | 'pushimi' | 'receta' | 'teknika'

export function SlotEditorPage() {
  const { programId = '', slotId = '' } = useParams()
  const view = useLocalQuery(() => programEditor(store, programId), [programId])
  const { params, sheet, open, close } = useSheet()
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  if (view === undefined) return <h1 className="sr-only">Ushtrimi në program</h1>
  const day = view?.days.find((candidate) => candidate.slots.some((slot) => slot.id === slotId))
  if (!view || !day) return <NotFound text="Ky ushtrim nuk është më në program." />

  const index = day.slots.findIndex((slot) => slot.id === slotId)
  const block = view.blocks.find((candidate) => candidate.id === params.get('blloku')) ?? null
  const maxWeeks = block ? block.weeks : Math.max(...view.blocks.map((entry) => entry.weeks))
  const requestedWeek = Number(params.get('java'))
  const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= maxWeeks ? requestedWeek : null
  const scope: Scope = { blockId: block?.id ?? null, week }
  const base = scope.blockId === null && scope.week === null
  const rules = view.rules(slotId, scope)
  const blockNames = Object.fromEntries(view.blocks.map((entry) => [entry.id, entry.name]))
  const here = (field: RuleField) => sameScope(rules[field].from, scope) || (base && rules[field].from === null && BASE_FIELDS.has(field))
  const canClear = (field: RuleField) => sameScope(rules[field].from, scope)
  const detail = (field: RuleField) => {
    if (rules[field].value === undefined) return undefined
    return here(field) ? 'Vendosur këtu' : describeScope(rules[field].from, blockNames)
  }
  const exerciseName = view.exercises[rules.exerciseId.value]?.name ?? 'Ushtrim i panjohur'
  const scopeText = describeScope(scope, blockNames)

  const setScope = (next: { blloku?: string; java?: string }) =>
    setParams(
      (current) => {
        for (const [key, value] of Object.entries(next)) {
          if (value) current.set(key, value)
          else current.delete(key)
        }
        return current
      },
      { replace: true },
    )

  async function save(fields: RuleFields) {
    await editSlot(store, slotId, scope, fields)
    close()
  }

  const fieldSheet = sheet as FieldSheet | 'fshi' | null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te dita" />
      </header>
      <div className="flex flex-col gap-1">
        <span className="text-sm leading-5 text-muted-foreground">
          {day.name} · ushtrimi {index + 1}
        </span>
        <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em] break-words">{exerciseName}</h1>
      </div>

      <section aria-labelledby="scope-title" className="flex flex-col gap-3">
        <h2 id="scope-title" className="text-sm leading-5 font-semibold">
          Ku vlen ndryshimi
        </h2>
        <ChipGroup
          label="Blloku"
          value={scope.blockId ?? ''}
          options={[{ value: '', label: 'Të gjitha' }, ...view.blocks.map((entry) => ({ value: entry.id, label: entry.name }))]}
          onChange={(value) => setScope({ blloku: value })}
        />
        <ChipGroup
          label="Java"
          value={week ? String(week) : ''}
          options={[{ value: '', label: 'Të gjitha' }, ...Array.from({ length: maxWeeks }, (_, offset) => ({ value: String(offset + 1), label: String(offset + 1) }))]}
          onChange={(value) => setScope({ java: value })}
        />
        <p className="text-sm leading-5 text-muted-foreground">
          {scopeText}. Ndryshimi më i saktë fiton: blloku dhe java, pastaj blloku, pastaj java, pastaj i gjithë programi.
        </p>
      </section>

      <Group title="Vlerat">
        <Row label="Ushtrimi" detail={detail('exerciseId')} value={exerciseName} onClick={() => open('ushtrimi')} />
        <Row label="Setet" detail={detail('sets')} value={String(rules.sets.value)} onClick={() => open('setet')} />
        <Row label="Pushimi" detail={detail('restSeconds')} value={`${rules.restSeconds.value} s`} onClick={() => open('pushimi')} />
        <Row label="Receta" detail={detail('prescription')} value={prescriptionSummary(rules.prescription.value)} onClick={() => open('receta')} />
        <Row label="Teknika" detail={detail('technique')} value={techniqueLabel(rules.technique.value)} onClick={() => open('teknika')} />
      </Group>

      <Preview view={view} slotId={slotId} dayId={day.id} scope={scope} exerciseName={exerciseName} />

      <Group title="Në ditë">
        <Row label="Zhvendose lart" disabled={index === 0} onClick={() => void moveSlot(store, slotId, -1)} action />
        <Row label="Zhvendose poshtë" disabled={index === day.slots.length - 1} onClick={() => void moveSlot(store, slotId, 1)} action />
        <Row label="Hiq ushtrimin" onClick={() => open('fshi')} action />
      </Group>

      {fieldSheet === 'ushtrimi' ? (
        <ExerciseSheet slotId={slotId} scope={scope} scopeText={scopeText} onClear={canClear('exerciseId') ? () => void save({ exerciseId: null }) : undefined} onClose={close} />
      ) : null}
      {fieldSheet === 'setet' ? (
        <NumberSheet
          title="Setet"
          scopeText={scopeText}
          initial={rules.sets.value}
          min={1}
          max={10}
          step={1}
          minusLabel="Një set më pak"
          plusLabel="Një set më shumë"
          onSave={(sets) => void save({ sets })}
          onClear={canClear('sets') ? () => void save({ sets: null }) : undefined}
          onClose={close}
        />
      ) : null}
      {fieldSheet === 'pushimi' ? (
        <NumberSheet
          title="Pushimi"
          scopeText={scopeText}
          initial={rules.restSeconds.value}
          min={0}
          max={600}
          step={15}
          unit="s"
          minusLabel="15 sekonda më pak"
          plusLabel="15 sekonda më shumë"
          onSave={(restSeconds) => void save({ restSeconds })}
          onClear={canClear('restSeconds') ? () => void save({ restSeconds: null }) : undefined}
          onClose={close}
        />
      ) : null}
      {fieldSheet === 'receta' ? (
        <PrescriptionSheet
          scopeText={scopeText}
          initial={rules.prescription.value}
          onSave={(prescription) => save({ prescription })}
          onClear={canClear('prescription') ? () => void save({ prescription: null }) : undefined}
          onClose={close}
        />
      ) : null}
      {fieldSheet === 'teknika' ? (
        <TechniqueSheet
          scopeText={scopeText}
          initial={rules.technique.value}
          timed={rules.prescription.value?.type === 'timed'}
          onSave={(technique) => void save({ technique })}
          onClear={canClear('technique') ? () => void save({ technique: null }) : undefined}
          onClose={close}
        />
      ) : null}
      {fieldSheet === 'fshi' ? (
        <ConfirmSheet
          title="Hiq ushtrimin"
          text={`${exerciseName} hiqet nga ${day.name} në çdo bllok dhe javë. Seancat e kaluara mbeten te historia.`}
          action="Hiq"
          onClose={close}
          onConfirm={async () => {
            await removeSlot(store, slotId)
            navigate(-2)
          }}
        />
      ) : null}
    </div>
  )
}

/** Si del ushtrimi javë pas jave në blloqet e nivelit; javët jashtë nivelit janë më të zbehta. */
function Preview({ view, slotId, dayId, scope, exerciseName }: { view: ProgramEditorView; slotId: string; dayId: string; scope: Scope; exerciseName: string }) {
  const blocks = scope.blockId ? view.blocks.filter((block) => block.id === scope.blockId) : view.blocks
  return (
    <section aria-labelledby="preview-title" className="flex flex-col">
      <h2 id="preview-title" className="mb-1 text-sm leading-5 font-semibold text-muted-foreground">
        Si del në program
      </h2>
      <ul className="flex flex-col rounded-xl border border-border bg-card px-4">
        {blocks.flatMap((block) =>
          Array.from({ length: block.weeks }, (_, offset) => {
            const week = offset + 1
            const planned = view.plan(block.id, week, dayId).slots.find((slot) => slot.slotId === slotId)
            if (!planned) return null
            const name = view.exercises[planned.exerciseId]?.name
            const technique = techniqueText(planned.technique)
            const outside = scope.week !== null && scope.week !== week
            return (
              <li
                key={`${block.id}-${week}`}
                className={cn('flex min-h-12 items-center gap-3 border-t border-border-subtle py-1.5 first:border-t-0', outside && 'text-muted-foreground')}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm leading-5 font-medium">
                    {block.name} · Java {week}
                  </span>
                  {name && name !== exerciseName ? <span className="truncate text-xs leading-4 text-muted-foreground">{name}</span> : null}
                </span>
                <span className="text-right text-sm leading-5 tabular-nums">
                  {[setsText(planned.sets, planned.target), technique].filter(Boolean).join(' · ')}
                </span>
              </li>
            )
          }),
        )}
      </ul>
    </section>
  )
}

function SheetScope({ scopeText }: { scopeText: string }) {
  return <p className="text-sm leading-5 text-muted-foreground">Ndryshimi vlen {lowerFirst(scopeText)}.</p>
}

function SheetActions({ onSave, onClear, saveDisabled }: { onSave?: () => void; onClear?: () => void; saveDisabled?: boolean }) {
  return (
    <div className={cn('grid gap-2', onSave && onClear ? 'grid-cols-2' : 'grid-cols-1')}>
      {onClear ? (
        <Button variant="outline" onClick={onClear}>
          Hiq ndryshimin
        </Button>
      ) : null}
      {onSave ? (
        <Button disabled={saveDisabled} onClick={onSave}>
          Ruaj
        </Button>
      ) : null}
    </div>
  )
}

function ExerciseSheet({
  slotId,
  scope,
  scopeText,
  onClear,
  onClose,
}: {
  slotId: string
  scope: Scope
  scopeText: string
  onClear?: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title="Ushtrimi" onClose={onClose}>
      <SheetScope scopeText={scopeText} />
      {onClear ? <SheetActions onClear={onClear} /> : null}
      <LibraryPicker
        busy={busy}
        onPick={(item) => {
          setBusy(true)
          void setSlotExercise(store, slotId, scope, item).then(onClose)
        }}
      />
    </Sheet>
  )
}

function NumberSheet({
  title,
  scopeText,
  initial,
  min,
  max,
  step,
  unit,
  minusLabel,
  plusLabel,
  onSave,
  onClear,
  onClose,
}: {
  title: string
  scopeText: string
  initial: number
  min: number
  max: number
  step: number
  unit?: string
  minusLabel: string
  plusLabel: string
  onSave: (value: number) => void
  onClear?: () => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initial)
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  return (
    <Sheet title={title} onClose={onClose}>
      <SheetScope scopeText={scopeText} />
      <ValueStepper
        label={title}
        hideLabel
        variant="hero"
        text={String(value)}
        unit={unit}
        inputMode="numeric"
        minusLabel={minusLabel}
        plusLabel={plusLabel}
        onMinus={() => setValue((current) => clamp(current - step))}
        onPlus={() => setValue((current) => clamp(current + step))}
        onCommit={(text) => {
          const parsed = Number(text)
          if (Number.isInteger(parsed) && parsed >= min && parsed <= max) setValue(parsed)
        }}
      />
      <SheetActions onSave={() => onSave(value)} onClear={onClear} />
    </Sheet>
  )
}

const TECHNIQUES: { type: Technique['type']; label: string; hint: string }[] = [
  { type: 'none', label: 'Asnjë', hint: 'Seti i fundit si të tjerët.' },
  { type: 'rest_pause', label: 'Rest-pause', hint: 'Deri në dështim, pushim i shkurtër, përsëri deri në dështim.' },
  { type: 'drop_set', label: 'Drop set', hint: 'Pas dështimit, ul peshën dhe vazhdo pa pushim.' },
  { type: 'to_failure', label: 'Deri në dështim', hint: 'Seti i fundit deri sa nuk mund më.' },
]

function TechniqueSheet({
  scopeText,
  initial,
  timed,
  onSave,
  onClear,
  onClose,
}: {
  scopeText: string
  initial: Technique | undefined | null
  timed: boolean
  onSave: (technique: Technique) => void
  onClear?: () => void
  onClose: () => void
}) {
  const [type, setType] = useState<Technique['type']>(initial?.type ?? 'none')
  const [restSeconds, setRestSeconds] = useState(initial?.type === 'rest_pause' ? (initial.restSeconds ?? 15) : 15)
  const [percent, setPercent] = useState(initial?.type === 'drop_set' && initial.percent ? String(initial.percent) : '')
  const [problem, setProblem] = useState<string | null>(null)
  const percentId = useId()

  function save() {
    if (type === 'rest_pause') return onSave(restSeconds === 15 ? { type } : { type, restSeconds })
    if (type === 'drop_set') {
      if (percent.trim() === '') return onSave({ type })
      const value = Number(percent.trim())
      if (!Number.isInteger(value) || value < 30 || value > 95) {
        setProblem('Përqindja duhet të jetë nga 30 deri në 95, ose bosh.')
        return
      }
      return onSave({ type, percent: value })
    }
    onSave({ type })
  }

  return (
    <Sheet title="Teknika e setit të fundit" onClose={onClose}>
      <SheetScope scopeText={scopeText} />
      {timed ? <p className="text-sm leading-5 text-muted-foreground">Me recetën me kohë teknika nuk zbatohet.</p> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Teknika</legend>
        {TECHNIQUES.map((option) => (
          <Choice key={option.type} name="technique" value={option.type} checked={type === option.type} onChange={() => setType(option.type)} label={option.label} hint={option.hint} />
        ))}
      </fieldset>
      {type === 'rest_pause' ? (
        <ValueStepper
          label="Pauza"
          text={String(restSeconds)}
          unit="s"
          inputMode="numeric"
          minusLabel="5 sekonda më pak"
          plusLabel="5 sekonda më shumë"
          onMinus={() => setRestSeconds((value) => Math.max(5, value - 5))}
          onPlus={() => setRestSeconds((value) => Math.min(60, value + 5))}
          onCommit={(text) => {
            const value = Number(text)
            if (Number.isInteger(value) && value >= 5 && value <= 60) setRestSeconds(value)
          }}
        />
      ) : null}
      {type === 'drop_set' ? (
        <>
          <label htmlFor={percentId} className="text-sm leading-5 font-medium">
            Pesha e drop-it, % e setit
          </label>
          <input
            id={percentId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Pesha e javës 1 të bllokut"
            value={percent}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => (setPercent(event.currentTarget.value), setProblem(null))}
            className={inputClass}
          />
          {problem ? (
            <p role="alert" className="text-sm leading-5 text-destructive">
              {problem}
            </p>
          ) : null}
        </>
      ) : null}
      <SheetActions onSave={save} onClear={onClear} />
    </Sheet>
  )
}
