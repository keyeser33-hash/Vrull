import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { baselineKind } from '@/body/body-shape'
import { type BodyTimeline, CHANGE_STEPS, changeLevel, FORECAST, latestUpTo, MUSCLE_ZONE, scalesAt, type StopZone, type TimeStop, weeksBetween, type ZoneBase } from '@/body/body-time'
import type { Tone } from '@/body/model-math'
import { BodyFigure } from '@/components/body/body-figure'
import { Group, SwitchRow } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { PhotoThumb } from '@/components/photos/photo-thumb'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { photos, store, useLocalQuery } from '@/data/app-data'
import { timeView, type TimeView } from '@/data/body'
import { type PhotoDay, type PhotoRef, type Pose, POSES } from '@/data/photos'
import type { I18n } from '@/i18n'
import { programBlockName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import { oneDecimal, signedDecimal } from './body-format'

// Makina e kohës (V52, V2-E3-09; SPEC §11). Modeli 3D rrotullohet në hapësirë dhe lëviz në kohë:
// rrëshqitësi ka një ndalesë për çdo datë me matje, nga baza te matja e fundit, dhe në fund
// parashikimin kur ka mjaft matje (body/body-time.ts). Në çdo ndalesë modeli merr formën e
// perimetrave të asaj dite dhe zonat ngjyrosen sipas ndryshimit nga baza; "Luaj" i kalon ndalesat
// me radhë. Ndryshimet e vërteta janë 1–3%, ndaj "Thekso ndryshimin" e trefishon formën, jo numrat.
// Poshtë: perimetrat e ndalesës, fotoja e asaj dite pranë asaj të fillimit, "Shto matjen e sotme".

const BodyModel = lazy(() => import('@/components/body/body-model'))

/** Sa herë zmadhohet ndryshimi i formës me "Thekso ndryshimin". */
const EMPHASIS = 3
/**
 * Luajtja: një ndalesë çdo 960 ms, me formën në 16 hapa mes dy ndalesave. Pozicioni vjen nga koha e
 * kaluar, jo nga numri i hapave: një telefon i ngadaltë kapërcen hapa të formës, por luajtja zgjat njësoj.
 */
const STOP_MS = 960
const TICK_MS = 60
const STEPS = STOP_MS / TICK_MS

/** Ndryshimi nga baza në tri shkallë të `data`, njësoj te modeli, figura 2D dhe legjenda. */
const LEVELS: Record<1 | 2 | 3, { fill: string; swatch: string; tone: Tone }> = {
  1: { fill: 'fill-data/35', swatch: 'bg-data/35', tone: { token: '--data', alpha: 0.35 } },
  2: { fill: 'fill-data/65', swatch: 'bg-data/65', tone: { token: '--data', alpha: 0.65 } },
  3: { fill: 'fill-data', swatch: 'bg-data', tone: { token: '--data', alpha: 1 } },
}

type MeasureKey = Extract<Parameters<I18n['t']>[0], `bodyModel.measure.${string}`>
const measureName = ({ t }: I18n, id: string) => t(`bodyModel.measure.${id}` as MeasureKey)
const dayText = ({ fmt }: I18n, date: string) => fmt.date(new Date(`${date}T12:00:00`), { weekday: false })
const centimetres = ({ fmt }: I18n, value: number) => fmt.unit(value, 'cm', { minDigits: 1, maxDigits: 1 })
const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ignorePick = () => {}

export function BodyTimePage() {
  const { t } = useI18n()
  const view = useLocalQuery(() => timeView(store), [])
  const days = useLocalQuery(() => photos.timeline(), [])
  const header = (
    <div className="flex flex-col">
      <BackHeader title={t('bodyModel.time.title')} back={t('bodyModel.time.back')} fallback="/progresi/trupi/matjet" />
      <p className="type-caption text-muted-foreground">{t('bodyModel.time.intro')}</p>
    </div>
  )
  const add = (
    <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
      {t('bodyModel.shape.add')}
    </Link>
  )
  if (!view) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <div aria-hidden className="h-[372px] rounded-xl bg-surface" />
      </div>
    )
  }
  if (!view.timeline) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <p className={cn(surfaceClass, 'rounded-xl p-4 type-body-l')}>{t('bodyModel.time.empty')}</p>
        {add}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {header}
      <TimeMachine view={view} timeline={view.timeline} days={days ?? null} />
      {add}
    </div>
  )
}

function TimeMachine({ view, timeline, days }: { view: TimeView; timeline: BodyTimeline; days: PhotoDay[] | null }) {
  const i18n = useI18n()
  const { t } = i18n
  const { stops, base } = timeline
  const last = stops.length - 1
  const today = stops.findLastIndex((stop) => stop.kind === 'measured')
  // Pozicioni në vijë: numër i plotë te një ndalesë, thyesë gjatë luajtjes. Hapet te matja e fundit.
  const [position, setPosition] = useState(today)
  const cursor = useRef(position)
  const [playing, setPlaying] = useState(false)
  const [emphasis, setEmphasis] = useState(false)
  const [back, setBack] = useState(false)
  const [three] = useState(webglAvailable)
  const at = Math.min(position, last)
  const index = Math.round(at)
  const stop = stops[index]
  const forecast = stop.kind === 'forecast'

  const move = (next: number) => {
    cursor.current = next
    setPosition(next)
  }

  useEffect(() => {
    if (!playing) return
    // Me lëvizje të reduktuar forma nuk rrjedh mes ndalesave: kalon nga njëra te tjetra.
    const whole = reducedMotion() ? 1 : STEPS
    const from = cursor.current
    const started = Date.now()
    const timer = setInterval(() => {
      const next = Math.min(from + Math.floor(((Date.now() - started) / STOP_MS) * whole) / whole, last)
      if (next !== cursor.current) {
        cursor.current = next
        setPosition(next)
      }
      if (next >= last) setPlaying(false)
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [playing, last])

  const label = baselineKind(stops[0].date, view.start) === 'start' && view.startLabel ? programBlockName(t, view.startLabel) : t('bodyModel.shape.first')
  const date = dayText(i18n, stop.date)
  const when = forecast ? t('bodyModel.time.ahead', { count: weeksBetween(stops[today].date, stop.date) }) : t('bodyModel.time.since', { count: weeksBetween(stops[0].date, stop.date), label })
  const modelLabel = forecast ? t('bodyModel.time.modelForecast', { date }) : t('bodyModel.time.model', { date })

  const scales = useMemo(() => scalesAt(stops, at, emphasis ? EMPHASIS : 1), [stops, at, emphasis])
  const levelOf = useCallback(
    (keys: string[]) => {
      const zone = keys.map((key) => MUSCLE_ZONE[key]).find(Boolean)
      const entry = zone ? stop.zones.find((item) => item.id === zone) : undefined
      return entry ? changeLevel(entry.ratio) : 0
    },
    [stop],
  )
  const paintKey = useCallback(
    (key: string) => {
      const level = levelOf([key])
      return level ? LEVELS[level].tone : null
    },
    [levelOf],
  )

  return (
    <>
      <section aria-label={modelLabel} className={cn(surfaceClass, 'relative flex shrink-0 flex-col overflow-hidden rounded-xl')}>
        {/* Data rri mbi modelin, jo sipër tij: "27 dhjetor" në display-s arrin deri te koka e trupit. */}
        <p className="flex flex-col gap-1 px-3.5 pt-3">
          <span className="type-display-s tabular-nums">{date}</span>
          <span className={cn('type-caption', forecast ? 'text-data' : 'text-muted-foreground')}>{when}</span>
        </p>
        {three ? (
          <Suspense fallback={<div aria-hidden className="h-[300px]" />}>
            <BodyModel className="h-[300px]" paint={paintKey} onPick={ignorePick} back={back} onBackChange={setBack} shape={scales} label={modelLabel} />
          </Suspense>
        ) : (
          <BodyFigure
            primary={[]}
            scale={2}
            className="h-[300px] justify-center"
            label={modelLabel}
            paint={(keys) => {
              const level = levelOf(keys)
              return level ? LEVELS[level].fill : null
            }}
          />
        )}
        {three ? (
          <button
            type="button"
            onClick={() => setBack(!back)}
            className="absolute right-2.5 bottom-2.5 flex h-11 items-center gap-1.5 rounded-pill border border-subtle bg-background px-3.5 font-display text-[17px] font-bold text-foreground uppercase outline-none focus-visible:outline-2 focus-visible:outline-foreground"
          >
            <Icon name="rrotullo" size={18} />
            {back ? t('bodyModel.turn.front') : t('bodyModel.turn.back')}
          </button>
        ) : null}
      </section>

      <div className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label={playing ? t('bodyModel.time.pause') : t('bodyModel.time.play')}
            onClick={() => {
              if (!playing) move(0)
              setPlaying(!playing)
            }}
            className={buttonVariants({ variant: 'secondary', ground: 'page', size: 'icon' })}
          >
            <Icon name={playing ? 'pauze' : 'luaj'} size={20} />
          </button>
          <div className="relative min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={last}
              step={1}
              value={index}
              onChange={(event) => {
                setPlaying(false)
                move(Number(event.currentTarget.value))
              }}
              aria-label={t('bodyModel.time.slider')}
              aria-valuetext={t('bodyModel.time.stopText', { date: forecast ? `${t('bodyModel.time.forecast')}, ${date}` : date, index: index + 1, total: stops.length })}
              className="time-range block"
            />
            {/* Shenjat e ndalesave nën gjurmë; doreza 28 px lëviz 14 px brenda çdo skaji. */}
            <span aria-hidden className="pointer-events-none absolute inset-x-[14px] bottom-1 h-1.5">
              {stops.map((item, order) => (
                <span
                  key={item.date}
                  className={cn('absolute top-0 h-1.5 w-0.5 -translate-x-1/2 rounded-pill', item.kind === 'forecast' ? 'bg-data' : order <= index ? 'bg-foreground' : 'bg-subtle')}
                  style={{ left: `${(order / last) * 100}%` }}
                />
              ))}
            </span>
          </div>
        </div>
        <p className="flex justify-between gap-3 pl-[54px] type-caption text-muted-foreground tabular-nums">
          <span>{`${label} · ${dayText(i18n, stops[0].date)}`}</span>
          <span className="text-right">{stops[last].kind === 'forecast' ? `${t('bodyModel.time.forecast')} · ${dayText(i18n, stops[last].date)}` : dayText(i18n, stops[last].date)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="type-caption text-muted-foreground">{t('bodyModel.time.legend', { label })}</p>
        <ul aria-label={t('bodyModel.legend')} className="flex flex-wrap gap-x-3 gap-y-1.5 type-caption">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-3 shrink-0 rounded-[3px]', LEVELS[1].swatch)} />
            {t('bodyModel.time.level.low', { low: CHANGE_STEPS[0] })}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-3 shrink-0 rounded-[3px]', LEVELS[2].swatch)} />
            {t('bodyModel.time.level.mid', { low: CHANGE_STEPS[0], high: CHANGE_STEPS[1] })}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-3 shrink-0 rounded-[3px]', LEVELS[3].swatch)} />
            {t('bodyModel.time.level.high', { high: CHANGE_STEPS[1] })}
          </li>
        </ul>
      </div>

      <section aria-labelledby="time-list" className="flex flex-col">
        <h2 id="time-list" className="mb-0.5 type-label text-muted-foreground">
          {t(forecast ? 'bodyModel.time.listForecast' : 'bodyModel.time.list', { date })}
        </h2>
        <ul className="flex flex-col">
          {stop.zones.map((zone) => (
            <ZoneRow key={zone.id} zone={zone} base={base.find((item) => item.id === zone.id)!} stop={stop} />
          ))}
        </ul>
        <p className="pt-2 type-caption text-muted-foreground">
          {forecast
            ? t('bodyModel.time.forecastNote')
            : stops[last].kind === 'forecast'
              ? null
              : t('bodyModel.time.forecastHint', { count: FORECAST.minPoints, weeks: FORECAST.minSpanDays / 7 })}
        </p>
      </section>

      <Group>
        <SwitchRow label={t('bodyModel.time.emphasis')} detail={t('bodyModel.time.emphasisText', { factor: EMPHASIS })} checked={emphasis} onChange={setEmphasis} />
      </Group>

      {days ? <TimePhotos days={days} date={stops[Math.min(index, today)].date} /> : null}
    </>
  )
}

/** Një perimetër në ndalesën e zgjedhur: nga baza te vlera e asaj dite, ose intervali i parashikimit. */
function ZoneRow({ zone, base, stop }: { zone: StopZone; base: ZoneBase; stop: TimeStop }) {
  const i18n = useI18n()
  const { t } = i18n
  const values = t('bodyModel.shape.values', { from: oneDecimal(i18n, base.value), to: centimetres(i18n, zone.value) })
  const detail =
    stop.kind === 'forecast'
      ? zone.range
        ? t('bodyModel.time.range', { low: oneDecimal(i18n, zone.range[0]), high: centimetres(i18n, zone.range[1]) })
        : t('bodyModel.time.kept', { value: centimetres(i18n, zone.value) })
      : zone.measuredOn === stop.date
        ? values
        : t('bodyModel.time.measuredOn', { values, date: dayText(i18n, zone.measuredOn) })
  const delta = `${signedDecimal(i18n, zone.delta)} cm`
  return (
    <li>
      <Link
        to={`/progresi/${base.keys[0]}`}
        className="flex min-h-[50px] items-center justify-between gap-2.5 border-b border-border py-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="flex min-w-0 flex-col">
          <span className="type-body-strong">{measureName(i18n, zone.id)}</span>
          <span className="type-caption text-muted-foreground tabular-nums">{detail}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-display text-[22px] font-bold text-data tabular-nums">{zone.range ? t('bodyModel.time.about', { delta }) : delta}</span>
          <Icon name="hap" size={18} className="text-muted-foreground" />
        </span>
      </Link>
    </li>
  )
}

/**
 * Fotot e progresit në kohë: fotoja e parë e pozës pranë asaj të ndalesës (e fundit deri atë ditë).
 * Pa asnjë foto, një fjali dhe rruga te fotot.
 */
function TimePhotos({ days, date }: { days: PhotoDay[]; date: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const [pose, setPose] = useState<Pose>('front')
  if (days.length === 0) {
    return (
      <section aria-labelledby="time-photos" className="flex flex-col gap-2">
        <h2 id="time-photos" className="type-label text-muted-foreground">
          {t('bodyModel.time.photos')}
        </h2>
        <p className="type-caption text-muted-foreground">{t('bodyModel.time.photosEmpty')}</p>
        <Link to="/progresi/fotot" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
          {t('photos.title')}
        </Link>
      </section>
    )
  }
  const taken = days.flatMap((day) => (day.photos[pose] ? [day.photos[pose]] : []))
  const first = taken.reduce<PhotoRef | undefined>((oldest, photo) => (!oldest || photo.date < oldest.date ? photo : oldest), undefined)
  const current = latestUpTo(taken, date)
  return (
    <section aria-labelledby="time-photos" className="flex flex-col gap-2">
      <h2 id="time-photos" className="type-label text-muted-foreground">
        {t('bodyModel.time.photos')}
      </h2>
      <div role="radiogroup" aria-label={t('bodyModel.time.pose')} className={cn(surfaceClass, 'grid grid-cols-3 gap-1 rounded-[14px] p-1')}>
        {POSES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={pose === value}
            onClick={() => setPose(value)}
            className={cn(
              'h-11 rounded-sm font-display text-lg font-bold uppercase outline-none focus-visible:outline-2 focus-visible:outline-foreground',
              pose === value ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            {t(`photos.pose.${value}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PhotoTile photo={first} caption={first ? t('bodyModel.time.photoStart', { date: dayText(i18n, first.date) }) : null} missing={t('bodyModel.time.photoNone', { date: dayText(i18n, date) })} />
        <PhotoTile photo={current} caption={current ? dayText(i18n, current.date) : null} missing={t('bodyModel.time.photoNone', { date: dayText(i18n, date) })} />
      </div>
    </section>
  )
}

/** Një foto me datën mbi të (`on-ink` mbi `scrim`, si te faqja e fotove); hap foton te faqja e saj. */
function PhotoTile({ photo, caption, missing }: { photo: PhotoRef | undefined; caption: string | null; missing: string }) {
  if (!photo || !caption) {
    return <span className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-subtle p-2 text-center type-caption text-muted-foreground">{missing}</span>
  }
  return (
    <Link
      to={`/progresi/fotot?foto=${photo.id}`}
      aria-label={caption}
      className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <PhotoThumb photo={photo} className="size-full" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 bg-scrim px-2 py-1 text-left text-xs leading-4 font-semibold text-on-ink">
        {caption}
      </span>
    </Link>
  )
}
