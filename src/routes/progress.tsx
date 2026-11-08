import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { TrendChart } from '@/components/charts/trend-chart'
import { EmptyState } from '@/components/layout/empty-state'
import { Group, LinkRow } from '@/components/layout/list-group'
import { BackButton } from '@/components/layout/page'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/lib/calendar'
import { type ComplianceDay, metricHistory, progressStart, progressView, trainingProgress } from '@/data/progress'
import { historyGlance } from '@/data/history'
import { startWorkout, trainingSnapshot } from '@/data/training'
import type { I18n } from '@/i18n'
import { muscleName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { prepareRestNotifications } from '@/lib/rest-alarm'
import type { StrengthRow, VolumeRow } from '@/progress/strength'
import { METRICS, type Metric, metricByKey, movingAverage } from '@/progress/metrics'
import { cn } from '@/lib/cn'
import { PhotoSection } from './photos'

// Progresi (V2-E1-05 në sistemin Vrull; pamja e plotë e bordit vjen me Etapën 3): para setit të
// parë gjendja bosh e bordit "Gjendje · Bosh" me "Fillo stërvitjen e parë"; pastaj paneli i peshës
// me mesataren 7-ditore dhe "Shto matjen" (veprimi kryesor), Trupi 3D (këtu që nga v2), fotot,
// forca, volumi, ushqimi dhe çdo matje me vlerën e fundit. Tekstet: 'progress.*' (V2-E1-16b).

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

/** Kreu i Progresit: data dhe java e programit sipër, si te bordi. */
function ProgressHeader({ label }: { label?: string }) {
  const { t, fmt } = useI18n()
  const [now] = useState(() => new Date())
  const date = fmt.date(now)
  const eyebrow = date.charAt(0).toLocaleUpperCase() + date.slice(1) + (label ? ` · ${label}` : '')
  return <ScreenHeader eyebrow={eyebrow} title={t('tab.progress')} />
}

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
        <ProgressHeader label={label} />
        <div aria-hidden className="h-80 rounded-xl bg-surface" />
      </div>
    )
  }
  if (start.empty) return <ProgressEmpty weightKg={start.weightKg} snapshot={snapshot} label={label} />
  const { weight } = view
  const measured = view.metrics.filter((entry) => entry.latest)
  return (
    <div className="flex flex-col gap-3.5">
      <ProgressHeader label={label} />
      <section aria-labelledby="weight-title" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-4')}>
        <div className="flex flex-col gap-1">
          <span id="weight-title" className="type-label text-muted-foreground">
            {t('progress.weightTitle')}
          </span>
          {weight.latest ? (
            <span className="flex items-baseline gap-1.5">
              <span className="type-display-s tabular-nums">{numberText(i18n, weight.latest.value)}</span>
              <span className="type-body text-muted-foreground">{WEIGHT.unit}</span>
            </span>
          ) : (
            <span className="type-title">{t('progress.noWeight')}</span>
          )}
          <span className="type-caption text-muted-foreground tabular-nums">{weight.change ? changeText(i18n, WEIGHT, weight.change) : t('progress.changeLater')}</span>
        </div>
        {weight.averages.length > 1 ? (
          <TrendChart
            ground="card"
            line={since(weight.averages, 56)}
            points={since(weight.points, 56)}
            lineLabel={t('progress.average')}
            pointsLabel={t('progress.dailyWeight')}
            label={t('progress.weightChart', { value: valueText(i18n, WEIGHT, weight.latest!.value) })}
            format={(value) => valueText(i18n, WEIGHT, value)}
          />
        ) : null}
        <div className="flex gap-2">
          <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'min-w-0 flex-1 px-4')}>
            {t('progress.addMeasurement')}
          </Link>
          <Link to="/progresi/weight_kg" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            {t('progress.history')}
          </Link>
        </div>
      </section>

      <BodyLink />

      <HistoryLink />

      <PhotoSection />

      <TrainingSections />

      {measured.length > 0 ? (
        <Group title={t('progress.bodyGroup')}>
          {measured.map(({ metric, latest, change }) => (
            <LinkRow
              key={metric.key}
              to={`/progresi/${metric.key}`}
              label={metricName(i18n, metric)}
              value={valueText(i18n, metric, latest!.value)}
              detail={change ? changeText(i18n, metric, change) : dayText(i18n, latest!.date)}
            />
          ))}
        </Group>
      ) : (
        <p className="type-caption text-muted-foreground">{t('progress.noPerimeters')}</p>
      )}
    </div>
  )
}

/** Trupi 3D, që në v2 jeton brenda Progresit (/progresi/trupi). */
function BodyLink() {
  const { t } = useI18n()
  return (
    <Link
      to="/progresi/trupi"
      className={cn(
        surfaceClass,
        'flex min-h-row items-center gap-3 rounded-lg py-3 pr-3 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-title">{t('progress.body')}</span>
        <span className="type-caption text-muted-foreground">{t('progress.bodyText')}</span>
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** Historiku i seancave (V2-E1-15): sa seanca të mbyllura dhe kur ishte e fundit. */
function HistoryLink() {
  const { t, fmt } = useI18n()
  const glance = useLocalQuery(() => historyGlance(store), [])
  const [today] = useState(() => localDate(new Date()))
  const [yesterday] = useState(() => {
    const now = new Date()
    return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  })
  if (!glance) return null
  const when = !glance.last
    ? null
    : glance.last === today
      ? t('history.when.today')
      : glance.last === yesterday
        ? t('history.when.yesterday')
        : t('history.when.on', { date: fmt.date(new Date(`${glance.last}T12:00:00`), { weekday: false }) })
  return (
    <Link
      to="/progresi/historiku"
      className={cn(
        surfaceClass,
        'flex min-h-row items-center gap-3 rounded-lg py-3 pr-3 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-title">{t('history.title')}</span>
        <span className="type-caption text-muted-foreground tabular-nums">{when ? t('history.linkText', { count: glance.total, when }) : t('history.linkEmpty')}</span>
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** Bordi "Gjendje · Bosh": grafikët nisin me setin e parë; Trupi dhe matjet hapen që tani. */
function ProgressEmpty({ weightKg, snapshot, label }: { weightKg: number | null; snapshot: Snapshot | undefined; label?: string }) {
  const { t, fmt, lang } = useI18n()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const plan = snapshot && !snapshot.completed ? snapshot.plan : null

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
    <div className="flex min-h-[calc(100dvh-var(--spacing-tab-bar)-var(--safe-top)-var(--safe-bottom)-44px)] flex-col gap-[18px]">
      <ProgressHeader label={label} />
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
            <Button variant="primary" size="xl" disabled={busy} onClick={() => void start()}>
              {t('progress.startFirst')}
            </Button>
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
      <header className="flex min-h-11 items-center">
        <BackButton label={t('body.backToProgress')} fallback="/progresi" />
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="type-display-m">{name}</h1>
        <span className="type-body text-muted-foreground tabular-nums">
          {latest ? `${valueText(i18n, metric, latest.value)} · ${dayText(i18n, latest.date)}` : t('progress.noMeasurements')}
        </span>
      </div>
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

function TrainingSections() {
  const [now] = useState(() => new Date())
  const progress = useLocalQuery(() => trainingProgress(store, now), [])
  if (!progress) return null
  return (
    <>
      <Strength rows={progress.strength.slice(0, 8)} />
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
  return (
    <Group title={t('progress.strength')}>
      {rows.map((row) => (
        <LinkRow
          key={row.exerciseId}
          to={`/ushtrimi/${row.exerciseId}`}
          label={row.name}
          value={valueText(i18n, KG, row.latest.value)}
          detail={row.change ? changeText(i18n, KG, row.change) : dayText(i18n, row.latest.date)}
        />
      ))}
    </Group>
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
