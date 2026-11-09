import { store, useLocalQuery } from '@/data/app-data'
import { type DailyChoice, readDailyChoice, type ReadinessChoice } from '@/data/daily-state'
import { decisionDate, workoutKey } from '@/data/lighter-day'
import { type ReadinessView, readinessView, trainedGroups } from '@/data/readiness-view'
import type { LocalStore } from '@/data/store'
import { isTrainingMode, type TodayView, todayView } from '@/data/today'
import type { TrainingSnapshot } from '@/data/training'
import { welcomeBack } from '@/data/welcome-back'
import { type LighterCost, lighterCost, type Reason, readinessReasons, readinessStrengths, type StrengthKey } from '@/readiness/lighter-session'

// Gjendja e sugjerimit për pjesët e tjera të Sot dhe të seancës (V50, V2-E3-06). Një lexim i vetëm
// (`suggestionFor`) thotë çfarë tregohet: kartën e sugjerimit, stërvitjen e shtyrë, ose shiritin e seancës më të
// lehtë; Sot, seanca dhe `WorkoutCard` e lexojnë njëlloj.

/**
 * suggest: karta "Sot më lehtë?"; postponed: "Ditë pushimi sot"; lighter: seanca më e lehtë është zgjedhur sot;
 * null: asgjë.
 */
export type SuggestionKind = 'suggest' | 'postponed' | 'lighter'

export interface Suggestion {
  kind: SuggestionKind | null
  /** Dita e ushqimit (dita e check-in-it dhe e vendimit). */
  date: string
  /** Dy pjesët me pikët më të ulëta; bosh pa check-in. */
  reasons: Reason[]
  cost: LighterCost
  /** Sot ka stërvitje pa asnjë set të ruajtur (karta mund të dalë dhe "Shtyje për nesër" vlen). */
  beforeFirstSet: boolean
}

const NO_COST: LighterCost = { sets: false, effect: null }

/** Sot ka stërvitje të radhës pa asnjë set të ruajtur: Sot e seanca e hapur pa sete. */
function beforeFirstSet(view: TodayView): boolean {
  return isTrainingMode(view) && !!view.workout && view.workout.loggedSets === 0
}

/** Vendimi i ditës kur vlen për stërvitjen e radhës; një vendim për stërvitje tjetër (e mbyllur) nuk vlen. */
function choiceFor(choice: DailyChoice | null, snapshot: TrainingSnapshot | null): ReadinessChoice | null {
  if (!choice) return null
  return choice.workout === null || !snapshot || choice.workout === workoutKey(snapshot.pointer) ? choice.choice : null
}

/**
 * Karta del kur sot ka stërvitje pa set të ruajtur, gatishmëria është e ulët dhe vendimi s'është marrë;
 * stërvitja e shtyrë del deri sa të kthehet; "lighter" kur seanca më e lehtë është zgjedhur dhe stërvitja ekziston.
 */
export function suggestionOf(view: TodayView, ready: ReadinessView, decision: DailyChoice | null): Suggestion {
  const choice = choiceFor(decision, view.snapshot)
  const before = beforeFirstSet(view)
  const plan = view.snapshot && !view.snapshot.completed ? view.snapshot : null
  const cost = plan
    ? lighterCost(plan.plan.slots, Object.fromEntries(Object.entries(plan.exercises).map(([id, exercise]) => [id, exercise.tracking])), { keepWeight: view.welcomeBack?.lighter ?? false })
    : NO_COST
  const base = { date: view.date, cost, beforeFirstSet: before }
  if (view.postponed) return { ...base, kind: 'postponed', reasons: [] }
  if (choice === 'lighter' && isTrainingMode(view)) return { ...base, kind: 'lighter', reasons: [] }
  if (!(before && choice === null && ready.state && ready.readiness?.level === 'low')) return { ...base, kind: null, reasons: [] }
  const focus = view.workout?.focus
  return {
    ...base,
    kind: 'suggest',
    reasons: readinessReasons({
      checkIn: ready.state,
      readiness: ready.readiness,
      recovery: focus && view.workout?.recovery ? { group: focus.group.id, status: view.workout.recovery } : null,
      trainedGroups: trainedGroups(view.workout?.primary ?? []),
    }),
  }
}

export async function suggestionFor(db: LocalStore, view?: TodayView): Promise<Suggestion> {
  const today = view ?? (await todayView(db))
  const date = await decisionDate(db, today.snapshot?.session)
  return suggestionOf(today, await readinessView(db, today.date), await readDailyChoice(db, date))
}

/** Sugjerimi i Sot (me pamjen që ekrani e ka lexuar) ose i seancës (pa pamje: e lexon vetë); undefined derisa të lexohet. */
export function useSuggestion(view?: TodayView): Suggestion | undefined {
  return useLocalQuery(() => suggestionFor(store, view), [view])
}

/** Sugjerimi pret vendimin: "Fillo stërvitjen" nuk është veprimi kryesor i ekranit (një prush për ekran). */
export function useSuggestionPending(view: TodayView): boolean {
  return useSuggestion(view)?.kind === 'suggest'
}

/**
 * Sugjerimi në krye të seancës. Seanca lexon këtë me çdo set të ruajtur, ndaj leximi i rëndë (gatishmëria, me
 * `todayView`) bëhet vetëm para setit të parë dhe kur vendimi s'është marrë; përndryshe mjafton gjendja e ditës.
 */
export async function sessionSuggestionFor(db: LocalStore, snapshot: TrainingSnapshot, started: boolean): Promise<Suggestion> {
  const date = await decisionDate(db, snapshot.session)
  const choice = choiceFor(await readDailyChoice(db, date), snapshot)
  if (choice === null && !started) return suggestionFor(db)
  if (choice !== 'lighter') return { kind: null, date, reasons: [], cost: NO_COST, beforeFirstSet: false }
  const trackings = Object.fromEntries(Object.entries(snapshot.exercises).map(([id, exercise]) => [id, exercise.tracking]))
  const back = await welcomeBack(db)
  return { kind: 'lighter', date, reasons: [], cost: lighterCost(snapshot.plan.slots, trackings, { keepWeight: back?.lighter ?? false }), beforeFirstSet: !started }
}

export function useSessionSuggestion(snapshot: TrainingSnapshot, started: boolean): Suggestion | undefined {
  return useLocalQuery(() => sessionSuggestionFor(store, snapshot, started), [snapshot, started])
}

/** Gatishmëria e lartë (nga 85%) e ditës dhe dy pjesët më të forta, për rreshtin e kartës së stërvitjes; null përndryshe. */
export function useStrengths(date: string): { percent: number; strengths: StrengthKey[] } | null | undefined {
  return useLocalQuery(async () => {
    const ready = await readinessView(store, date)
    if (!ready.state || ready.readiness?.level !== 'high') return null
    return { percent: ready.readiness.percent, strengths: readinessStrengths({ checkIn: ready.state, readiness: ready.readiness }) }
  }, [date])
}

/** Pamja e ditës e sotme (`energetic` vetëm me çelësin "Pamja ndjek gjendjen"), për fjalinë në krye të seancës. */
export function useDayMode(): ReadinessView['mode'] | undefined {
  return useLocalQuery(async () => (await readinessView(store)).mode, [])
}
