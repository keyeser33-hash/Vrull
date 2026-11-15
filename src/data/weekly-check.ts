import { localDate } from '@/lib/calendar'
import { type Goal, withAdjustment } from '@/nutrition/calculator'
import { type WeeklyCheck, weeklyCheck, trendWeight } from '@/nutrition/weekly-check'
import { dayTargets, targetsWeight } from './nutrition'
import { readProfile } from './profile'
import type { LocalStore } from './store'
import { adjustmentOn, isComplete, personalTargets, readTargetsProfile, refreshSavedTargets } from './targets-profile'
import { naturalId } from './natural-id'

// Kontrolli javor (V33, V2-E2-04): çdo të hënë, nga java e 2-të e objektivave personale, java e
// kaluar rishikohet (`nutrition/weekly-check.ts`). Vendimi ("Po" ose "Jo tani") ruhet te
// `weekly_checks` dhe e heq kartën deri të hënën tjetër; korrigjimi i pranuar vlen nga dita e
// pranimit, për ditët e stërvitjes dhe të pushimit njësoj.

export type WeeklyCheckStatus = 'accepted' | 'dismissed'

export interface WeeklyCheckView {
  /** E hëna e javës së rishikuar. */
  weekStart: string
  /** Numri i javës së rishikuar nga java e parë e objektivave personale. */
  week: number
  goal: Goal
  result: WeeklyCheck
  decided: { status: WeeklyCheckStatus; kcal: number } | null
  /** Objektivat e ditës së stërvitjes dhe të pushimit me propozimin; null pa propozim. */
  training: number | null
  rest: number | null
  /** Pesha trend e 14 ditëve (java para dhe java e rishikuar), vetëm ditët me vlerë. */
  trend: { day: number; kg: number }[]
  /** Pesha që synonte plani në fund të javës; null pa propozim. */
  goalKg: number | null
}


const parse = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const addDays = (date: string, days: number) => {
  const next = parse(date)
  next.setDate(next.getDate() + days)
  return localDate(next)
}
const mondayOf = (date: string) => addDays(date, -((parse(date).getDay() + 6) % 7))
const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)

/** E hëna e parë me kontroll: pas javës së dytë të objektivave personale. */
export const firstWeeklyCheckDate = (from: string) => addDays(mondayOf(from), 14)
/** E hëna e kontrollit të radhës pas një jave të rishikuar. */
export const nextWeeklyCheckDate = (weekStart: string) => addDays(weekStart, 14)

export async function readWeeklyCheck(store: LocalStore, today: string): Promise<WeeklyCheckView | null> {
  const [profile, targets] = await Promise.all([readProfile(store), readTargetsProfile(store)])
  // Me "Plani i Jimit" (V62) objektivat nuk korrigjohen.
  if (targets.choice === 'jim' || targets.from === null || !isComplete(targets)) return null
  const weekStart = addDays(mondayOf(today), -7)
  const week = Math.floor(daysBetween(mondayOf(targets.from), weekStart) / 7) + 1
  if (week < 2) return null

  const rows = (await store.where('weekly_checks', 'week_start', weekStart)).sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
  const decided = rows[0] ? { status: rows[0].status as WeeklyCheckStatus, kcal: Number(rows[0].kcal) } : null

  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const [entries, measurements, dayGoals, weightKg] = await Promise.all([
    Promise.all(dates.map((date) => store.where('diary_entries', 'date', date))),
    store.all('body_measurements'),
    Promise.all(dates.map((date) => dayTargets(store, date))),
    targetsWeight(store, today),
  ])
  const personal = weightKg === null ? null : personalTargets(targets, { weightKg, sessionsPerWeek: profile.trainingDays.length, date: today })
  if (!personal || weightKg === null) return null
  const adjustment = adjustmentOn(targets.adjustments, today)
  const training = withAdjustment(personal.training, adjustment)
  const rest = withAdjustment(personal.rest, adjustment)
  const sessions = profile.trainingDays.length
  const sign = targets.goal === 'gain' ? 1 : targets.goal === 'lose' ? -1 : 0

  const weights = measurements.filter((row) => row.weight_kg !== null && row.weight_kg !== undefined).map((row) => ({ date: String(row.date).slice(0, 10), kg: Number(row.weight_kg) }))
  const result = weeklyCheck({
    weekStart,
    goal: targets.goal,
    weights,
    days: dates.map((date, index) => ({ date, kcal: entries[index].reduce((sum, row) => sum + Number(row.kcal ?? 0), 0), targetKcal: dayGoals[index]?.kcal ?? null })),
    averageTargetKcal: (training.kcal * sessions + rest.kcal * (7 - sessions)) / 7,
    plannedAdjustmentKcal: personal.adjustmentKcal,
    plannedChangeKg: (sign * personal.ratePctPerWeek * weightKg) / 100,
  })
  const proposal = result.kind === 'proposal' ? result.kcal : null
  return {
    weekStart,
    week,
    goal: targets.goal,
    result,
    decided,
    training: proposal === null ? null : withAdjustment(training, proposal).kcal,
    rest: proposal === null ? null : withAdjustment(rest, proposal).kcal,
    trend: Array.from({ length: 14 }, (_, day) => ({ day, kg: trendWeight(weights, addDays(weekStart, day - 7)) })).filter((point): point is { day: number; kg: number } => point.kg !== null),
    goalKg: result.kind === 'proposal' ? Math.round((result.previousTrendKg + result.plannedChangeKg) * 100) / 100 : null,
  }
}

/** Ruan vendimin; "Po" rillogarit objektivat e ruajtura nga sot. */
export async function decideWeeklyCheck(store: LocalStore, view: WeeklyCheckView, status: WeeklyCheckStatus, today: string) {
  if (view.result.kind !== 'proposal') return
  const { result } = view
  // Një rresht për javë, edhe kur dy telefona vendosin pa u sinkronizuar.
  const existing = (await store.where('weekly_checks', 'week_start', view.weekStart))[0]
  const userId = store.userId()
  const id = existing?.id ?? (userId ? await naturalId(['weekly_checks', userId, view.weekStart]) : undefined)
  // Vlerat e javës ruhen vetëm brenda kufijve të serverit (migrimi weekly_checks): një peshim me ujë
  // ose një gabim shtypi nuk e bën rreshtin të refuzuar përgjithmonë; vendimi dhe korrigjimi mbeten.
  const within = (value: number, min: number, max: number) => (Number.isFinite(value) && value >= min && value <= max ? value : null)
  await store.put(
    'weekly_checks',
    {
      id,
      week_start: view.weekStart,
      status,
      kcal: result.kcal,
      applies_from: today,
      maintenance_kcal: within(result.maintenanceKcal, 500, 8000),
      trend_change_kg: within(result.changeKg, -10, 10),
      logged_days: result.loggedDays,
      average_kcal: within(result.averageKcal, 0, 15000),
    },
    { revive: true },
  )
  if (status === 'accepted' && result.kcal !== 0) await refreshSavedTargets(store, await readTargetsProfile(store), today)
}

/** Korrigjimet e pranuara për historinë te Objektivat, të fundit i pari. */
export async function weeklyCheckHistory(store: LocalStore): Promise<{ weekStart: string; week: number; from: string; kcal: number }[]> {
  const targets = await readTargetsProfile(store)
  if (targets.from === null) return []
  const start = mondayOf(targets.from)
  return [...targets.adjustments].reverse().map((adjustment) => ({ ...adjustment, week: Math.floor(daysBetween(start, adjustment.weekStart) / 7) + 1 }))
}
