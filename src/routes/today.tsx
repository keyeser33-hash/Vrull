import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BodyFigure } from '@/components/body/body-figure'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { restartProgram, skipWorkout, startWorkout, trainingHistory, trainingSnapshot, type TrainingSnapshot } from '@/data/training'
import { prepareRestNotifications } from '@/lib/rest-alarm'
import { reference, suggestionFor } from '@/program/loads'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { recoveryFor, type GroupRecovery } from '@/program/recovery'
import { UpdateNotice, UpdateSheet } from './app-update'
import { dateLabel, kg, setsText, targetText, techniqueText } from './training-format'

// Ekrani Sot, drejtimi C "Fokus" (SPEC §14): një panel me stërvitjen e radhës, rikuperimi i
// muskujve të saj, ushtrimi i parë me peshën, dhe një veprim amber: "Fillo stërvitjen".

export function TodayPage() {
  const snapshot = useLocalQuery(() => trainingSnapshot(store), [])
  const history = useLocalQuery(() => trainingHistory(store), [])
  const trainingDays = useLocalQuery(async () => ((await store.all('user_settings'))[0]?.training_days as number[] | undefined) ?? [], [])
  const [now] = useState(() => new Date())
  const [params] = useSearchParams()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex min-h-11 items-center justify-between gap-3 text-sm leading-5 text-muted-foreground tabular-nums">
        <span>{dateLabel(now)}</span>
        <div className="flex items-center gap-1">
          {snapshot ? <span>{snapshot.label}</span> : null}
          <Link to="/cilesimet" aria-label="Cilësimet" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
            <Icon name="cilesimet" size={22} />
          </Link>
        </div>
      </header>
      <UpdateNotice />
      {snapshot === undefined ? (
        <TodaySkeleton />
      ) : snapshot === null ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="text-lg leading-7 font-semibold">Pa program aktiv</h1>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Programi i zgjedhur shfaqet këtu me stërvitjen e radhës.</p>
        </section>
      ) : snapshot.completed ? (
        <ProgramCompleted snapshot={snapshot} />
      ) : (
        <NextWorkout
          snapshot={snapshot}
          history={history}
          isTrainingDay={(trainingDays ?? []).includes(((now.getDay() + 6) % 7) + 1)}
          now={now}
        />
      )}
      {params.get('perditesimi') ? <UpdateSheet onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="sr-only">Sot</h1>
      <div aria-hidden className="h-[186px] rounded-xl bg-skeleton" />
      <div aria-hidden className="h-36 rounded-lg bg-skeleton" />
      <div aria-hidden className="h-14 rounded-full bg-skeleton" />
    </div>
  )
}

type History = Awaited<ReturnType<typeof trainingHistory>> | undefined

function NextWorkout({
  snapshot,
  history,
  isTrainingDay,
  now,
}: {
  snapshot: TrainingSnapshot
  history: History
  isTrainingDay: boolean
  now: Date
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const { plan, exercises, session } = snapshot
  const totalSets = plan.slots.reduce((total, slot) => total + slot.sets, 0)
  const primary = [...new Set(plan.slots.flatMap((slot) => exercises[slot.exerciseId]?.primary ?? []))]
  const secondary = [...new Set(plan.slots.flatMap((slot) => exercises[slot.exerciseId]?.secondary ?? []))]
  const recovery = recoveryFor(MUSCLE_GROUPS, primary, history?.worked ?? [], now)
  const [first] = plan.slots
  const technique = first ? techniqueText(first.technique) : null
  const reserve = first?.target.kind === 'reps' && first.target.rir ? `${first.target.rir.min}–${first.target.rir.max} në rezervë` : null
  const groupsLabel = recovery.map((entry) => entry.group.name.toLowerCase())

  async function start() {
    setBusy(true)
    try {
      // Lejet e timer-it kërkohen kur nevojiten: në stërvitjen e parë (SPEC §3a).
      await prepareRestNotifications()
      await startWorkout(store)
      navigate('/seanca')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section aria-labelledby="today-title" className="flex gap-3 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs leading-4 font-medium text-panel-muted-foreground">{isTrainingDay ? 'Sot' : 'E radhës'}</span>
          <h1 id="today-title" className="text-4xl leading-10 font-bold tracking-[-0.03em]">
            Stërvitja {plan.dayNumber}
          </h1>
          <span className="text-lg leading-[26px] font-medium">{plan.dayName}</span>
          <span className="mt-2.5 flex flex-col text-sm leading-5 text-panel-muted-foreground tabular-nums">
            <span>
              {plan.slots.length} ushtrime · {totalSets} sete
            </span>
            {first ? <span>{targetText(first.target)}</span> : null}
            {technique ?? reserve ? <span>{technique ?? reserve}</span> : null}
          </span>
        </div>
        <BodyFigure
          primary={primary}
          secondary={secondary}
          label={`Muskujt e sotëm: ${groupsLabel.length > 1 ? `${groupsLabel.slice(0, -1).join(', ')} dhe ${groupsLabel.at(-1)}` : (groupsLabel[0] ?? 'asnjë')}`}
        />
      </section>

      {recovery.length > 0 ? <Recovery entries={recovery} /> : null}

      {first ? <FirstExercise snapshot={snapshot} history={history} now={now} /> : null}

      <Button variant="brand" size="xl" disabled={busy || plan.slots.length === 0} onClick={() => void start()}>
        {session ? 'Vazhdo stërvitjen' : 'Fillo stërvitjen'}
      </Button>

      {session ? null : confirmSkip ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm leading-5">Kalon te stërvitja tjetër pa e bërë këtë. Stërvitja shënohet si e kapërcyer.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirmSkip(false)}>
              Anulo
            </Button>
            <Button variant="outline" onClick={() => void skipWorkout(store).then(() => setConfirmSkip(false))}>
              Kapërce
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="self-center" onClick={() => setConfirmSkip(true)}>
          Kapërce këtë stërvitje
        </Button>
      )}
    </>
  )
}

const STATUS = {
  gati: { label: 'Gati', className: 'bg-success-soft text-success' },
  pothuajse_gati: { label: 'Pothuajse gati', className: 'bg-warning-soft text-warning' },
  i_lodhur: { label: 'I lodhur', className: 'bg-destructive-soft text-destructive' },
} as const

function sinceText(hours: number | null) {
  if (hours === null) return 'Pa stërvitje ende'
  if (hours < 24) return 'Sot'
  return `${Math.floor(hours / 24)} ditë nga e fundit`
}

function Recovery({ entries }: { entries: GroupRecovery[] }) {
  return (
    <section aria-labelledby="recovery-title" className="flex flex-col">
      <h2 id="recovery-title" className="mb-1.5 text-sm leading-5 font-semibold">
        Rikuperimi i muskujve të sotëm
      </h2>
      <ul>
        {entries.map(({ group, hours, status }) => (
          <li key={group.id} className="flex min-h-12 items-center gap-3 border-t border-border-subtle tabular-nums">
            <span className="flex-1 text-base leading-6">{group.name}</span>
            <span className="text-xs leading-4 text-muted-foreground">{sinceText(hours)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs leading-4 font-medium ${STATUS[status].className}`}>{STATUS[status].label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FirstExercise({ snapshot, history, now }: { snapshot: TrainingSnapshot; history: History; now: Date }) {
  const [slot] = snapshot.plan.slots
  const exercise = snapshot.exercises[slot.exerciseId]
  const sets = history?.sets ?? []
  const suggestion = exercise
    ? suggestionFor(slot, exercise, sets, now, history?.overrides[slot.exerciseId] ?? null, history?.weightSteps ?? {})
    : null
  const previous = reference(sets, { exerciseId: slot.exerciseId, blockPosition: snapshot.plan.blockPosition, week: snapshot.plan.week, setNumber: 1 })
  const weight = suggestion?.weightKg ?? previous?.weightKg ?? null
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 tabular-nums">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs leading-4 text-muted-foreground">Ushtrimi i parë</span>
        <span className="text-base leading-6 font-semibold">
          {exercise?.name}
          {weight ? ` · ${kg(weight)} kg` : ''}
        </span>
      </div>
      <span className="text-sm leading-5 text-muted-foreground">{setsText(slot.sets, slot.target)}</span>
    </div>
  )
}

function ProgramCompleted({ snapshot }: { snapshot: TrainingSnapshot }) {
  const [busy, setBusy] = useState(false)
  const restartFrom = snapshot.blocks.find((block) => block.position === 1) ?? snapshot.blocks[0]
  return (
    <>
      <section aria-labelledby="done-title" className="flex flex-col gap-1.5 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground">
        <span className="text-xs leading-4 font-medium text-panel-muted-foreground">{snapshot.programName}</span>
        <h1 id="done-title" className="text-4xl leading-10 font-bold tracking-[-0.03em]">
          Përfunduar
        </h1>
        <p className="mt-2 text-sm leading-5 text-panel-muted-foreground">
          Rinise nga {restartFrom.name}: peshat e sugjeruara dalin nga 1RM-të e reja.
        </p>
      </section>
      <Button
        variant="brand"
        size="xl"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void restartProgram(store, restartFrom.id).finally(() => setBusy(false))
        }}
      >
        Rinis nga {restartFrom.name}
      </Button>
    </>
  )
}
