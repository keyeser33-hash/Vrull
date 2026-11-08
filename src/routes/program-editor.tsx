import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { LibraryPicker } from '@/components/forms/library-picker'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { ExercisePhoto } from '@/components/ui/exercise-photo'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import {
  addBlock,
  addDay,
  addSlotFromLibrary,
  copyBlock,
  copyDay,
  copyWeek,
  createBlankProgram,
  createFromTemplate,
  deleteProgram,
  discardEmptyDrafts,
  duplicateProgram,
  editSlot,
  moveBlock,
  moveDay,
  programEditor,
  programList,
  type ProgramEditorView,
  type ProgramSummary,
  removeBlock,
  removeDay,
  renameDay,
  renameProgram,
  reorderSlots,
  saveDraft,
  setProgramProgression,
  updateBlock,
} from '@/data/program-editor'
import { switchProgram } from '@/data/training'
import { programBlockName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { progressionIncrement, weightStep } from '@/program/loads'
import { slotRules } from '@/program/rules'
import { isTemplateId } from '@/program/templates'
import type { Equipment, ProgressionRule } from '@/program/types'
import { workoutMinutes } from '@/program/week-plan'
import { prescriptionValue, rirText, slotSummary, useTemplateNames } from './builder-format'
import {
  ConfirmSheet,
  EditorBar,
  EditorFooter,
  MoreButton,
  NameSheet,
  NotFound,
  SelectButton,
  SheetAction,
  StepButton,
  Switch,
  TemplateList,
  TemplateSheet,
} from './builder-parts'
import { DEFAULT_PRESCRIPTION } from './prescription-form'
import { useEditorPaths, useSheet } from './editor-nav'
import { clock } from './training-format'

// Ndërtuesi i programeve (V2-E1-10; bordet "Programet", "Ndërto", "Dita", "Hyrja · Programi"): Programet
// e mia me shabllonet, struktura e programit (blloqet, ditët, progresi i zgjuar) dhe dita me ushtrimet
// që renditen me tërheqje. Ushtrimi në program ka ekranin e vet (slot-editor.tsx). Fletët hapen me
// ?ndrysho=..., që butoni mbrapa i Android-it t'i mbyllë. Ndryshimet ruhen menjëherë; "Ruaj programin"
// e nxjerr programin nga drafti.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
const MAX_WEEKS = 12
const RIR_OPTIONS = [0, 1, 2, 3, 4]
const INCREMENTS = [1, 1.25, 2, 2.5, 5, 10]

/** Hapi i dumbbell-it nga cilësimet, për fjalinë "Me dumbbell shtesa është +2 kg". */
function useWeightSteps() {
  return useLocalQuery(async () => ((await store.all('user_settings'))[0]?.weight_steps as Partial<Record<Equipment, number>> | undefined) ?? {}, [])
}

/** "javët 1–4", "java 9": javët e bllokut te programi. */
function blockSpan(t: ReturnType<typeof useI18n>['t'], blocks: { weeks: number }[], index: number) {
  const from = blocks.slice(0, index).reduce((sum, block) => sum + block.weeks, 1)
  const to = from + blocks[index].weeks - 1
  return from === to ? t('builder.structure.blockWeek', { week: from }) : t('builder.structure.blockWeeks', { from, to })
}

// ——— Programet e mia (bordi "Programet") ———

export function ProgramsPage() {
  const { t } = useI18n()
  const programs = useLocalQuery(() => programList(store), [])
  const { params, sheet, open, close } = useSheet()
  const navigate = useNavigate()
  const names = useTemplateNames()
  const [busy, setBusy] = useState(false)
  const active = programs?.find((program) => program.active) ?? null
  const mine = programs?.filter((program) => !program.active) ?? []
  const requested = params.get('shablloni')
  const template = isTemplateId(requested) ? requested : null
  // Një draft bosh nga "Ndërto program" (përdoruesi doli pa shtuar asnjë ushtrim) nuk mbetet te "Të mitë".
  useEffect(() => {
    discardEmptyDrafts(store).catch(() => {})
  }, [])

  async function build() {
    setBusy(true)
    try {
      const programId = await createBlankProgram(store, { program: t('builder.blank.name'), block: t('builder.blank.block', { number: 1 }), day: t('builder.blank.day', { number: 1 }) })
      navigate(`/programi/editori/${programId}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col">
        <BackButton label={t('builder.programmes.back')} fallback="/programi" className="-ml-2.5" />
        <h1 className="type-display-m">{t('builder.programmes.title')}</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="lg" className="px-3 text-xl" disabled={busy} onClick={() => void build()}>
          {t('builder.programmes.build')}
        </Button>
        {/* "Importo nga PDF" (V2-E1-11): AI-ja lexon PDF-në dhe e hap si draft te ndërtuesi. */}
        <Button variant="outline" size="lg" className="px-3 text-xl" onClick={() => navigate('/programet/importo')}>
          <Icon name="skedari" size={20} />
          {t('ai.entry.import')}
        </Button>
      </div>

      {programs === undefined ? (
        <div aria-hidden className="h-40 rounded-xl bg-surface" />
      ) : (
        <>
          <section aria-labelledby="programmes-active" className="flex flex-col gap-1.5">
            <h2 id="programmes-active" className="type-label text-muted-foreground">
              {t('builder.programmes.active')}
            </h2>
            {active ? <ActiveCard program={active} /> : <p className="type-body text-muted-foreground">{t('builder.programmes.none')}</p>}
          </section>

          {mine.length > 0 ? (
            <section aria-labelledby="programmes-mine" className="flex flex-col gap-1.5">
              <h2 id="programmes-mine" className="type-label text-muted-foreground">
                {t('builder.programmes.mine')}
              </h2>
              <ul className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
                {mine.map((program, index) => (
                  <li key={program.id} className={cn(index > 0 && 'border-t border-border')}>
                    <Link to={`/programi/editori/${program.id}`} className={cn('flex min-h-row items-center justify-between gap-2.5 px-3.5 py-1.5', focusRing)}>
                      <span className="flex min-w-0 flex-col">
                        <span className="type-body-strong">{program.name}</span>
                        <span className="type-caption text-muted-foreground tabular-nums">
                          {[
                            program.draft ? t('builder.programmes.draft') : null,
                            t('builder.count.blocks', { count: program.blocks }),
                            t('builder.count.days', { count: program.days }),
                            program.description,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <Icon name="chevron-djathtas" size={20} className="text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="programmes-templates" className="flex flex-col gap-1.5">
            <h2 id="programmes-templates" className="type-label text-muted-foreground">
              {t('builder.programmes.templates')}
            </h2>
            <TemplateList onOpen={(id) => open('shablloni', { shablloni: id })} />
          </section>
          {/* "Nga miqtë" (programet e ndara me lidhje, V5) vjen me Etapën 4. */}
        </>
      )}

      {sheet === 'shablloni' && template ? (
        <TemplateSheet
          id={template}
          onClose={close}
          onUse={async () => {
            const programId = await createFromTemplate(store, template, names)
            navigate(`/programi/editori/${programId}`, { replace: true })
          }}
        />
      ) : null}
    </div>
  )
}

/** Karta e programit aktiv: emri, java dhe ditët, shiriti i javëve të bëra. */
function ActiveCard({ program }: { program: ProgramSummary }) {
  const { t } = useI18n()
  const { pointer } = program
  const week = pointer ? programWeekLabel(t, pointer) : null
  const current = pointer ? Math.min(pointer.weekOfProgram, program.weeks) : 0
  return (
    <Link to={`/programi/editori/${program.id}`} className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-3.5', focusRing)}>
      <span className="flex items-start justify-between gap-2.5">
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[28px] leading-none font-extrabold break-words uppercase">{program.name}</span>
          {week ? <span className="mt-1 type-caption text-muted-foreground tabular-nums">{t('builder.programmes.activeMeta', { week, count: program.days })}</span> : null}
        </span>
        <span className="flex h-[26px] shrink-0 items-center rounded-pill border border-subtle px-2.5 text-[13px] font-semibold">{t('builder.programmes.activeBadge')}</span>
      </span>
      {pointer ? (
        <span className="flex flex-col gap-1.5">
          <span role="img" aria-label={t('builder.programmes.progressLabel', { current, total: program.weeks })}>
            <ProgressTrack ratio={pointer.completed ? 1 : (current - 1) / program.weeks} />
          </span>
          <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">
            {pointer.completed ? t('builder.programmes.completed') : t('builder.programmes.progress', { current, total: program.weeks })}
          </span>
        </span>
      ) : null}
    </Link>
  )
}

// ——— "Ndërto timin" te hapat e parë (bordi "Hyrja · Programi") ———

/** Nga e para ose nga një shabllon, para strukturës; vetëm brenda hapave të parë. */
export function BuildStartPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { params, sheet, open, close } = useSheet()
  const paths = useEditorPaths()
  const names = useTemplateNames()
  const [busy, setBusy] = useState(false)
  const requested = params.get('shablloni')
  const template = isTemplateId(requested) ? requested : null
  useEffect(() => {
    discardEmptyDrafts(store).catch(() => {})
  }, [])

  async function blank() {
    setBusy(true)
    try {
      const programId = await createBlankProgram(store, { program: t('builder.blank.name'), block: t('builder.blank.block', { number: 1 }), day: t('builder.blank.day', { number: 1 }) })
      navigate(paths.program(programId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorBar icon="back" label={t('builder.onboarding.back')} fallback="/fillimi" title={t('builder.onboarding.title')} />
      <h1 className="type-display-m">{t('builder.onboarding.heading')}</h1>
      <button
        type="button"
        disabled={busy}
        onClick={() => void blank()}
        className={cn(surfaceClass, 'flex min-h-[72px] items-center gap-3.5 rounded-lg px-3.5 py-3 text-left', focusRing)}
      >
        <Icon name="nderto" size={24} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-title">{t('builder.onboarding.blank')}</span>
          <span className="type-caption text-muted-foreground">{t('builder.onboarding.blankText')}</span>
        </span>
        <Icon name="chevron-djathtas" size={20} className="text-muted-foreground" />
      </button>
      <section aria-labelledby="start-templates" className="flex flex-col gap-1.5">
        <h2 id="start-templates" className="type-label text-muted-foreground">
          {t('builder.programmes.templates')}
        </h2>
        <TemplateList onOpen={(id) => open('shablloni', { shablloni: id })} />
      </section>
      <p className="type-caption text-muted-foreground">{t('builder.onboarding.note')}</p>
      {sheet === 'shablloni' && template ? (
        <TemplateSheet
          id={template}
          onClose={close}
          onUse={async () => {
            const programId = await createFromTemplate(store, template, names)
            navigate(paths.program(programId), { replace: true })
          }}
        />
      ) : null}
    </div>
  )
}

// ——— Struktura (bordi "Ndërto") ———

export function ProgramEditorPage() {
  const { t } = useI18n()
  const { programId = '' } = useParams()
  const view = useLocalQuery(() => programEditor(store, programId), [programId])
  const steps = useWeightSteps()
  const { params, sheet, open, close } = useSheet()
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  const paths = useEditorPaths()
  const names = useTemplateNames()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (view === undefined) return <h1 className="sr-only">{t('builder.structure.title')}</h1>
  if (view === null) return <NotFound text={t('builder.notFound.programme')} back={t('builder.structure.back')} fallback={paths.programmes} />

  const totalWeeks = view.blocks.reduce((total, block) => total + block.weeks, 0)
  const block = view.blocks.find((candidate) => candidate.id === params.get('blloku'))
  /** Nga një fletë te tjetra pa shtuar histori: mbrapa i mbyll të dyja. */
  const swap = (name: string) =>
    setParams(
      (current) => {
        current.set('ndrysho', name)
        return current
      },
      { replace: true },
    )

  async function newBlock(current: ProgramEditorView) {
    const last = current.blocks.at(-1)
    await addBlock(store, current.id, { name: t('builder.blank.block', { number: current.blocks.length + 1 }), weeks: last?.weeks ?? 4 })
  }

  async function newDay(current: ProgramEditorView) {
    const dayId = await addDay(store, current.id, t('builder.blank.day', { number: current.days.length + 1 }))
    navigate(paths.day(current.id, dayId))
  }

  async function save(current: ProgramEditorView) {
    setBusy(true)
    setFailed(false)
    try {
      if (paths.onboarding) {
        // Porta (gate.tsx) e sheh profilin e plotësuar dhe e hap Sot vetë.
        await paths.onboarding.finish(current.id)
        return
      }
      await saveDraft(store, current.id)
      open('ruajtur')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  async function start(current: ProgramEditorView) {
    setBusy(true)
    await switchProgram(store, current.id)
    navigate('/programi', { replace: true })
  }

  const footer = paths.onboarding || view.draft ? 'save' : view.active ? null : 'start'
  const templateText = view.template ? t('builder.template.startedFrom', { name: names.program[view.template] }) : null

  return (
    <div className="flex flex-col gap-4">
      <EditorBar
        icon={view.draft ? 'close' : 'back'}
        label={view.draft ? t('builder.structure.close') : t('builder.structure.back')}
        fallback={paths.programmes}
        title={view.draft ? t('builder.structure.newTitle') : t('builder.structure.title')}
        heading
        action={paths.onboarding ? undefined : <MoreButton label={t('builder.structure.more')} onClick={() => open('me-shume')} />}
      />

      <ProgramName key={view.name} view={view} hint={templateText} />

      <section aria-labelledby="structure-blocks" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="structure-blocks" className="type-title">
            {t('builder.structure.blocks')}
          </h2>
          <span className="type-caption text-muted-foreground tabular-nums">{t('builder.structure.totalWeeks', { count: totalWeeks })}</span>
        </div>
        {view.blocks.map((entry, index) => {
          const name = programBlockName(t, entry.name)
          const span = blockSpan(t, view.blocks, index)
          return (
            <div key={entry.id} className={cn(surfaceClass, 'flex min-h-row items-center gap-2.5 rounded-lg py-1.5 pr-1.5 pl-3')}>
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-[13px] font-bold text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <button
                type="button"
                aria-label={t('builder.structure.blockLabel', { name, weeks: span })}
                onClick={() => open('blloku', { blloku: entry.id })}
                className={cn('flex min-h-touch min-w-0 flex-1 flex-col justify-center text-left', focusRing)}
              >
                <span className="truncate type-body-strong">{name}</span>
                <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{span}</span>
              </button>
              <div role="group" aria-label={t('builder.structure.weeksOf', { name })} className="flex shrink-0 items-center gap-1">
                <StepButton label={t('builder.structure.weekLess')} sign="−" disabled={entry.weeks <= 1} onClick={() => void updateBlock(store, entry.id, { weeks: entry.weeks - 1 })} />
                <span className="w-[58px] text-center font-display text-xl font-bold tabular-nums">{t('builder.count.weeks', { count: entry.weeks })}</span>
                <StepButton label={t('builder.structure.weekMore')} sign="+" disabled={entry.weeks >= MAX_WEEKS} onClick={() => void updateBlock(store, entry.id, { weeks: entry.weeks + 1 })} />
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => void newBlock(view)}
          className={cn('flex h-12 items-center justify-center gap-2 rounded-md border border-dashed border-subtle font-display text-lg font-bold tracking-[0.02em] uppercase', focusRing)}
        >
          <Icon name="plus" size={20} />
          {t('builder.structure.addBlock')}
        </button>
      </section>

      <section aria-labelledby="structure-days" className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <h2 id="structure-days" className="type-title">
              {t('builder.structure.days')}
            </h2>
            <span className="type-caption text-muted-foreground tabular-nums">{t('builder.structure.perWeek', { count: view.days.length })}</span>
          </div>
          <Button variant="secondary" ground="page" size="icon" aria-label={t('builder.structure.addDay')} onClick={() => void newDay(view)}>
            <Icon name="plus" size={20} />
          </Button>
        </div>
        <ul className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
          {view.days.map((day, index) => {
            const plan = view.plan(view.blocks[0].id, 1, day.id)
            const detail = [t('builder.count.exercises', { count: day.slots.length }), day.slots.length ? t('builder.minutes', { minutes: workoutMinutes(plan.slots) }) : null]
              .filter(Boolean)
              .join(' · ')
            const name = programDayName(t, day.name)
            return (
              <li key={day.id} className={cn(index > 0 && 'border-t border-border')}>
                <Link
                  to={paths.day(view.id, day.id)}
                  aria-label={t('builder.structure.dayLabel', { number: day.number, name, detail })}
                  className={cn('flex min-h-row items-center gap-3 py-1.5 pr-3.5 pl-3', focusRing)}
                >
                  <span aria-hidden className="w-7 text-center font-display text-[22px] font-extrabold text-muted-foreground tabular-nums">
                    {day.number}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate type-body-strong">{name}</span>
                    <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{detail}</span>
                  </span>
                  <Icon name="chevron-djathtas" size={20} className="text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <SmartCard view={view} dumbbellStep={weightStep('dumbbell', steps ?? {})} />

      {footer ? (
        <EditorFooter>
          {failed ? (
            <p role="alert" className="type-caption text-danger">
              {t('builder.onboarding.failed')}
            </p>
          ) : null}
          {footer === 'save' ? (
            <Button variant="primary" size="xl" disabled={busy} onClick={() => void save(view)}>
              {busy ? t('builder.saving') : t('builder.save')}
            </Button>
          ) : (
            <Button variant="primary" size="xl" disabled={busy} onClick={() => void start(view)}>
              {t('builder.start')}
            </Button>
          )}
        </EditorFooter>
      ) : null}

      {sheet === 'blloku' && block ? <BlockSheet view={view} blockId={block.id} onClose={close} /> : null}
      {sheet === 'kopjo-javen' ? <CopyWeekSheet view={view} onClose={close} /> : null}
      {sheet === 'me-shume' ? (
        <Sheet title={view.name} onClose={close}>
          <SheetAction label={t('builder.more.copyWeek')} detail={t('builder.more.copyWeekText')} onClick={() => swap('kopjo-javen')} />
          <SheetAction
            label={t('builder.more.copyProgramme')}
            detail={t('builder.more.copyProgrammeText')}
            onClick={() => void duplicateProgram(store, view.id, t('builder.copyName', { name: view.name })).then((copyId) => navigate(paths.program(copyId), { replace: true }))}
          />
          <SheetAction
            label={t('builder.more.delete')}
            detail={view.active ? t('builder.more.deleteActive') : t('builder.more.deleteText')}
            disabled={view.active}
            danger
            onClick={() => swap('fshi')}
          />
        </Sheet>
      ) : null}
      {sheet === 'fshi' && !view.active ? (
        <ConfirmSheet
          title={t('builder.more.delete')}
          text={t('builder.more.deleteConfirm', { name: view.name })}
          action={t('builder.more.delete')}
          onClose={close}
          onConfirm={async () => {
            await deleteProgram(store, view.id)
            navigate(paths.programmes, { replace: true })
          }}
        />
      ) : null}
      {sheet === 'ruajtur' ? (
        <Sheet
          title={t('builder.saved.title')}
          description={t('builder.saved.text', { name: view.name })}
          onClose={() => navigate(paths.programmes, { replace: true })}
          footer={
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="xl" disabled={busy} onClick={() => void start(view)}>
                {t('builder.start')}
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate(paths.programmes, { replace: true })}>
                {t('builder.later')}
              </Button>
            </div>
          }
        />
      ) : null}
    </div>
  )
}

/** Emri i programit: ruhet kur del nga fusha ose me Enter; bosh kthehet te i mëparshmi. */
function ProgramName({ view, hint }: { view: ProgramEditorView; hint: string | null }) {
  const { t } = useI18n()
  const [name, setName] = useState(view.name)
  const inputId = useId()
  const hintId = useId()
  const commit = () => {
    const clean = name.trim()
    if (!clean) setName(view.name)
    else if (clean !== view.name) void renameProgram(store, view.id, clean)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="type-caption text-muted-foreground">
        {t('builder.structure.name')}
      </label>
      <input
        id={inputId}
        value={name}
        maxLength={60}
        autoComplete="off"
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => setName(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className={cn('h-14 w-full min-w-0 rounded-md border border-border bg-surface px-3.5 font-display text-[28px] font-extrabold text-foreground uppercase', focusRing)}
      />
      {hint ? (
        <span id={hintId} className="type-caption text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

/** "Progresi i zgjuar · Për gjithë programin": çelësi, pragu i RIR-it dhe shtesa (SPEC §4, V9). */
function SmartCard({ view, dumbbellStep }: { view: ProgramEditorView; dumbbellStep: number }) {
  const { t, fmt } = useI18n()
  const rule = view.progression
  const set = (next: ProgressionRule | null) => void setProgramProgression(store, view.id, next)
  return (
    <section aria-labelledby="structure-smart" className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-3.5')}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-col">
          <h2 id="structure-smart" className="type-title">
            {t('builder.smart.title')}
          </h2>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('builder.smart.forProgramme')}</span>
        </div>
        <Switch checked={rule !== null} label={t('builder.smart.title')} onChange={(on) => set(on ? { minRir: 2, incrementKg: 2.5 } : null)} />
      </div>
      {rule ? (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 type-body-l">
            <span>{t('builder.smart.when')}</span>
            <SelectButton
              label={t('builder.smart.rir')}
              value={rule.minRir}
              options={RIR_OPTIONS.map((value) => ({ value, label: t('builder.smart.rirOption', { rir: value }) }))}
              onChange={(minRir) => set({ ...rule, minRir })}
            />
            <span>{t('builder.smart.add')}</span>
            <SelectButton
              label={t('builder.smart.increment')}
              value={rule.incrementKg}
              options={INCREMENTS.map((value) => ({ value, label: `+${fmt.unit(value, 'kg')}` }))}
              onChange={(incrementKg) => set({ ...rule, incrementKg })}
            />
            <span>{t('builder.smart.nextTime')}</span>
          </div>
          <p className="type-caption text-muted-foreground">{t('builder.smart.note', { dumbbell: progressionIncrement(rule.incrementKg, dumbbellStep) })}</p>
        </>
      ) : (
        <p className="type-caption text-muted-foreground">{t('builder.smart.off')}</p>
      )}
    </section>
  )
}

/** Blloku: emri, radha, kopja dhe fshirja (javët ndryshohen te rreshti). */
function BlockSheet({ view, blockId, onClose }: { view: ProgramEditorView; blockId: string; onClose: () => void }) {
  const { t } = useI18n()
  const index = view.blocks.findIndex((candidate) => candidate.id === blockId)
  const block = view.blocks[index]
  const [name, setName] = useState(programBlockName(t, block.name))
  const [confirm, setConfirm] = useState(false)
  const nameId = useId()
  const only = view.blocks.length === 1
  const footer = (
    <Button
      variant="primary"
      size="xl"
      onClick={() => {
        const clean = name.trim()
        if (clean && clean !== programBlockName(t, block.name)) void updateBlock(store, blockId, { name: clean })
        onClose()
      }}
    >
      {t('common.save')}
    </Button>
  )
  return (
    <Sheet title={programBlockName(t, block.name)} description={blockSpan(t, view.blocks, index)} onClose={onClose} footer={footer}>
      <label htmlFor={nameId} className="type-label text-muted-foreground">
        {t('builder.block.name')}
      </label>
      <input
        id={nameId}
        value={name}
        maxLength={40}
        autoComplete="off"
        onChange={(event) => setName(event.currentTarget.value)}
        className={cn('h-button w-full rounded-md border border-border bg-surface-2 px-3.5 text-lg font-semibold text-foreground', focusRing)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" disabled={index === 0} onClick={() => void moveBlock(store, blockId, -1)}>
          <Icon name="chevron-lart" size={20} />
          {t('builder.block.up')}
        </Button>
        <Button variant="secondary" size="lg" disabled={index === view.blocks.length - 1} onClick={() => void moveBlock(store, blockId, 1)}>
          <Icon name="chevron-poshte" size={20} />
          {t('builder.block.down')}
        </Button>
      </div>
      <Button variant="secondary" size="lg" onClick={() => void copyBlock(store, blockId).then(onClose)}>
        {t('builder.block.copy')}
      </Button>
      {confirm ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-danger p-3">
          <p className="type-body">{t('builder.block.deleteConfirm', { name: programBlockName(t, block.name) })}</p>
          <Button variant="secondary" size="lg" className="text-danger" onClick={() => void removeBlock(store, blockId).then(onClose)}>
            {t('builder.block.deleteYes')}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="lg" className="text-danger" disabled={only} onClick={() => setConfirm(true)}>
          {only ? t('builder.block.deleteOnly') : t('builder.block.delete')}
        </Button>
      )}
    </Sheet>
  )
}

/** "Kopjo javën": rregullat e një jave kalojnë te një tjetër. */
function CopyWeekSheet({ view, onClose }: { view: ProgramEditorView; onClose: () => void }) {
  const { t } = useI18n()
  const weeks = view.blocks.flatMap((block) =>
    Array.from({ length: block.weeks }, (_, index) => ({ value: `${block.id}:${index + 1}`, label: t('builder.weekOf', { block: programBlockName(t, block.name), week: index + 1 }) })),
  )
  const [from, setFrom] = useState(weeks[0]?.value ?? '')
  const [to, setTo] = useState(weeks[1]?.value ?? weeks[0]?.value ?? '')
  const fromId = useId()
  const toId = useId()
  const parse = (value: string) => {
    const [blockId, week] = value.split(':')
    return { blockId, week: Number(week) }
  }
  const select = cn('h-button w-full appearance-none rounded-md border border-border bg-surface-2 px-3.5 text-base text-foreground', focusRing)
  const footer = (
    <Button variant="primary" size="xl" disabled={from === to} onClick={() => void copyWeek(store, view.id, parse(from), parse(to)).then(onClose)}>
      {t('builder.copyWeek.action')}
    </Button>
  )
  return (
    <Sheet title={t('builder.more.copyWeek')} onClose={onClose} footer={footer}>
      <p className="type-body text-muted-foreground">{t('builder.copyWeek.text')}</p>
      <label htmlFor={fromId} className="type-label text-muted-foreground">
        {t('builder.copyWeek.from')}
      </label>
      <select id={fromId} value={from} onChange={(event) => setFrom(event.currentTarget.value)} className={select}>
        {weeks.map((week) => (
          <option key={week.value} value={week.value}>
            {week.label}
          </option>
        ))}
      </select>
      <label htmlFor={toId} className="type-label text-muted-foreground">
        {t('builder.copyWeek.to')}
      </label>
      <select id={toId} value={to} onChange={(event) => setTo(event.currentTarget.value)} className={select}>
        {weeks.map((week) => (
          <option key={week.value} value={week.value}>
            {week.label}
          </option>
        ))}
      </select>
    </Sheet>
  )
}

// ——— Dita (bordi "Dita") ———

interface SlotItem {
  id: string
  /** "1 · Bench Press". */
  name: string
  /** "Bench Press", për lexuesin e ekranit. */
  exercise: string
  libraryId: string | null
  summary: string
  notes: string[]
}

export function DayEditorPage() {
  const { t, fmt } = useI18n()
  const { programId = '', dayId = '' } = useParams()
  const view = useLocalQuery(() => programEditor(store, programId), [programId])
  const { sheet, open, close } = useSheet()
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  const paths = useEditorPaths()
  const [busy, setBusy] = useState(false)
  if (view === undefined) return <h1 className="sr-only">{t('builder.day.name')}</h1>
  const index = view?.days.findIndex((candidate) => candidate.id === dayId) ?? -1
  const day = view?.days[index]
  if (!view || !day) return <NotFound text={t('builder.notFound.day')} back={t('builder.day.back')} fallback={view ? paths.program(view.id) : paths.programmes} />

  const only = view.days.length === 1
  const dayName = programDayName(t, day.name)
  const base = { blockId: null, week: null }
  const items: SlotItem[] = day.slots.map((slot, position) => {
    const at = (blockId: string | null) => {
      const rules = slotRules(view.engine, slot.id, blockId ? { blockId, week: null } : base)
      const exercise = view.exercises[rules.exerciseId.value]?.name ?? ''
      return { exercise, rest: rules.restSeconds.value, text: slotSummary(t, fmt, { sets: rules.sets.value, restSeconds: rules.restSeconds.value, prescription: rules.prescription.value }) }
    }
    const program = at(null)
    // Blloqet që e ndryshojnë ushtrimin (bordi: "Te blloku Forca: 4 × 4–6 · RIR 1").
    const notes = view.blocks.flatMap((block) => {
      const own = at(block.id)
      if (own.text === program.text && own.exercise === program.exercise) return []
      const rules = slotRules(view.engine, slot.id, { blockId: block.id, week: null })
      const short = [`${fmt.number(rules.sets.value)} × ${prescriptionValue(t, fmt, rules.prescription.value)}`]
      if (rules.prescription.value?.type === 'rir') short.push(rirText(t, fmt, rules.prescription.value.rir))
      if (own.rest !== program.rest) short.push(t('builder.summary.rest', { time: clock(own.rest) }))
      const summary = [own.exercise !== program.exercise ? own.exercise : null, short.join(' · ')].filter(Boolean).join(' · ')
      return [t('builder.day.inBlock', { block: programBlockName(t, block.name), summary })]
    })
    return { id: slot.id, name: `${fmt.number(position + 1)} · ${slot.name}`, exercise: slot.name, libraryId: slot.libraryId, summary: program.text, notes }
  })
  const plan = view.plan(view.blocks[0].id, 1, day.id)
  const meta = [
    t('builder.day.meta', { number: day.number, total: view.days.length }),
    t('builder.count.exercises', { count: day.slots.length }),
    day.slots.length ? t('builder.minutes', { minutes: workoutMinutes(plan.slots) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const swap = (name: string) =>
    setParams(
      (current) => {
        current.set('ndrysho', name)
        return current
      },
      { replace: true },
    )

  return (
    <div className="flex flex-col gap-3.5">
      <EditorBar icon="back" label={t('builder.day.back')} fallback={paths.program(view.id)} title={view.name} action={<MoreButton label={t('builder.day.more')} onClick={() => open('me-shume')} />} />

      <div className="flex items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="type-caption text-muted-foreground tabular-nums">{meta}</span>
          <h1 className="type-display-m break-words">{dayName}</h1>
        </div>
        <Button variant="secondary" ground="page" size="icon" aria-label={t('builder.day.rename')} onClick={() => open('emri')}>
          <Icon name="laps" size={20} />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="type-body text-muted-foreground">{t('builder.day.empty')}</p>
      ) : (
        <>
          <SlotList items={items} to={(slotId) => paths.slot(view.id, slotId)} onReorder={(ids) => reorderSlots(store, day.id, ids)} />
          <p className="type-caption text-muted-foreground">{t('builder.day.hint')}</p>
        </>
      )}

      <EditorFooter>
        <Button variant="primary" size="xl" onClick={() => open('shto')}>
          <Icon name="plus" size={22} />
          {t('builder.day.add')}
        </Button>
      </EditorFooter>

      {sheet === 'emri' ? (
        <NameSheet
          title={t('builder.day.name')}
          label={t('builder.block.name')}
          initial={dayName}
          onClose={close}
          onSave={async (name) => {
            await renameDay(store, day.id, name)
            close()
          }}
        />
      ) : null}
      {sheet === 'shto' ? (
        <Sheet
          title={t('builder.day.add')}
          description={t('builder.day.addNote', { day: dayName, sets: 3, range: '8–12', rir: 2 })}
          onClose={close}
        >
          <LibraryPicker
            busy={busy}
            onPick={(item) => {
              setBusy(true)
              void addSlotFromLibrary(store, day.id, item)
                .then((slotId) => editSlot(store, slotId, base, { prescription: DEFAULT_PRESCRIPTION }))
                .finally(() => {
                  setBusy(false)
                  close()
                })
            }}
          />
        </Sheet>
      ) : null}
      {sheet === 'me-shume' ? (
        <Sheet title={dayName} description={meta} onClose={close}>
          <SheetAction
            label={t('builder.day.copy')}
            detail={t('builder.day.copyText')}
            onClick={() => void copyDay(store, day.id, t('builder.copyName', { name: dayName })).then((copyId) => navigate(paths.day(view.id, copyId), { replace: true }))}
          />
          <SheetAction label={t('builder.day.up')} disabled={index === 0} onClick={() => void moveDay(store, day.id, -1).then(close)} />
          <SheetAction label={t('builder.day.down')} disabled={index === view.days.length - 1} onClick={() => void moveDay(store, day.id, 1).then(close)} />
          <SheetAction label={t('builder.day.delete')} detail={only ? t('builder.day.deleteOnly') : undefined} disabled={only} danger onClick={() => swap('fshi')} />
        </Sheet>
      ) : null}
      {sheet === 'fshi' && !only ? (
        <ConfirmSheet
          title={t('builder.day.delete')}
          text={t('builder.day.deleteConfirm', { name: dayName })}
          action={t('builder.day.delete')}
          onClose={close}
          onConfirm={async () => {
            await removeDay(store, day.id)
            navigate(paths.program(view.id), { replace: true })
          }}
        />
      ) : null}
    </div>
  )
}

const GAP = 8
const LONG_PRESS_MS = 250

interface DragState {
  id: string
  from: number
  to: number
  offset: number
  /** Lartësia e rreshtit që lëviz plus hapësira, sa zhvendosen të tjerët. */
  step: number
}

/**
 * Ushtrimet e ditës me radhë (bordi "Dita"): prekja e gjatë te doreza dhe tërheqja i rendit (Pointer
 * Events, pa varësi); me miun tërheqja nis menjëherë. Prekja e shkurtër e dorezës (ose Enter) shfaq
 * "lart" dhe "poshtë" 44 px, dhe shigjetat e tastierës lëvizin ushtrimin, për aksesueshmërinë.
 */
function SlotList({ items, to, onReorder }: { items: SlotItem[]; to: (slotId: string) => string; onReorder: (ids: string[]) => Promise<void> }) {
  const { t } = useI18n()
  const incoming = items.map((item) => item.id)
  // Radha e tërheqjes, deri sa store-i të sjellë të renë (`base`: radha e store-it kur u bë).
  const [optimistic, setOptimistic] = useState<{ ids: string[]; base: string } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const rows = useRef(new Map<string, HTMLLIElement>())
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const press = useRef<{ id: string; pointerId: number; startY: number; timer: number; started: boolean; rects: DOMRect[]; from: number; mouse: boolean } | null>(null)
  const suppressClick = useRef(false)

  // Radha e store-it fiton sapo ndryshon; deri atëherë mbetet ajo e tërheqjes, që lista të mos kërcejë.
  const ids = optimistic && optimistic.base === incoming.join() ? optimistic.ids : incoming
  useEffect(() => () => window.clearTimeout(press.current?.timer), [])
  const byId = new Map(items.map((item) => [item.id, item]))

  function commit(next: string[], movedId: string) {
    setOptimistic({ ids: next, base: incoming.join() })
    const item = byId.get(movedId)
    if (item) setAnnouncement(t('builder.day.moved', { name: item.exercise, position: next.indexOf(movedId) + 1, total: next.length }))
    void onReorder(next).catch(() => setOptimistic(null))
  }

  function moveBy(id: string, delta: -1 | 1) {
    const from = ids.indexOf(id)
    const target = from + delta
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(target, 0, id)
    commit(next, id)
    // Fokusi mbetet te doreza e të njëjtit ushtrim, në vendin e ri.
    requestAnimationFrame(() => handles.current.get(id)?.focus())
  }

  function begin() {
    const current = press.current
    if (!current) return
    current.started = true
    setDrag({ id: current.id, from: current.from, to: current.from, offset: 0, step: current.rects[current.from].height + GAP })
    setMoving(null)
    navigator.vibrate?.(10)
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return
    const rects = ids.map((rowId) => rows.current.get(rowId)?.getBoundingClientRect() ?? new DOMRect())
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const mouse = event.pointerType === 'mouse'
    press.current = { id, pointerId: event.pointerId, startY: event.clientY, timer: mouse ? 0 : window.setTimeout(begin, LONG_PRESS_MS), started: false, rects, from: ids.indexOf(id), mouse }
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = press.current
    if (!current || current.pointerId !== event.pointerId) return
    const offset = event.clientY - current.startY
    if (!current.started) {
      if (current.mouse && Math.abs(offset) > 4) begin()
      else if (!current.mouse && Math.abs(offset) > 8) cancel()
      if (!press.current?.started) return
    }
    const { rects, from } = current
    const center = rects[from].top + rects[from].height / 2 + offset
    const target = rects.filter((rect, index) => index !== from && rect.top + rect.height / 2 < center).length
    setDrag({ id: current.id, from, to: target, offset, step: rects[from].height + GAP })
  }

  function cancel() {
    window.clearTimeout(press.current?.timer)
    press.current = null
    setDrag(null)
  }

  function onPointerUp() {
    const current = press.current
    window.clearTimeout(current?.timer)
    if (current?.started && drag) {
      suppressClick.current = true
      if (drag.to !== drag.from) {
        const next = [...ids]
        next.splice(drag.from, 1)
        next.splice(drag.to, 0, drag.id)
        commit(next, drag.id)
      }
    }
    press.current = null
    setDrag(null)
  }

  function onHandleKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (moving !== id) return
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveBy(id, event.key === 'ArrowUp' ? -1 : 1)
    }
    if (event.key === 'Escape') setMoving(null)
  }

  /** Sa zhvendoset një rresht tjetër gjatë tërheqjes, që t'i lërë vend atij që lëviz. */
  function shift(index: number): number {
    if (!drag) return 0
    if (drag.to > drag.from && index > drag.from && index <= drag.to) return -drag.step
    if (drag.to < drag.from && index >= drag.to && index < drag.from) return drag.step
    return 0
  }

  return (
    <>
      <ol aria-label={t('builder.day.list')} className="flex flex-col gap-2">
        {ids.map((id, index) => {
          const item = byId.get(id)!
          const name = item.exercise
          const dragging = drag?.id === id
          const lifted = dragging || moving === id
          return (
            <li
              key={id}
              ref={(node) => {
                if (node) rows.current.set(id, node)
                else rows.current.delete(id)
              }}
              aria-label={dragging ? t('builder.day.dragging', { name }) : undefined}
              style={{ transform: dragging ? `translate(6px, ${drag.offset}px) rotate(-1deg)` : shift(index) ? `translateY(${shift(index)}px)` : undefined }}
              className={cn(
                'relative flex min-h-[76px] items-center rounded-lg border',
                lifted ? 'z-10 border-foreground bg-surface-2' : 'border-surface-border bg-surface',
                drag && !dragging && 'transition-transform duration-200 ease-out',
              )}
            >
              <button
                ref={(node) => {
                  if (node) handles.current.set(id, node)
                  else handles.current.delete(id)
                }}
                type="button"
                aria-label={t('builder.day.handle', { name })}
                aria-pressed={lifted}
                onPointerDown={(event) => onPointerDown(event, id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={cancel}
                onContextMenu={(event) => event.preventDefault()}
                onKeyDown={(event) => onHandleKey(event, id)}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false
                    return
                  }
                  setMoving((current) => (current === id ? null : id))
                }}
                className={cn('flex h-14 w-touch shrink-0 touch-none items-center justify-center rounded-md select-none', lifted ? 'text-foreground' : 'text-muted-foreground', focusRing)}
              >
                <Icon name="doreza" size={20} />
              </button>
              <Link to={to(id)} draggable={false} className={cn('flex min-h-[74px] min-w-0 flex-1 items-center gap-3 py-2 pr-3', focusRing)}>
                <ExercisePhoto libraryId={item.libraryId} size="square" ground="card" className="size-14 rounded-sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="type-body-strong break-words">{item.name}</span>
                  <span className="type-caption text-muted-foreground tabular-nums">{item.summary}</span>
                  {item.notes.map((note) => (
                    <span key={note} className="text-[13px] leading-[1.35] text-data tabular-nums">
                      {note}
                    </span>
                  ))}
                </span>
              </Link>
              {moving === id ? (
                <div className="flex shrink-0 flex-col gap-1 py-1 pr-1">
                  <Button variant="secondary" size="icon" aria-label={t('builder.day.moveUp', { name })} disabled={index === 0} onClick={() => moveBy(id, -1)}>
                    <Icon name="chevron-lart" size={20} />
                  </Button>
                  <Button variant="secondary" size="icon" aria-label={t('builder.day.moveDown', { name })} disabled={index === ids.length - 1} onClick={() => moveBy(id, 1)}>
                    <Icon name="chevron-poshte" size={20} />
                  </Button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
