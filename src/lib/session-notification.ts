import type { LocalStore } from '@/data/store'
import { saveSet, trainingHistory, type TrainingHistory, trainingSnapshot, type TrainingSnapshot } from '@/data/training'
import { workoutWeights } from '@/data/week-weights'
import type { I18n } from '@/i18n'
import { dropWeight, weightStep } from '@/program/loads'
import { type LoggedSet, pendingSegment, segmentDefaults, setDefaults } from '@/program/next-set'
import { sessionProgress } from '@/program/session-progress'
import type { PlannedSlot, Technique, Tracking } from '@/program/types'
// Intervali i recetës ("9–11") është i njëjtë me atë të ekranit të seancës.
import { rangeText } from '@/routes/session-format'

// Njoftimi i seancës dhe seti nga njoftimi (V2-E1-08, SPEC §0.3a "Seti nga njoftimi").
//
// Gjatë një seance të hapur, njoftimi tregon setin e radhës me peshën dhe përsëritjet e propozuara
// dhe pushimin kur ka. JS-i i llogarit setet që vijnë një herë, si të ruhen me vlerat e propozuara,
// dhe ia jep plugin-it native (SessionNotificationPlugin.java) bashkë me tekstet në gjuhën e app-it.
// Prekjet te njoftimi i zbaton native-i menjëherë në njoftim (seti tjetër, pushimi) dhe i shkruan në
// një radhë në telefon (SharedPreferences), edhe kur WebView-i fle ose procesi është vrarë. JS-i e
// zbraz radhën kur njoftohet (app-i gjallë) dhe në çdo nisje; çdo veprim zbatohet një herë.

/** Një set i radhës te njoftimi, me vlerat që ruan "Ruaj setin" pa e hapur app-in. */
export interface NotificationStep {
  /** `seanca:sloti:seti`, me `:segment` për segmentin: e njëjta prekje dy herë ka të njëjtin çelës. */
  key: string
  slotId: string
  exerciseId: string
  position: number
  setNumber: number
  sets: number
  segment: 'rest_pause' | 'drop_set' | null
  /** Teknika që ruhet me setin: e slotit vetëm te seti i fundit. */
  technique: Technique['type']
  tracking: Tracking
  weightKg: number | null
  reps: number | null
  seconds: number | null
  rir: number | null
  /** Pushimi pas këtij seti, në sekonda; 0 pa pushim. */
  restAfter: number
  /**
   * Seti para tij në njoftim, kur ky e merr numrin prej tij: kur përdoruesi ndryshon përsëritjet me
   * −/+ dhe ruan, seti tjetër propozon të njëjtat (pjesëtuesi 1), segmenti një të tretën (3), si te seanca.
   */
  inherit: { key: string; divisor: number } | null
  /** Ushtrimi me peshë pa peshë të propozuar: pesha zgjidhet te app-i, njoftimi s'e ruan dot. */
  needsWeight: boolean
}

/** Hapi siç e merr plugin-i native: të dhënat dhe tekstet e gatshme. */
export interface NativeStep extends Omit<NotificationStep, 'sets' | 'needsWeight'> {
  /** "Bench Press · Seti 3 nga 4". */
  title: string
  /** "62,5"; null pa peshë. */
  weight: string | null
  /** "Synimi 9–11", ose si të zgjidhet pesha. */
  target: string | null
  canSave: boolean
}

export interface NotificationTexts {
  channel: string
  channelText: string
  session: string
  rest: string
  /** Formati i kronometrit të Android-it: "%s" bëhet koha që mbetet. */
  restEnds: string
  save: string
  saveSegment: string
  saveShort: string
  edit: string
  skipRest: string
  openApp: string
  repsLower: string
  repsRaise: string
  secondsLower: string
  secondsRaise: string
  repsOne: string
  repsOther: string
  secondsOne: string
  secondsOther: string
  allDone: string
  allDoneText: string
  restDoneTitle: string
  restDoneBody: string
  restChannel: string
  restChannelText: string
}

/** Gjithçka që i duhet njoftimit, edhe kur WebView-i nuk jeton (ruhet te telefoni). */
export interface NotificationState {
  sessionId: string
  /** Fillimi i seancës (ms): kreu i njoftimit numëron kohën që nga ai. */
  startedAt: number
  steps: NativeStep[]
  /** Setet arrijnë deri në fund të seancës (jo të prera te një set që kërkon peshën ose te kufiri). */
  complete: boolean
  texts: NotificationTexts
}

/** Një prekje te njoftimi, siç e ruan native-i te radha. */
export type NotificationAction =
  | {
      id: string
      type: 'save'
      /** Koha e prekjes (ms). */
      at: number
      sessionId: string
      key: string
      slotId: string
      exerciseId: string
      position: number
      setNumber: number
      segment: 'rest_pause' | 'drop_set' | null
      technique: Technique['type']
      weightKg: number | null
      reps: number | null
      seconds: number | null
      rir: number | null
      /** Fundi i pushimit që nisi njoftimi pas setit (ms) dhe gjatësia e tij, kur nisi një. */
      restEndsAt: number | null
      restSeconds: number | null
    }
  | { id: string; type: 'skip_rest'; at: number; sessionId: string }

/** Ura me plugin-in native; në prova, një imitim. */
export interface SessionNotificationPort {
  show(state: NotificationState): Promise<void>
  hide(): Promise<void>
  /** Veprimet në radhë, nga e vjetra te e reja. */
  pending(): Promise<NotificationAction[]>
  /** Heq nga radha veprimet e zbatuara (ose të hedhura). */
  ack(ids: string[]): Promise<void>
  /** Native-i njofton kur shton një veprim dhe JS-i jeton. */
  onAction(listener: () => void): () => void
}

/** Timer-i i pushimit i një seance (lib/use-rest-timer.ts). */
export interface RestControl {
  adopt(endsAt: number, totalSeconds: number): void
  skip(): void
}

/** Çfarë tregon ekrani i seancës, që njoftimi të mos propozojë një ushtrim tjetër. */
export interface SessionView {
  sessionId: string
  selected: string | null
  /** Segmenti që përdoruesi e kapërceu te ekrani (id e setit). */
  dismissedSegment: string | null
}

/** "Ndrysho" te njoftimi, siç e jep native-i: seti dhe vlerat e treguara atje. */
export interface OpenRequest {
  sessionId: string | null
  /** Null kur njoftimi s'ka set (p.sh. "Pushimi mbaroi"): hapet thjesht seanca. */
  slotId: string | null
  setNumber: number
  segment: boolean
  reps: number | null
  seconds: number | null
}

/** Seti që hapet te seanca nga njoftimi (`location.state`), me përsëritjet ose sekondat e zgjedhura me −/+. */
export interface OpenedSet {
  slotId: string
  setNumber: number
  values: { reps?: number; seconds?: number }
}

/** Gjendja e navigimit te `/seanca` për "Ndrysho"; segmenti hapet vetë te seanca, pa zgjedhje. */
export function openState(request: OpenRequest): { notificationSet: OpenedSet } | undefined {
  if (request.segment || request.slotId === null) return undefined
  const values: OpenedSet['values'] = {}
  if (request.reps !== null) values.reps = request.reps
  if (request.seconds !== null) values.seconds = request.seconds
  return { notificationSet: { slotId: request.slotId, setNumber: request.setNumber, values } }
}

export function openedSet(state: unknown): OpenedSet | null {
  const value = (state as { notificationSet?: Partial<OpenedSet> } | null | undefined)?.notificationSet
  if (!value || typeof value.slotId !== 'string' || typeof value.setNumber !== 'number') return null
  return { slotId: value.slotId, setNumber: value.setNumber, values: value.values ?? {} }
}

// Çfarë tregon ekrani i seancës (ushtrimi i zgjedhur, segmenti i kapërcyer), për njoftimin. Ekrani e
// shkruan, njoftimi e lexon; pa ekran të hapur njoftimi ndjek radhën e programit.
let currentView: SessionView | null = null
const viewListeners = new Set<() => void>()

export const sessionView = {
  get: () => currentView,
  set(view: SessionView | null) {
    if (JSON.stringify(view) === JSON.stringify(currentView)) return
    currentView = view
    viewListeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void) {
    viewListeners.add(listener)
    return () => void viewListeners.delete(listener)
  },
}

type SessionSnapshot = Pick<TrainingSnapshot, 'plan' | 'exercises'> & { session: NonNullable<TrainingSnapshot['session']> }

const MAX_STEPS = 40

/**
 * Setet që vijnë në seancë, si të ruhen një nga një me vlerat e propozuara (`program/next-set.ts`,
 * si ekrani i seancës): pesha e setit të parë është pesha e javës (`workoutWeights`), setet e tjera
 * mbajnë vlerat e setit të mëparshëm, seti i fundit me rest-pause ose drop set ka segmentin e vet.
 * Ndalet te një set që kërkon peshën te app-i.
 */
export function notificationSteps(input: {
  snapshot: SessionSnapshot
  history: Pick<TrainingHistory, 'sets' | 'weightSteps'>
  weights: ReadonlyMap<string, { weightKg: number | null }>
  view?: SessionView | null
}): { steps: NotificationStep[]; complete: boolean } {
  const { snapshot, history, weights } = input
  const { plan, exercises, session } = snapshot
  const view = input.view?.sessionId === session.id ? input.view : null
  const sets: LoggedSet[] = session.sets.map((set) => ({ ...set, segments: [...set.segments] }))
  const keyOf = (slotId: string | null, setNumber: number, segment = false) => `${session.id}:${slotId}:${setNumber}${segment ? ':segment' : ''}`
  const chained = new Map<string, string>()
  const steps: NotificationStep[] = []
  let complete = false

  for (let index = 0; steps.length < MAX_STEPS; index++) {
    const first = index === 0
    const selected = first ? (view?.selected ?? null) : null
    const due = selected ? null : pendingSegment(plan, sets)
    if (due && !(first && view?.dismissedSegment === due.set.id)) {
      const { set, slot } = due
      const exercise = exercises[slot.exerciseId]
      const tracking = exercise?.tracking ?? 'weight_reps'
      const dropTo =
        set.technique === 'drop_set' && exercise
          ? dropWeight(
              history.sets,
              { exerciseId: slot.exerciseId, run: plan.run, blockPosition: plan.blockPosition },
              set.weightKg ?? 0,
              slot.technique.type === 'drop_set' ? slot.technique : {},
              weightStep(exercise.equipment, history.weightSteps),
            )
          : null
      const values = segmentDefaults(set, dropTo)
      const weightKg = tracking === 'weight_reps' ? values.weightKg : null
      const progress = sessionProgress(plan, sets)
      steps.push({
        key: keyOf(slot.slotId, set.setNumber, true),
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        position: slot.position,
        setNumber: set.setNumber,
        sets: slot.sets,
        segment: set.technique as 'rest_pause' | 'drop_set',
        technique: set.technique,
        tracking,
        weightKg,
        reps: values.reps,
        seconds: null,
        rir: null,
        restAfter: progress.totalSets - progress.doneSets > 0 ? slot.restSeconds : 0,
        inherit: chained.has(slot.slotId) ? { key: keyOf(slot.slotId, set.setNumber), divisor: 3 } : null,
        needsWeight: false,
      })
      set.segments = [{ weightKg, reps: values.reps ?? 0 }]
      continue
    }

    const progress = sessionProgress(plan, sets, selected)
    if (progress.current === null) {
      complete = true
      break
    }
    const { slot, done } = progress.slots[progress.current]
    const setNumber = done + 1
    const tracking = exercises[slot.exerciseId]?.tracking ?? 'weight_reps'
    const values = setDefaults(slot, sets.filter((set) => set.slotId === slot.slotId).at(-1), weights.get(slot.slotId)?.weightKg ?? null)
    const technique: Technique = setNumber === slot.sets ? slot.technique : { type: 'none' }
    const timed = tracking === 'timed'
    const key = keyOf(slot.slotId, setNumber)
    const step: NotificationStep = {
      key,
      slotId: slot.slotId,
      exerciseId: slot.exerciseId,
      position: slot.position,
      setNumber,
      sets: slot.sets,
      segment: null,
      technique: technique.type,
      tracking,
      weightKg: timed ? null : values.weightKg,
      reps: timed ? null : values.reps,
      seconds: timed ? values.seconds : null,
      rir: values.rir,
      restAfter: restAfter(slot, technique, progress.totalSets - progress.doneSets - 1),
      inherit: chained.has(slot.slotId) ? { key: chained.get(slot.slotId)!, divisor: 1 } : null,
      needsWeight: tracking === 'weight_reps' && !values.weightKg,
    }
    steps.push(step)
    if (step.needsWeight) break
    chained.set(slot.slotId, key)
    sets.push({ id: key, slotId: slot.slotId, setNumber, weightKg: step.weightKg, reps: step.reps, seconds: step.seconds, rir: step.rir, technique: technique.type, segments: [] })
  }
  return { steps, complete }
}

/** Pushimi pas setit, si te seanca: rest-pause 15 s (ose i recetës), drop set pa pushim, përndryshe pushimi i slotit kur mbeten sete. */
function restAfter(slot: PlannedSlot, technique: Technique, remainingSets: number): number {
  if (technique.type === 'rest_pause') return technique.restSeconds ?? 15
  if (technique.type === 'drop_set') return 0
  return remainingSets > 0 ? slot.restSeconds : 0
}

type Texts = Pick<I18n, 't' | 'fmt'>

/** Synimi i setit: "Synimi 9–11", "Synimi 60 s"; për segmentin "Deri në dështim"; pa peshë, si të zgjidhet ajo. */
function targetLine(step: NotificationStep, slot: PlannedSlot | undefined, { t, fmt }: Texts): string | null {
  if (step.segment) return t('notify.toFailure')
  if (!slot) return null
  const { target } = slot
  const range = rangeText(target, fmt)
  if (step.needsWeight) return range ? t('session.choose', { range }) : null
  if (target.kind === 'timed') return t('notify.target', { range: fmt.unit(target.seconds, 's') })
  if (target.kind === 'reps' && target.min === 0 && target.max === null) return null
  return range ? t('notify.target', { range }) : null
}

export function notificationTexts({ t }: Texts): NotificationTexts {
  return {
    channel: t('notify.channel'),
    channelText: t('notify.channelText'),
    session: t('notify.session'),
    rest: t('session.rest.label'),
    restEnds: t('notify.restEnds', { time: '%s' }),
    save: t('session.save'),
    saveSegment: t('session.saveSegment'),
    saveShort: t('notify.saveShort'),
    edit: t('notify.edit'),
    skipRest: t('notify.skipRest'),
    openApp: t('notify.openApp'),
    repsLower: t('notify.repsLower'),
    repsRaise: t('notify.repsRaise'),
    secondsLower: t('notify.secondsLower'),
    secondsRaise: t('notify.secondsRaise'),
    repsOne: t('notify.reps', { count: 1 }),
    repsOther: t('notify.reps', { count: 2 }),
    secondsOne: t('notify.seconds', { count: 1 }),
    secondsOther: t('notify.seconds', { count: 2 }),
    allDone: t('session.allDone'),
    allDoneText: t('session.allDoneText'),
    restDoneTitle: t('session.notify.title'),
    restDoneBody: t('session.notify.body'),
    restChannel: t('settings.restTimer'),
    restChannelText: t('session.notify.channelText'),
  }
}

/** Gjendja e njoftimit: setet që vijnë me tekstet e tyre, në gjuhën e app-it. */
export function notificationState(
  snapshot: SessionSnapshot,
  { steps, complete }: { steps: NotificationStep[]; complete: boolean },
  texts: Texts,
): NotificationState {
  const { t, fmt } = texts
  return {
    sessionId: snapshot.session.id,
    startedAt: Date.parse(snapshot.session.startedAt),
    complete,
    texts: notificationTexts(texts),
    steps: steps.map(({ sets, needsWeight, ...step }) => {
      const exercise = snapshot.exercises[step.exerciseId]?.name ?? ''
      const slot = snapshot.plan.slots.find((candidate) => candidate.slotId === step.slotId)
      const title = step.segment
        ? t(step.segment === 'drop_set' ? 'notify.segment.dropSet' : 'notify.segment.restPause', { exercise, set: step.setNumber })
        : t('notify.title', { exercise, set: step.setNumber, sets })
      return {
        ...step,
        title,
        weight: step.weightKg ? fmt.number(step.weightKg) : null,
        target: targetLine({ ...step, sets, needsWeight }, slot, texts),
        canSave: !needsWeight,
      }
    }),
  }
}

export type ApplyResult = 'applied' | 'duplicate' | 'closed' | 'stale'

const numberOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value))

/**
 * Zbaton një prekje të njoftimit te baza lokale, një herë: një set që ekziston (nga një prekje e
 * dytë, ose i ruajtur te app-i ndërkohë) nuk ndryshohet; një seancë e mbyllur nuk merr sete.
 */
export async function applyNotificationAction(store: LocalStore, action: NotificationAction): Promise<ApplyResult> {
  const session = await store.get('workout_sessions', action.sessionId)
  if (!session || session.status !== 'in_progress') return 'closed'
  if (action.type === 'skip_rest') return 'applied'
  const existing = (await store.where('set_logs', 'session_id', action.sessionId)).find(
    (row) => row.slot_id === action.slotId && Number(row.set_number) === action.setNumber,
  )
  if (action.segment) {
    // Segmenti i shtohet setit të vet; pa të (p.sh. seti u fshi) nuk ka ku të shkojë.
    if (!existing) return 'stale'
    if (((existing.segments as unknown[] | null | undefined) ?? []).length > 0) return 'duplicate'
    await saveSet(store, {
      id: existing.id,
      sessionId: action.sessionId,
      slot: { slotId: action.slotId, exerciseId: String(existing.exercise_id), position: Number(existing.position) },
      setNumber: action.setNumber,
      weightKg: numberOrNull(existing.weight_kg),
      reps: numberOrNull(existing.reps),
      seconds: numberOrNull(existing.seconds),
      rir: numberOrNull(existing.rir),
      rpe: numberOrNull(existing.rpe),
      technique: existing.technique as Technique['type'],
      notes: (existing.notes as string | null | undefined) ?? null,
      segments: [{ weightKg: action.weightKg, reps: action.reps ?? 0 }],
    })
    return 'applied'
  }
  if (existing) return 'duplicate'
  await saveSet(store, {
    sessionId: action.sessionId,
    slot: { slotId: action.slotId, exerciseId: action.exerciseId, position: action.position },
    setNumber: action.setNumber,
    weightKg: action.weightKg,
    reps: action.reps,
    seconds: action.seconds,
    rir: action.rir,
    technique: action.technique,
    loggedAt: new Date(action.at).toISOString(),
  })
  return 'applied'
}

export interface SessionNotifier {
  /** Njoftimi sipas bazës: i treguar gjatë një seance të hapur, i hequr pa të. */
  sync(): Promise<void>
  /** Zbaton veprimet në radhë, rifreskon njoftimin dhe i heq nga radha. */
  drain(): Promise<void>
  setView(view: SessionView | null): void
  /** Dëgjon prekjet dhe zbraz radhën që në nisje; kthen funksionin që e ndal. */
  start(): () => void
}

export function createSessionNotifier(deps: {
  store: LocalStore
  port: SessionNotificationPort
  rest: (sessionId: string) => RestControl
  i18n: () => Texts
  now?: () => number
}): SessionNotifier {
  const { store, port } = deps
  const now = deps.now ?? (() => Date.now())
  let view: SessionView | null = null
  // Gjendja e fundit e dërguar (JSON; "null" = i hequr), që i njëjti njoftim të mos dërgohet dy herë.
  let shown: string | undefined
  let queue: Promise<unknown> = Promise.resolve()

  /** Një punë në një kohë: leximet dhe shkrimet e njoftimit nuk ndërthuren. */
  function serial(task: () => Promise<void>): Promise<void> {
    const run = queue.then(task)
    queue = run.catch(() => undefined)
    return run
  }

  async function compute(): Promise<NotificationState | null> {
    const snapshot = await trainingSnapshot(store)
    if (!snapshot?.session) return null
    const [history, weights] = await Promise.all([trainingHistory(store), workoutWeights(store, snapshot.plan)])
    const session = { ...snapshot, session: snapshot.session }
    return notificationState(session, notificationSteps({ snapshot: session, history, weights, view }), deps.i18n())
  }

  async function syncNow() {
    const state = await compute()
    const json = JSON.stringify(state)
    if (json === shown) return
    if (state) await port.show(state)
    else await port.hide()
    shown = json
  }

  async function drainNow() {
    const actions = await port.pending()
    if (actions.length === 0) return
    const handled: string[] = []
    const seen = new Set<string>()
    for (const action of actions) {
      if (!seen.has(action.id)) {
        let result: ApplyResult
        try {
          result = await applyNotificationAction(store, action)
        } catch {
          // Baza nuk u shkrua: veprimi dhe ata pas tij mbeten në radhë, me radhë, për herën tjetër.
          break
        }
        seen.add(action.id)
        if (result === 'applied') {
          if (action.type === 'skip_rest') deps.rest(action.sessionId).skip()
          else if (action.restEndsAt && action.restEndsAt > now()) {
            deps.rest(action.sessionId).adopt(action.restEndsAt, action.restSeconds ?? Math.ceil((action.restEndsAt - action.at) / 1000))
          }
        }
      }
      handled.push(action.id)
    }
    // Njoftimi i ri para heqjes nga radha: native-i kapërcen setet që janë ende në radhë, ndaj
    // seti i sapo ruajtur nuk rishfaqet për një çast.
    await syncNow()
    if (handled.length) await port.ack(handled)
  }

  return {
    sync: () => serial(syncNow),
    drain: () => serial(drainNow),
    setView(next) {
      view = next
    },
    start() {
      const stop = port.onAction(() => void serial(drainNow).catch(() => undefined))
      void serial(drainNow)
        .then(() => serial(syncNow))
        .catch(() => undefined)
      return stop
    },
  }
}
