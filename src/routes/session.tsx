import { useEffect, useId, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { finishWorkout, saveSet, trainingHistory, trainingSnapshot, type SetRecord, type TrainingSnapshot } from '@/data/training'
import { dropWeight, type HistorySet, personalRecords, reference, suggestionFor, weightStep } from '@/program/loads'
import { sessionProgress } from '@/program/session-progress'
import type { PlannedSlot } from '@/program/types'
import { cn } from '@/lib/cn'
import { restFinishedInApp } from '@/lib/rest-alarm'
import { useRestTimer } from '@/lib/use-rest-timer'
import { ChangeExerciseSheet, ExerciseListSheet } from './session-sheets'
import { clock, kg, setsText, targetText, techniqueText } from './training-format'

// Seanca e stërvitjes, drejtimi C "Fokus" (SPEC §14): një ushtrim dhe një set në ekran, timer-i
// i pushimit si rreth i madh, pesha dhe përsëritjet me − dhe +, dhe një veprim amber: "Ruaj setin".

type History = Awaited<ReturnType<typeof trainingHistory>>

export function SessionPage() {
  const snapshot = useLocalQuery(() => trainingSnapshot(store), [])
  const history = useLocalQuery(() => trainingHistory(store), [])
  if (snapshot === undefined || history === undefined) return <div className="min-h-dvh bg-background" />
  if (!snapshot?.session) return <Navigate to="/" replace />
  return <ActiveSession snapshot={snapshot} session={snapshot.session} history={history} />
}

/** Seti i fundit me rest-pause ose drop set: pas pjesës së parë vjen pjesa e dytë, në të njëjtin ekran. */
interface SegmentStep {
  set: SetRecord
  slot: PlannedSlot
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function asHistory(set: SetRecord, snapshot: TrainingSnapshot, sessionId: string): HistorySet {
  const { plan } = snapshot
  return {
    id: set.id,
    exerciseId: set.exerciseId,
    sessionId,
    run: plan.run,
    blockPosition: plan.blockPosition,
    blockName: plan.blockName,
    blockWeeks: plan.blockWeeks,
    week: plan.week,
    setNumber: set.setNumber,
    weightKg: set.weightKg,
    reps: set.reps,
    rir: set.rir,
    isWarmup: false,
    loggedAt: set.loggedAt,
  }
}

function ActiveSession({
  snapshot,
  session,
  history,
}: {
  snapshot: TrainingSnapshot
  session: NonNullable<TrainingSnapshot['session']>
  history: History
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(null)
  const [segment, setSegment] = useState<SegmentStep | null>(null)
  const [record, setRecord] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Pas ruajtjes, setin tjetër e lejon vetëm ekrani që e ka parë setin e ruajtur (pa dyfishim).
  const [awaiting, setAwaiting] = useState<{ id: string; segments: number } | null>(null)
  const rest = useRestTimer(session.id, () => void restFinishedInApp())
  const shown = awaiting ? session.sets.find((set) => set.id === awaiting.id) : undefined
  const waiting = awaiting !== null && !(shown && shown.segments.length >= awaiting.segments)
  const now = useNow(1000)
  const { plan, exercises } = snapshot
  const progress = sessionProgress(plan, session.sets, selected)
  const elapsed = (now - Date.parse(session.startedAt)) / 1000
  const shownIndex = segment ? plan.slots.findIndex((slot) => slot.slotId === segment.slot.slotId) : progress.current
  const openSheet = (name: 'lista' | 'ndrysho') => setParams({ [name]: '1' })
  const closeSheet = () => navigate(-1)
  const finish = () => {
    setBusy(true)
    rest.skip()
    void finishWorkout(store, session.id).then(() => navigate('/', { replace: true }))
  }

  if (shownIndex === null) {
    return (
      <SessionFrame
        heading={`${progress.doneSets} sete · ${clock(elapsed)}`}
        progress={progress}
        current={null}
        onMinimize={() => navigate('/')}
        onList={() => openSheet('lista')}
      >
        <section aria-labelledby="done-title" className="flex flex-col gap-2 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground">
          <span className="text-xs leading-4 font-medium text-panel-muted-foreground">{plan.dayName}</span>
          <h1 id="done-title" className="text-3xl leading-9 font-bold tracking-[-0.025em]">
            Të gjitha setet u bënë
          </h1>
          <p className="text-sm leading-5 text-panel-muted-foreground">Mbyll stërvitjen që treguesi të kalojë te e radha.</p>
        </section>
        <Button
          variant="brand"
          size="xl"
          disabled={busy}
          onClick={finish}
        >
          Mbyll stërvitjen
        </Button>
        {params.has('lista') ? (
          <ExerciseListSheet {...{ snapshot, progress }} onSelect={setSelected} onClose={closeSheet} onChange={() => openSheet('ndrysho')} onFinish={finish} />
        ) : null}
      </SessionFrame>
    )
  }

  const entry = progress.slots[shownIndex]
  const slot = entry.slot
  const exercise = exercises[slot.exerciseId]
  const setNumber = segment ? segment.set.setNumber : entry.done + 1
  const isLastSet = setNumber === slot.sets
  const sessionSets = session.sets.filter((set) => set.slotId === slot.slotId)
  const lastInSession = sessionSets.at(-1)
  const steps = history.weightSteps
  const step = exercise ? weightStep(exercise.equipment, steps) : 2.5
  const suggestion = exercise
    ? suggestionFor(slot, exercise, history.sets, new Date(now), history.overrides[slot.exerciseId] ?? null, steps)
    : { weightKg: null, hint: null }
  const previous = reference(history.sets, {
    exerciseId: slot.exerciseId,
    blockPosition: plan.blockPosition,
    week: plan.week,
    setNumber,
    sessionId: session.id,
  })
  const next = progress.next === null ? null : progress.slots[progress.next].slot
  const tracking = exercise?.tracking ?? 'weight_reps'
  const technique = isLastSet ? slot.technique : { type: 'none' as const }

  const defaults = segment
    ? {
        weightKg:
          slot.technique.type === 'drop_set'
            ? (dropWeight(history.sets, { exerciseId: slot.exerciseId, run: plan.run, blockPosition: plan.blockPosition }, segment.set.weightKg ?? 0, slot.technique, step) ??
              segment.set.weightKg ??
              0)
            : (segment.set.weightKg ?? 0),
        reps: Math.max(1, Math.round((segment.set.reps ?? 3) / 3)),
        seconds: null,
        rir: null,
      }
    : {
        weightKg: lastInSession?.weightKg ?? suggestion.weightKg ?? previous?.weightKg ?? 0,
        reps:
          lastInSession?.reps ??
          (slot.target.kind === 'reps' ? Math.max(slot.target.min, 1) : slot.target.kind === 'timed' ? null : slot.target.reps),
        seconds: slot.target.kind === 'timed' ? (lastInSession?.seconds ?? slot.target.seconds) : null,
        rir: slot.target.kind === 'reps' && slot.target.rir ? (lastInSession?.rir ?? slot.target.rir.min) : null,
      }

  async function save(values: { weightKg: number; reps: number | null; seconds: number | null; rir: number | null }) {
    setBusy(true)
    // Seti i ri e mbyll pushimin: njoftimi i tij anulohet (TH-09).
    if (rest.running) rest.skip()
    try {
      const weightKg = tracking === 'timed' ? null : values.weightKg
      if (segment) {
        await saveSet(store, {
          id: segment.set.id,
          sessionId: session.id,
          slot: segment.slot,
          setNumber: segment.set.setNumber,
          weightKg: segment.set.weightKg,
          reps: segment.set.reps,
          seconds: segment.set.seconds,
          rir: segment.set.rir,
          technique: segment.set.technique,
          segments: [{ weightKg: tracking === 'weight_reps' ? weightKg : null, reps: values.reps ?? 0 }],
        })
        setAwaiting({ id: segment.set.id, segments: 1 })
        setSegment(null)
        afterSet()
        return
      }
      const saved = await saveSet(store, {
        sessionId: session.id,
        slot,
        setNumber,
        weightKg,
        reps: values.reps,
        seconds: values.seconds,
        rir: values.rir,
        technique: technique.type,
      })
      setAwaiting({ id: saved.id, segments: 0 })
      const prs = personalRecords(asHistory(saved, snapshot, session.id), history.sets)
      setRecord(
        prs.weightForReps && saved.reps
          ? `Rekord: pesha më e madhe për ${saved.reps} përsëritje`
          : prs.e1rm
            ? 'Rekord: 1RM e vlerësuar më e lartë'
            : null,
      )
      if (technique.type === 'rest_pause' || technique.type === 'drop_set') {
        setSegment({ set: saved, slot })
        if (technique.type === 'rest_pause') rest.start(technique.restSeconds ?? 15)
        return
      }
      afterSet()
    } finally {
      setBusy(false)
    }
  }

  function afterSet() {
    setSelected(null)
    const remaining = progress.totalSets - progress.doneSets - (segment ? 0 : 1)
    if (remaining > 0) rest.start(slot.restSeconds)
  }

  const subtitle = segment
    ? `Seti ${setNumber} nga ${slot.sets} · pjesa 2, ${techniqueText(slot.technique)}`
    : `Seti ${setNumber} nga ${slot.sets} · ${targetText(slot.target)}`

  return (
    <SessionFrame
      heading={`Ushtrimi ${shownIndex + 1} nga ${plan.slots.length} · ${clock(elapsed)}`}
      progress={progress}
      current={shownIndex}
      onMinimize={() => navigate('/')}
      onList={() => openSheet('lista')}
    >
      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em]">{exercise?.name}</h1>
          <span className="text-base leading-6 text-muted-foreground tabular-nums">{subtitle}</span>
        </div>
        <SetDots total={slot.sets} done={entry.done} current={setNumber} lastTechnique={techniqueText(slot.technique)} />
      </div>

      <RestPanel rest={rest} restSeconds={segment ? (slot.technique.type === 'rest_pause' ? (slot.technique.restSeconds ?? 15) : 0) : slot.restSeconds} note={restNote(segment, slot, isLastSet)} />

      <SetForm
        key={`${slot.slotId}:${setNumber}:${segment ? 'segment' : 'set'}:${slot.exerciseId}`}
        tracking={segment && tracking === 'weight_reps' ? 'weight_reps' : segment ? 'bodyweight_reps' : tracking}
        defaults={defaults}
        step={step}
        hideWeight={Boolean(segment) && tracking !== 'weight_reps'}
        reference={segment ? null : referenceLine(previous, suggestion.weightKg, suggestion.hint)}
        submitLabel={segment ? 'Ruaj pjesën 2' : `Ruaj setin ${setNumber}`}
        busy={busy || waiting}
        onSubmit={(values) => void save(values)}
      />
      {segment ? (
        <Button
          variant="ghost"
          className="self-center"
          onClick={() => {
            setSegment(null)
            afterSet()
          }}
        >
          Pa pjesë të dytë
        </Button>
      ) : null}
      <p aria-live="polite" className="min-h-5 text-center text-sm leading-5 font-medium">
        {record}
      </p>

      {next ? (
        <button
          type="button"
          onClick={() => setSelected(next.slotId)}
          className="flex min-h-11 items-center gap-2 border-t border-border pt-2 text-left tabular-nums"
        >
          <span className="text-xs leading-4 text-muted-foreground">Pastaj</span>
          <span className="flex-1 text-sm leading-5 font-semibold">{exercises[next.exerciseId]?.name}</span>
          <span className="text-sm leading-5 text-muted-foreground">{setsText(next.sets, next.target)}</span>
          <Icon name="chevron-djathtas" size={16} />
        </button>
      ) : null}

      {params.has('lista') ? (
        <ExerciseListSheet
          {...{ snapshot, progress }}
          onSelect={setSelected}
          onClose={closeSheet}
          onChange={() => setParams({ ndrysho: '1' }, { replace: true })}
          onFinish={finish}
        />
      ) : null}
      {params.has('ndrysho') ? <ChangeExerciseSheet plan={plan} slot={slot} exerciseName={exercise?.name ?? ''} onClose={closeSheet} /> : null}
    </SessionFrame>
  )
}

function restNote(segment: SegmentStep | null, slot: PlannedSlot, isLastSet: boolean) {
  if (segment) return slot.technique.type === 'drop_set' ? 'Ul peshën dhe vazhdo pa pushim' : 'Pas pushimit, vazhdo deri në dështim'
  const technique = techniqueText(slot.technique)
  return isLastSet && technique ? `Seti i fundit: ${technique}` : null
}

function referenceLine(previous: ReturnType<typeof reference>, suggested: number | null, hint: string | null) {
  const parts: string[] = []
  if (previous) {
    const where =
      previous.kind === 'previous_block'
        ? previous.blockWeeks === 1
          ? previous.blockName
          : `${previous.blockName} · Java ${previous.week}`
        : 'Herën e fundit'
    const value = previous.weightKg ? `${kg(previous.weightKg)} × ${previous.reps ?? 0}` : `${previous.reps ?? 0} përsëritje`
    parts.push(`${where}, seti ${previous.setNumber}: ${value}`)
  }
  if (suggested) parts.push(`sugjeruar ${kg(suggested)} kg`)
  else if (hint && !previous) parts.push(hint)
  return parts.join(' · ') || null
}

function SessionFrame({
  heading,
  progress,
  current,
  onMinimize,
  onList,
  children,
}: {
  heading: string
  progress: ReturnType<typeof sessionProgress>
  current: number | null
  onMinimize: () => void
  onList: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        <header className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <Button variant="ghost" size="icon" aria-label="Minimizo stërvitjen" className="text-foreground" onClick={onMinimize}>
            <Icon name="chevron-poshte" />
          </Button>
          <span className="flex-1 text-center text-sm leading-5 text-muted-foreground tabular-nums">{heading}</span>
          <Button variant="ghost" size="icon" aria-label="Lista e ushtrimeve" className="text-foreground" onClick={onList}>
            <Icon name="lista" />
          </Button>
        </header>
        <div aria-hidden className="grid gap-[3px] px-4" style={{ gridTemplateColumns: `repeat(${progress.slots.length}, minmax(0, 1fr))` }}>
          {progress.slots.map((entry, index) => (
            <span
              key={entry.slot.slotId}
              className={cn(
                'h-1 rounded-full',
                index === current ? 'bg-brand' : entry.done >= entry.slot.sets ? 'bg-foreground' : 'bg-chart-track',
              )}
            />
          ))}
        </div>
        <main className="flex flex-1 flex-col gap-3.5 px-4 pt-4 pb-3">{children}</main>
      </div>
    </div>
  )
}

function SetDots({ total, done, current, lastTechnique }: { total: number; done: number; current: number; lastTechnique: string | null }) {
  const words = Array.from({ length: total }, (_, index) => {
    const number = index + 1
    const state = number <= done ? 'u bë' : number === current ? 'tani' : 'pas'
    const extra = number === total && lastTechnique ? `, ${lastTechnique}` : ''
    return `seti ${number} ${state}${extra}`
  })
  return (
    <div role="img" aria-label={words.join('; ')} className="flex gap-1.5 pb-2">
      {Array.from({ length: total }, (_, index) => {
        const number = index + 1
        return (
          <span
            key={number}
            className={cn(
              'size-2.5 rounded-full',
              number <= done ? 'bg-foreground' : number === current ? 'bg-brand shadow-[0_0_0_3px_var(--brand-soft)]' : 'bg-chart-track',
            )}
          />
        )
      })}
    </div>
  )
}

function RestPanel({ rest, restSeconds, note }: { rest: ReturnType<typeof useRestTimer>; restSeconds: number; note: string | null }) {
  const radius = 80
  const length = 2 * Math.PI * radius
  const fraction = rest.running && rest.total > 0 ? rest.remaining / rest.total : 0
  return (
    <section aria-label="Timer-i i pushimit" className="flex flex-col items-center gap-3 rounded-xl border border-panel-border bg-panel p-4 text-panel-foreground">
      <div className="relative size-44">
        <svg viewBox="0 0 176 176" width={176} height={176} aria-hidden>
          <circle cx={88} cy={88} r={radius} fill="none" strokeWidth={8} className="stroke-panel-border" />
          {rest.running ? (
            <circle
              cx={88}
              cy={88}
              r={radius}
              fill="none"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${fraction * length} ${length}`}
              transform="rotate(-90 88 88)"
              className="stroke-brand transition-[stroke-dasharray] duration-200"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs leading-4 font-medium text-panel-muted-foreground">{rest.running ? 'Pushim' : 'Pushimi pas setit'}</span>
          <span role="timer" aria-live="off" className="text-5xl leading-[52px] font-bold tracking-[-0.03em] tabular-nums">
            {clock(rest.running ? rest.remaining : restSeconds)}
          </span>
          {rest.running ? <span className="text-xs leading-4 text-panel-muted-foreground tabular-nums">nga {clock(rest.total)}</span> : null}
        </div>
      </div>
      {rest.running ? (
        <div className="grid w-full grid-cols-[1fr_1fr_1.4fr] gap-2">
          <Button variant="panel" className="tabular-nums" onClick={() => rest.add(-15)} aria-label="Hiq 15 sekonda">
            −15 s
          </Button>
          <Button variant="panel" className="tabular-nums" onClick={() => rest.add(15)} aria-label="Shto 15 sekonda">
            +15 s
          </Button>
          <Button variant="on-panel" onClick={() => rest.skip()}>
            Kapërce
          </Button>
        </div>
      ) : (
        <p className="flex min-h-11 items-center text-sm leading-5 text-panel-muted-foreground">{note ?? 'Timer-i nis kur ruan setin'}</p>
      )}
    </section>
  )
}

interface SetValues {
  weightKg: number
  reps: number | null
  seconds: number | null
  rir: number | null
}

function SetForm({
  tracking,
  defaults,
  step,
  hideWeight,
  reference,
  submitLabel,
  busy,
  onSubmit,
}: {
  tracking: 'weight_reps' | 'bodyweight_reps' | 'timed'
  defaults: { weightKg: number; reps: number | null; seconds: number | null; rir: number | null }
  step: number
  hideWeight: boolean
  reference: string | null
  submitLabel: string
  busy: boolean
  onSubmit: (values: SetValues) => void
}) {
  const [weightKg, setWeight] = useState(defaults.weightKg)
  const [reps, setReps] = useState(defaults.reps ?? 0)
  const [seconds, setSeconds] = useState(defaults.seconds ?? 0)
  const [rir, setRir] = useState(defaults.rir)
  const timed = tracking === 'timed'
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ weightKg, reps: timed ? null : reps, seconds: timed ? seconds : null, rir })
      }}
    >
      {timed || hideWeight ? null : (
        <Stepper
          label={tracking === 'bodyweight_reps' ? 'Pesha shtesë' : 'Pesha'}
          value={weightKg}
          unit="kg"
          step={step}
          decimals
          onChange={setWeight}
          minusLabel={`Ul peshën me ${kg(step)} kg`}
          plusLabel={`Rrit peshën me ${kg(step)} kg`}
        />
      )}
      {timed ? (
        <Stepper label="Sekondat" value={seconds} unit="s" step={5} onChange={setSeconds} minusLabel="Pesë sekonda më pak" plusLabel="Pesë sekonda më shumë" />
      ) : (
        <Stepper label="Përsëritjet" value={reps} unit="përs" step={1} onChange={setReps} minusLabel="Një përsëritje më pak" plusLabel="Një përsëritje më shumë" />
      )}
      {rir === null ? null : (
        <Stepper label="Në rezervë" value={rir} unit="përs" step={1} max={10} onChange={setRir} minusLabel="Një më pak në rezervë" plusLabel="Një më shumë në rezervë" />
      )}
      {reference ? <span className="text-center text-xs leading-4 text-muted-foreground tabular-nums">{reference}</span> : null}
      <Button type="submit" variant="brand" size="xl" className="mt-1.5" disabled={busy || (!timed && reps < 1) || (timed && seconds < 1)}>
        {submitLabel}
      </Button>
    </form>
  )
}

function Stepper({
  label,
  value,
  unit,
  step,
  max = 999,
  decimals = false,
  onChange,
  minusLabel,
  plusLabel,
}: {
  label: string
  value: number
  unit: string
  step: number
  max?: number
  decimals?: boolean
  onChange: (value: number) => void
  minusLabel: string
  plusLabel: string
}) {
  const [text, setText] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const set = (next: number) => onChange(Math.min(max, Math.max(0, Math.round(next * 100) / 100)))
  const commit = () => {
    if (text === null) return
    const parsed = Number(text.replace(',', '.'))
    if (Number.isFinite(parsed)) set(decimals ? parsed : Math.round(parsed))
    setText(null)
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_52px_minmax(0,112px)_52px] items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-1.5 pl-5 tabular-nums">
      <label htmlFor={id} className="text-sm leading-5 text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        aria-label={minusLabel}
        onClick={() => set(value - step)}
        className="flex size-[52px] items-center justify-center rounded-full border border-input text-foreground"
      >
        <Icon name="hiq" size={28} />
      </button>
      <span className="flex items-baseline justify-center">
        <input
          ref={inputRef}
          id={id}
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={text ?? (decimals ? kg(value) : String(value))}
          onFocus={(event) => {
            setText(decimals ? kg(value) : String(value))
            event.currentTarget.select()
          }}
          onChange={(event) => setText(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
              event.currentTarget.blur()
            }
          }}
          className="h-11 w-full min-w-0 bg-transparent text-right text-3xl leading-9 font-bold tracking-[-0.025em] outline-none"
          style={{ width: `${Math.max(2, (text ?? (decimals ? kg(value) : String(value))).length) + 0.5}ch` }}
        />
        <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
      </span>
      <button
        type="button"
        aria-label={plusLabel}
        onClick={() => set(value + step)}
        className="flex size-[52px] items-center justify-center rounded-full border border-input text-foreground"
      >
        <Icon name="shto" size={28} />
      </button>
    </div>
  )
}
