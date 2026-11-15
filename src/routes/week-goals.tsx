import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { targetsWeight } from '@/data/nutrition'
import { trainingSnapshot } from '@/data/training'
import { type IntakeDayView, type IntakeGoal, type WeekGoalsView, type WeekTrainingDay, weekGoalsView } from '@/data/weekly-goals'
import type { I18n } from '@/i18n'
import { programBlockName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { GOAL_DAYS } from '@/progress/weekly-goals'
import { waterTargetMl } from '@/nutrition/water'
import { atNoon, capitalize, type GoalCell, goalCells, weekHeading, weekRangeText } from './week-format'
import { BackLink, GoalValue } from './week-parts'

// Qëllimet e javës (V43, SPEC §0.3c, bordi "Qëllimet"; /sot/java): për çdo qëllim, shtatë ditët e javës
// me gjendjen e tyre, rregulli me fjalë, dita rezervë e bllokut dhe vargu. Rregullat jetojnë te
// `progress/weekly-goals.ts`; këtu vetëm lexohen (`weekGoalsView`).

async function goalsPage() {
  const [goals, snapshot] = await Promise.all([weekGoalsView(store), trainingSnapshot(store)])
  const weightKg = await targetsWeight(store, goals.foodToday)
  return { goals, plan: snapshot && !snapshot.completed ? snapshot.plan : null, weightKg }
}

const GRID = 'grid grid-cols-[92px_repeat(7,minmax(0,1fr))] items-center gap-1'

export function WeekGoalsPage() {
  const i18n = useI18n()
  const { t } = i18n
  const page = useLocalQuery(goalsPage, [])
  const back = <BackLink text={t('tab.today')} label={t('week.goals.back')} fallback="/" />
  if (!page) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <h1 className="type-display-m">{t('week.goals.title')}</h1>
        <div aria-hidden className="h-80 rounded-lg bg-surface" />
      </div>
    )
  }
  const { goals, plan, weightKg } = page
  const cells = goalCells(i18n, goals)
  const caption = [weekHeading(i18n, goals.monday, goals.today), plan?.blockName ? programBlockName(t, plan.blockName) : null]
    .filter(Boolean)
    .join(' · ')
  const todayIndex = goals.training.days.findIndex((day) => day.today)
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <div className="flex flex-col">
        {back}
        <div className="flex flex-col gap-1">
          <h1 className="type-display-m">{t('week.goals.title')}</h1>
          <span className="type-caption text-muted-foreground tabular-nums">{caption}</span>
        </div>
      </div>
      <div aria-hidden className={cn(GRID, 'text-xs text-muted-foreground')}>
        <span />
        {goals.training.days.map((day, index) => (
          <span key={day.date} className={cn('text-center', index === todayIndex && 'font-bold text-foreground')}>
            {t(`today.weekLetter.${day.weekday}` as 'today.weekLetter.1')}
          </span>
        ))}
      </div>
      <GoalSection id="goal-training" cell={cells[0]}>
        <DayRow label={trainingSpoken(i18n, goals.training.days)} rule={t('week.goals.trainingRule', { count: goals.training.target })}>
          {goals.training.days.map((day) => (
            <TrainingCell key={day.date} day={day} />
          ))}
        </DayRow>
      </GoalSection>
      <IntakeSection id="goal-food" cell={cells[1]} goal={goals.food} kind="food" note={t('week.goals.foodNote')} />
      <IntakeSection
        id="goal-water"
        cell={cells[2]}
        goal={goals.water}
        kind="water"
        note={
          weightKg === null
            ? t('week.goals.waterNotePlain')
            : t('week.goals.waterNote', { training: litres(i18n, waterTargetMl(weightKg, 'training')), rest: litres(i18n, waterTargetMl(weightKg, 'rest')) })
        }
      />
      {goals.food === null && goals.water === null ? <p className="type-caption text-muted-foreground">{t('week.goals.noTargets')}</p> : null}
      <SpareSection goals={goals} />
      <aside aria-labelledby="goal-streak" className="flex items-start gap-3.5">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-2 font-display text-2xl font-extrabold tabular-nums">
          {goals.streak}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="goal-streak" className="type-body-strong">
            {t('week.streak.title', { count: goals.streak })}
          </h2>
          <p className="type-caption text-muted-foreground">{t('week.streak.text')}</p>
        </div>
      </aside>
    </div>
  )
}

const litres = ({ fmt }: Pick<I18n, 'fmt'>, ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })
const dayName = ({ fmt }: Pick<I18n, 'fmt'>, date: string) => fmt.weekday(atNoon(date))

function GoalSection({ id, cell, children }: { id: string; cell: GoalCell; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 border-t border-border pt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="type-title">
          {cell.label}
        </h2>
        <GoalValue cell={cell} />
      </div>
      {children}
    </section>
  )
}

/** Rreshti i ditëve: rregulli majtas, shtatë rrathët djathtas; lexuesi i ekranit dëgjon një fjali. */
function DayRow({ label, rule, children }: { label: string; rule: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className={GRID}>
      <span className="pr-1 text-[13px] leading-[1.3] text-muted-foreground">{rule}</span>
      {children}
    </div>
  )
}

const circle = 'mx-auto box-border flex size-8 items-center justify-center overflow-hidden rounded-pill'

function TrainingCell({ day }: { day: WeekTrainingDay }) {
  switch (day.state) {
    case 'done':
      return (
        <span className={cn(circle, 'bg-ember text-on-ember')}>
          <Icon name="zgjedhur" size={16} />
        </span>
      )
    case 'spare':
      return (
        <span className={cn(circle, 'border border-dashed border-ember-text text-ember-text')}>
          <Icon name="kalendari" size={14} />
        </span>
      )
    case 'skipped':
      return <span className={cn(circle, 'border border-subtle text-sm text-muted-foreground')}>×</span>
    case 'missed':
      return <span className={cn(circle, 'border-2 border-dashed border-muted-foreground')} />
    case 'planned':
      return <span className={cn(circle, day.today ? 'border-2 border-ember-text' : 'border border-subtle')} />
    case 'rest':
      return <span className={cn(circle, day.today ? 'border-2 border-ember-text' : '', 'text-sm text-subtle')}>–</span>
  }
}

function trainingSpoken(i18n: I18n, days: WeekTrainingDay[]): string {
  const { t } = i18n
  const parts = days.map((day) => {
    const name = dayName(i18n, day.date)
    if (day.state === 'done') return t('week.day.done', { day: name })
    if (day.state === 'spare') return t('week.day.spare', { day: name })
    if (day.state === 'skipped') return t('week.day.skipped', { day: name })
    if (day.state === 'missed') return t('week.day.missed', { day: name })
    if (day.state === 'planned') return t(day.today ? 'week.day.today' : 'week.day.planned', { day: name })
    return t('week.day.rest', { day: name })
  })
  return capitalize(parts.join(', '))
}

function IntakeSection({ id, cell, goal, kind, note }: { id: string; cell: GoalCell; goal: IntakeGoal | null; kind: 'food' | 'water'; note: string }) {
  const i18n = useI18n()
  const { t } = i18n
  if (!goal) return null
  const today = goal.days.find((day) => day.state === 'partial')
  return (
    <GoalSection id={id} cell={cell}>
      <DayRow label={intakeSpoken(i18n, goal.days)} rule={t('week.goals.daysRule', { goal: GOAL_DAYS })}>
        {goal.days.map((day) => (
          <IntakeCell key={day.date} day={day} kind={kind} />
        ))}
      </DayRow>
      <p className="text-[13px] leading-[1.4] text-muted-foreground">
        {note}
        {today?.percent !== null && today?.percent !== undefined ? ` ${t('week.goals.todayPercent', { percent: today.percent })}` : ''}
      </p>
    </GoalSection>
  )
}

function IntakeCell({ day, kind }: { day: IntakeDayView; kind: 'food' | 'water' }) {
  const i18n = useI18n()
  switch (day.state) {
    case 'counted':
      return (
        <span className={cn(circle, 'bg-ember text-on-ember')}>
          <Icon name="zgjedhur" size={16} />
        </span>
      )
    case 'partial':
      return (
        <span className={cn(circle, 'relative items-end border-2 border-ember-text')}>
          <span className="w-full origin-bottom bg-ember/40" style={{ height: `${Math.min(day.percent ?? 0, 100)}%` }} />
        </span>
      )
    case 'missed':
      return (
        <span className={cn(circle, 'border border-subtle text-[11px] text-muted-foreground tabular-nums')}>
          {kind === 'water' ? litres(i18n, day.amount) : `${day.percent ?? 0}%`}
        </span>
      )
    case 'upcoming':
      return <span className={cn(circle, 'border border-subtle')} />
    case 'none':
      return <span className={cn(circle, 'text-sm text-subtle')}>–</span>
  }
}

function intakeSpoken(i18n: I18n, days: IntakeDayView[]): string {
  const { t } = i18n
  const parts = days.map((day) => {
    const name = dayName(i18n, day.date)
    if (day.state === 'counted') return t('week.day.counted', { day: name })
    if (day.state === 'missed') return t('week.day.under', { day: name, percent: day.percent ?? 0 })
    if (day.state === 'partial') return t('week.day.partial', { day: name, percent: day.percent ?? 0 })
    if (day.state === 'upcoming') return t('week.day.upcoming', { day: name })
    return t('week.day.noTarget', { day: name })
  })
  return capitalize(parts.join(', '))
}

/** Dita rezervë e bllokut të javës (bordi "Qëllimet"): e lirë, ose kur u përdor. */
function SpareSection({ goals }: { goals: WeekGoalsView }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const spare = goals.spare
  if (!spare) return null
  const block = programBlockName(t, spare.blockName)
  const target = goals.training.target
  let text: string
  if (spare.used) {
    const date = spare.used.date
    text = [
      date ? t(`week.spare.for.${atNoon(date).getDay() || 7}` as 'week.spare.for.1', { date: fmt.date(atNoon(date), { weekday: false }) }) : null,
      t('week.spare.usedIn', { range: weekRangeText(i18n, spare.used.monday) }),
    ]
      .filter(Boolean)
      .join(' ')
  } else {
    text = [
      spare.wouldCover ? t('week.spare.wouldCover') : t('week.spare.free', { almost: Math.max(target - 1, 0), target }),
      spare.endsOn ? t('week.spare.ends', { block, date: fmt.date(atNoon(spare.endsOn), { weekday: false }) }) : null,
    ]
      .filter(Boolean)
      .join(' ')
  }
  return (
    <aside aria-labelledby="goal-spare" className="flex items-start gap-3.5 border-t border-border pt-3.5">
      <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-md border border-dashed', spare.used ? 'border-ember-text text-ember-text' : 'border-muted-foreground text-foreground')}>
        <Icon name="kalendari" size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="goal-spare" className="type-body-strong">
          {t(spare.used ? 'week.spare.titleUsed' : 'week.spare.titleFree')}
        </h2>
        <p className="type-caption text-muted-foreground tabular-nums">{text}</p>
      </div>
    </aside>
  )
}
