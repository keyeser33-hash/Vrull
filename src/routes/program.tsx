import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { BodyFigure } from '@/components/body/body-figure'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { programView, setExerciseVideo, trainingHistory, type ProgramView } from '@/data/training'
import { currentOneRm, e1rm, type HistorySet } from '@/program/loads'
import { e1rmSeries } from '@/progress/strength'
import { TrendChart } from '@/components/charts/trend-chart'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { DayStatus, OverviewWeek } from '@/program/overview'
import { cn } from '@/lib/cn'
import { embedUrl, watchUrl, youtubeId } from '@/lib/youtube'
import { editorPath } from './editor-nav'
import { ExerciseMusclesSheet } from './exercise-muscles'
import { ChangeExerciseSheet } from './session-sheets'
import { dateLabel, EQUIPMENT_LABEL, kg, setsText, techniqueText } from './training-format'

// Programi, varianti A (vendim i 07.11.2026, referencat nga Mobbin: Equinox+, Gymshark, Centr):
// paneli i ecurisë sipër, javët si butona, stërvitjet e javës me gjendjen me fjalë. Prej këtu
// hapet një stërvitje çfarëdo dhe ekrani i një ushtrimi me videon (SPEC §12).

const STATUS: Record<DayStatus, { label: string; className: string } | null> = {
  done: { label: 'Bërë', className: 'bg-success-soft text-success' },
  skipped: { label: 'Kapërcyer', className: 'bg-secondary text-muted-foreground' },
  next: { label: 'E radhës', className: 'bg-brand-soft text-foreground' },
  upcoming: null,
}

function StatusBadge({ status }: { status: DayStatus }) {
  const value = STATUS[status]
  return value ? <span className={cn('rounded-full px-2.5 py-1 text-xs leading-4 font-medium', value.className)}>{value.label}</span> : null
}

const dayPath = (week: OverviewWeek, dayId: string) => `/programi/${week.blockId}/${week.week}/${dayId}`

export function ProgramPage() {
  const view = useLocalQuery(() => programView(store), [])
  const [params, setParams] = useSearchParams()
  if (view === undefined) return <h1 className="sr-only">Programi</h1>
  if (view === null) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h1 className="text-lg leading-7 font-semibold">Pa program aktiv</h1>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">Programi i zgjedhur shfaqet këtu me javët dhe stërvitjet.</p>
        <Link to="/programet" className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 w-full')}>
          Programet
        </Link>
      </section>
    )
  }
  const { overview } = view
  const selected = Math.min(Number(params.get('java') ?? overview.currentWeek), overview.weeks.length - 1)
  const week = overview.weeks[selected]
  const current = overview.weeks[overview.currentWeek]
  const blocks = [...new Map(overview.weeks.map((entry) => [entry.blockId, entry.blockName])).entries()]

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="program-title" className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground">
        <span className="text-xs leading-4 font-medium text-panel-muted-foreground">{view.pointer.completed ? 'Përfunduar' : current.label}</span>
        <h1 id="program-title" className="text-3xl leading-9 font-bold tracking-[-0.025em]">
          {view.programName}
        </h1>
        <span className="text-sm leading-5 text-panel-muted-foreground tabular-nums">
          {overview.doneWorkouts} nga {overview.totalWorkouts} stërvitje
        </span>
        <div aria-hidden className="flex gap-1">
          {blocks.map(([blockId]) => (
            <div key={blockId} className="flex flex-1 gap-[3px]" style={{ flexGrow: overview.weeks.filter((entry) => entry.blockId === blockId).length }}>
              {overview.weeks
                .filter((entry) => entry.blockId === blockId)
                .map((entry) => {
                  const done = entry.days.every((day) => day.status === 'done' || day.status === 'skipped')
                  const isCurrent = entry === current && !view.pointer.completed
                  return (
                    <span
                      key={entry.short}
                      className={cn('h-1.5 flex-1 rounded-full', isCurrent ? 'bg-brand' : done ? 'bg-panel-foreground' : 'bg-panel-border')}
                    />
                  )
                })}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Link to={editorPath(view.programId)} className={buttonVariants({ variant: 'panel' })}>
            Ndrysho programin
          </Link>
          <Link to="/programet" className={buttonVariants({ variant: 'panel' })}>
            Programet
          </Link>
        </div>
      </section>

      <nav aria-label="Javët e programit" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {overview.weeks.map((entry, index) => (
            <button
              key={entry.short}
              type="button"
              aria-pressed={index === selected}
              aria-label={entry.label}
              onClick={() => setParams({ java: String(index) }, { replace: true })}
              className={cn(
                'h-11 min-w-11 rounded-full border px-4 text-sm font-semibold tabular-nums',
                index === selected ? 'border-foreground bg-selected text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {entry.short}
            </button>
          ))}
        </div>
      </nav>

      <section aria-labelledby="week-title" className="flex flex-col">
        <h2 id="week-title" className="mb-1.5 text-sm leading-5 font-semibold">
          {week.label}
        </h2>
        <ul className="flex flex-col gap-2">
          {week.days.map((day) => (
            <li key={day.dayId}>
              <WorkoutCard view={view} week={week} dayId={day.dayId} dayNumber={day.dayNumber} name={day.name} status={day.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function WorkoutCard({
  view,
  week,
  dayId,
  dayNumber,
  name,
  status,
}: {
  view: ProgramView
  week: OverviewWeek
  dayId: string
  dayNumber: number
  name: string
  status: DayStatus
}) {
  const plan = view.plan(week.blockId, week.week, dayId)
  const primary = [...new Set(plan.slots.flatMap((slot) => view.exercises[slot.exerciseId]?.primary ?? []))]
  const sets = plan.slots.reduce((total, slot) => total + slot.sets, 0)
  return (
    <Link
      to={dayPath(week, dayId)}
      className="flex min-h-[72px] items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent"
    >
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-md bg-panel">
        <BodyFigure primary={primary} scale={0.36} className="[&_figcaption]:hidden" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base leading-6 font-semibold">Stërvitja {dayNumber}</span>
        <span className="truncate text-sm leading-5 text-muted-foreground">{name}</span>
        <span className="text-xs leading-4 text-muted-foreground tabular-nums">
          {plan.slots.length} ushtrime · {sets} sete
        </span>
      </span>
      <StatusBadge status={status} />
      <Icon name="chevron-djathtas" size={16} className="text-muted-foreground" />
    </Link>
  )
}

/** Një stërvitje e programit, në çdo javë: ushtrimet, setet, intervali dhe teknika. */
export function WorkoutPage() {
  const { blockId = '', week = '1', dayId = '' } = useParams()
  const view = useLocalQuery(() => programView(store), [])
  if (!view) return <h1 className="sr-only">Stërvitja</h1>
  const entry = view.overview.weeks.find((candidate) => candidate.blockId === blockId && candidate.week === Number(week))
  const day = entry?.days.find((candidate) => candidate.dayId === dayId)
  if (!entry || !day) return <p className="text-sm text-muted-foreground">Kjo stërvitje nuk është më në program.</p>
  const plan = view.plan(blockId, Number(week), dayId)
  return (
    <div className="flex flex-col gap-4">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te programi" />
      </header>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm leading-5 text-muted-foreground">{entry.label}</span>
          <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em]">Stërvitja {day.dayNumber}</h1>
          <span className="text-base leading-6">{day.name}</span>
        </div>
        <StatusBadge status={day.status} />
      </div>
      <ol className="flex flex-col">
        {plan.slots.map((slot, index) => {
          const exercise = view.exercises[slot.exerciseId]
          const technique = techniqueText(slot.technique)
          const query = new URLSearchParams({ blloku: blockId, java: week, dita: dayId, slot: slot.slotId })
          return (
            <li key={slot.slotId} className="border-t border-border-subtle first:border-t-0">
              <Link to={`/ushtrimi/${slot.exerciseId}?${query}`} className="flex min-h-14 items-center gap-3 py-1 tabular-nums">
                <span className="w-5 text-sm leading-5 text-muted-foreground">{index + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base leading-6 font-medium">{exercise?.name}</span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {[setsText(slot.sets, slot.target), technique ? `seti i fundit ${technique}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="chevron-djathtas" size={16} className="text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Ekrani i një ushtrimi: muskujt, videoja, historia e shkurtër dhe ndërrimi për fazën. */
export function ExercisePage() {
  const { exerciseId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const view = useLocalQuery(() => programView(store), [])
  const history = useLocalQuery(() => trainingHistory(store), [])
  const [now] = useState(() => new Date())
  const exercise = view?.exercises[exerciseId]
  if (!view || !history) return <h1 className="sr-only">Ushtrimi</h1>
  if (!exercise) return <p className="text-sm text-muted-foreground">Ky ushtrim nuk gjendet.</p>

  const sets = history.sets.filter((set) => set.exerciseId === exerciseId && !set.isWarmup)
  const oneRm = currentOneRm(history.sets, exerciseId, now, history.overrides[exerciseId] ?? null)
  const best = sets.reduce<(typeof sets)[number] | null>((top, set) => {
    const value = e1rm(set.weightKg, set.reps, set.rir) ?? 0
    return value > (top ? (e1rm(top.weightKg, top.reps, top.rir) ?? 0) : 0) ? set : top
  }, null)
  const last = sets.at(-1)
  const videoId = exercise.videoUrl ? youtubeId(exercise.videoUrl) : null
  const blockId = params.get('blloku')
  const week = Number(params.get('java') ?? 0)
  const dayId = params.get('dita')
  const slotId = params.get('slot')
  const plan = blockId && dayId && week ? view.plan(blockId, week, dayId) : null
  const slot = plan?.slots.find((candidate) => candidate.slotId === slotId)
  const blockName = view.overview.weeks.find((entry) => entry.blockId === blockId)?.blockName
  const editor = params.get('ndrysho')
  const open = (name: string) => setParams((current) => (current.set('ndrysho', name), current))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu" />
      </header>
      <section aria-labelledby="exercise-title" className="flex gap-3 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs leading-4 font-medium text-panel-muted-foreground">{EQUIPMENT_LABEL[exercise.equipment]}</span>
          <h1 id="exercise-title" className="text-3xl leading-9 font-bold tracking-[-0.025em]">
            {exercise.name}
          </h1>
          <span className="text-sm leading-5 text-panel-muted-foreground">{musclesText(exercise.primary, exercise.secondary)}</span>
          <button type="button" onClick={() => open('muskujt')} className={cn(buttonVariants({ variant: 'panel' }), 'mt-2 self-start')}>
            Shiko muskujt
          </button>
        </div>
        <BodyFigure primary={exercise.primary} secondary={exercise.secondary} label={`Muskujt e ${exercise.name}`} />
      </section>

      <section aria-labelledby="video-title" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="video-title" className="text-sm leading-5 font-semibold">
            Videoja
          </h2>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => open('video')}>
            {videoId ? 'Ndrysho videon' : 'Shto video'}
          </Button>
        </div>
        {videoId ? (
          <>
            <div className="aspect-video overflow-hidden rounded-lg bg-panel">
              <iframe
                title={`Videoja e ${exercise.name}`}
                src={embedUrl(videoId)}
                className="size-full"
                allow="encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
              />
            </div>
            <a href={watchUrl(videoId)} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
              Hap në YouTube
            </a>
          </>
        ) : (
          <p className="text-sm leading-5 text-muted-foreground">Ngjit link-un e një videoje nga YouTube që të shohësh teknikën këtu. Videoja kërkon internet.</p>
        )}
      </section>

      <section aria-labelledby="history-title" className="flex flex-col">
        <h2 id="history-title" className="mb-1 text-sm leading-5 font-semibold">
          Historia
        </h2>
        <dl className="flex flex-col tabular-nums">
          <Fact term="1RM aktuale" value={oneRm ? `${kg(Math.round(oneRm * 2) / 2)} kg` : 'Ende pa sete'} />
          <Fact term="Rekordi" value={best ? `${kg(best.weightKg ?? 0)} × ${best.reps}` : 'Ende pa sete'} />
          <Fact term="Herën e fundit" value={last ? `${dateLabel(new Date(last.loggedAt))} · ${kg(last.weightKg ?? 0)} × ${last.reps ?? 0}` : 'Ende pa sete'} />
        </dl>
      </section>

      <StrengthChart history={history.sets} exerciseId={exerciseId} />

      {plan && slot && blockName ? (
        <Button variant="outline" className="w-full" onClick={() => open('ushtrimi')}>
          Ndrysho ushtrimin për {blockName}
        </Button>
      ) : null}

      {editor === 'muskujt' ? <ExerciseMusclesSheet exercise={exercise} onClose={() => navigate(-1)} /> : null}
      {editor === 'video' ? <VideoSheet exerciseId={exerciseId} initial={exercise.videoUrl ?? ''} onClose={() => navigate(-1)} /> : null}
      {editor === 'ushtrimi' && plan && slot ? (
        <ChangeExerciseSheet
          plan={plan}
          slot={slot}
          exerciseName={exercise.name}
          onClose={() => navigate(`/programi/${blockId}/${week}/${dayId}`, { replace: true })}
        />
      ) : null}
    </div>
  )
}

const groupNames = (keys: string[]) =>
  [...new Set(keys.map((key) => MUSCLE_GROUPS.find((group) => group.keys.includes(key))?.name.toLowerCase()).filter(Boolean))]

/** "Kryesorë: gjoksi. Ndihmës: shpatullat, tricepsi." */
function musclesText(primary: string[], secondary: string[]) {
  const main = groupNames(primary)
  const helpers = groupNames(secondary).filter((name) => !main.includes(name))
  return [main.length ? `Kryesorë: ${main.join(', ')}.` : null, helpers.length ? `Ndihmës: ${helpers.join(', ')}.` : null]
    .filter(Boolean)
    .join(' ')
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border-subtle first:border-t-0">
      <dt className="text-base leading-6">{term}</dt>
      <dd className="text-sm leading-5 text-muted-foreground">{value}</dd>
    </div>
  )
}

function VideoSheet({ exerciseId, initial, onClose }: { exerciseId: string; initial: string; onClose: () => void }) {
  const [url, setUrl] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const inputId = 'video-url'
  async function save() {
    const value = url.trim()
    if (value && !youtubeId(value)) {
      setProblem('Ky nuk është link videoje YouTube. Kopjoje nga butoni "Ndaj" i YouTube.')
      return
    }
    await setExerciseVideo(store, exerciseId, value || null)
    onClose()
  }
  return (
    <Sheet title="Videoja e ushtrimit" onClose={onClose}>
      <label htmlFor={inputId} className="text-sm leading-5 font-medium">
        Link-u i YouTube
      </label>
      <input
        id={inputId}
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://youtu.be/…"
        value={url}
        onChange={(event) => (setUrl(event.currentTarget.value), setProblem(null))}
        aria-invalid={problem ? true : undefined}
        className={inputClass}
      />
      {problem ? (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={!initial} onClick={() => void setExerciseVideo(store, exerciseId, null).then(onClose)}>
          Hiq videon
        </Button>
        <Button onClick={() => void save()}>Ruaj</Button>
      </div>
    </Sheet>
  )
}

function StrengthChart({ history, exerciseId }: { history: HistorySet[]; exerciseId: string }) {
  const series = e1rmSeries(history, exerciseId)
  if (series.length < 2) return null
  return (
    <section aria-labelledby="strength-title" className="flex flex-col gap-2">
      <h2 id="strength-title" className="text-sm leading-5 font-semibold">
        e1RM në kohë
      </h2>
      <TrendChart tone="card" line={series} label={`e1RM në kohë, ${series.length} stërvitje`} format={(value) => `${kg(value)} kg`} />
    </section>
  )
}
