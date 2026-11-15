import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { TrendChart } from '@/components/charts/trend-chart'
import { EmptyState } from '@/components/layout/empty-state'
import { Group, LinkRow } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { photos, store, useLocalQuery } from '@/data/app-data'
import { localDate, shiftDate } from '@/lib/calendar'
import { type ComplianceDay, metricHistory, progressStart, progressView, trainingProgress } from '@/data/progress'
import { trainingSnapshot } from '@/data/training'
import type { I18n } from '@/i18n'
import { muscleName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { useStartWorkout } from './start-workout'
import type { StrengthRow, VolumeRow } from '@/progress/strength'
import { METRICS, type Metric, metricByKey, movingAverage } from '@/progress/metrics'
import { cn } from '@/lib/cn'
import { weekSummary } from '@/data/weekly-goals'
import { mondayOf, weekCardMonday } from '@/progress/weekly-goals'
import { ProgressHeader } from '@/components/layout/progress-tabs'
import { summaryTitle, weekRangeText } from './week-format'

// Progresi (V2-E1-05; pamja e 0.23, SPEC §0.3c, bordi "Progresi"): tab-et Trupi · Përmbledhja ·
// Historiku · Arritjet, që hapet te Përmbledhja. Para setit të parë gjendja bosh e bordit "Gjendje ·
// Bosh" me "Fillo stërvitjen e parë"; pastaj karta e javës (hap përmbledhjen), forca (e1RM), pesha me
// mesataren 7-ditore, matjet, fotot dhe "Shto matjen" (veprimi kryesor), volumi dhe ushqimi i 7 ditëve.
// Tekstet: 'progress.*' (V2-E1-16b).

// Një shifër pas presjes: sa mat peshorja dhe centimetri.
const round1 = (value: number) => Math.round(value * 10) / 10
const numberText = ({ fmt }: I18n, value: number) => fmt.number(round1(value), { maxDigits: 1 })
const valueText = (i18n: I18n, metric: Metric, value: number) => i18n.fmt.unit(round1(value), metric.unit, { maxDigits: 1 })
const deltaText = (i18n: I18n, metric: Metric, delta: number) => {
  const value = round1(delta)
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${valueText(i18n, metric, Math.abs(value))}`
}
const metricName = ({ t }: I18n, metric: Metric) => t(`progress.metric.${metric.key}`)
const WEIGHT = METRICS[0]
const DAY_MS = 86_400_000
/** Pikat e `days` ditëve të fundit, deri te matja e fundit. */
const since = <T extends { date: string }>(points: T[], days: number): T[] => {
  const last = points.at(-1)
  if (!last) return points
  const limit = new Date(Date.parse(`${last.date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10)
  return points.filter((point) => point.date >= limit)
}
const atNoon = (date: string) => new Date(`${date}T12:00:00`)
/** "1 nëntor" / "1 November". */
const dayText = ({ fmt }: I18n, date: string) => fmt.date(atNoon(date), { weekday: false })
const changeText = (i18n: I18n, metric: Metric, change: { delta: number; from: { date: string } }) =>
  i18n.t('progress.changeFrom', { delta: deltaText(i18n, metric, change.delta), date: dayText(i18n, change.from.date) })

type Snapshot = Awaited<ReturnType<typeof trainingSnapshot>>
/** Java e programit për stërvitjen e radhës ("Faza 1 · Java 2"), në gjuhën e app-it. */
const weekLabel = (t: I18n['t'], snapshot: Snapshot | undefined) => (snapshot && !snapshot.completed ? programWeekLabel(t, snapshot.plan) : undefined)

export function ProgressPage() {
  const i18n = useI18n()
  const { t } = i18n
  const start = useLocalQuery(() => progressStart(store), [])
  const view = useLocalQuery(() => progressView(store), [])
  const snapshot = useLocalQuery(() => trainingSnapshot(store), [])
  const label = weekLabel(t, snapshot)
  if (!start || !view) {
    return (
      <div className="flex flex-col gap-5">
        <ProgressHeader active="summary" />
        <div aria-hidden className="h-80 rounded-xl bg-surface" />
      </div>
    )
  }
  if (start.empty) return <ProgressEmpty weightKg={start.weightKg} snapshot={snapshot} label={label} />
  return (
    <div className="flex flex-col gap-3.5">
      <ProgressHeader active="summary" />
      <WeekLink />
      <TrainingSections />
      <WeightSection view={view} />
      <TrainingExtras />
    </div>
  )
}

/**
 * Karta e javës (bordi "Progresi"): java e fundit e mbyllur, ose nga e diela 20:00 java e tanishme si
 * do të mbyllej; hap përmbledhjen e saj.
 */
function WeekLink() {
  const i18n = useI18n()
  const { t } = i18n
  const [now] = useState(() => new Date())
  const monday = weekCardMonday(now) ?? shiftDate(mondayOf(localDate(now)), -7)
  const summary = useLocalQuery(() => weekSummary(store, monday), [monday])
  if (!summary) return null
  const { goals } = summary
  const short = (goal: typeof goals.food) => (goal ? `${goal.counted}/${goal.met ? 7 : goal.goal}` : '–')
  const training = summary.spare ? `${goals.training.done}+1` : `${goals.training.done}/${goals.training.target}`
  const range = weekRangeText(i18n, summary.monday)
  return (
    <Link
      to={`/progresi/java/${summary.monday}`}
      className={cn(surfaceClass, 'flex items-center gap-3.5 rounded-xl px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-caption text-muted-foreground tabular-nums">{summary.programWeek ? `${t('plan.week', { week: summary.programWeek.week })} · ${range}` : range}</span>
        <span className="type-display-s">{summaryTitle(i18n, summary)}</span>
        <span className="flex flex-wrap gap-x-3 type-caption text-muted-foreground tabular-nums">
          <span>{t('progress.week.training', { value: training })}</span>
          <span>{t('progress.week.food', { value: short(goals.food) })}</span>
          <span>{t('progress.week.water', { value: short(goals.water) })}</span>
        </span>
        <span className="text-sm tabular-nums">
          {t('progress.week.streak', { count: summary.streak })} · {t('week.summary.records.count', { count: summary.training.records.count })}
        </span>
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** Pesha (bordi "Progresi"): mesatarja 7-ditore me ndryshimin, grafiku, matjet, fotot dhe "Shto matjen". */
function WeightSection({ view }: { view: Awaited<ReturnType<typeof progressView>> }) {
  const i18n = useI18n()
  const { t } = i18n
  const timeline = useLocalQuery(() => photos.timeline(), [])
  const { weight } = view
  const measured = view.metrics.filter((entry) => entry.latest)
  const photoCount = timeline?.reduce((total, day) => total + Object.values(day.photos).filter(Boolean).length, 0) ?? 0
  return (
    <section aria-labelledby="weight-title" className="flex flex-col gap-3 pt-1">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="weight-title" className="type-label text-muted-foreground">
          {t('progress.weight')}
        </h2>
        <Link to="/progresi/weight_kg" className="-my-3 -mr-2 flex min-h-12 items-center rounded-md px-2 text-sm font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
          {t('progress.history')}
        </Link>
      </div>
      {weight.latest ? (
        <div className="flex items-end gap-3">
          <span className="font-display text-[64px] leading-[0.85] font-extrabold tracking-[-0.02em] tabular-nums">{numberText(i18n, weight.latest.value)}</span>
          <span className="flex flex-col gap-px pb-0.5 text-[15px]">
            <span className="text-muted-foreground">{t('progress.weightUnit')}</span>
            <span className="font-semibold text-data tabular-nums">{weight.change ? changeText(i18n, WEIGHT, weight.change) : t('progress.changeLater')}</span>
          </span>
        </div>
      ) : (
        <span className="type-title">{t('progress.noWeight')}</span>
      )}
      {weight.averages.length > 1 ? (
        <TrendChart
          ground="page"
          line={since(weight.averages, 56)}
          points={since(weight.points, 56)}
          lineLabel={t('progress.average')}
          pointsLabel={t('progress.dailyWeight')}
          label={t('progress.weightChart', { value: valueText(i18n, WEIGHT, weight.latest!.value) })}
          format={(value) => valueText(i18n, WEIGHT, value)}
        />
      ) : null}
      <div className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
        {measured.map(({ metric, latest, change }) => (
          <Link
            key={metric.key}
            to={`/progresi/${metric.key}`}
            className="flex min-h-[56px] items-center gap-3 border-b border-border py-2 pr-3.5 pl-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="type-body-strong">{metricName(i18n, metric)}</span>
              <span className="type-caption text-muted-foreground tabular-nums">{change ? changeText(i18n, metric, change) : dayText(i18n, latest!.date)}</span>
            </span>
            <span className="font-display text-xl font-bold whitespace-nowrap tabular-nums">{valueText(i18n, metric, latest!.value)}</span>
          </Link>
        ))}
        <Link
          to="/progresi/fotot"
          className="flex min-h-[56px] items-center gap-3 py-2 pr-3.5 pl-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-body-strong">{t('photos.title')}</span>
            <span className="type-caption text-muted-foreground tabular-nums">
              {timeline && timeline.length > 0 ? t('progress.photosDetail', { count: photoCount, date: dayText(i18n, timeline[0].date) }) : t('progress.photosNone')}
            </span>
          </span>
          <Icon name="hap" size={18} className="shrink-0 text-muted-foreground" />
        </Link>
      </div>
      {measured.length === 0 ? <p className="type-caption text-muted-foreground">{t('progress.noPerimeters')}</p> : null}
      <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
        {t('progress.addMeasurement')}
      </Link>
    </section>
  )
}

/** Bordi "Gjendje · Bosh": grafikët nisin me setin e parë; Trupi dhe matjet hapen që tani. */
function ProgressEmpty({ weightKg, snapshot, label }: { weightKg: number | null; snapshot: Snapshot | undefined; label?: string }) {
  const { t, fmt, lang } = useI18n()
  const starter = useStartWorkout()
  const plan = snapshot && !snapshot.completed ? snapshot.plan : null

  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-tab-bar)-var(--safe-top)-var(--safe-bottom)-44px)] flex-col gap-[18px]">
      <ProgressHeader active="summary" />
      <EmptyState
        title={t('progress.emptyTitle')}
        intro={t('progress.emptyIntro')}
        items={[
          { title: t('progress.strength'), text: t('progress.strengthText') },
          { title: t('progress.volume'), text: t('progress.volumeText') },
          { title: t('progress.body'), text: t('progress.bodyText'), to: '/progresi/trupi' },
          {
            title: t('progress.measurements'),
            text: weightKg === null ? t('progress.measurementsText') : t('progress.measurementsWeight', { weight: fmt.unit(weightKg, 'kg', { minDigits: 1, maxDigits: 1 }) }),
            to: '/progresi/matja',
          },
        ]}
        action={
          plan ? (
            <>
              <Button variant="primary" size="xl" {...starter.buttonProps}>
                {starter.label(t('progress.startFirst'))}
              </Button>
              {starter.sheet}
            </>
          ) : undefined
        }
        caption={plan && label ? t('progress.nextWorkout', { label, day: plan.dayNumber, name: programDayName(t, plan.dayName).toLocaleLowerCase(lang) }) : undefined}
      />
    </div>
  )
}

export function MetricPage() {
  const i18n = useI18n()
  const { t } = i18n
  const { metric: key = '' } = useParams()
  const metric = metricByKey(key)
  const history = useLocalQuery(() => (metric ? metricHistory(store, metric.key) : Promise.resolve([])), [key])
  if (!metric) return <p className="type-body text-muted-foreground">{t('progress.noMetric')}</p>
  const name = metricName(i18n, metric)
  if (!history) return <h1 className="sr-only">{name}</h1>
  const isWeight = metric.key === 'weight_kg'
  const line = isWeight ? movingAverage(history) : history
  const latest = history.at(-1)
  return (
    <div className="flex flex-col gap-5">
      <BackHeader
        title={name}
        subtitle={latest ? `${valueText(i18n, metric, latest.value)} · ${dayText(i18n, latest.date)}` : t('progress.noMeasurements')}
        back={t('body.backToProgress')}
        fallback="/progresi"
      />
      {line.length > 1 ? (
        <TrendChart
          ground="page"
          line={line}
          points={isWeight ? history : []}
          lineLabel={isWeight ? t('progress.average') : undefined}
          pointsLabel={isWeight ? t('progress.dailyWeight') : undefined}
          label={t('progress.metricChart', { name, count: history.length })}
          format={(value) => valueText(i18n, metric, value)}
        />
      ) : null}
      {history.length > 0 ? (
        <Group title={t('progress.history')}>
          {[...history].reverse().map((point) => (
            <LinkRow key={point.date} to={`/progresi/matja?data=${point.date}`} label={dayText(i18n, point.date)} value={valueText(i18n, metric, point.value)} />
          ))}
        </Group>
      ) : null}
      <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
        {t('progress.addMeasurement')}
      </Link>
    </div>
  )
}

function useTrainingProgress() {
  const [now] = useState(() => new Date())
  return useLocalQuery(() => trainingProgress(store, now), [])
}

/** Forca (bordi "Progresi"): ushtrimi i parë me e1RM-në e madhe dhe ndryshimin, pastaj të tjerët si lista. */
function TrainingSections() {
  const progress = useTrainingProgress()
  if (!progress) return null
  return <Strength rows={progress.strength.slice(0, 8)} />
}

/** Volumi javor dhe ushqimi i 7 ditëve, pas peshës. */
function TrainingExtras() {
  const progress = useTrainingProgress()
  if (!progress) return null
  return (
    <>
      <Volume rows={progress.volume} />
      <Compliance days={progress.compliance} />
    </>
  )
}

const KG = METRICS[0]

function Strength({ rows }: { rows: StrengthRow[] }) {
  const i18n = useI18n()
  const { t } = i18n
  if (rows.length === 0) {
    return <p className="type-caption text-muted-foreground">{t('progress.strengthEmpty')}</p>
  }
  const [lead, ...rest] = rows
  return (
    <section aria-labelledby="strength-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="strength-title" className="type-label text-muted-foreground">
          {t('progress.strength')}
        </h2>
        <Link
          to={`/ushtrimi/${lead.exerciseId}`}
          className="-my-3 -mr-2 flex min-h-12 min-w-0 items-center truncate rounded-md px-2 text-sm font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground"
        >
          {lead.name}
        </Link>
      </div>
      <div className="flex items-end gap-3">
        <span className="font-display text-[72px] leading-[0.85] font-extrabold tracking-[-0.02em] tabular-nums">{numberText(i18n, lead.latest.value)}</span>
        <span className="flex flex-col gap-px pb-0.5 text-[15px]">
          <span className="text-muted-foreground">{KG.unit}</span>
          <span className="font-semibold text-data tabular-nums">{lead.change ? changeText(i18n, KG, lead.change) : dayText(i18n, lead.latest.date)}</span>
        </span>
      </div>
      {rest.length > 0 ? <StrengthList rows={rest} /> : null}
    </section>
  )
}

function StrengthList({ rows }: { rows: StrengthRow[] }) {
  const i18n = useI18n()
  return (
    <div className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
      {rows.map((row) => (
        <LinkRow
          key={row.exerciseId}
          to={`/ushtrimi/${row.exerciseId}`}
          label={row.name}
          value={valueText(i18n, KG, row.latest.value)}
          detail={row.change ? changeText(i18n, KG, row.change) : dayText(i18n, row.latest.date)}
        />
      ))}
    </div>
  )
}

function Volume({ rows }: { rows: VolumeRow[] }) {
  const { t, fmt } = useI18n()
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((row) => Math.max(row.thisWeek, row.lastWeek)), 1)
  return (
    <section aria-labelledby="volume-title" className="flex flex-col gap-2">
      <h2 id="volume-title" className="type-label text-muted-foreground">
        {t('progress.volumeTitle')}
      </h2>
      <dl className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4 tabular-nums')}>
        {rows.map((row) => (
          <div key={row.group.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 type-caption">
              <dt>{muscleName(t, row.group.id)}</dt>
              <dd className="text-muted-foreground">
                <b className="font-semibold text-foreground">{fmt.number(row.thisWeek)}</b> {t('progress.thisWeek')} · {fmt.number(row.lastWeek)} {t('progress.lastWeek')}
              </dd>
            </div>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
              <div className="h-full rounded-pill bg-data" style={{ width: `${(row.thisWeek / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Dita ISO e javës (1 = e hënë … 7 = e diel) e një date. */
const isoDay = (date: string) => (atNoon(date).getDay() || 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7

function Compliance({ days }: { days: ComplianceDay[] }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  if (days.every((day) => day.kcal === 0)) return null
  return (
    <section aria-labelledby="compliance-title" className="flex flex-col gap-2">
      <h2 id="compliance-title" className="type-label text-muted-foreground">
        {t('progress.foodTitle')}
      </h2>
      <div className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-4')}>
        <ol className="relative grid h-32 grid-cols-7 items-end gap-2 border-b border-border">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground" style={{ bottom: `${(100 / 130) * 100}%` }} />
          {days.map((day) => {
            const percent = day.target ? Math.round((day.kcal / day.target) * 100) : null
            const kcal = fmt.number(Math.round(day.kcal))
            const date = fmt.date(atNoon(day.date), { weekday: true })
            return (
              <li
                key={day.date}
                aria-label={percent === null ? t('progress.foodDay', { date, kcal }) : t('progress.foodDayTarget', { date, kcal, percent: String(percent) })}
                className="flex h-full flex-col justify-end"
              >
                <span className="rounded-t-[4px] bg-foreground" style={{ height: `${Math.min(percent ?? 0, 130) / 1.3}%`, minHeight: day.kcal > 0 ? 2 : 0 }} />
              </li>
            )
          })}
        </ol>
        <div aria-hidden className="grid grid-cols-7 gap-2 text-center text-xs leading-4 text-muted-foreground tabular-nums">
          {days.map((day) => {
            const percent = day.target ? Math.round((day.kcal / day.target) * 100) : null
            return (
              <span key={day.date} className="flex flex-col">
                <span className="font-medium text-foreground">{percent === null ? '–' : `${fmt.number(percent)}%`}</span>
                <span>{t(`day.short.${isoDay(day.date)}`)}</span>
              </span>
            )
          })}
        </div>
        <p className="type-caption text-muted-foreground">{t('progress.foodTarget')}</p>
      </div>
    </section>
  )
}
