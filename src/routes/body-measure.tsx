import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { Tone } from '@/body/model-math'
import { BackButton } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type MeasureContext, measureContext } from '@/data/body'
import { saveMeasurement, type MeasurementValues } from '@/data/progress'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import { isDayBefore, stepValue } from '@/progress/measure-form'
import { metricByKey, type MetricKey, parseMetric } from '@/progress/metrics'
import { oneDecimal, signedDecimal } from './body-format'

// Shto matjen (SPEC §8, V2-E1-14; bordi "Trupi · Shto matjen"). Data (sot, ose një ditë tjetër nga
// historia me ?data=), pesha e trupit me ±0,1 kg dhe katër perimetrat e bordit me ±0,1 cm; "Më
// shumë matje" hap të tjerat (qafa, shpatullat, vithet, parakrahu, pulpa, ana tjetër, % e yndyrës).
// Një matje e re mbushet me vlerat e fundit ("Të mbushura nga 1 nëntor"); ruhet ajo që shihet:
// fushat e dukshme me vlerë, të fshehurat e "Më shumë" vetëm kur seksioni është hapur. Te një datë
// që ka matje, fushat mbajnë vlerat e saj dhe një fushë e zbrazur e fshin vlerën. Krahu, parakrahu,
// kofsha dhe pulpa kryesore janë ana e djathtë; "ana tjetër" është e majta.

type FieldKey = Extract<Parameters<I18n['t']>[0], `measure.field.${string}`>

const MAIN: { key: MetricKey; label: FieldKey }[] = [
  { key: 'arm_right_cm', label: 'measure.field.arm' },
  { key: 'chest_cm', label: 'measure.field.chest' },
  { key: 'waist_cm', label: 'measure.field.waist' },
  { key: 'thigh_right_cm', label: 'measure.field.thigh' },
]
const MORE: { key: MetricKey; label: FieldKey }[] = [
  { key: 'neck_cm', label: 'measure.field.neck' },
  { key: 'shoulders_cm', label: 'measure.field.shoulders' },
  { key: 'hips_cm', label: 'measure.field.hips' },
  { key: 'forearm_right_cm', label: 'measure.field.forearm' },
  { key: 'calf_right_cm', label: 'measure.field.calf' },
  { key: 'arm_left_cm', label: 'measure.field.armOther' },
  { key: 'forearm_left_cm', label: 'measure.field.forearmOther' },
  { key: 'thigh_left_cm', label: 'measure.field.thighOther' },
  { key: 'calf_left_cm', label: 'measure.field.calfOther' },
  { key: 'body_fat_pct', label: 'measure.field.bodyFat' },
]
const STEP = 0.1
const THUMB: Tone = { token: '--muted-foreground', alpha: 0.45 }

const day = (date: string) => new Date(`${date}T12:00:00`)

export function MeasurePage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => localDate(new Date()))
  const date = params.get('data') ?? today
  const context = useLocalQuery(() => measureContext(store, date), [date])
  // Pas ndryshimit të datës, konteksti i vjetër mbetet derisa të vijë i riu: forma pret atë të datës.
  if (!context || context.date !== date) return <h1 className="sr-only">{t('measure.title')}</h1>
  return (
    <MeasureForm
      key={date}
      date={date}
      today={today}
      context={context}
      onDate={(next) => setParams((current) => (current.set('data', next), current), { replace: true })}
    />
  )
}

function MeasureForm({ date, today, context, onDate }: { date: string; today: string; context: MeasureContext; onDate: (date: string) => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const navigate = useNavigate()
  const location = useLocation()
  const { saved, previous } = context
  const text = (value: number | null | undefined) => (typeof value === 'number' ? oneDecimal(i18n, value) : '')
  // Matja e re merr vlerat e fundit; data që ka matje mban vetëm të sajat.
  const [texts, setTexts] = useState<Partial<Record<MetricKey, string>>>(() =>
    Object.fromEntries(
      (['weight_kg', ...MAIN.map((field) => field.key), ...MORE.map((field) => field.key)] as MetricKey[]).map((key) => [key, text(saved ? saved[key] : previous[key]?.value)]),
    ),
  )
  const [more, setMore] = useState(() => Boolean(saved && MORE.some((field) => typeof saved[field.key] === 'number')))
  const [live, setLive] = useState<MetricKey | null>(null)
  const [errors, setErrors] = useState<Partial<Record<MetricKey | 'form', string>>>({})
  const [busy, setBusy] = useState(false)
  const prefilledFrom = saved ? null : MAIN.map((field) => previous[field.key]?.date).filter((value): value is string => Boolean(value)).sort().at(-1)

  const valueOf = (key: MetricKey) => {
    const parsed = parseMetric(metricByKey(key)!, texts[key] ?? '')
    return parsed.ok ? parsed.value : null
  }
  const change = (key: MetricKey, next: string) => {
    setTexts((current) => ({ ...current, [key]: next }))
    setLive(key)
    setErrors((current) => {
      const { [key]: _field, form: _form, ...rest } = current
      return rest
    })
  }
  const step = (key: MetricKey, direction: -1 | 1) => {
    const next = stepValue(metricByKey(key)!, valueOf(key), previous[key]?.value ?? null, direction)
    if (next !== null) change(key, oneDecimal(i18n, next))
  }
  const labelOf = (key: MetricKey) => (key === 'weight_kg' ? t('measure.weight') : t([...MAIN, ...MORE].find((field) => field.key === key)!.label))

  async function save() {
    const visible: MetricKey[] = ['weight_kg', ...MAIN.map((field) => field.key), ...(more ? MORE.map((field) => field.key) : [])]
    const values: MeasurementValues = {}
    const problems: typeof errors = {}
    for (const key of visible) {
      const metric = metricByKey(key)!
      const parsed = parseMetric(metric, texts[key] ?? '')
      if (!parsed.ok) problems[key] = t('measure.range', { name: labelOf(key), min: metric.min, max: metric.max, unit: metric.unit })
      // Te një matje e re ruhen vetëm fushat me vlerë; te një datë që ka matje, fusha bosh e fshin.
      else if (parsed.value !== null || saved) values[key] = parsed.value
    }
    const hasSaved = saved !== null && Object.values(saved).some((value) => typeof value === 'number')
    if (Object.keys(problems).length === 0 && Object.values(values).every((value) => value === null) && !hasSaved) problems.form = t('measure.atLeastOne')
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    await saveMeasurement(store, date, values)
    if (location.key === 'default') navigate('/progresi', { replace: true })
    else navigate(-1)
  }

  const deltaLine = (key: MetricKey, unit: string): ReactNode => {
    const before = previous[key]
    if (!before) return t('measure.none')
    const last = t('measure.last', { date: fmt.date(day(before.date), { weekday: false }), value: oneDecimal(i18n, before.value) })
    const current = valueOf(key)
    if (current === null) return last
    const delta = Math.round((current - before.value) * 10) / 10
    return (
      <>
        {last} ·{' '}
        {delta === 0 ? (
          t('measure.unchanged')
        ) : (
          <span className="font-semibold text-data">
            {signedDecimal(i18n, delta)}
            {' '}
            {unit}
          </span>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex min-h-14 items-center gap-1">
        <BackButton label={t('measure.back')} fallback="/progresi" className="-ml-2" />
        <h1 className="min-w-0 flex-1 type-display-m">{t('measure.title')}</h1>
      </header>

      <DateRow date={date} today={today} onDate={onDate} />

      <WeightCard
        value={texts.weight_kg ?? ''}
        live={live === 'weight_kg'}
        error={errors.weight_kg}
        context={context}
        date={date}
        current={valueOf('weight_kg')}
        onChange={(next) => change('weight_kg', next)}
        onStep={(direction) => step('weight_kg', direction)}
      />

      <section aria-labelledby="measure-perimeters" className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="measure-perimeters" className="type-label text-muted-foreground">
            {t('measure.perimeters')}
          </h2>
          {prefilledFrom ? <span className="type-caption text-muted-foreground">{t('measure.prefilled', { date: fmt.date(day(prefilledFrom), { weekday: false }) })}</span> : null}
        </div>
        <div className={cn(surfaceClass, 'flex flex-col rounded-lg pr-2.5 pl-3.5')}>
          {MAIN.map((field) => (
            <MetricRow
              key={field.key}
              label={t(field.label)}
              unit={metricByKey(field.key)!.unit}
              value={texts[field.key] ?? ''}
              live={live === field.key}
              error={errors[field.key]}
              detail={deltaLine(field.key, 'cm')}
              onChange={(next) => change(field.key, next)}
              onStep={(direction) => step(field.key, direction)}
            />
          ))}
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore(!more)}
            className="flex min-h-[60px] items-center justify-between gap-2.5 py-2 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
          >
            <span className="flex flex-col gap-0.5">
              <span className="type-body-strong">{t('measure.more')}</span>
              <span className="type-caption text-muted-foreground">{t('measure.moreText')}</span>
            </span>
            <Icon name="poshte" size={20} className={cn('shrink-0 text-muted-foreground transition-transform', more && 'rotate-180')} />
          </button>
          {more
            ? MORE.map((field) => {
                const metric = metricByKey(field.key)!
                return (
                  <MetricRow
                    key={field.key}
                    label={t(field.label)}
                    unit={metric.unit}
                    value={texts[field.key] ?? ''}
                    live={live === field.key}
                    error={errors[field.key]}
                    detail={deltaLine(field.key, metric.unit)}
                    onChange={(next) => change(field.key, next)}
                    onStep={(direction) => step(field.key, direction)}
                    top
                  />
                )
              })
            : null}
        </div>
      </section>

      <section aria-labelledby="measure-how" className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-lg px-3.5 py-3')}>
        <h2 id="measure-how" className="type-label text-muted-foreground">
          {t('measure.how')}
        </h2>
        <ul className="flex flex-col gap-1 type-caption">
          {(['measure.how1', 'measure.how2', 'measure.how3'] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-pill bg-muted-foreground" />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <ModelThumb />
        <span className="flex flex-col gap-0.5">
          <span className="type-body font-semibold">{t('measure.model')}</span>
          <span className="type-caption text-muted-foreground">{t('measure.modelText')}</span>
        </span>
      </div>

      {errors.form ? (
        <p role="alert" className="type-caption text-danger">
          {errors.form}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 -mb-[calc(var(--safe-bottom)+24px)] border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+20px)]">
        <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
          {t('measure.save')}
        </Button>
      </div>
    </div>
  )
}

/** Data e matjes: rreshti hap zgjedhësin e datës së telefonit (deri sot). */
function DateRow({ date, today, onDate }: { date: string; today: string; onDate: (date: string) => void }) {
  const { t, fmt } = useI18n()
  const id = useId()
  const shown = `${fmt.weekday(day(date))} ${fmt.date(day(date), { weekday: false, year: true })}`
  return (
    <div className={cn(surfaceClass, 'relative flex h-14 items-center gap-2 rounded-lg pr-1.5 pl-4 has-focus-visible:outline-2 has-focus-visible:outline-foreground')}>
      <label htmlFor={id} className="shrink-0 type-body-strong">
        {t('measure.date')}
      </label>
      <span aria-hidden className="min-w-0 flex-1 truncate text-right type-body font-medium tabular-nums">
        {date === today ? t('measure.today', { date: shown }) : shown}
      </span>
      <Icon name="kalendari" size={20} className="mx-2 shrink-0 text-muted-foreground" />
      {/* Fusha e datës mbulon gjithë rreshtin: prekja hap zgjedhësin e telefonit. */}
      <input
        id={id}
        type="date"
        value={date}
        max={today}
        onChange={(event) => {
          if (event.currentTarget.value) onDate(event.currentTarget.value)
        }}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker?.()
          } catch {
            // Disa shfletues e lejojnë vetëm me prekje të drejtpërdrejtë; fusha mbetet e prekshme.
          }
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </div>
  )
}

function WeightCard({
  value,
  live,
  error,
  context,
  date,
  current,
  onChange,
  onStep,
}: {
  value: string
  live: boolean
  error?: string
  context: MeasureContext
  date: string
  current: number | null
  onChange: (value: string) => void
  onStep: (direction: -1 | 1) => void
}) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const id = useId()
  const helpId = useId()
  const errorId = useId()
  const before = context.previous.weight_kg
  const yesterday = before ? isDayBefore(before.date, date) : false
  const when = before ? fmt.date(day(before.date), { weekday: false }) : ''
  const kg = (number: number) => fmt.unit(number, 'kg', { minDigits: 1, maxDigits: 1 })
  const comparison = (() => {
    if (!before || current === null) return null
    const delta = Math.round((current - before.value) * 10) / 10
    if (delta === 0) return yesterday ? t('measure.sameYesterday') : t('measure.sameOn', { date: when })
    const signed = `${signedDecimal(i18n, delta)} kg`
    return yesterday ? t('measure.diffYesterday', { delta: signed }) : t('measure.diffOn', { delta: signed, date: when })
  })()
  const help = before
    ? [comparison, context.average !== null ? t('measure.average', { value: kg(context.average) }) : null].filter(Boolean).join(' · ')
    : t('measure.noWeight')
  return (
    <section className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-xl px-3.5 pt-3.5 pb-3')}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="type-title">
          {t('measure.weight')}
        </label>
        {before ? (
          <span className="type-caption text-muted-foreground tabular-nums">
            {t('measure.previous', { when: yesterday ? t('measure.yesterday') : when, value: kg(before.value) })}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-[64px_minmax(0,1fr)_64px] items-center gap-2">
        <StepButton label={t('ui.stepper.lowerWeight', { step: STEP })} onClick={() => onStep(-1)} large>
          −{fmt.number(STEP)}
        </StepButton>
        <div className="flex flex-col items-center">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${helpId} ${errorId}` : helpId}
            onChange={(event) => onChange(event.currentTarget.value)}
            className={cn(
              'h-[72px] w-full rounded-sm bg-transparent text-center font-display text-[72px] leading-none font-extrabold tracking-[-0.02em] tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-foreground',
              live ? 'text-ember-text' : 'text-foreground',
            )}
          />
          <span aria-hidden className="type-body text-muted-foreground">
            kg
          </span>
        </div>
        <StepButton label={t('ui.stepper.raiseWeight', { step: STEP })} onClick={() => onStep(1)} large>
          +{fmt.number(STEP)}
        </StepButton>
      </div>
      <span id={helpId} className="text-center type-caption text-muted-foreground tabular-nums">
        {help}
      </span>
      {error ? (
        <p id={errorId} role="alert" className="text-center type-caption text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function MetricRow({
  label,
  unit,
  value,
  live,
  error,
  detail,
  onChange,
  onStep,
  top,
}: {
  label: string
  unit: string
  value: string
  live: boolean
  error?: string
  detail: ReactNode
  onChange: (value: string) => void
  onStep: (direction: -1 | 1) => void
  /** Rreshtat e "Më shumë" kanë ndarësin sipër (pas butonit që i hap). */
  top?: boolean
}) {
  const { t, fmt } = useI18n()
  const id = useId()
  const detailId = useId()
  const errorId = useId()
  const step = fmt.number(STEP)
  return (
    <div className={cn('flex flex-col justify-center gap-1 py-2.5', top ? 'border-t border-border' : 'border-b border-border')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <label htmlFor={id} className="type-body-strong">
            {label}
          </label>
          {/* 13 px si te bordi: "1 nëntor 34,4 · pa ndryshim" rri në një rresht pranë fushës. */}
          <span id={detailId} className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">
            {detail}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <StepButton label={t('measure.stepDown', { name: label, step, unit })} onClick={() => onStep(-1)}>
            −
          </StepButton>
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${detailId} ${errorId}` : detailId}
            onChange={(event) => onChange(event.currentTarget.value)}
            className={cn(
              'h-11 w-[76px] rounded-sm border border-border bg-background text-center font-display text-[26px] font-extrabold tabular-nums outline-none focus-visible:border-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground',
              live ? 'text-ember-text' : 'text-foreground',
            )}
          />
          <StepButton label={t('measure.stepUp', { name: label, step, unit })} onClick={() => onStep(1)}>
            +
          </StepButton>
        </span>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="type-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function StepButton({ label, onClick, large, children }: { label: string; onClick: () => void; large?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm bg-surface-2 font-display font-bold text-foreground tabular-nums outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground transition-transform duration-100 ease-out motion-safe:active:scale-[0.97]',
        large ? 'h-14 rounded-md border border-surface-border text-xl' : 'size-11 text-[22px]',
      )}
    >
      {children}
    </button>
  )
}

/** Trupi 3D i prerë te shpatullat, gri, si pamje e vogël pranë tekstit; pa WebGL nuk shfaqet. */
function ModelThumb() {
  const host = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [three] = useState(webglAvailable)
  useEffect(() => {
    const element = host.current
    if (!three || !element) return
    let cancelled = false
    let made: string | null = null
    void import('@/components/body/body-still')
      .then(({ renderBodyStills }) => renderBodyStills(element, [{ paint: () => THUMB }], { width: 148, height: 165 }))
      .then(([still]) => {
        made = still.url
        if (cancelled) URL.revokeObjectURL(still.url)
        else setUrl(still.url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [three])
  if (!three) return null
  return (
    <span ref={host} aria-hidden className={cn(surfaceClass, 'relative h-[72px] w-14 shrink-0 overflow-hidden rounded-md')}>
      {url ? <img src={url} alt="" width={148} height={165} className="absolute -top-0.5 -left-[46px] max-w-none" /> : null}
    </span>
  )
}
