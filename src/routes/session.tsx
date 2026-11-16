import { type PointerEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ExerciseVideoSheet } from '@/components/ui/exercise-video'
import { ExerciseMotion } from '@/components/ui/exercise-motion'
import { Icon } from '@/components/ui/icons'
import { RirPicker } from '@/components/ui/rir-picker'
import { Stepper } from '@/components/ui/stepper'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type ExerciseRecord, finishWorkout, saveSet, type SetRecord, undoSet, trainingHistory, type TrainingHistory, trainingSnapshot, type TrainingSnapshot } from '@/data/training'
import { type WorkoutWeight, workoutWeights } from '@/data/week-weights'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { dropWeight, type HistorySet, type Reference, reference, type WeightBasis, weightStep } from '@/program/loads'
import { chosenVideo } from '@/program/exercise-videos'
import { tempoOf } from '@/program/motion'
import { pendingSegment, segmentDefaults, setDefaults, type SetValues } from '@/program/next-set'
import { type SetRow, setTable } from '@/program/set-table'
import { type RecordHint, recordHint, sessionSetRecords, setRecord, type SetRecordResult } from '@/progress/records'
import { type SessionProgress, sessionProgress } from '@/program/session-progress'
import type { PlannedSlot, SessionPlan, Target, Technique, Tracking } from '@/program/types'
import { cn } from '@/lib/cn'
import { restFinishedInApp } from '@/lib/rest-alarm'
import { openedSet, sessionView } from '@/lib/session-notification'
import { useRestTimer } from '@/lib/use-rest-timer'
import { CueList } from './exercise-guide'
import { ExerciseMusclesSheet } from './exercise-muscles'
import { FormVideoScreen, type FormVideoTarget } from './form-video'
import { type BeatContext, BodyBeatScreen, MusicButton, MusicConnectScreen, TapSheet } from './music'
import { useSessionBeat } from './music-beat'
import { editable, elapsedText, loadText, previousText, rangeText, setValue, spokenDuration, targetShort, targetText } from './session-format'
import { type BannerRecord, RecordBanner } from './session-banner'
import { recordPulse, savePulse } from './session-motion'
import { SessionGuide } from './session-guide'
import { useSessionGuide } from './session-guide-hook'
import { type KeypadChip, KeypadSheet } from './session-keypad'
import { SessionLighter } from './session-lighter'
import { type LocalChange, setKey, settled, useTapGuard, withLocal } from './session-local'
import { ChangeExerciseSheet, ExerciseListSheet } from './session-sheets'
import { ActiveNote, SetTable } from './session-table'
import { UndoToast } from './session-undo'
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
async function sessionWeights(): Promise<Map<string, WorkoutWeight>> {
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

/** Koha e një seti të ri: tani, ose një milisekondë pas setit të fundit kur ai vjen më vonë. */
function after(last: string | undefined): string {
  const now = Date.now()
  const previous = last ? Date.parse(last) : Number.NaN
  return new Date(Number.isFinite(previous) && previous >= now ? previous + 1 : now).toISOString()
}

/** Historia me ndryshimet lokale të seancës: setet e zhbëra hiqen, ato të ruajtura në prekje shtohen. */
function liveHistory(sets: HistorySet[], changes: readonly LocalChange[], plan: SessionPlan, sessionId: string): HistorySet[] {
  if (changes.length === 0) return sets
  const touched = new Set(
    changes.flatMap((change) => {
      const slotId = change.key.slice(0, change.key.lastIndexOf(':'))
      const slot = plan.slots.find((entry) => entry.slotId === slotId)
      return slot ? [`${slot.exerciseId}:${change.key.slice(change.key.lastIndexOf(':') + 1)}`] : []
    }),
  )
  const kept = sets.filter((set) => !(set.sessionId === sessionId && touched.has(`${set.exerciseId}:${set.setNumber}`)))
  const added = changes.flatMap((change) => (change.set ? [asHistory(change.set, plan, sessionId)] : []))
  return [...kept, ...added].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
}

/** Seti që ruan "Ruaj setin": sloti, numri, teknika e setit dhe segmenti që pret, kur është ai. */
interface Step {
  slot: PlannedSlot
  setNumber: number
  technique: Technique
  segment: SegmentStep | null
}

/** "Zhbëj" për setin e sapo ruajtur (6 s): çelësi, teksti dhe shkrimi që duhet pritur para heqjes. */
interface UndoEntry {
  key: string
  token: number
  slotId: string
  setId: string
  setNumber: number
  segment: boolean
  /** Seti para segmentit, që "Zhbëj" e kthen pa të. */
  base: SetRecord | null
  text: string
  done: Promise<SetRecord>
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
  weights: Map<string, WorkoutWeight>
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

  // "Ruaj setin" dhe "Zhbëj" duken në prekje, para bazës (V58; docs/MESIMET.md): ndryshimet lokale mbi
  // leximin largohen kur shkrimi mbaron dhe leximi i tregon. Shkrimet shkojnë një nga një, që "Zhbëj" të
  // heqë setin pasi është shkruar dhe një set i ri me të njëjtin numër të vijë pas heqjes.
  const [changes, setChanges] = useState<LocalChange[]>([])
  const sets = useMemo(() => withLocal(session.sets, changes), [session.sets, changes])
  useEffect(() => {
    setChanges((current) => {
      const next = settled(session.sets, current)
      return next.length === current.length ? current : next
    })
  }, [session.sets, changes])
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  const tokens = useRef(0)
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = writes.current.then(task)
    writes.current = run.catch(() => undefined)
    return run
  }
  /** Një ndryshim lokal i setit; shkrimi e shënon të shkruar, ose e heq kur dështon. */
  function local(key: string, set: SetRecord | null, write: Promise<unknown>): number {
    const token = ++tokens.current
    setChanges((current) => [...current.filter((entry) => entry.key !== key), { key, set, written: false, token }])
    write.then(
      () => setChanges((current) => current.map((entry) => (entry.token === token ? { ...entry, written: true } : entry))),
      () => {
        setChanges((current) => current.filter((entry) => entry.token !== token))
        setUndo((entry) => (entry?.token === token ? null : entry))
      },
    )
    return token
  }
  const [undo, setUndo] = useState<UndoEntry | null>(null)

  const now = useNow(1000)
  const { plan, exercises } = snapshot
  const progress = sessionProgress(plan, sets, selected)
  // Rekordi i çdo seti në kohën e vet (§6: e1RM-ja, ose pesha më e madhe për ato përsëritje): tabela,
  // pushimi dhe fleta e ndryshimit; seti 1 mbetet rekord edhe kur seti 2 e kalon.
  // Historia me setet që leximi s'i ka ende (ose i ka ende pas "Zhbëj"): rekordet, pragu dhe lista e
  // ndjekin setin në prekje, si tabela.
  const live = useMemo(() => liveHistory(history.sets, changes, snapshot.plan, session.id), [history.sets, changes, snapshot.plan, session.id])
  const records = useMemo(() => sessionSetRecords(live, session.id), [live, session.id])
  const elapsed = (now - Date.parse(session.startedAt)) / 1000

  const lastSet = sets.at(-1) ?? null
  const lastSlot = lastSet ? plan.slots.find((entry) => entry.slotId === lastSet.slotId) : undefined
  const segmentDue = selected ? null : pendingSegment(plan, sets)
  const segment: SegmentStep | null = segmentDue && dismissed !== segmentDue.set.id ? segmentDue : null
  // Rrëshqitja dhe lista hapin edhe një ushtrim të bërë: setet e tij shihen dhe ndryshohen (V58).
  const selectedIndex = selected ? plan.slots.findIndex((entry) => entry.slotId === selected) : -1
  const viewing = selectedIndex >= 0 && progress.slots[selectedIndex].done >= progress.slots[selectedIndex].slot.sets ? selectedIndex : null
  const shownIndex = segment ? plan.slots.findIndex((entry) => entry.slotId === segment.slot.slotId) : (viewing ?? progress.current)
  const current = shownIndex === null ? null : progress.slots[shownIndex]
  const slot = current?.slot ?? null
  const exercise = slot ? exercises[slot.exerciseId] : undefined
  const position = t('session.position', { exercise: (shownIndex ?? plan.slots.length - 1) + 1, exercises: plan.slots.length, elapsed: elapsedText(elapsed) })
  // Seti në ekran; gjatë pushimit, seti që vjen. Videoja e formës regjistrohet për të (V2-E1-13).
  const setNumber = current ? (segment ? segment.set.setNumber : Math.min(current.done + 1, current.slot.sets)) : 0
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
  const openSheet = (name: 'lista' | 'ndrysho' | 'muskujt' | 'video' | 'videoja' | 'ritmi' | 'lidh-muziken') => setParams({ [name]: '1' })
  // Lëvizja dhe sinjalet: të hapura te seti i parë i ushtrimit, të palosura pas tij, derisa përdoruesi të zgjedhë.
  const [foldedSlots, setFoldedSlots] = useState<Record<string, boolean>>({})
  const demo = exercise ? chosenVideo(exercise, exercise.videoUrl) : null
  const closeSheet = () => navigate(-1)
  const finish = () => {
    setBusy(true)
    rest.skip()
    onClosing(session.id)
    void enqueue(() => finishWorkout(store, session.id))
  }
  /** Pesha e ushtrimit në këtë seancë: e setit të fundit, ose pesha e javës për setin e parë. */
  const weightOf = (target: PlannedSlot) => {
    const inSession = sets.filter((set) => set.slotId === target.slotId).at(-1)
    return inSession ? inSession.weightKg : (weights.get(target.slotId)?.weightKg ?? null)
  }
  function startRest(after: PlannedSlot, newSet: boolean) {
    const remaining = progress.totalSets - progress.doneSets - (newSet ? 1 : 0)
    if (remaining > 0) rest.start(after.restSeconds)
  }
  /** Ushtrimi tjetër ose i mëparshmi (rrëshqitja anash), edhe kur është bërë. */
  const go = (index: number) => {
    const target = plan.slots[Math.min(plan.slots.length - 1, Math.max(0, index))]
    if (target) setSelected(target.slotId)
  }

  // "Ndrysho setin": prekja e një seti të ruajtur të çdo ushtrimi te tabela; fleta e historikut.
  const editId = params.get('seti')
  const edited = editId ? sets.find((set) => set.id === editId && editable(set)) : undefined
  const openEdit = (set: SetRecord) => setParams({ seti: set.id })

  /**
   * "Ruaj setin" (§6, §0.3c): seti del menjëherë te tabela me "Zhbëj", pushimi nis, rekordi del te
   * banderola; baza shkruhet pas tij. Segmenti i shtohet setit të fundit.
   */
  function save(step: Step, values: SetValues) {
    const { slot: at, setNumber: number, technique, segment: due } = step
    const tracking = exercises[at.exerciseId]?.tracking ?? 'weight_reps'
    // Seti i ri e mbyll pushimin: njoftimi i tij anulohet (TH-09).
    if (rest.running) rest.skip()
    const weightKg = tracking === 'timed' ? null : values.weightKg
    const key = setKey({ slotId: at.slotId, setNumber: number })
    if (due) {
      const withSegment: SetRecord = { ...due.set, segments: [{ weightKg: tracking === 'weight_reps' ? weightKg : null, reps: values.reps ?? 0 }] }
      const done = enqueue(() =>
        saveSet(store, {
          id: due.set.id,
          sessionId: session.id,
          slot: due.slot,
          setNumber: due.set.setNumber,
          weightKg: due.set.weightKg,
          reps: due.set.reps,
          seconds: due.set.seconds,
          rir: due.set.rir,
          technique: due.set.technique,
          segments: withSegment.segments,
        }),
      )
      const token = local(key, withSegment, done)
      setUndo({ key, token, slotId: at.slotId, setId: due.set.id, setNumber: number, segment: true, base: due.set, text: setValue(withSegment, texts), done })
      void savePulse()
      setSelected(null)
      startRest(due.slot, false)
      return
    }
    const id = crypto.randomUUID()
    const saved: SetRecord = {
      id,
      slotId: at.slotId,
      exerciseId: at.exerciseId,
      setNumber: number,
      weightKg,
      reps: values.reps,
      seconds: values.seconds,
      rir: values.rir,
      rpe: null,
      technique: technique.type,
      segments: [],
      // Pas setit më të ri të njohur, që seti i ri të jetë i fundit edhe për rekordet, kur ora e telefonit ndryshon.
      loggedAt: after(live.at(-1)?.loggedAt),
      notes: null,
    }
    const done = enqueue(() =>
      saveSet(store, { newId: id, sessionId: session.id, slot: at, setNumber: number, weightKg, reps: values.reps, seconds: values.seconds, rir: values.rir, technique: technique.type }),
    )
    const token = local(key, saved, done)
    setUndo({ key, token, slotId: at.slotId, setId: id, setNumber: number, segment: false, base: null, text: setValue(saved, texts), done })
    // Rekordi del në moment (§6, §0.3c): e1RM-ja ose pesha më e madhe për ato përsëritje; banderola
    // mbi pushimin dhe një dridhje e rëndë në vend të së lehtës së çdo ruajtjeje.
    const record = setRecord(asHistory(saved, plan, session.id), live)
    if (record) {
      setBanner({ id, exercise: exercises[at.exerciseId]?.name ?? '', record })
      void recordPulse()
    } else void savePulse()
    // Ushtrimi i zgjedhur mbetet në ekran derisa t'i mbarojnë setet.
    if (number >= at.sets) setSelected(null)
    if (technique.type === 'rest_pause' || technique.type === 'drop_set') {
      if (technique.type === 'rest_pause') rest.start(technique.restSeconds ?? 15)
      return
    }
    startRest(at, true)
  }

  /** "Zhbëj": seti (ose segmenti) hiqet menjëherë nga ekrani, pushimi dhe njoftimi i tij ndalen. */
  function undoLast(entry: UndoEntry) {
    setUndo(null)
    rest.skip()
    setBanner((current) => (current?.id === entry.setId ? null : current))
    const done = enqueue(async () => {
      const written = await entry.done
      await undoSet(store, written.id, { segment: entry.segment })
    })
    local(entry.key, entry.segment && entry.base ? { ...entry.base, segments: [] } : null, done)
    if (entry.segment) setDismissed(null)
    else setSelected(entry.slotId)
  }

  const notice = undo ? <UndoToast key={undo.token} text={t(undo.segment ? 'session.undo.segment' : 'session.undo.saved', { set: undo.setNumber, value: undo.text })} setNumber={undo.setNumber} onUndo={() => undoLast(undo)} onExpire={() => setUndo((entry) => (entry?.token === undo.token ? null : entry))} /> : null

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
      top={<SessionLighter snapshot={snapshot} started={sets.length > 0} />}
    >
      {children}
      <RecordBanner banner={banner} onDone={() => setBanner(null)} />
      {params.has('lista') ? (
        <ExerciseListSheet
          snapshot={snapshot}
          progress={progress}
          sets={sets}
          history={live}
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
      {params.has('videoja') && demo && exercise ? <ExerciseVideoSheet chosen={demo} name={exercise.name} onClose={closeSheet} /> : null}
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
      {edited ? <EditSavedSet set={edited} snapshot={snapshot} history={{ ...history, sets: live }} record={records.get(edited.id)?.kind === 'e1rm'} onClose={closeSheet} /> : null}
    </SessionFrame>
  )

  // Seti që vjen (te seti dhe te pushimi): vlerat e propozuara, të njëjta me njoftimin e seancës
  // (`program/next-set.ts`). Pesha e setit të parë: rreshti i "Peshave të javës", përndryshe propozimi i §7.
  const active = viewing === null
  const tracking: Tracking = exercise?.tracking ?? 'weight_reps'
  const step = exercise ? weightStep(exercise.equipment, history.weightSteps) : 2.5
  const lastInSlot = slot ? sets.filter((set) => set.slotId === slot.slotId).at(-1) : undefined
  const week = slot ? weights.get(slot.slotId) : undefined
  const drop = (base: number) =>
    slot ? dropWeight(live, { exerciseId: slot.exerciseId, run: plan.run, blockPosition: plan.blockPosition }, base, slot.technique.type === 'drop_set' ? slot.technique : {}, step) : null
  const proposed: SetValues | null = !slot
    ? null
    : segment
      ? segmentDefaults(segment.set, segment.set.technique === 'drop_set' ? drop(segment.set.weightKg ?? 0) : null)
      : setDefaults(slot, lastInSlot, week?.weightKg ?? null)
  // "Ndrysho" te njoftimi hap këtë set me përsëritjet ose sekondat e zgjedhura atje (V2-E1-08).
  const fromNotification = opened !== null && slot !== null && !segment && opened.slotId === slot.slotId && opened.setNumber === setNumber
  const defaults: SetValues | null = proposed && fromNotification ? { ...proposed, ...opened.values } : proposed
  const technique: Technique = slot && setNumber === slot.sets && !segment ? slot.technique : { type: 'none' }
  const dropTo = slot?.technique.type === 'drop_set' ? drop(lastInSlot?.weightKg ?? defaults?.weightKg ?? 0) : null
  const restPauseSeconds = slot?.technique.type === 'rest_pause' ? (slot.technique.restSeconds ?? 15) : null
  const rowsFor = (at: PlannedSlot, activeSet: number | null) =>
    setTable({
      slot: at,
      sets,
      active: activeSet,
      segment: Boolean(segment),
      weekWeightKg: weights.get(at.slotId)?.weightKg ?? null,
      history: live,
      at: { exerciseId: at.exerciseId, blockPosition: plan.blockPosition, week: plan.week, sessionId: session.id },
    })

  if (rest.running && lastSet && viewing === null) {
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
    // Pushimi para setit që vjen (bordet "Pushimi · Zhbëj" dhe "Pushimi · ushtrimi i ri"): tabela e
    // ushtrimit, ose lëvizja dhe sinjalet e ushtrimit të ri; "Ruaj setin N" ruan setin me vlerat e propozuara.
    const coming: RestNext | null =
      slot && current && defaults
        ? {
            key: `${slot.slotId}:${setNumber}:${segment ? 'segment' : 'set'}`,
            exercise: exercise ?? null,
            slot,
            setNumber,
            segment: segment ? segment.set.technique : null,
            newExercise: lastSet.slotId !== slot.slotId && !segment,
            weightKg: tracking === 'timed' ? null : defaults.weightKg,
            tracking,
            rows: rowsFor(slot, setNumber),
            dropTo,
            restPauseSeconds,
            canSave: !(tracking === 'weight_reps' && defaults.weightKg <= 0) && (tracking === 'timed' ? (defaults.seconds ?? 0) > 0 : (defaults.reps ?? 0) > 0),
          }
        : null
    return frame(
      <RestView
        rest={rest}
        saved={undo?.setId === lastSet.id || undo?.key === setKey(lastSet) ? null : lastSet}
        next={coming}
        records={records}
        notice={notice}
        onEdit={openEdit}
        onSave={() => {
          if (slot && defaults) save({ slot, setNumber, technique, segment }, defaults)
        }}
      />,
      next,
    )
  }

  if (!current || !slot || !defaults) {
    return frame(
      <>
        <main className="flex flex-1 flex-col gap-2 px-4 pt-4">
          <h1 className="type-display-l">{t('session.allDone')}</h1>
          <p className="type-body text-muted-foreground">{t('session.allDoneText')}</p>
        </main>
        <SessionFooter>
          {notice}
          <Button variant="primary" size="xl" disabled={busy} onClick={finish}>
            {t('session.finish')}
          </Button>
        </SessionFooter>
      </>,
    )
  }

  const previous = segment ? null : reference(live, { exerciseId: slot.exerciseId, blockPosition: plan.blockPosition, week: plan.week, setNumber, sessionId: session.id })
  const rows = rowsFor(slot, active ? setNumber : null)
  const folded = foldedSlots[slot.slotId] ?? (current.done > 0 || segment !== null)
  const nextIndex = progress.current
  const continueTo = !active && nextIndex !== null ? (exercises[progress.slots[nextIndex].slot.exerciseId]?.name ?? '') : null

  return frame(
    <SetView
      key={`${slot.slotId}:${setNumber}:${active ? '' : 'view:'}${segment ? 'segment' : 'set'}:${slot.exerciseId}${fromNotification ? `:${location.key}` : ''}${lastInSlot ? '' : `:${week?.weightKg ?? ''}:${slot.sets}`}`}
      mode={active ? 'set' : 'view'}
      exercise={exercise}
      exerciseName={exercise?.name ?? ''}
      tracking={segment && tracking !== 'weight_reps' ? 'bodyweight_reps' : tracking}
      target={slot.target}
      setNumber={setNumber}
      sets={slot.sets}
      done={current.done}
      restSeconds={slot.restSeconds}
      segment={segment ? segment.set.technique : null}
      defaults={defaults}
      step={step}
      previous={previous}
      basis={week?.proposal.basis ?? null}
      weekKg={week?.weekKg ?? null}
      weekWeightKg={week?.weightKg ?? null}
      history={live}
      rows={rows}
      records={records}
      dropTo={dropTo}
      restPauseSeconds={restPauseSeconds}
      dots={{ count: plan.slots.length, shown: shownIndex ?? 0, done: progress.slots.map((entry) => entry.done >= entry.slot.sets) }}
      onSwipe={(direction) => go((shownIndex ?? 0) + direction)}
      folded={active ? folded : (foldedSlots[slot.slotId] ?? true)}
      onFold={(value) => setFoldedSlots((state) => ({ ...state, [slot.slotId]: value }))}
      onVideo={() => openSheet('videoja')}
      onEdit={openEdit}
      notice={notice}
      continueTo={continueTo}
      onContinue={() => setSelected(null)}
      onFinish={finish}
      busy={busy}
      onSave={(values) => save({ slot, setNumber, technique, segment }, values)}
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
  top,
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
  /** Sugjerimi ose shiriti i seancës më të lehtë, nën kre (V50). */
  top?: ReactNode
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)]">
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
              <Button variant="ghost" size="icon" aria-label={t('session.filmYourself')} className="rounded-pill" onClick={onVideo}>
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
        {top}
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

/**
 * Fundi i ekranit: veprimi kryesor ("Ruaj setin", "Mbyll stërvitjen"), ngjitur poshtë që të duket edhe kur
 * tabela e seteve është e gjatë; `main` sipër ka `flex-1`.
 */
function SessionFooter({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+20px)]">{children}</div>
}

function SetView({
  mode,
  exercise,
  exerciseName,
  tracking,
  target,
  setNumber,
  sets,
  done,
  restSeconds,
  segment,
  defaults,
  step,
  previous,
  basis,
  weekKg,
  weekWeightKg,
  history,
  rows,
  records,
  dropTo,
  restPauseSeconds,
  dots,
  onSwipe,
  folded,
  onFold,
  onVideo,
  onEdit,
  notice,
  continueTo,
  onContinue,
  onFinish,
  busy,
  onSave,
  onSkipSegment,
}: {
  /** `set`: seti aktiv me stepper-in; `view`: një ushtrim i bërë, me setet që ndryshohen. */
  mode: 'set' | 'view'
  exercise: ExerciseRecord | undefined
  exerciseName: string
  tracking: Tracking
  target: Target
  setNumber: number
  sets: number
  /** Setet e ruajtura të ushtrimit. */
  done: number
  /** Pushimi pas setit (receta e slotit), te nëntitulli. */
  restSeconds: number
  /** Segmenti që po regjistrohet, ose null për një set të zakonshëm. */
  segment: Technique['type'] | null
  defaults: SetValues
  step: number
  previous: Reference | null
  basis: WeightBasis | null
  /** Pesha e javës kur e ka ulur "Mirë se u ktheve" ose seanca më e lehtë: "ishte 25 kg". */
  weekKg: number | null
  /** Pesha e javës e slotit, për çipin te tastiera. */
  weekWeightKg: number | null
  history: HistorySet[]
  /** Rreshtat e tabelës së seteve (`setTable`). */
  rows: SetRow<SetRecord>[]
  records: ReadonlyMap<string, unknown>
  dropTo: number | null
  restPauseSeconds: number | null
  /** Pikat poshtë kreut: një për ushtrim, i shfaquri si vijë prushi. */
  dots: { count: number; shown: number; done: boolean[] }
  /** Rrëshqitja anash: −1 ushtrimi i mëparshëm, +1 i radhës. */
  onSwipe: (direction: -1 | 1) => void
  folded: boolean
  onFold: (folded: boolean) => void
  onVideo: () => void
  onEdit: (set: SetRecord) => void
  /** "Zhbëj" mbi veprimin kryesor. */
  notice: ReactNode
  /** Te një ushtrim i bërë: ushtrimi ku vazhdon seanca; null kur të gjitha setet janë bërë. */
  continueTo: string | null
  onContinue: () => void
  onFinish: () => void
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
  // Një slot me peshë (jo pesha e trupit, jo me kohë) nuk ruhet me 0 kg: pesha shkruhet fillimisht.
  const needsWeight = tracking === 'weight_reps' && weightKg <= 0
  const weightNeededId = useId()
  const editing = params.get('shkruaj')
  const edit = (field: 'pesha' | 'perseritjet' | 'sekondat') => setParams({ shkruaj: field })
  const clamp = (value: number, max = 999) => Math.min(max, Math.max(0, Math.round(value * 100) / 100))
  const guide = useSessionGuide(exercise)

  const subtitle = segment
    ? t(segment === 'drop_set' ? 'session.segment.dropSet' : 'session.segment.restPause', { set: setNumber, sets })
    : t('session.setOf', { set: setNumber, sets, target: targetText(target, texts) })
  const range = rangeText(target, fmt)
  const bounds = target.kind === 'reps' ? { min: target.min, max: target.max } : target.kind === 'timed' ? null : { min: target.reps, max: target.reps }
  const hint = !segment && tracking === 'weight_reps' && bounds ? recordHint(history, { exerciseId: exercise?.id ?? '', weightKg, ...bounds }) : null
  const keypadFor = t('session.keypad.for', { exercise: exerciseName, set: setNumber })
  const ready = useTapGuard()
  const swipe = useSwipe(onSwipe)
  const viewing = mode === 'view'

  const card = (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-ember-text bg-surface p-3">
      <ActiveHeader setNumber={setNumber} segment={segment} previous={segment ? null : previous} weightKg={timed ? null : weightKg} tracking={tracking} />
      {timed ? (
        <SecondsStepper setNumber={setNumber} seconds={seconds} onChange={(value) => setSeconds(clamp(value))} onEdit={() => edit('sekondat')} />
      ) : (
        <Stepper
          size="card"
          weight={weightKg}
          reps={reps}
          weightStep={step}
          label={t('session.setLabel', { set: setNumber })}
          repsCaption={range && !segment ? t('session.table.repsTarget', { range }) : undefined}
          canLowerWeight={weightKg > 0}
          canLowerReps={reps > 1}
          onWeightStep={(direction) => setWeight((value) => clamp(value + direction * step))}
          onRepsStep={(direction) => setReps((value) => clamp(value + direction))}
          onEditWeight={() => edit('pesha')}
          onEditReps={() => edit('perseritjet')}
        />
      )}
      {!timed && weekKg !== null && weekKg !== weightKg ? (
        <p className="-mt-2 w-[calc(50%-6px)] text-center type-caption text-muted-foreground tabular-nums">{t('lighter.was', { weight: fmt.unit(weekKg, 'kg') })}</p>
      ) : null}
      {tracking === 'bodyweight_reps' && !segment ? <p className="type-caption text-muted-foreground">{t('session.extraWeight')}</p> : null}
      {rir === null || segment ? null : <RirPicker ground="card" value={rir} onChange={setRir} />}
      <ActiveNote row={rows.find((row) => row.state === 'active')} dropTo={dropTo} restPauseSeconds={restPauseSeconds} />
      {segment ? null : <SetHints previous={previous} basis={basis} range={range} hint={hint} />}
    </div>
  )

  return (
    <>
      <main className="flex flex-1 touch-pan-y flex-col gap-3 px-4 pt-1" {...swipe}>
        <Dots {...dots} />
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h1 className="min-w-0 type-display-l">{exerciseName}</h1>
            {guide.hasMotion ? (
              <Button
                variant="secondary"
                ground="page"
                size="icon"
                aria-expanded={!folded}
                aria-label={t(folded ? 'session.guide.show' : 'session.guide.hide')}
                onClick={() => onFold(!folded)}
                className="shrink-0"
              >
                <Icon name={folded ? 'chevron-poshte' : 'chevron-lart'} size={20} />
              </Button>
            ) : null}
          </div>
          <p className="mt-1 type-body text-muted-foreground tabular-nums">
            {viewing ? (
              <span>{t('session.doneSubtitle', { done, sets, target: targetText(target, texts) })}</span>
            ) : (
              <>
                <span>{subtitle}</span>
                {!segment && restSeconds > 0 ? <span> · {t('session.restSeconds', { seconds: restSeconds })}</span> : null}
              </>
            )}
          </p>
        </div>

        {exercise ? <SessionGuide exercise={exercise} folded={folded} onFold={onFold} onVideo={onVideo} /> : null}

        <SetTable
          rows={rows}
          tracking={tracking}
          target={target}
          records={records}
          dropTo={dropTo}
          restPauseSeconds={restPauseSeconds}
          active={viewing ? undefined : card}
          onEdit={onEdit}
        />
      </main>

      {viewing ? (
        <SessionFooter>
          {notice}
          {continueTo ? (
            <Button variant="secondary" ground="page" size="xl" onClick={onContinue}>
              {t('session.continueTo', { exercise: continueTo })}
            </Button>
          ) : (
            <Button variant="primary" size="xl" disabled={busy} onClick={onFinish}>
              {t('session.finish')}
            </Button>
          )}
        </SessionFooter>
      ) : (
      <SessionFooter>
        {notice}
        <Button
          variant="primary"
          size="xl"
          disabled={busy || (!timed && reps < 1) || (timed && seconds < 1) || needsWeight}
          aria-describedby={needsWeight ? weightNeededId : undefined}
          onClick={() => {
            if (ready()) onSave({ weightKg, reps: timed ? null : reps, seconds: timed ? seconds : null, rir })
          }}
        >
          {t(segment ? 'session.saveSegment' : 'session.save')}
        </Button>
        {needsWeight ? (
          <p id={weightNeededId} className="text-center type-caption text-muted-foreground">
            {t('session.weightNeeded')}
          </p>
        ) : null}
        {onSkipSegment ? (
          <Button variant="ghost" disabled={busy} onClick={onSkipSegment}>
            {t('session.skipSegment')}
          </Button>
        ) : null}
      </SessionFooter>
      )}

      {editing === 'pesha' || editing === 'perseritjet' || editing === 'sekondat' ? (
        <KeypadSheet
          kind={editing === 'pesha' ? 'weight' : editing === 'sekondat' ? 'seconds' : 'reps'}
          description={keypadFor}
          value={editing === 'pesha' ? weightKg : editing === 'sekondat' ? seconds : reps}
          step={editing === 'pesha' ? step : editing === 'sekondat' ? 5 : 1}
          plates={editing === 'pesha' && exercise?.equipment === 'barbell'}
          chips={keypadChips(editing, previous, weekWeightKg, texts.t)}
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

/** Pikat e ushtrimeve poshtë kreut (bordi "Seanca"): i shfaquri vijë prushi, të bërët gri; dekor, lista i thotë me fjalë. */
function Dots({ count, shown, done }: { count: number; shown: number; done: boolean[] }) {
  if (count < 2) return null
  return (
    <div aria-hidden className="flex justify-center gap-1.5 pb-0.5">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cn('h-1.5 rounded-pill transition-[width] duration-150 ease-out', index === shown ? 'w-5 bg-ember' : cn('w-1.5', done[index] ? 'bg-muted-foreground' : 'bg-subtle'))}
        />
      ))}
    </div>
  )
}

/**
 * Rrëshqitja anash te fleta e ushtrimit (V58): mbi 56 px dhe më shumë anash se lart-poshtë çon te ushtrimi
 * tjetër ose i mëparshmi. Fotot e lëvizjes kanë rrëshqitjen e tyre (fillimi → fundi), ndaj nuk e nisin.
 */
function useSwipe(onSwipe: (direction: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      start.current = target.closest('[data-motion-stage], input, [role="dialog"]') ? null : { x: event.clientX, y: event.clientY }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const from = start.current
      start.current = null
      if (!from) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1)
    },
    onPointerCancel: () => {
      start.current = null
    },
  }
}

/** Çipat e tastierës: "Herën e kaluar" dhe "Pesha e javës" për peshën, "Herën e kaluar" për përsëritjet. */
function keypadChips(field: 'pesha' | 'perseritjet' | 'sekondat', previous: Reference | null, weekWeightKg: number | null, t: I18n['t']): KeypadChip[] {
  const chips: KeypadChip[] = []
  if (field === 'pesha') {
    if (previous?.weightKg) chips.push({ label: t('session.keypad.lastTime'), value: previous.weightKg })
    if (weekWeightKg) chips.push({ label: t('session.keypad.week'), value: weekWeightKg })
  } else if (field === 'perseritjet' && previous?.reps) chips.push({ label: t('session.keypad.lastTime'), value: previous.reps })
  return chips
}

/** Kreu i kartës aktive: "Seti 3" (ose "Seti 4 · rest-pause") dhe "Herën e kaluar · 60 × 9 · +2,5 kg". */
function ActiveHeader({
  setNumber,
  segment,
  previous,
  weightKg,
  tracking,
}: {
  setNumber: number
  segment: Technique['type'] | null
  previous: Reference | null
  weightKg: number | null
  tracking: Tracking
}) {
  const { t, fmt } = useI18n()
  const value = previousText(previous, tracking, fmt)
  const diff = weightKg && previous?.weightKg ? Math.round((weightKg - previous.weightKg) * 100) / 100 : 0
  const label = segment
    ? t('session.review.setTag', { set: setNumber, technique: t(segment === 'drop_set' ? 'session.chip.dropSet' : 'session.chip.restPause') })
    : t('session.setLabel', { set: setNumber })
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 type-title">{label}</span>
      {value ? (
        <span className="min-w-0 truncate text-right text-[13px] leading-[1.35] text-muted-foreground tabular-nums">
          {t('session.table.previousValue', { value })}
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
      ) : null}
    </div>
  )
}

/**
 * Poshtë numrave të setit aktiv: pa referencë, si të zgjidhet pesha; pastaj pragu i rekordit
 * (`recordHint`) me kupën (0.23, §0.3c).
 */
function SetHints({ previous, basis, range, hint }: { previous: Reference | null; basis: WeightBasis | null; range: string | null; hint: RecordHint | null }) {
  const { t, fmt } = useI18n()
  const choose = !previous ? (basis?.kind === 'choose' && range ? t('session.choose', { range }) : basis?.kind === 'needs_one_rm' ? t('session.needsOneRm') : null) : null
  if (!choose && !hint) return null
  const e1rm = hint ? fmt.unit(hint.e1rmKg, 'kg', { maxDigits: 1 }) : ''
  return (
    <section aria-label={t('session.rows')} className="flex flex-col gap-1 border-t border-border pt-2.5 text-sm leading-[1.35]">
      {choose ? <p className="text-muted-foreground">{choose}</p> : null}
      {hint ? (
        <p className="flex items-center justify-between gap-3">
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <Icon name="kupa" size={16} className="text-ember-text" />
            {t('session.record.label')}
          </span>
          <span className="min-w-0 text-right tabular-nums">
            {hint.kind === 'reps' ? t('session.record.reps', { count: hint.reps, e1rm }) : t('session.record.any', { e1rm })}
          </span>
        </p>
      ) : null}
    </section>
  )
}

/** Setet me kohë (Plank): një numër i madh me sekondat dhe −5 / +5. */
function SecondsStepper({ setNumber, seconds, onChange, onEdit }: { setNumber: number; seconds: number; onChange: (value: number) => void; onEdit: () => void }) {
  const { t, fmt } = useI18n()
  return (
    <div role="group" aria-label={t('session.seconds.summary', { set: setNumber, count: seconds })} className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1">
        <button type="button" aria-label={t('session.seconds.edit', { seconds })} onClick={onEdit} className="min-h-touch rounded-md">
          <span className="font-display text-[72px] leading-[0.85] font-extrabold text-foreground tabular-nums">{fmt.number(seconds)}</span>
        </button>
        <span aria-hidden className="type-caption text-muted-foreground">
          {t('session.seconds.unit', { count: seconds })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" ground="card" size="lg" aria-label={t('session.seconds.lower')} disabled={seconds <= 5} onClick={() => onChange(seconds - 5)} className="px-0 text-xl tabular-nums">
          −{fmt.number(5)}
        </Button>
        <Button variant="secondary" ground="card" size="lg" aria-label={t('session.seconds.raise')} onClick={() => onChange(seconds + 5)} className="px-0 text-xl tabular-nums">
          +{fmt.number(5)}
        </Button>
      </div>
    </div>
  )
}

/** Seti që vjen pas pushimit, siç e tregon pushimi. */
interface RestNext {
  /** Sloti, numri dhe segmenti: butoni i ruajtjes merr një çelës të ri për çdo set (roja e prekjes). */
  key: string
  exercise: ExerciseRecord | null
  slot: PlannedSlot
  setNumber: number
  segment: Technique['type'] | null
  /** Seti i parë i një ushtrimi tjetër: lëvizja dhe sinjalet e tij në vend të tabelës. */
  newExercise: boolean
  weightKg: number | null
  tracking: Tracking
  rows: SetRow<SetRecord>[]
  dropTo: number | null
  restPauseSeconds: number | null
  /** Pa peshë (ushtrim pa histori) seti shkruhet te ekrani i setit, jo nga pushimi. */
  canSave: boolean
}

/**
 * Pushimi (SPEC §0.3c, §0.3g; bordet "Pushimi · Zhbëj" dhe "Pushimi · ushtrimi i ri"): unaza, −15 / +15 dhe
 * "Kapërce", pastaj seti që vjen. Kur është i të njëjtit ushtrim, tabela e tij me setet që preken për t'u
 * ndryshuar; kur është një ushtrim tjetër, lëvizja dhe 3 sinjalet e tij. "Ruaj setin N" ruan setin që vjen
 * me vlerat e propozuara (si njoftimi i seancës) dhe e mbyll pushimin. Lexuesi i ekranit dëgjon "Seti 1 u
 * ruajt" kur seti erdhi nga njoftimi (pa "Zhbëj").
 */
function RestView({
  rest,
  saved,
  next,
  records,
  notice,
  onEdit,
  onSave,
}: {
  rest: ReturnType<typeof useRestTimer>
  /** Seti i fundit, për lexuesin e ekranit; null kur e thotë "Zhbëj". */
  saved: SetRecord | null
  next: RestNext | null
  /** Setet që ishin rekord në kohën e tyre (`sessionSetRecords`). */
  records: ReadonlyMap<string, SetRecordResult>
  /** "Zhbëj" për setin e sapo ruajtur. */
  notice: ReactNode
  onEdit: (set: SetRecord) => void
  onSave: () => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  const size = 168
  const radius = 76
  const length = 2 * Math.PI * radius
  const fraction = rest.total > 0 ? rest.remaining / rest.total : 0
  const target = next ? (next.segment ? null : targetShort(next.slot.target, fmt)) : null
  const thenLabel = next
    ? next.segment
      ? t('session.review.setTag', { set: next.setNumber, technique: t(next.segment === 'drop_set' ? 'session.chip.dropSet' : 'session.chip.restPause') })
      : t('session.rest.then', { set: next.setNumber, sets: next.slot.sets })
    : null
  // "Herën e kaluar"-i i setit që vjen, si te seti: rreshti aktiv i tabelës.
  return (
    <>
      <main className="flex flex-1 flex-col gap-3 px-4 pt-1 pb-3">
        <h1 className="sr-only">{t('session.rest.label')}</h1>
        <p aria-live="polite" className="sr-only">
          {saved ? t('session.rest.saved', { set: saved.setNumber, value: setValue(saved, texts) }) : null}
        </p>

        <div
          role="timer"
          aria-label={t('session.rest.spoken', { left: spokenDuration(rest.remaining, t), total: spokenDuration(rest.total, t) })}
          className="relative size-[168px] shrink-0 self-center"
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={10} className="stroke-track" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${fraction * length} ${length}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="stroke-ember-text transition-[stroke-dasharray] duration-200"
            />
          </svg>
          <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="type-label text-muted-foreground">{t('session.rest.label')}</span>
            <span className="font-display text-[64px] leading-[0.85] font-extrabold tabular-nums">{clock(rest.remaining)}</span>
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

        {/* "A e dije?" (§0.3e) vjen me Mëso-n: këtu, poshtë kohëmatësit dhe mbi "Ruaj setin", pa i mbuluar. */}

        {next && next.newExercise ? (
          <NewExerciseCard next={next} target={target} />
        ) : next ? (
          <>
            <p className="flex items-baseline justify-between gap-3">
              <span className="type-label text-muted-foreground">{thenLabel}</span>
              {next.weightKg && target ? (
                <span className="tabular-nums">
                  <span className="font-display text-xl font-bold">{fmt.number(next.weightKg)}</span>{' '}
                  <span className="text-sm text-muted-foreground">{t('session.rest.loadTail', { target })}</span>
                </span>
              ) : target ? (
                <span className="font-display text-xl font-bold tabular-nums">{target}</span>
              ) : null}
            </p>
            <section aria-labelledby="rest-table-title" className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-2.5')}>
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 id="rest-table-title" className="type-title">
                  {next.exercise?.name ?? ''}
                </h2>
                <span className="type-caption text-muted-foreground">{t('session.rest.tapToEdit')}</span>
              </div>
              <SetTable
                rows={next.rows}
                tracking={next.tracking}
                target={next.slot.target}
                records={records}
                dropTo={next.dropTo}
                restPauseSeconds={next.restPauseSeconds}
                compact
                onEdit={onEdit}
              />
            </section>
          </>
        ) : null}
      </main>
      {notice || (next && next.canSave) ? (
        <SessionFooter>
          {notice}
          {next && next.canSave ? <RestSave key={next.key} label={next.segment ? t('session.saveSegment') : t('session.rest.saveNext', { set: next.setNumber })} onSave={onSave} /> : null}
        </SessionFooter>
      ) : null}
    </>
  )
}

/** "Ruaj setin N" te pushimi; me rojën e prekjes së dytë, sepse del aty ku ishte "Ruaj setin". */
function RestSave({ label, onSave }: { label: string; onSave: () => void }) {
  const ready = useTapGuard()
  return (
    <Button
      variant="primary"
      size="xl"
      onClick={() => {
        if (ready()) onSave()
      }}
    >
      {label}
    </Button>
  )
}

/** Ushtrimi i ri pas pushimit (bordi "Pushimi · ushtrimi i ri"): "Pastaj", emri, seti, lëvizja me tempon dhe 3 sinjalet. */
function NewExerciseCard({ next, target }: { next: RestNext; target: string | null }) {
  const { t, fmt } = useI18n()
  const exercise = next.exercise
  const { guide, cues, hasMotion } = useSessionGuide(exercise ?? undefined)
  const load = next.weightKg && target ? `${fmt.unit(next.weightKg, 'kg')} × ${target}` : target
  return (
    <section aria-labelledby="rest-next-title" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-3')}>
      <div className="flex flex-col gap-0.5">
        <span className="type-label text-muted-foreground">{t('session.next')}</span>
        <h2 id="rest-next-title" className="type-title">
          {exercise?.name ?? ''}
        </h2>
        <span className="type-caption text-muted-foreground tabular-nums">
          {t('session.setOf', { set: next.setNumber, sets: next.slot.sets, target: load ?? '' })}
        </span>
      </div>
      {exercise && hasMotion ? (
        <div className="-mx-3">
          <ExerciseMotion
            libraryId={exercise.libraryId}
            name={exercise.name}
            tempo={tempoOf(guide?.tempo)}
            showTempo={!guide || guide.tempo !== null}
            stageClassName="aspect-auto h-[132px]"
            overlay={
              <span className="pointer-events-none absolute top-2 left-2 rounded-sm bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground">
                {t('session.rest.newExercise')}
              </span>
            }
          />
        </div>
      ) : null}
      {cues.length ? <CueList cues={cues} numbered /> : null}
    </section>
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
