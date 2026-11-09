import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { RirPicker } from '@/components/ui/rir-picker'
import { Stepper } from '@/components/ui/stepper'
import { store, useLocalQuery } from '@/data/app-data'
import { finishWorkout, saveSet, type SetRecord, trainingHistory, type TrainingHistory, trainingSnapshot, type TrainingSnapshot } from '@/data/training'
import { workoutWeights } from '@/data/week-weights'
import { programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { dropWeight, type HistorySet, type Reference, reference, type WeightBasis, weightStep } from '@/program/loads'
import { pendingSegment, segmentDefaults, setDefaults, type SetValues } from '@/program/next-set'
import { type RecordHint, recordHint, sessionSetRecords, setRecord, type SetRecordResult } from '@/progress/records'
import { type SessionProgress, sessionProgress } from '@/program/session-progress'
import type { PlannedSlot, SessionPlan, Target, Technique, Tracking } from '@/program/types'
import type { WeekWeightRow } from '@/progress/week-weights'
import { cn } from '@/lib/cn'
import { restFinishedInApp } from '@/lib/rest-alarm'
import { openedSet, sessionView } from '@/lib/session-notification'
import { useRestTimer } from '@/lib/use-rest-timer'
import { ExerciseMusclesSheet } from './exercise-muscles'
import { FormVideoScreen, type FormVideoTarget } from './form-video'
import { type BeatContext, BodyBeatScreen, MusicButton, MusicConnectScreen, TapSheet } from './music'
import { useSessionBeat } from './music-beat'
import { editable, elapsedText, loadText, rangeText, setValue, spokenDuration, targetText } from './session-format'
import { type BannerRecord, RecordBanner } from './session-banner'
import { recordPulse } from './session-motion'
import { SavedSets, SetChips } from './session-sets'
import { ChangeExerciseSheet, ExerciseListSheet, NumberSheet } from './session-sheets'
import { EditSetSheet } from './set-edit-sheet'
import { clock } from './training-format'

// Seanca e stërvitjes në Vrull (V2-E1-07; bordet "Seanca", "Pushimi", "Ushtrimet"; pamja e 0.23, SPEC
// §0.3c): një ushtrim dhe një set në ekran, me çipat e seteve sipër, numrat e mëdhenj, "Herën e kaluar"
// dhe pragun e rekordit si rreshta, dhe "Ruaj setin" si veprimin e vetëm me prush. Muzika është ikonë
// te kreu. Pas setit vjen pushimi si unazë e madhe, me setet e ruajtura poshtë; kur seti jep rekord,
// banderola zbret mbi pushimin. Seti i fundit me rest-pause ose drop set ka segmentin e vet. Pa tab-bar,
// jashtë kornizës.

/** Një lexim i vetëm, që seti i ruajtur dhe historia të jenë gjithnjë në të njëjtën gjendje. */
async function sessionData() {
  const [snapshot, history] = await Promise.all([trainingSnapshot(store), trainingHistory(store)])
  return { snapshot, history }
}

/**
 * Pesha e javës e çdo sloti të seancës (`workoutWeights`, e njëjtë me Sot dhe Programin). Lexim më
 * vete, që ruajtja e një seti të mos presë llogarinë e gjithë javës.
 */
async function sessionWeights(): Promise<Map<string, WeekWeightRow>> {
  const snapshot = await trainingSnapshot(store)
  return snapshot?.session ? workoutWeights(store, snapshot.plan) : new Map()
}

export function SessionPage() {
  const data = useLocalQuery(sessionData, [])
  const weights = useLocalQuery(sessionWeights, [])
  // Pas "Mbyll stërvitjen" seanca nuk është më e hapur: ekrani kalon te mbyllja, jo te Sot.
  const [closing, setClosing] = useState<string | null>(null)
  if (data === undefined) return <div className="min-h-dvh bg-background" />
  const { snapshot, history } = data
  if (!snapshot?.session) return <Navigate to={closing ? `/seanca/mbyllja/${closing}` : '/'} replace />
  // Pesha e setit të parë vjen nga peshat e javës: ekrani pret leximin e parë të tyre.
  if (weights === undefined) return <div className="min-h-dvh bg-background" />
  return <ActiveSession snapshot={snapshot} session={snapshot.session} history={history} weights={weights} onClosing={setClosing} />
}

type OpenSession = NonNullable<TrainingSnapshot['session']>

/** Seti i fundit me rest-pause ose drop set, që pret segmentin e tij. */
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

/** Seti i sapo ruajtur si set i historisë, para se leximi i ri ta sjellë. */
function asHistory(set: SetRecord, plan: SessionPlan, sessionId: string): HistorySet {
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
  weights,
  onClosing,
}: {
  snapshot: TrainingSnapshot
  session: OpenSession
  history: TrainingHistory
  weights: Map<string, WeekWeightRow>
  onClosing: (sessionId: string) => void
}) {
  const texts = useI18n()
  const { t } = texts
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(null)
  // Segmenti që përdoruesi e kapërceu; pa të, seti i fundit me teknikë pret segmentin e vet.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Pas ruajtjes, setin tjetër e lejon vetëm leximi që e ka parë setin e ruajtur (pa dyfishim).
  const [awaiting, setAwaiting] = useState<{ id: string; segments: number } | null>(null)
  // Banderola e rekordit (0.23): seti i sapo ruajtur që dha rekord, deri sa banderola të ikë.
  const [banner, setBanner] = useState<BannerRecord | null>(null)
  const rest = useRestTimer(session.id, () => void restFinishedInApp())
  // "Ndrysho" te njoftimi i seancës (V2-E1-08): ushtrimi i setit dhe vlerat e zgjedhura atje.
  const opened = openedSet(location.state)
  useEffect(() => {
    if (opened) setSelected(opened.slotId)
    // Vetëm kur vjen një hapje e re nga njoftimi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])
  // Njoftimi tregon të njëjtin ushtrim si ekrani; pa ekran, radhën e programit.
  useEffect(() => sessionView.set({ sessionId: session.id, selected, dismissedSegment: dismissed }), [session.id, selected, dismissed])
  useEffect(() => () => sessionView.set(null), [])
  const now = useNow(1000)
  const { plan, exercises } = snapshot
  const progress = sessionProgress(plan, session.sets, selected)
  // Rekordi i çdo seti në kohën e vet (§6: e1RM-ja, ose pesha më e madhe për ato përsëritje): çipat,
  // rreshtat e pushimit dhe fleta e ndryshimit; seti 1 mbetet rekord edhe kur seti 2 e kalon.
  const records = useMemo(() => sessionSetRecords(history.sets, session.id), [history.sets, session.id])
  const elapsed = (now - Date.parse(session.startedAt)) / 1000
  const shown = awaiting ? session.sets.find((set) => set.id === awaiting.id) : undefined
  const waiting = awaiting !== null && !(shown && shown.segments.length >= awaiting.segments)

  const lastSet = session.sets.at(-1) ?? null
  const lastSlot = lastSet ? plan.slots.find((entry) => entry.slotId === lastSet.slotId) : undefined
  const segmentDue = selected ? null : pendingSegment(plan, session.sets)
  const segment: SegmentStep | null = segmentDue && dismissed !== segmentDue.set.id ? segmentDue : null
  const shownIndex = segment ? plan.slots.findIndex((slot) => slot.slotId === segment.slot.slotId) : progress.current
  const current = shownIndex === null ? null : progress.slots[shownIndex]
  const slot = current?.slot ?? null
  const exercise = slot ? exercises[slot.exerciseId] : undefined
  const position = t('session.position', { exercise: (shownIndex ?? plan.slots.length - 1) + 1, exercises: plan.slots.length, elapsed: elapsedText(elapsed) })
  // Seti në ekran; gjatë pushimit, seti që vjen. Videoja e formës regjistrohet për të (V2-E1-13).
  const setNumber = current ? (segment ? segment.set.setNumber : current.done + 1) : 0
  const videoTarget: FormVideoTarget | null =
    slot && exercise ? { exerciseId: slot.exerciseId, exerciseName: exercise.name, sessionId: session.id, setNumber } : null

  // Muzika "Trupi në ritëm" (V2-E1-12): ikona te kreu (0.23), ekrani i plotë dhe lidhja, mbi seancën.
  const beat = useSessionBeat({ slots: plan.slots, exercises, phase: rest.running ? 'rest' : 'set' })
  // Kreu i ekranit të plotë: seti në ekran; gjatë pushimit dhe pas setit të fundit, seti i ruajtur.
  const beatContext: BeatContext | null =
    slot && !rest.running
      ? { exercise: exercise?.name ?? '', set: setNumber, sets: slot.sets }
      : lastSet
        ? { exercise: exercises[lastSet.exerciseId]?.name ?? '', set: lastSet.setNumber, sets: lastSlot?.sets ?? lastSet.setNumber }
        : null
  const openSheet = (name: 'lista' | 'ndrysho' | 'muskujt' | 'video' | 'ritmi' | 'lidh-muziken') => setParams({ [name]: '1' })
  const closeSheet = () => navigate(-1)
  const finish = () => {
    setBusy(true)
    rest.skip()
    onClosing(session.id)
    void finishWorkout(store, session.id)
  }
  /** Pesha e ushtrimit në këtë seancë: e setit të fundit, ose pesha e javës për setin e parë. */
  const weightOf = (target: PlannedSlot) => {
    const inSession = session.sets.filter((set) => set.slotId === target.slotId).at(-1)
    return inSession ? inSession.weightKg : (weights.get(target.slotId)?.weightKg ?? null)
  }
  function startRest(after: PlannedSlot, newSet: boolean) {
    setSelected(null)
    const remaining = progress.totalSets - progress.doneSets - (newSet ? 1 : 0)
    if (remaining > 0) rest.start(after.restSeconds)
  }

  // "Ndrysho setin" (0.23): prekja e një seti të ruajtur te çipat ose te pushimi; fleta e historikut.
  const editId = params.get('seti')
  const edited = editId ? session.sets.find((set) => set.id === editId && editable(set)) : undefined
  const openEdit = (set: SetRecord) => setParams({ seti: set.id })

  const frame = (children: ReactNode, restNext: { exercise: string | null; text: string } | null = null) => (
    <SessionFrame
      progress={progress}
      position={position}
      // Mbrapa aty nga erdhi (zakonisht Sot); seanca mbetet e hapur dhe vazhdohet prej andej.
      onBack={() => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))}
      onList={() => openSheet('lista')}
      onMuscles={exercise ? () => openSheet('muskujt') : undefined}
      onVideo={videoTarget ? () => openSheet('video') : undefined}
      music={<MusicButton beat={beat} sessionId={session.id} onOpen={() => openSheet('ritmi')} onConnect={() => openSheet('lidh-muziken')} />}
    >
      {children}
      <RecordBanner banner={banner} onDone={() => setBanner(null)} />
      {params.has('lista') ? (
        <ExerciseListSheet
          snapshot={snapshot}
          progress={progress}
          sets={session.sets}
          history={history.sets}
          sessionId={session.id}
          elapsed={elapsedText(elapsed)}
          busy={busy}
          onSelect={setSelected}
          onClose={closeSheet}
          onChange={() => setParams({ ndrysho: '1' }, { replace: true })}
          onFinish={finish}
        />
      ) : null}
      {params.has('ndrysho') && slot ? <ChangeExerciseSheet plan={plan} slot={slot} exerciseName={exercise?.name ?? ''} onClose={closeSheet} /> : null}
      {params.has('muskujt') && exercise ? <ExerciseMusclesSheet exercise={exercise} onClose={closeSheet} /> : null}
      {params.has('video') && videoTarget ? <FormVideoScreen target={videoTarget} onClose={closeSheet} /> : null}
      {params.has('ritmi') && beatContext ? (
        <BodyBeatScreen
          beat={beat}
          context={beatContext}
          rest={rest.running ? { remaining: rest.remaining, total: rest.total, next: restNext } : null}
          onClose={closeSheet}
          onTap={() => setParams({ ritmi: '1', prek: '1' })}
        />
      ) : null}
      {params.has('prek') && beat.session ? <TapSheet beat={beat} onClose={closeSheet} /> : null}
      {params.has('lidh-muziken') ? <MusicConnectScreen beat={beat} sessionId={session.id} onClose={closeSheet} /> : null}
      {/* Fleta e historikut mban rregullin e vet (e1RM-ja): "nuk është më rekord" vlen për rekordin e e1RM-së. */}
      {edited ? <EditSavedSet set={edited} snapshot={snapshot} history={history} record={records.get(edited.id)?.kind === 'e1rm'} onClose={closeSheet} /> : null}
    </SessionFrame>
  )

  if (rest.running && lastSet) {
    let next: { exercise: string | null; text: string } | null = null
    if (segment) {
      next = {
        exercise: null,
        text: t(segment.set.technique === 'drop_set' ? 'session.segment.dropSet' : 'session.segment.restPause', { set: segment.set.setNumber, sets: segment.slot.sets }),
      }
    } else if (current && slot) {
      next = {
        exercise: lastSet.slotId === slot.slotId ? null : (exercise?.name ?? null),
        text: t('session.setOf', { set: current.done + 1, sets: slot.sets, target: loadText(weightOf(slot), slot.target, texts) }),
      }
    }
    return frame(
      <RestView
        rest={rest}
        saved={waiting ? null : lastSet}
        sets={session.sets.filter((set) => set.slotId === lastSet.slotId)}
        records={records}
        next={waiting ? null : next}
        onEdit={openEdit}
      />,
      waiting ? null : next,
    )
  }

  if (!current || !slot) {
    return frame(
      <>
        <main className="flex flex-1 flex-col gap-2 px-4 pt-4">
          <h1 className="type-display-l">{t('session.allDone')}</h1>
          <p className="type-body text-muted-foreground">{t('session.allDoneText')}</p>
        </main>
        <SessionFooter>
          <Button variant="primary" size="xl" disabled={busy} onClick={finish}>
            {t('session.finish')}
          </Button>
        </SessionFooter>
      </>,
    )
  }

  const isLastSet = setNumber === slot.sets
  const tracking: Tracking = exercise?.tracking ?? 'weight_reps'
  const step = exercise ? weightStep(exercise.equipment, history.weightSteps) : 2.5
  const lastInSlot = session.sets.filter((set) => set.slotId === slot.slotId).at(-1)
  const week = weights.get(slot.slotId)
  const drop = (base: number) =>
    dropWeight(history.sets, { exerciseId: slot.exerciseId, run: plan.run, blockPosition: plan.blockPosition }, base, slot.technique.type === 'drop_set' ? slot.technique : {}, step)

  // Vlerat e propozuara, të njëjta me njoftimin e seancës (`program/next-set.ts`). Pesha e setit të
  // parë: rreshti i "Peshave të javës", përndryshe propozimi i §7 ose pesha e fundit.
  const proposed: SetValues = segment
    ? segmentDefaults(segment.set, segment.set.technique === 'drop_set' ? drop(segment.set.weightKg ?? 0) : null)
    : setDefaults(slot, lastInSlot, week?.weightKg ?? null)
  // "Ndrysho" te njoftimi hap këtë set me përsëritjet ose sekondat e zgjedhura atje (V2-E1-08).
  const fromNotification = opened !== null && !segment && opened.slotId === slot.slotId && opened.setNumber === setNumber
  const defaults: SetValues = fromNotification ? { ...proposed, ...opened.values } : proposed
  const technique: Technique = isLastSet && !segment ? slot.technique : { type: 'none' }
  const next = progress.next === null ? null : progress.slots[progress.next].slot

  async function save(values: SetValues) {
    if (!slot) return
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
        startRest(segment.slot, false)
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
      // Rekordi del në moment (§6, §0.3c): e1RM-ja ose pesha më e madhe për ato përsëritje; banderola
      // mbi pushimin dhe një dridhje e rëndë.
      const record = setRecord(asHistory(saved, plan, session.id), history.sets)
      if (record) {
        setBanner({ id: saved.id, exercise: exercise?.name ?? '', record })
        void recordPulse()
      }
      if (technique.type === 'rest_pause' || technique.type === 'drop_set') {
        setSelected(null)
        if (technique.type === 'rest_pause') rest.start(technique.restSeconds ?? 15)
        return
      }
      startRest(slot, true)
    } finally {
      setBusy(false)
    }
  }

  return frame(
    <SetView
      key={`${slot.slotId}:${setNumber}:${segment ? 'segment' : 'set'}:${slot.exerciseId}${fromNotification ? `:${location.key}` : ''}`}
      exerciseId={slot.exerciseId}
      exerciseName={exercise?.name ?? ''}
      tracking={segment && tracking !== 'weight_reps' ? 'bodyweight_reps' : tracking}
      target={slot.target}
      setNumber={setNumber}
      sets={slot.sets}
      technique={slot.technique}
      segment={segment ? segment.set.technique : null}
      defaults={defaults}
      step={step}
      previous={segment ? null : reference(history.sets, { exerciseId: slot.exerciseId, blockPosition: plan.blockPosition, week: plan.week, setNumber, sessionId: session.id })}
      basis={week?.proposal.basis ?? null}
      history={history.sets}
      dropTo={slot.technique.type === 'drop_set' ? drop(defaults.weightKg) : null}
      next={next ? { name: exercises[next.exerciseId]?.name ?? '', sets: next.sets } : null}
      chips={<SetChips slot={slot} sets={session.sets.filter((set) => set.slotId === slot.slotId)} current={setNumber} records={records} onEdit={openEdit} />}
      busy={busy || waiting}
      onSave={(values) => void save(values)}
      onSkipSegment={
        segment
          ? () => {
              setDismissed(segment.set.id)
              startRest(segment.slot, false)
            }
          : undefined
      }
    />,
  )
}

/**
 * Korniza e seancës: shiriti i seteve, kreu me "Mbrapa", listën e ushtrimeve, dhe djathtas muzikën
 * (0.23: ikona që zë vendin e mini-player-it), videon e formës dhe muskujt, si te bordi "Seanca".
 */
function SessionFrame({
  progress,
  position,
  onBack,
  onList,
  onMuscles,
  onVideo,
  music,
  children,
}: {
  progress: SessionProgress
  /** "1 nga 9 · 06:10" */
  position: string
  onBack: () => void
  onList: () => void
  onMuscles?: () => void
  onVideo?: () => void
  /** Ikona e muzikës ("Trupi në ritëm"); pa plugin nuk vizaton asgjë. */
  music?: ReactNode
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        <SessionBar progress={progress} />
        <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2">
          <Button variant="ghost" size="icon" aria-label={t('common.back')} className="justify-self-start rounded-pill" onClick={onBack}>
            <Icon name="mbrapa" size={22} />
          </Button>
          <Button
            variant="ghost"
            aria-haspopup="dialog"
            aria-label={t('session.openList', { position })}
            className="justify-self-center gap-1.5 px-2 tabular-nums text-muted-foreground"
            onClick={onList}
          >
            {position}
            <Icon name="poshte" size={18} />
          </Button>
          <div className="flex justify-end">
            {music}
            {onVideo ? (
              <Button variant="ghost" size="icon" aria-label={t('videos.title')} className="rounded-pill" onClick={onVideo}>
                <Icon name="kamera-video" size={22} />
              </Button>
            ) : null}
            {onMuscles ? (
              <Button variant="ghost" size="icon" aria-label={t('session.muscles')} className="rounded-pill" onClick={onMuscles}>
                <Icon name="muskujt" size={22} />
              </Button>
            ) : null}
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

/** Shiriti i seancës: një pjesë për çdo ushtrim, sa më e gjatë aq më shumë sete; mbushet me setet e bëra. */
function SessionBar({ progress }: { progress: SessionProgress }) {
  const { t } = useI18n()
  return (
    <div
      role="progressbar"
      aria-label={t('session.progress')}
      aria-valuemin={0}
      aria-valuemax={progress.totalSets}
      aria-valuenow={progress.doneSets}
      aria-valuetext={t('session.progressValue', { done: progress.doneSets, total: progress.totalSets })}
      className="flex shrink-0 gap-1 px-4 pt-2.5"
    >
      {progress.slots.map((entry) => (
        <div key={entry.slot.slotId} className="h-1 basis-0 overflow-hidden rounded-pill bg-track" style={{ flexGrow: entry.slot.sets }}>
          <div className="h-full bg-ember" style={{ width: `${(entry.done / entry.slot.sets) * 100}%` }} />
        </div>
      ))}
    </div>
  )
}

/** Fundi i ekranit: veprimi kryesor ("Ruaj setin", "Mbyll stërvitjen"); `main` sipër ka `flex-1`. */
function SessionFooter({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-2 px-4 pt-2.5 pb-5">{children}</div>
}

function SetView({
  exerciseId,
  exerciseName,
  tracking,
  target,
  setNumber,
  sets,
  technique,
  segment,
  defaults,
  step,
  previous,
  basis,
  history,
  dropTo,
  next,
  chips,
  busy,
  onSave,
  onSkipSegment,
}: {
  exerciseId: string
  exerciseName: string
  tracking: Tracking
  target: Target
  setNumber: number
  sets: number
  /** Teknika e setit të fundit të slotit. */
  technique: Technique
  /** Segmenti që po regjistrohet, ose null për një set të zakonshëm. */
  segment: Technique['type'] | null
  defaults: SetValues
  step: number
  previous: Reference | null
  basis: WeightBasis | null
  history: HistorySet[]
  dropTo: number | null
  next: { name: string; sets: number } | null
  /** Çipat e seteve të ushtrimit (0.23). */
  chips: ReactNode
  busy: boolean
  onSave: (values: SetValues) => void
  onSkipSegment?: () => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [weightKg, setWeight] = useState(defaults.weightKg)
  const [reps, setReps] = useState(defaults.reps ?? 0)
  const [seconds, setSeconds] = useState(defaults.seconds ?? 0)
  const [rir, setRir] = useState(defaults.rir)
  const timed = tracking === 'timed'
  const editing = params.get('shkruaj')
  const edit = (field: 'pesha' | 'perseritjet' | 'sekondat') => setParams({ shkruaj: field })
  const clamp = (value: number, max = 999) => Math.min(max, Math.max(0, Math.round(value * 100) / 100))

  const subtitle = segment
    ? t(segment === 'drop_set' ? 'session.segment.dropSet' : 'session.segment.restPause', { set: setNumber, sets })
    : t('session.setOf', { set: setNumber, sets, target: targetText(target, texts) })
  const range = rangeText(target, fmt)
  const bounds = target.kind === 'reps' ? { min: target.min, max: target.max } : target.kind === 'timed' ? null : { min: target.reps, max: target.reps }
  const hint = !segment && tracking === 'weight_reps' && bounds ? recordHint(history, { exerciseId, weightKg, ...bounds }) : null

  return (
    <>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pt-1">
        <div className="flex flex-col">
          <h1 className="type-display-l">{exerciseName}</h1>
          <p className="mt-1.5 type-body text-muted-foreground tabular-nums">{subtitle}</p>
          {tracking === 'bodyweight_reps' && !segment ? <p className="mt-0.5 type-body text-muted-foreground">{t('session.extraWeight')}</p> : null}
        </div>

        {chips}

        {timed ? (
          <SecondsStepper setNumber={setNumber} seconds={seconds} onChange={(value) => setSeconds(clamp(value))} onEdit={() => edit('sekondat')} />
        ) : (
          <Stepper
            className="pt-2.5"
            weight={weightKg}
            reps={reps}
            weightStep={step}
            label={t('session.setLabel', { set: setNumber })}
            canLowerWeight={weightKg > 0}
            canLowerReps={reps > 1}
            onWeightStep={(direction) => setWeight((value) => clamp(value + direction * step))}
            onRepsStep={(direction) => setReps((value) => clamp(value + direction))}
            onEditWeight={() => edit('pesha')}
            onEditReps={() => edit('perseritjet')}
          />
        )}

        {rir === null || segment ? null : <RirPicker value={rir} onChange={setRir} />}

        {segment ? null : <TechniqueNote technique={technique} sets={sets} dropTo={dropTo} />}

        {segment ? null : (
          <div className="flex flex-col divide-y divide-border">
            <SetRows previous={previous} weightKg={tracking === 'timed' ? null : weightKg} basis={basis} range={range} hint={hint} />
            {next ? (
              <section aria-label={t('session.nextExercise')} className="flex min-h-10 items-center justify-between gap-3 py-2 text-sm leading-[1.35]">
                <span className="shrink-0 text-muted-foreground">{t('session.next')}</span>
                <span className="min-w-0 truncate text-right">
                  {next.name} · {t('session.sets', { count: next.sets })}
                </span>
              </section>
            ) : null}
          </div>
        )}
      </main>

      <SessionFooter>
        <Button
          variant="primary"
          size="xl"
          disabled={busy || (!timed && reps < 1) || (timed && seconds < 1)}
          onClick={() => onSave({ weightKg, reps: timed ? null : reps, seconds: timed ? seconds : null, rir })}
        >
          {t(segment ? 'session.saveSegment' : 'session.save')}
        </Button>
        {onSkipSegment ? (
          <Button variant="ghost" disabled={busy} onClick={onSkipSegment}>
            {t('session.skipSegment')}
          </Button>
        ) : null}
      </SessionFooter>

      {editing === 'pesha' || editing === 'perseritjet' || editing === 'sekondat' ? (
        <NumberSheet
          label={t(editing === 'pesha' ? 'session.edit.weight' : editing === 'sekondat' ? 'session.edit.seconds' : 'session.edit.reps')}
          value={editing === 'pesha' ? weightKg : editing === 'sekondat' ? seconds : reps}
          decimals={editing === 'pesha'}
          onSave={(value) => {
            if (editing === 'pesha') setWeight(clamp(value))
            else if (editing === 'sekondat') setSeconds(clamp(Math.round(value), 3600))
            else setReps(clamp(Math.round(value)))
            navigate(-1)
          }}
          onClose={() => navigate(-1)}
        />
      ) : null}
    </>
  )
}

/**
 * Rreshtat poshtë setit (bordi "Seanca", 0.23): "Herën e kaluar · 60 × 13 · +2,5 kg" (ose e njëjta javë e
 * bllokut të kaluar), ose si të zgjidhet pesha; pastaj pragu i rekordit (`recordHint`) me kupën.
 */
function SetRows({
  previous,
  weightKg,
  basis,
  range,
  hint,
}: {
  previous: Reference | null
  weightKg: number | null
  basis: WeightBasis | null
  range: string | null
  hint: RecordHint | null
}) {
  const { t, fmt } = useI18n()
  const row = 'flex min-h-10 items-center justify-between gap-3 py-2 text-sm leading-[1.35]'
  let reference: ReactNode = null
  if (previous) {
    const value = previous.weightKg ? `${fmt.number(previous.weightKg)} × ${fmt.number(previous.reps ?? 0)}` : t('session.target.reps', { count: previous.reps ?? 0 })
    const label =
      previous.kind === 'last_time'
        ? t('session.lastTime')
        : programWeekLabel(t, { blockName: previous.blockName, blockWeeks: previous.blockWeeks, week: previous.week, run: 1 })
    const diff = weightKg && previous.weightKg ? Math.round((weightKg - previous.weightKg) * 100) / 100 : 0
    reference = (
      <div className={row}>
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className="min-w-0 text-right tabular-nums">
          {value}
          {diff !== 0 ? (
            <>
              {' · '}
              <span className="font-semibold text-data">
                {diff > 0 ? '+' : '−'}
                {fmt.unit(Math.abs(diff), 'kg')}
              </span>
            </>
          ) : null}
        </span>
      </div>
    )
  } else {
    const text = basis?.kind === 'choose' && range ? t('session.choose', { range }) : basis?.kind === 'needs_one_rm' ? t('session.needsOneRm') : null
    if (text) reference = <p className={cn(row, 'text-muted-foreground')}>{text}</p>
  }
  if (!reference && !hint) return null
  const e1rm = hint ? fmt.unit(hint.e1rmKg, 'kg', { maxDigits: 1 }) : ''
  return (
    <section aria-label={t('session.rows')} className="flex flex-col divide-y divide-border">
      {reference}
      {hint ? (
        <div className={row}>
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <Icon name="kupa" size={16} className="text-ember-text" />
            {t('session.record.label')}
          </span>
          <span className="min-w-0 text-right tabular-nums">
            {hint.kind === 'reps' ? t('session.record.reps', { count: hint.reps, e1rm }) : t('session.record.any', { e1rm })}
          </span>
        </div>
      ) : null}
    </section>
  )
}

/** Teknika e setit të fundit, që në setin e parë: "Seti 4: rest-pause, 15 s pushim". */
function TechniqueNote({ technique, sets, dropTo }: { technique: Technique; sets: number; dropTo: number | null }) {
  const { t, fmt } = useI18n()
  let text: string | null = null
  if (technique.type === 'rest_pause') text = t('session.technique.restPause', { set: sets, seconds: technique.restSeconds ?? 15 })
  else if (technique.type === 'drop_set') text = dropTo ? t('session.technique.dropSetTo', { set: sets, weight: fmt.unit(dropTo, 'kg') }) : t('session.technique.dropSet', { set: sets })
  else if (technique.type === 'to_failure') text = t('session.technique.toFailure', { set: sets })
  return text ? <p className="type-caption text-muted-foreground">{text}</p> : null
}

/** Setet me kohë (Plank): një numër i madh me sekondat dhe −5 / +5. */
function SecondsStepper({ setNumber, seconds, onChange, onEdit }: { setNumber: number; seconds: number; onChange: (value: number) => void; onEdit: () => void }) {
  const { t, fmt } = useI18n()
  return (
    <div role="group" aria-label={t('session.seconds.summary', { set: setNumber, count: seconds })} className="flex flex-col gap-3.5 pt-2.5">
      <div className="flex flex-col items-center gap-1">
        <button type="button" aria-label={t('session.seconds.edit', { seconds })} onClick={onEdit} className="min-h-touch rounded-md">
          <span className="type-display-hero text-foreground">{fmt.number(seconds)}</span>
        </button>
        <span aria-hidden className="type-body text-muted-foreground">
          {t('session.seconds.unit', { count: seconds })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" ground="page" size="lg" aria-label={t('session.seconds.lower')} disabled={seconds <= 5} onClick={() => onChange(seconds - 5)} className="px-0 text-xl tabular-nums">
          −{fmt.number(5)}
        </Button>
        <Button variant="secondary" ground="page" size="lg" aria-label={t('session.seconds.raise')} onClick={() => onChange(seconds + 5)} className="px-0 text-xl tabular-nums">
          +{fmt.number(5)}
        </Button>
      </div>
    </div>
  )
}

/**
 * Pushimi (bordet "Pushimi" dhe, nga 0.23, "Pushimi · banderola e rekordit"): unaza, −15 / +15 dhe
 * "Kapërce", seti që vjen dhe setet e ruajtura të ushtrimit me "rekord" dhe "Ndrysho". Rekordi i setit
 * të sapo ruajtur del te banderola sipër (`RecordBanner`); lexuesi i ekranit dëgjon "Seti 1 u ruajt".
 */
function RestView({
  rest,
  saved,
  sets,
  records,
  next,
  onEdit,
}: {
  rest: ReturnType<typeof useRestTimer>
  /** Seti i fundit; null derisa leximi i ri ta sjellë. */
  saved: SetRecord | null
  /** Setet e ruajtura të ushtrimit të setit të fundit. */
  sets: SetRecord[]
  /** Setet që ishin rekord në kohën e tyre (`sessionSetRecords`). */
  records: ReadonlyMap<string, SetRecordResult>
  next: { exercise: string | null; text: string } | null
  onEdit: (set: SetRecord) => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  const size = 232
  const radius = 108
  const length = 2 * Math.PI * radius
  const fraction = rest.total > 0 ? rest.remaining / rest.total : 0
  return (
    <main className="flex flex-1 flex-col gap-3.5 px-4 pt-2 pb-5">
      <h1 className="sr-only">{t('session.rest.label')}</h1>
      <p aria-live="polite" className="sr-only">
        {saved ? t('session.rest.saved', { set: saved.setNumber, value: setValue(saved, texts) }) : null}
      </p>

      <div
        role="timer"
        aria-label={t('session.rest.spoken', { left: spokenDuration(rest.remaining, t), total: spokenDuration(rest.total, t) })}
        className="relative size-[232px] shrink-0 self-center"
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={12} className="stroke-track" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${fraction * length} ${length}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="stroke-ember-text transition-[stroke-dasharray] duration-200"
          />
        </svg>
        <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span className="type-label text-muted-foreground">{t('session.rest.label')}</span>
          <span className="type-display-hero">{clock(rest.remaining)}</span>
          <span className="type-caption text-muted-foreground tabular-nums">{t('session.rest.of', { total: clock(rest.total) })}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" ground="page" size="lg" aria-label={t('session.rest.less')} className="px-0 text-xl tabular-nums" onClick={() => rest.add(-15)}>
          <span className="normal-case">−{fmt.unit(15, 's')}</span>
        </Button>
        <Button variant="secondary" ground="page" size="lg" aria-label={t('session.rest.more')} className="px-0 text-xl tabular-nums" onClick={() => rest.add(15)}>
          <span className="normal-case">+{fmt.unit(15, 's')}</span>
        </Button>
        <Button variant="secondary" ground="page" size="lg" className="px-0 text-xl" onClick={() => rest.skip()}>
          {t('session.rest.skip')}
        </Button>
      </div>

      {next ? (
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="type-caption text-muted-foreground">{t('session.next')}</span>
          {next.exercise ? <span className="type-body-strong">{next.exercise}</span> : null}
          <span className="type-body-strong tabular-nums">{next.text}</span>
        </div>
      ) : null}

      <SavedSets sets={sets} records={records} onEdit={onEdit} />
    </main>
  )
}

/** Fleta "Ndrysho setin" për një set të seancës së hapur, me hapin e pajisjes dhe RIR-in kur receta e kërkon. */
function EditSavedSet({
  set,
  snapshot,
  history,
  record,
  onClose,
}: {
  set: SetRecord
  snapshot: TrainingSnapshot
  history: TrainingHistory
  record: boolean
  onClose: () => void
}) {
  const exercise = snapshot.exercises[set.exerciseId]
  const target = snapshot.plan.slots.find((slot) => slot.slotId === set.slotId)?.target
  return (
    <EditSetSheet
      key={set.id}
      set={{ id: set.id, setNumber: set.setNumber, weightKg: set.weightKg, reps: set.reps, rir: set.rir, record }}
      description={exercise?.name ?? ''}
      step={exercise ? weightStep(exercise.equipment, history.weightSteps) : 2.5}
      showRir={set.rir !== null || (target?.kind === 'reps' && target.rir !== undefined)}
      history={history.sets}
      onClose={onClose}
    />
  )
}
