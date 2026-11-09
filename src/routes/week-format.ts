import type { IntakeGoal, TrainingGoal, WeekSummary } from '@/data/weekly-goals'
import type { I18n } from '@/i18n'
import { programWeekLabel } from '@/i18n/domain'
import { shiftDate } from '@/lib/calendar'

// Tekstet e javës (V43, SPEC §0.3c): data e javës, vlerat e qëllimeve dhe titulli i përmbledhjes, të
// njëjta te Sot, te Qëllimet e javës, te përmbledhja dhe te karta për ndarje.

export const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** "16–22 nëntor" / "16–22 November"; kur ndërron muaji "30 nëntor – 6 dhjetor"; `year` shton vitin. */
export function weekRangeText({ fmt }: Pick<I18n, 'fmt'>, monday: string, { year = false }: { year?: boolean } = {}): string {
  const sunday = shiftDate(monday, 6)
  const end = fmt.date(atNoon(sunday), { weekday: false, year })
  if (monday.slice(0, 7) === sunday.slice(0, 7)) return `${Number(monday.slice(8, 10))}–${end}`
  const start = fmt.date(atNoon(monday), { weekday: false, year: year && monday.slice(0, 4) !== sunday.slice(0, 4) })
  return `${start} – ${end}`
}

/** Shkronja e parë e madhe, si në fillim të fjalisë ("e hënë" → "E hënë"). */
export const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** Një qëllim si matës: vlera e madhe, njësia e vogël pas saj dhe segmentet e shiritit. */
export interface GoalCell {
  key: 'training' | 'food' | 'water'
  label: string
  /** "2", "3+1", "–". */
  value: string
  /** Vlera e shkurtër e kartës së së dielës: "4/4", "6/7", "3+1". */
  short: string
  /** "nga 4", "nga 5 ditë", "rezervë". */
  unit: string
  /** Segmentet e shiritit dhe sa janë mbushur; `spare`: segmenti i fundit është dita rezervë. */
  segments: number
  filled: number
  spare: boolean
  met: boolean
  /** Si e lexon lexuesi i ekranit: "2 nga 4", "6 nga 7 ditë". */
  spoken: string
}

function intakeCell({ t }: Pick<I18n, 't'>, key: 'food' | 'water', goal: IntakeGoal | null): GoalCell {
  const label = t(key === 'food' ? 'week.goal.food' : 'week.goal.water')
  if (!goal) return { key, label, value: '–', short: '–', unit: t('week.goal.none'), segments: 5, filled: 0, spare: false, met: false, spoken: t('week.goal.none') }
  // Kur arrihet, numri thotë sa ditë nga 7; deri atëherë sa nga 5 (bordet "Java" dhe "Java · Rezerva").
  const target = goal.met ? 7 : goal.goal
  return {
    key,
    label,
    value: String(goal.counted),
    short: `${goal.counted}/${target}`,
    unit: t('week.goal.ofDays', { target }),
    segments: goal.goal,
    filled: Math.min(goal.counted, goal.goal),
    spare: false,
    met: goal.met,
    spoken: t('week.goal.spokenDays', { count: goal.counted, target }),
  }
}

/** Tre matësit e javës: stërvitja (me ditën rezervë kur u përdor), ushqimi dhe uji. */
export function goalCells(i18n: Pick<I18n, 't'>, goals: { training: TrainingGoal; food: IntakeGoal | null; water: IntakeGoal | null }, spareUsed = false): GoalCell[] {
  const { t } = i18n
  const { done, target, met } = goals.training
  const spare = spareUsed && met === true && done < target
  const training: GoalCell =
    target === 0
      ? { key: 'training', label: t('week.goal.training'), value: String(done), short: String(done), unit: t('week.goal.noTraining'), segments: 0, filled: 0, spare: false, met: false, spoken: t('week.goal.noTraining') }
      : {
          key: 'training',
          label: t('week.goal.training'),
          value: spare ? `${done}+1` : String(done),
          short: spare ? `${done}+1` : `${done}/${target}`,
          unit: spare ? t('week.goal.spare') : t('week.goal.of', { target }),
          segments: target,
          filled: Math.min(done, target),
          spare,
          met: met === true,
          spoken: spare ? t('week.goal.spokenSpare', { done }) : t('week.goal.spokenOf', { done, target }),
        }
  return [training, intakeCell(i18n, 'food', goals.food), intakeCell(i18n, 'water', goals.water)]
}

/** "Qëllimet e javës: stërvitja 2 nga 4, ushqimi 3 nga 5 ditë, uji 2 nga 5 ditë". */
export function goalsSpoken({ t }: Pick<I18n, 't'>, cells: GoalCell[], complete: boolean): string {
  const [training, food, water] = cells
  const goals = t('week.goal.spoken', { training: training.spoken, food: food.spoken, water: water.spoken })
  return complete ? t('week.goal.allMet', { goals }) : goals
}

/** Titulli i përmbledhjes: "Java e plotë", ose pa faj "Java 4 u mbyll". */
export function summaryTitle({ t }: Pick<I18n, 't'>, summary: Pick<WeekSummary, 'goals' | 'programWeek'>): string {
  if (summary.goals.complete) return t('week.summary.complete')
  return summary.programWeek ? t('week.summary.closed', { week: summary.programWeek.week }) : t('week.summary.closedPlain')
}

/** Java e programit dhe data: "Faza 1 · Java 3 · 16–22 nëntor". */
export function summaryCaption(i18n: Pick<I18n, 't' | 'fmt'>, summary: Pick<WeekSummary, 'programWeek' | 'monday'>): string {
  const range = weekRangeText(i18n, summary.monday)
  return summary.programWeek ? `${programWeekLabel(i18n.t, summary.programWeek)} · ${range}` : range
}

/** Qëllimet e arritura nga tre (stërvitja me ditën rezervë numërohet e arritur). */
export const metGoals = (summary: Pick<WeekSummary, 'goals'>) =>
  [summary.goals.training.met === true, !!summary.goals.food?.met, !!summary.goals.water?.met].filter(Boolean).length

/** "4:06": koha e seancave në orë dhe minuta. */
export const hoursText = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`

/** "+2,6" / "−0,4": ndryshimi me shenjë, një shifër pas presjes. */
export function signedText({ fmt }: Pick<I18n, 'fmt'>, value: number): string {
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±'
  return `${sign}${fmt.number(Math.abs(rounded), { minDigits: 1, maxDigits: 1 })}`
}
