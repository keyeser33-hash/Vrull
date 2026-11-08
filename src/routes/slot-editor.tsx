import { type ReactNode, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { LibraryPicker } from '@/components/forms/library-picker'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { editSlot, programEditor, type ProgramEditorView, removeSlot, type RuleFields, setRule, setSlotExercise } from '@/data/program-editor'
import { muscleName, programBlockName, programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { useExercisePhoto } from '@/lib/exercise-photo'
import { groupsOf } from '@/program/exercise-catalog'
import { resolveRow, type RuleField, sameScope, type Scope } from '@/program/rules'
import type { Prescription, ProgressionRule, Technique } from '@/program/types'
import { levelName, levelTitle, prescriptionLabel, prescriptionValue, rirText, saveLabel } from './builder-format'
import { ChoiceChip, ConfirmSheet, EditorBar, EditorFooter, MoreButton, NotFound, Segmented, SelectButton, StepButton } from './builder-parts'
import { useEditorPaths, useSheet } from './editor-nav'
import { PrescriptionSheet } from './prescription-sheet'
import { DEFAULT_PRESCRIPTION } from './prescription-form'
import { setsText, techniqueName } from './programme-format'
import { clock } from './training-format'

// Një ushtrim në program (bordi "Sloti"; SPEC §4, GLOSSARY "Niveli"). Sipër, ku vlen ndryshimi: gjithë
// programi, një bllok, ose një javë (e çdo blloku ose e një blloku); fiton niveli më i saktë. Receta
// (setet, përsëritjet, RIR-i, pushimi, teknika) dhe progresi i zgjuar ndryshohen këtu dhe ruhen me
// "Ruaj për…" në nivelin e zgjedhur; çdo vlerë thotë nga cili nivel vjen. Ushtrimi ndërrohet menjëherë.

type Level = 'programme' | 'block' | 'week'
const FIELDS: RuleField[] = ['exerciseId', 'sets', 'restSeconds', 'prescription', 'technique', 'progression']
const RIR_CHIPS = [0, 1, 2, 3, 4]
const RIR_OPTIONS = [0, 1, 2, 3, 4]
const INCREMENTS = [1, 1.25, 2, 2.5, 5, 10]
const TECHNIQUES = ['none', 'rest_pause', 'drop_set'] as const

export function SlotEditorPage() {
  const { t } = useI18n()
  const { programId = '', slotId = '' } = useParams()
  const view = useLocalQuery(() => programEditor(store, programId), [programId])
  const paths = useEditorPaths()
  if (view === undefined) return <h1 className="sr-only">{t('builder.slot.recipe')}</h1>
  const day = view?.days.find((candidate) => candidate.slots.some((slot) => slot.id === slotId))
  if (!view || !day) return <NotFound text={t('builder.notFound.slot')} back={t('builder.slot.back')} fallback={view ? paths.program(view.id) : paths.programmes} />
  return <SlotEditor view={view} dayId={day.id} slotId={slotId} />
}

function SlotEditor({ view, dayId, slotId }: { view: ProgramEditorView; dayId: string; slotId: string }) {
  const { t, fmt } = useI18n()
  const { params, sheet, open, close } = useSheet()
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  const paths = useEditorPaths()
  const day = view.days.find((candidate) => candidate.id === dayId)!
  const index = day.slots.findIndex((slot) => slot.id === slotId)

  const block = view.blocks.find((candidate) => candidate.id === params.get('blloku')) ?? null
  const maxWeeks = block ? block.weeks : Math.max(...view.blocks.map((entry) => entry.weeks))
  const requestedWeek = Number(params.get('java'))
  const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= maxWeeks ? requestedWeek : null
  const scope: Scope = { blockId: block?.id ?? null, week }
  const level: Level = week !== null ? 'week' : block ? 'block' : 'programme'
  const base = level === 'programme'
  const rules = view.rules(slotId, scope)
  const program = view.rules(slotId, { blockId: null, week: null })
  const blockNames = Object.fromEntries(view.blocks.map((entry) => [entry.id, programBlockName(t, entry.name)]))
  const exercise = view.exercises[rules.exerciseId.value]
  const changed = FIELDS.filter((field) => sameScope(rules[field].from, scope)).length

  const setScope = (next: { blloku?: string | null; java?: string | null }) =>
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
  const chooseLevel = (next: Level) => {
    if (next === 'programme') setScope({ blloku: null, java: null })
    if (next === 'block') setScope({ blloku: scope.blockId ?? view.blocks[0].id, java: null })
    if (next === 'week') setScope({ java: String(scope.week ?? 1) })
  }

  const primaryGroups = groupsOf(exercise?.primary ?? [])
  const helpers = (exercise?.secondary ?? []).filter((key) => !(exercise?.primary ?? []).includes(key))
  const muscles = [
    primaryGroups.map((group) => muscleName(t, group)).join(', '),
    helpers.length ? t('builder.slot.helpers', { names: helpers.map((key) => t(`bodyModel.key.${key}` as 'bodyModel.key.trapezius').toLocaleLowerCase(fmt.locale)).join(', ') }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-3.5">
      <EditorBar
        icon="back"
        label={t('builder.slot.back')}
        fallback={paths.day(view.id, dayId)}
        title={t('builder.slot.caption', { day: programDayName(t, day.name), number: index + 1 })}
        action={<MoreButton label={t('builder.slot.more')} onClick={() => open('hiq')} />}
      />

      <div className="flex flex-col gap-2.5">
        <Hero libraryId={exercise?.libraryId ?? null} name={exercise?.name ?? ''} />
        <div className="flex items-center justify-between gap-2.5">
          <span className="type-caption text-muted-foreground">{muscles}</span>
          <Button variant="outline" aria-label={t('builder.slot.changeLabel')} className="shrink-0 px-3 text-[17px]" onClick={() => open('ushtrimi')}>
            <Icon name="nderro" size={18} />
            {t('builder.slot.change')}
          </Button>
        </div>
      </div>

      <section aria-labelledby="slot-where" className="flex flex-col gap-2">
        <h2 id="slot-where" className="type-title">
          {t('builder.slot.where')}
        </h2>
        <Segmented
          label={t('builder.slot.level')}
          value={level}
          onChange={chooseLevel}
          options={[
            { value: 'programme', label: t('builder.slot.level.programme') },
            { value: 'block', label: t('builder.slot.level.block') },
            { value: 'week', label: t('builder.slot.level.week') },
          ]}
        />
        {level === 'week' ? (
          <div role="radiogroup" aria-label={t('builder.slot.whichWeek')} className="flex flex-wrap gap-1.5">
            {Array.from({ length: maxWeeks }, (_, offset) => offset + 1).map((number) => (
              <ChoiceChip key={number} selected={week === number} label={t('plan.week', { week: number })} onClick={() => setScope({ java: String(number) })}>
                {fmt.number(number)}
              </ChoiceChip>
            ))}
          </div>
        ) : null}
        {level !== 'programme' ? (
          <div role="radiogroup" aria-label={t('builder.slot.whichBlock')} className="flex flex-wrap gap-1.5">
            {level === 'week' ? (
              <ChoiceChip selected={scope.blockId === null} onClick={() => setScope({ blloku: null })}>
                {t('builder.slot.everyBlock')}
              </ChoiceChip>
            ) : null}
            {view.blocks.map((entry) => (
              <ChoiceChip key={entry.id} selected={scope.blockId === entry.id} onClick={() => setScope({ blloku: entry.id })}>
                {blockNames[entry.id]}
              </ChoiceChip>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2.5">
          <p className="type-caption text-muted-foreground">
            {base ? t('builder.slot.baseNote') : t('builder.slot.changes', { count: changed, level: levelTitle(t, scope, blockNames) })}
          </p>
          {!base && changed > 0 ? (
            <Button
              variant="outline"
              className="shrink-0 px-3 text-[17px]"
              onClick={() => void setRule(store, slotId, scope, { exerciseId: null, sets: null, restSeconds: null, prescription: null, technique: null, progression: null })}
            >
              {t('builder.slot.clear')}
            </Button>
          ) : null}
        </div>
      </section>

      <RecipeForm
        key={JSON.stringify([scope, rules.sets.value, rules.restSeconds.value, rules.prescription.value, rules.technique.value, rules.progression.value])}
        view={view}
        slotId={slotId}
        dayId={dayId}
        scope={scope}
        rules={rules}
        program={program}
        blockNames={blockNames}
        timed={exercise?.tracking === 'timed'}
        onRecipe={() => open('receta')}
        recipeOpen={sheet === 'receta'}
        onCloseRecipe={close}
      />

      {sheet === 'ushtrimi' ? (
        <Sheet title={t('builder.slot.changeTitle')} description={t('builder.slot.changeScope', { level: levelName(t, scope, blockNames) })} onClose={close}>
          <LibraryPicker onPick={(item) => void setSlotExercise(store, slotId, scope, item).then(close)} />
        </Sheet>
      ) : null}
      {sheet === 'hiq' ? (
        <ConfirmSheet
          title={t('builder.slot.remove')}
          text={t('builder.slot.removeConfirm', { name: exercise?.name ?? '', day: programDayName(t, day.name) })}
          action={t('builder.slot.remove')}
          onClose={close}
          onConfirm={async () => {
            await removeSlot(store, slotId)
            navigate(paths.day(view.id, dayId), { replace: true })
          }}
        />
      ) : null}
    </div>
  )
}

/** Foto bardh e zi me emrin e ushtrimit sipër saj (bordi "Sloti"); pa foto, vend-mbajtësi "Pa foto". */
function Hero({ libraryId, name }: { libraryId: string | null; name: string }) {
  const { t } = useI18n()
  const photo = useExercisePhoto(libraryId)
  return (
    <div className="relative flex h-[120px] items-end overflow-hidden rounded-lg bg-surface">
      {photo.status === 'ready' ? (
        <>
          <img src={photo.src} alt="" className="absolute inset-0 size-full object-cover object-[50%_30%] grayscale" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[90px] bg-linear-to-b from-transparent to-background" />
        </>
      ) : photo.status === 'missing' ? (
        <span className="absolute top-3 right-3.5 flex items-center gap-1.5 type-caption text-muted-foreground">
          <Icon name="programi" size={16} />
          {t('programme.noPhoto')}
        </span>
      ) : null}
      <h1 lang="en" className="relative px-3.5 pb-2.5 type-display-l break-words">
        {name}
      </h1>
    </div>
  )
}

type Rules = ProgramEditorView['rules'] extends (...args: never[]) => infer R ? R : never

/** Receta e slotit në nivelin e zgjedhur, si draft deri te "Ruaj për…". */
function RecipeForm({
  view,
  slotId,
  dayId,
  scope,
  rules,
  program,
  blockNames,
  timed,
  onRecipe,
  recipeOpen,
  onCloseRecipe,
}: {
  view: ProgramEditorView
  slotId: string
  dayId: string
  scope: Scope
  rules: Rules
  program: Rules
  blockNames: Record<string, string>
  timed: boolean
  onRecipe: () => void
  recipeOpen: boolean
  onCloseRecipe: () => void
}) {
  const { t, fmt } = useI18n()
  const base = scope.blockId === null && scope.week === null
  const [sets, setSets] = useState(rules.sets.value)
  const [rest, setRest] = useState(rules.restSeconds.value)
  const [prescription, setPrescription] = useState<Prescription | null | undefined>(rules.prescription.value)
  const [technique, setTechnique] = useState<Technique['type']>(rules.technique.value?.type ?? 'none')
  // Rregulli i progresit: "Si programi" = pa rregull në këtë nivel; "Rregull më vete" = rregulli këtu.
  const ownRule = sameScope(rules.progression.from, scope) ? (rules.progression.value ?? null) : null
  const inherited = inheritedRule(view, slotId, scope)
  const [mode, setMode] = useState<'inherit' | 'own'>(ownRule ? 'own' : 'inherit')
  const [rule, changeRule] = useState<ProgressionRule>(ownRule ?? inherited.rule ?? { minRir: 2, incrementKg: 2.5 })
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const paths = useEditorPaths()

  const changes: RuleFields = {}
  if (sets !== rules.sets.value) changes.sets = sets
  if (rest !== rules.restSeconds.value) changes.restSeconds = rest
  if (JSON.stringify(prescription ?? null) !== JSON.stringify(rules.prescription.value ?? null)) changes.prescription = prescription ?? null
  if (technique !== (rules.technique.value?.type ?? 'none')) changes.technique = techniqueOf(technique, rules.technique.value)
  if (mode === 'own' && JSON.stringify(rule) !== JSON.stringify(ownRule)) changes.progression = rule
  if (mode === 'inherit' && ownRule) changes.progression = null
  const dirty = Object.keys(changes).length > 0

  /** Ruan ndryshimet në nivelin e zgjedhur dhe kthehet te dita (si te bordi "Sloti"). */
  async function save() {
    setBusy(true)
    try {
      if (dirty) await editSlot(store, slotId, scope, changes)
      if (location.key === 'default') navigate(paths.day(view.id, dayId), { replace: true })
      else navigate(-1)
    } finally {
      setBusy(false)
    }
  }

  /** Nga vjen vlera: "nga programi", "nga blloku Forca", ose (këtu) "blloku Forca · programi 6–8". */
  function source(field: RuleField, programValue: string | null) {
    if (base) return null
    const from = rules[field].from
    if (sameScope(from, scope)) {
      const level = levelName(t, scope, blockNames)
      return { here: true, text: programValue ? t('builder.slot.here', { level, value: programValue }) : t('builder.slot.hereOnly', { level }) }
    }
    if (!from || (from.blockId === null && from.week === null)) return { here: false, text: t('builder.slot.fromProgramme') }
    return { here: false, text: t('builder.slot.fromLevel', { level: levelName(t, from, blockNames) }) }
  }

  const rirOf = (value: Prescription | null | undefined) => (value?.type === 'rir' ? value.rir : null)
  const rir = rirOf(prescription)
  const showRir = !timed && (!prescription || prescription.type === 'rir')
  const repsSource = source('prescription', program.prescription.value ? prescriptionValue(t, fmt, program.prescription.value) : null)
  const rirSource = source('prescription', rirOf(program.prescription.value) ? fmt.number(rirOf(program.prescription.value)!.min) : null)
  const techniqueLabel = (type: Technique['type']) => (type === 'to_failure' ? techniqueName(t, { type }) : t(`builder.slot.technique.${type}`))
  const techniqueSource = source('technique', techniqueLabel(program.technique.value?.type ?? 'none'))

  return (
    <>
      <section aria-label={t('builder.slot.recipe')} className={cn(surfaceClass, 'flex flex-col rounded-xl px-3.5 py-1.5')}>
        <Row label={t('builder.slot.sets')} source={source('sets', fmt.number(program.sets.value))}>
          <div role="group" aria-label={t('builder.slot.setsValue', { count: sets })} className="flex items-center gap-1">
            <StepButton label={t('builder.slot.setLess')} sign="−" disabled={sets <= 1} onClick={() => setSets(sets - 1)} />
            <span className="w-11 text-center font-display text-[34px] leading-none font-extrabold tabular-nums">{fmt.number(sets)}</span>
            <StepButton label={t('builder.slot.setMore')} sign="+" disabled={sets >= 10} onClick={() => setSets(sets + 1)} />
          </div>
        </Row>

        <Row label={prescriptionLabel(t, prescription)} source={repsSource}>
          <button
            type="button"
            aria-label={t('builder.slot.repsValue', { label: prescriptionLabel(t, prescription), value: prescriptionValue(t, fmt, prescription) })}
            onClick={onRecipe}
            className="flex h-touch max-w-[190px] min-w-0 items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 pr-2.5 pl-3.5 font-display text-[28px] leading-none font-extrabold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <span className="truncate">{prescriptionValue(t, fmt, prescription)}</span>
            <Icon name="chevron-poshte" size={16} className="shrink-0 text-muted-foreground" />
          </button>
        </Row>

        {showRir ? (
          <div role="group" aria-labelledby="slot-rir" className="flex flex-col gap-2 border-b border-border pt-2.5 pb-3">
            <div className="flex items-baseline justify-between gap-2">
              <span id="slot-rir" className="type-body-strong">
                {t('builder.slot.rir')}
              </span>
              {rirSource ? <SourceText source={rirSource} /> : null}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {RIR_CHIPS.map((value) => {
                const selected = rir !== null && (value === 4 ? rir.min >= 4 : rir.min === value && rir.max === value)
                return (
                  <ChoiceChip
                    key={value}
                    role="button"
                    selected={selected}
                    label={value === 4 ? t('ui.rir.orMore', { value: 4 }) : String(value)}
                    onClick={() => {
                      const reps = prescription?.type === 'rir' ? prescription.reps : (DEFAULT_PRESCRIPTION as Extract<Prescription, { type: 'rir' }>).reps
                      setPrescription({ type: 'rir', reps, rir: value === 4 ? { min: 4, max: 5 } : { min: value, max: value } })
                    }}
                    className="min-w-0 px-0 text-xl"
                  >
                    {value === 4 ? t('builder.slot.rirMore', { rir: 4 }) : fmt.number(value)}
                  </ChoiceChip>
                )
              })}
            </div>
            {rir && rir.min !== rir.max && rir.min < 4 ? <span className="type-caption text-muted-foreground">{rirText(t, fmt, rir)}</span> : null}
          </div>
        ) : null}

        <Row label={t('builder.slot.rest')} source={source('restSeconds', clock(program.restSeconds.value))}>
          <div role="group" aria-label={t('builder.slot.restValue', { time: clock(rest) })} className="flex items-center gap-1">
            <StepButton label={t('builder.slot.restLess')} sign="−15" disabled={rest <= 0} onClick={() => setRest(Math.max(0, rest - 15))} className="w-[52px] text-lg" />
            <span className="w-16 text-center font-display text-[34px] leading-none font-extrabold tabular-nums">{clock(rest)}</span>
            <StepButton label={t('builder.slot.restMore')} sign="+15" disabled={rest >= 600} onClick={() => setRest(Math.min(600, rest + 15))} className="w-[52px] text-lg" />
          </div>
        </Row>

        <div role="group" aria-labelledby="slot-technique" className="flex flex-col gap-2 pt-2.5 pb-3">
          <div className="flex items-baseline justify-between gap-2">
            <span id="slot-technique" className="type-body-strong">
              {t('builder.slot.technique')}
            </span>
            {techniqueSource ? <SourceText source={techniqueSource} /> : null}
          </div>
          {timed || prescription?.type === 'timed' ? (
            <span className="type-caption text-muted-foreground">{t('builder.slot.techniqueTimed')}</span>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {TECHNIQUES.map((type) => (
                  <ChoiceChip key={type} role="button" selected={technique === type} onClick={() => setTechnique(type)} className="min-w-0 px-1">
                    {t(`builder.slot.technique.${type}`)}
                  </ChoiceChip>
                ))}
              </div>
              <span className="type-caption text-muted-foreground">{technique === 'to_failure' ? t('builder.slot.techniqueFailure') : t('builder.slot.techniqueHint')}</span>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="slot-smart" className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-3.5')}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="slot-smart" className="type-title">
            {t('builder.smart.title')}
          </h2>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('builder.smart.forExercise')}</span>
        </div>
        <Segmented
          label={t('builder.smart.mode')}
          ground="card"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'inherit', label: t('builder.smart.inherit') },
            { value: 'own', label: t('builder.smart.own') },
          ]}
        />
        {mode === 'own' ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 type-body-l">
            <span>{t('builder.smart.whenShort')}</span>
            <SelectButton label={t('builder.smart.rir')} value={rule.minRir} options={RIR_OPTIONS.map((value) => ({ value, label: fmt.number(value) }))} onChange={(minRir) => changeRule({ ...rule, minRir })} />
            <span>{t('builder.smart.add')}</span>
            <SelectButton
              label={t('builder.smart.increment')}
              value={rule.incrementKg}
              options={INCREMENTS.map((value) => ({ value, label: `+${fmt.unit(value, 'kg')}` }))}
              onChange={(incrementKg) => changeRule({ ...rule, incrementKg })}
            />
          </div>
        ) : null}
        <p className="type-caption text-muted-foreground">
          {inherited.rule
            ? inherited.level
              ? t('builder.smart.fromLevel', { level: levelTitle(t, inherited.level, blockNames), rir: inherited.rule.minRir, increment: inherited.rule.incrementKg })
              : t('builder.smart.fromProgramme', { rir: inherited.rule.minRir, increment: inherited.rule.incrementKg })
            : t('builder.smart.programmeOff')}
        </p>
      </section>

      <Preview view={view} slotId={slotId} dayId={dayId} scope={scope} blockNames={blockNames} />

      <EditorFooter>
        <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
          {saveLabel(t, scope, blockNames)}
        </Button>
      </EditorFooter>

      {recipeOpen ? (
        <PrescriptionSheet
          levelText={levelName(t, scope, blockNames)}
          initial={prescription}
          onApply={(next) => {
            setPrescription(next.type === 'rir' && prescription?.type === 'rir' ? { ...next, rir: prescription.rir } : next)
            onCloseRecipe()
          }}
          onClose={onCloseRecipe}
        />
      ) : null}
    </>
  )
}

/** Teknika e zgjedhur, me vlerat që kishte (pushimi i rest-pause, % e drop set-it) kur lloji mbetet. */
function techniqueOf(type: Technique['type'], current: Technique | null | undefined): Technique {
  if (current?.type === type) return current
  return { type } as Technique
}

/** Rregulli që vlen kur sloti nuk ka rregull në këtë nivel: nga një nivel më i gjerë, ose i programit. */
function inheritedRule(view: ProgramEditorView, slotId: string, scope: Scope): { rule: ProgressionRule | null; level: Scope | null } {
  const others = view.engine.overrides.filter((row) => !(row.slotId === slotId && row.blockId === scope.blockId && row.week === scope.week))
  const row = resolveRow(others, slotId, scope, 'progression')
  if (row?.progression) return { rule: row.progression, level: { blockId: row.blockId, week: row.week } }
  return { rule: view.progression, level: null }
}

function SourceText({ source }: { source: { here: boolean; text: string } }) {
  return <span className={cn('text-xs leading-4', source.here ? 'font-semibold text-data' : 'text-muted-foreground')}>{source.text}</span>
}

/** Rreshti 60 px i recetës: emri dhe nga vjen majtas, kontrolli djathtas. */
function Row({ label, source, children }: { label: string; source: { here: boolean; text: string } | null; children: ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-2.5 border-b border-border py-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="type-body-strong">{label}</span>
        {source ? <SourceText source={source} /> : null}
      </div>
      {children}
    </div>
  )
}

/** Si del ushtrimi javë pas jave në blloqet e nivelit; javët jashtë nivelit janë më të zbehta. */
function Preview({ view, slotId, dayId, scope, blockNames }: { view: ProgramEditorView; slotId: string; dayId: string; scope: Scope; blockNames: Record<string, string> }) {
  const { t, fmt } = useI18n()
  const blocks = scope.blockId ? view.blocks.filter((block) => block.id === scope.blockId) : view.blocks
  const slotExercise = view.rules(slotId, { blockId: null, week: null }).exerciseId.value
  return (
    <section aria-labelledby="slot-preview" className="flex flex-col gap-1.5">
      <h2 id="slot-preview" className="type-label text-muted-foreground">
        {t('builder.slot.preview')}
      </h2>
      <ul className={cn(surfaceClass, 'flex flex-col rounded-lg px-3.5')}>
        {blocks.flatMap((block) =>
          Array.from({ length: block.weeks }, (_, offset) => {
            const week = offset + 1
            const planned = view.plan(block.id, week, dayId).slots.find((slot) => slot.slotId === slotId)
            if (!planned) return null
            const name = planned.exerciseId !== slotExercise ? view.exercises[planned.exerciseId]?.name : null
            const technique = techniqueName(t, planned.technique)
            const outside = scope.week !== null && scope.week !== week
            return (
              <li key={`${block.id}-${week}`} className={cn('flex min-h-12 items-center gap-3 border-t border-border py-1.5 first:border-t-0', outside && 'text-muted-foreground')}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="type-body-strong">{t('builder.weekOf', { block: blockNames[block.id], week })}</span>
                  {name ? (
                    <span lang="en" className="truncate type-caption text-muted-foreground">
                      {name}
                    </span>
                  ) : null}
                </span>
                <span className="text-right type-body tabular-nums">{[setsText(fmt, planned.sets, planned.target), technique].filter(Boolean).join(' · ')}</span>
              </li>
            )
          }),
        )}
      </ul>
    </section>
  )
}
