import { useId, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { TrendChart } from '@/components/charts/trend-chart'
import { EmptyState } from '@/components/layout/empty-state'
import { Group, LinkRow } from '@/components/layout/list-group'
import { BackButton } from '@/components/layout/page'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/lib/calendar'
import { type ComplianceDay, type MeasurementValues, measurementsOn, metricHistory, progressStart, progressView, saveMeasurement, trainingProgress } from '@/data/progress'
import { historyGlance } from '@/data/history'
import { startWorkout, trainingSnapshot } from '@/data/training'
import { useI18n } from '@/i18n/use-i18n'
import { prepareRestNotifications } from '@/lib/rest-alarm'
import type { StrengthRow, VolumeRow } from '@/progress/strength'
import { METRICS, type Metric, type MetricKey, metricByKey, movingAverage, parseMetric } from '@/progress/metrics'
import { cn } from '@/lib/cn'
import { PhotoSection } from './photos'
import { dateLabel, kg } from './training-format'

// Progresi (V2-E1-05 në sistemin Vrull; pamja e plotë e bordit vjen me Etapën 3): para setit të
// parë gjendja bosh e bordit "Gjendje · Bosh" me "Fillo stërvitjen e parë"; pastaj paneli i peshës
// me mesataren 7-ditore dhe "Shto matjen" (veprimi kryesor), Trupi 3D (këtu që nga v2), fotot,
// forca, volumi, ushqimi dhe çdo matje me vlerën e fundit.

// Një shifër pas presjes: sa mat peshorja dhe centimetri.
const round1 = (value: number) => Math.round(value * 10) / 10
const valueText = (metric: Metric, value: number) => `${kg(round1(value))} ${metric.unit}`
const deltaText = (metric: Metric, delta: number) => {
  const value = round1(delta)
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${kg(Math.abs(value))} ${metric.unit}`
}
const WEIGHT = METRICS[0]
const DAY_MS = 86_400_000
/** Pikat e `days` ditëve të fundit, deri te matja e fundit. */
const since = <T extends { date: string }>(points: T[], days: number): T[] => {
  const last = points.at(-1)
  if (!last) return points
  const limit = new Date(Date.parse(`${last.date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10)
  return points.filter((point) => point.date >= limit)
}
const dayText = (date: string) => dateLabel(new Date(`${date}T12:00:00`))

/** Kreu i Progresit: data dhe java e programit sipër, si te bordi. */
function ProgressHeader({ label }: { label?: string }) {
  const { t, fmt } = useI18n()
  const [now] = useState(() => new Date())
  const date = fmt.date(now)
  const eyebrow = date.charAt(0).toLocaleUpperCase() + date.slice(1) + (label ? ` · ${label}` : '')
  return <ScreenHeader eyebrow={eyebrow} title={t('tab.progress')} />
}

export function ProgressPage() {
  const start = useLocalQuery(() => progressStart(store), [])
  const view = useLocalQuery(() => progressView(store), [])
  const snapshot = useLocalQuery(() => trainingSnapshot(store), [])
  const label = snapshot && !snapshot.completed ? snapshot.label : undefined
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
            Pesha · mesatarja 7-ditore
          </span>
          {weight.latest ? (
            <span className="flex items-baseline gap-1.5">
              <span className="type-display-s tabular-nums">{kg(round1(weight.latest.value))}</span>
              <span className="type-body text-muted-foreground">{WEIGHT.unit}</span>
            </span>
          ) : (
            <span className="type-title">Pa peshë ende</span>
          )}
          <span className="type-caption text-muted-foreground tabular-nums">
            {weight.change ? `${deltaText(WEIGHT, weight.change.delta)} nga ${dayText(weight.change.from.date)}` : 'Ndryshimi del pas matjeve të tjera'}
          </span>
        </div>
        {weight.averages.length > 1 ? (
          <TrendChart
            tone="panel"
            line={since(weight.averages, 56)}
            points={since(weight.points, 56)}
            lineLabel="Mesatarja 7-ditore"
            pointsLabel="Pesha e ditës"
            label={`Pesha në 8 javët e fundit, mesatarja e fundit ${valueText(WEIGHT, weight.latest!.value)}`}
            format={(value) => valueText(WEIGHT, value)}
          />
        ) : null}
        <div className="flex gap-2">
          <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'min-w-0 flex-1 px-4')}>
            Shto matjen
          </Link>
          <Link to="/progresi/weight_kg" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Historia
          </Link>
        </div>
      </section>

      <BodyLink />

      <HistoryLink />

      <PhotoSection />

      <TrainingSections />

      {measured.length > 0 ? (
        <Group title="Trupi">
          {measured.map(({ metric, latest, change }) => (
            <LinkRow
              key={metric.key}
              to={`/progresi/${metric.key}`}
              label={metric.label}
              value={valueText(metric, latest!.value)}
              detail={change ? `${deltaText(metric, change.delta)} nga ${dayText(change.from.date)}` : dayText(latest!.date)}
            />
          ))}
        </Group>
      ) : (
        <p className="type-caption text-muted-foreground">Perimetrat dhe % e yndyrës dalin këtu pas matjes së parë me centimetër.</p>
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
  const [yesterday] = useState(() => localDate(new Date(Date.now() - 86_400_000)))
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
function ProgressEmpty({ weightKg, snapshot, label }: { weightKg: number | null; snapshot: Awaited<ReturnType<typeof trainingSnapshot>> | undefined; label?: string }) {
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
        caption={plan && label ? t('progress.nextWorkout', { label, day: plan.dayNumber, name: plan.dayName.toLocaleLowerCase(lang) }) : undefined}
      />
    </div>
  )
}

export function MetricPage() {
  const { metric: key = '' } = useParams()
  const metric = metricByKey(key)
  const history = useLocalQuery(() => (metric ? metricHistory(store, metric.key) : Promise.resolve([])), [key])
  if (!metric) return <p className="type-body text-muted-foreground">Kjo matje nuk ekziston.</p>
  if (!history) return <h1 className="sr-only">{metric.label}</h1>
  const isWeight = metric.key === 'weight_kg'
  const line = isWeight ? movingAverage(history) : history
  const latest = history.at(-1)
  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te progresi" fallback="/progresi" />
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="type-display-m">{metric.label}</h1>
        <span className="type-body text-muted-foreground tabular-nums">
          {latest ? `${valueText(metric, latest.value)} · ${dayText(latest.date)}` : 'Ende pa matje'}
        </span>
      </div>
      {line.length > 1 ? (
        <TrendChart
          tone="card"
          line={line}
          points={isWeight ? history : []}
          lineLabel={isWeight ? 'Mesatarja 7-ditore' : undefined}
          pointsLabel={isWeight ? 'Pesha e ditës' : undefined}
          label={`${metric.label} në kohë, ${history.length} matje`}
          format={(value) => valueText(metric, value)}
        />
      ) : null}
      {history.length > 0 ? (
        <Group title="Historia">
          {[...history].reverse().map((point) => (
            <LinkRow key={point.date} to={`/progresi/matja?data=${point.date}`} label={dayText(point.date)} value={valueText(metric, point.value)} />
          ))}
        </Group>
      ) : null}
      <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
        Shto matjen
      </Link>
    </div>
  )
}

const GROUPS: { title: string; keys: MetricKey[]; pairs?: boolean }[] = [
  { title: 'Pesha dhe yndyra', keys: ['weight_kg', 'body_fat_pct'] },
  { title: 'Trupi', keys: ['neck_cm', 'shoulders_cm', 'chest_cm', 'waist_cm', 'hips_cm'] },
  {
    title: 'Krahët dhe këmbët',
    keys: ['arm_left_cm', 'arm_right_cm', 'forearm_left_cm', 'forearm_right_cm', 'thigh_left_cm', 'thigh_right_cm', 'calf_left_cm', 'calf_right_cm'],
    pairs: true,
  },
]

const toText = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value).replace('.', ','))

export function MeasurementPage() {
  const [params] = useSearchParams()
  const [today] = useState(() => localDate(new Date()))
  const date = params.get('data') ?? today
  const saved = useLocalQuery(() => measurementsOn(store, date), [date])
  if (!saved) return <h1 className="sr-only">Matja</h1>
  return <MeasurementForm key={date} date={date} saved={saved} />
}

function MeasurementForm({ date, saved }: { date: string; saved: MeasurementValues }) {
  const navigate = useNavigate()
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(METRICS.map((metric) => [metric.key, toText(saved[metric.key])])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function save() {
    const values: MeasurementValues = {}
    const problems: Record<string, string> = {}
    for (const metric of METRICS) {
      const parsed = parseMetric(metric, texts[metric.key] ?? '')
      if (parsed.ok) values[metric.key] = parsed.value
      else problems[metric.key] = parsed.error
    }
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    if (Object.values(values).every((value) => value === null) && Object.values(saved).every((value) => value === null || value === undefined)) {
      setErrors({ form: 'Shkruaj të paktën një matje.' })
      return
    }
    setBusy(true)
    await saveMeasurement(store, date, values)
    navigate(-1)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu" fallback="/progresi" />
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="type-display-m">Matja</h1>
        <span className="type-body text-muted-foreground">{dayText(date)}</span>
      </div>
      <p className="-mt-2 type-caption text-muted-foreground">Pesha më mirë në mëngjes, para ushqimit. Perimetrat me centimetër, në të njëjtin vend çdo herë. Fushat bosh nuk ruhen.</p>
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-3">
          <legend className="mb-1 type-label text-muted-foreground">{group.title}</legend>
          <div className={cn('grid gap-3', group.pairs || group.keys.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
            {group.keys.map((key) => {
              const metric = metricByKey(key)!
              return (
                <MetricField
                  key={key}
                  metric={metric}
                  value={texts[key] ?? ''}
                  error={errors[key]}
                  onChange={(value) => {
                    setTexts((current) => ({ ...current, [key]: value }))
                    setErrors((current) => {
                      const { [key]: _removed, form: _form, ...rest } = current
                      return rest
                    })
                  }}
                />
              )
            })}
          </div>
        </fieldset>
      ))}
      {errors.form ? (
        <p role="alert" className="type-caption text-danger">
          {errors.form}
        </p>
      ) : null}
      <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
        Ruaj matjen
      </Button>
    </div>
  )
}

function MetricField({ metric, value, error, onChange }: { metric: Metric; value: string; error?: string; onChange: (value: string) => void }) {
  const id = useId()
  const errorId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-caption font-medium">
        {metric.label}, {metric.unit}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={inputClass}
      />
      {error ? (
        <p id={errorId} role="alert" className="type-caption text-danger">
          {error}
        </p>
      ) : null}
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
  if (rows.length === 0) {
    return <p className="type-caption text-muted-foreground">Forca (e1RM) del këtu pas seteve të para me peshë.</p>
  }
  return (
    <Group title="Forca · e1RM">
      {rows.map((row) => (
        <LinkRow
          key={row.exerciseId}
          to={`/ushtrimi/${row.exerciseId}`}
          label={row.name}
          value={valueText(KG, row.latest.value)}
          detail={row.change ? `${deltaText(KG, row.change.delta)} nga ${dayText(row.change.from.date)}` : dayText(row.latest.date)}
        />
      ))}
    </Group>
  )
}

function Volume({ rows }: { rows: VolumeRow[] }) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((row) => Math.max(row.thisWeek, row.lastWeek)), 1)
  return (
    <section aria-labelledby="volume-title" className="flex flex-col gap-2">
      <h2 id="volume-title" className="type-label text-muted-foreground">
        Volumi javor · sete pune
      </h2>
      <dl className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4 tabular-nums')}>
        {rows.map((row) => (
          <div key={row.group.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 type-caption">
              <dt>{row.group.name}</dt>
              <dd className="text-muted-foreground">
                <b className="font-semibold text-foreground">{row.thisWeek}</b> këtë javë · {row.lastWeek} e kaluara
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

const WEEKDAY = ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht']

function Compliance({ days }: { days: ComplianceDay[] }) {
  if (days.every((day) => day.kcal === 0)) return null
  return (
    <section aria-labelledby="compliance-title" className="flex flex-col gap-2">
      <h2 id="compliance-title" className="type-label text-muted-foreground">
        Ushqimi · 7 ditët e fundit
      </h2>
      <div className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-4')}>
        <ol className="relative grid h-32 grid-cols-7 items-end gap-2 border-b border-border">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground" style={{ bottom: `${(100 / 130) * 100}%` }} />
          {days.map((day) => {
            const percent = day.target ? Math.round((day.kcal / day.target) * 100) : null
            return (
              <li
                key={day.date}
                aria-label={`${dayText(day.date)}: ${day.kcal} kcal${percent === null ? '' : `, ${percent}% e objektivit`}`}
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
                <span className="font-medium text-foreground">{percent === null ? '–' : `${percent}%`}</span>
                <span>{WEEKDAY[new Date(`${day.date}T12:00:00`).getDay()]}</span>
              </span>
            )
          })}
        </div>
        <p className="type-caption text-muted-foreground">Vija me ndërprerje është objektivi i kcal të ditës.</p>
      </div>
    </section>
  )
}
