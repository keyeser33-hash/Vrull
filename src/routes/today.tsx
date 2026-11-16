import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MUSCLE_ROLE } from '@/components/body/roles'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { isTrainingMode, type TodayView, todayView } from '@/data/today'
import { weekGoalsView } from '@/data/weekly-goals'
import { mondayOf } from '@/progress/weekly-goals'
import { setLighterFirstSession } from '@/data/welcome-back'
import { DayLine } from './day-line'
import { MissedDayCard } from './missed-day-card'
import { ReadinessSuggestion } from './readiness-suggestion'
import { useStrengths, useSuggestionPending } from './readiness-suggestion-state'
import { strengthLine } from './readiness-suggestion-text'
import { WeeklyCheckCard } from './weekly-check-card'
import { AiBoxDock } from './ai-box-dock'
import { restartProgram, skipWorkout, type TrainingSnapshot } from '@/data/training'
import type { I18n } from '@/i18n'
import { muscleName, programBlockName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { facesBack } from '@/body/model-focus'
import { localDate, shiftDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import { UpdateNotice } from './app-update'
import { useStartWorkout } from './start-workout'
import { repsText, targetLine } from './today-format'
import { atNoon, capitalize } from './week-format'
import { DayRhythm } from './day-rhythm'
import { ReadinessSheets } from './readiness-sheets'
import { TodayMeters } from './today-meters'
import { TodayStories } from './today-stories'
import { TodayWeek } from './today-week'
import { DAY_PARAM } from './sheet-params'
import { untilText } from './until-text'

// Sot (V57, V63, SPEC §0.3f; bordet "Sot", "Sot · Pushim", "Sot · Diela"): titulli "Sot" me datën dhe javën e programit;
// rrathët e ditës; matësit e drejtpërdrejtë (kalori, proteina, ujë); ritmi i ditës; stërvitja e sotme (me muskujt në 3D),
// ose "Mirë se u ktheve" pas 7 ditësh pa seancë, ose në ditë pushimi stërvitja e radhës si rresht; java me tri pika nën
// datë; kutia e AI-së poshtë. "Fillo stërvitjen" është i vetmi veprim në prush dhe duhet të dukej pa lëvizur faqen në
// 390 × 844. "Kapërce këtë stërvitje" si lidhje e qetë poshtë kartës. Gjendjet e mëparshme mbeten: seanca e hapur,
// pas mbylljes, programi i përfunduar, pa program.

const BodyModel = lazy(() => import('@/components/body/body-model'))

const noop = () => {}

/** Gjithçka e Sot në një lexim, që karta kryesore të mos ndërrohet pas vizatimit të parë. */
async function todayScreen() {
  const view = await todayView(store)
  const open = view.mode !== 'none' && view.mode !== 'completed'
  return { view, goals: open ? await weekGoalsView(store) : null }
}

/** "Tani" e ritmit të ditës ndjek orën: një rilexim në minutë. */
function useMinuteTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 60_000)
    return () => clearInterval(timer)
  }, [])
  return tick
}

export function TodayPage() {
  const tick = useMinuteTick()
  const screen = useLocalQuery(todayScreen, [tick])
  const { t } = useI18n()
  if (!screen) {
    return (
      <div className="flex flex-col gap-3.5">
        <h1 className="sr-only">{t('tab.today')}</h1>
        <div aria-hidden className="h-[132px] rounded-lg bg-surface" />
        <div aria-hidden className="h-[280px] rounded-xl bg-surface" />
      </div>
    )
  }
  const { view, goals } = screen
  const programme = view.mode !== 'none' && view.mode !== 'completed'
  const back = programme ? view.welcomeBack : null
  const upcoming = view.mode === 'rest' || view.mode === 'done' || view.postponed
  return (
    <div className="flex flex-col gap-3.5">
      <TodayHeader view={view} />
      <TodayStories view={view} />
      <TodayMeters view={view} />
      <DayRhythm view={view} />
      {/* Vala e gatishmërisë (V50): secili vend ka skedarin e vet. */}
      <DayLine view={view} />
      <ReadinessSuggestion view={view} />
      <UpdateNotice />
      {back ? null : <MissedDayCard view={view} />}
      <WeeklyCheckCard date={view.date} />
      {view.mode === 'none' ? (
        <NoProgramme />
      ) : view.mode === 'completed' ? (
        <ProgrammeCompleted snapshot={view.snapshot!} />
      ) : back ? (
        <WelcomeBackCard view={view} />
      ) : upcoming && view.mode !== 'session' && !view.postponed ? (
        <NextWorkoutRow view={view} />
      ) : (
        <>
          {/* Stërvitja e shtyrë për nesër (V50): vetëm karta "Ditë pushimi sot" te sugjerimi, si te bordi. */}
          {view.postponed ? null : <WorkoutCard view={view} />}
          {view.mode === 'session' || view.postponed ? null : <SkipWorkout />}
        </>
      )}
      {programme ? <TodayWeek view={view} goals={goals} /> : null}
      <ReadinessSheets view={view} />
      {/* Vendi i kutisë së AI-së mbi tab-bar-in, që pjesa e fundit të mos mbetet poshtë saj. */}
      <div aria-hidden className="h-[76px] shrink-0" />
      <AiBoxDock />
    </div>
  )
}

function TodayHeader({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const { snapshot } = view
  const date = capitalize(fmt.date(view.now))
  const plan = snapshot && !snapshot.completed ? snapshot.plan : null
  return <ScreenHeader title={t('tab.today')} subtitle={<span className="tabular-nums">{plan ? `${date} · ${programWeekLabel(t, plan)}` : date}</span>} />
}

/** Ora dhe dita e stërvitjes që tregon karta: "Sot · 17:15 · Stërvitja 1", "Nesër · 17:15 · Stërvitja 2". */
function whenLine(view: TodayView, { t, fmt }: I18n): string {
  const plan = view.snapshot!.plan
  const workout = t('today.workoutTitle', { day: plan.dayNumber })
  if (isTrainingMode(view)) return [t('today.when.today'), view.trainingTime, workout].join(' · ')
  if (!view.nextDate) return workout
  const tomorrow = view.nextDate === shiftDate(localDate(view.now), 1)
  const when = tomorrow ? t('today.when.tomorrow') : capitalize(fmt.date(atNoon(view.nextDate)))
  return [when, ...(view.nextTime ? [view.nextTime] : []), workout].join(' · ')
}

function WorkoutCard({ view }: { view: TodayView }) {
  const i18n = useI18n()
  const { t } = i18n
  const starter = useStartWorkout()
  const quiet = useSuggestionPending(view)
  const strength = useStrengths(view.date)
  const { mode, workout } = view
  const plan = view.snapshot!.plan
  if (!workout) return null
  const upcoming = mode === 'rest' || mode === 'done'
  const meta = mode === 'session' ? `${whenLine(view, i18n)} · ${t('today.setsLogged', { done: workout.loggedSets, count: workout.sets })}` : whenLine(view, i18n)
  const model = webglAvailable() && workout.focus !== null
  // "Pas 3 orë 30 min" deri në orën e stërvitjes (bordi "Sot"); pas saj pa pilulë.
  const [hours, minutes] = view.trainingTime.split(':').map(Number)
  const wait = hours * 60 + minutes - (view.now.getHours() * 60 + view.now.getMinutes())
  const until = mode === 'train' && wait > 0 ? untilText(t, wait) : null
  const action = mode === 'session' ? t('today.resume') : view.firstEver ? t('today.startFirst') : t('today.start')

  return (
    <>
      <section
        id="sot-workout"
        aria-label={t(upcoming ? 'today.nextLabel' : 'today.workoutLabel')}
        className={cn(surfaceClass, 'relative flex min-h-[280px] shrink-0 scroll-mt-4 flex-col gap-2 overflow-hidden rounded-xl p-4')}
      >
        {model ? (
          <>
            <WorkoutModel primary={workout.primary} focus={workout.focus!.keys} />
            {/* Teksti mbi model: karta zbehet drejt së tejdukshmes me ngjyrën e vet (DESIGN.md › Rregullat e temave). */}
            <div aria-hidden className="absolute inset-0 bg-linear-to-r from-surface from-42% to-surface/0 to-72%" />
            <Link
              to="/progresi/trupi"
              aria-label={t('today.openBody')}
              className="absolute top-0 right-0 h-[190px] w-32 rounded-tr-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
            />
          </>
        ) : null}
        {upcoming ? <p className="relative type-label text-muted-foreground">{t(mode === 'rest' ? 'today.restTitle' : 'today.doneTitle')}</p> : null}
        <span className="relative flex flex-wrap items-center gap-x-2 gap-y-1 type-caption text-muted-foreground tabular-nums">
          {meta}
          {until ? <span className="rounded-pill border border-subtle bg-surface px-2 py-0.5 text-foreground">{t('sot.workout.in', { until })}</span> : null}
        </span>
        <h2 className="relative max-w-[216px] type-display-s">{programDayName(t, plan.dayName)}</h2>
        {mode === 'session' ? null : (
          <span className="relative type-caption text-muted-foreground tabular-nums">
            {t('today.exercises', { count: workout.exercises })} · {t('today.minutes', { minutes: workout.minutes })}
          </span>
        )}
        {workout.first ? <p className="relative max-w-[210px] type-body text-foreground tabular-nums">{targetLine(i18n, workout.first)}</p> : null}
        {workout.focus && workout.recovery ? (
          <p className="relative flex items-center gap-1.5 type-caption text-muted-foreground">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', workout.recovery === 'gati' ? 'bg-success' : 'bg-sand')} />
            {t('today.recovery', {
              group: muscleName(t, workout.focus.group.id),
              status: t(`today.recovery.${workout.recovery}`),
            })}
          </p>
        ) : null}
        {strength && !upcoming ? <p className="relative type-caption text-muted-foreground tabular-nums">{strengthLine(i18n, strength.percent, strength.strengths)}</p> : null}
        <Button variant={upcoming || quiet ? 'secondary' : 'primary'} size="lg" className="relative mt-auto w-full" disabled={workout.exercises === 0} {...starter.buttonProps}>
          {starter.label(action)}
        </Button>
      </section>
      {starter.sheet}
    </>
  )
}

/**
 * "Mirë se u ktheve" (V43, bordi "Kthimi"): pa faj, stërvitja e radhës dhe çelësi "Seanca e parë më e
 * lehtë" (i ndezur), që i jep seancës së parë 90% të peshës së javës; ruhet vetëm në telefon për sot.
 */
function WelcomeBackCard({ view }: { view: TodayView }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const starter = useStartWorkout()
  const [saving, setSaving] = useState(false)
  const back = view.welcomeBack!
  const { workout, mode } = view
  const plan = view.snapshot!.plan
  const today = isTrainingMode(view)
  const first = workout?.first
  const example =
    first && first.weightKg !== null && first.weekKg !== null
      ? t('today.back.lighterExample', { exercise: first.name, weight: fmt.number(first.weightKg), reps: repsText(first.target), week: fmt.number(first.weekKg) })
      : null
  const detail = back.lighter ? (example ?? t('today.back.lighterOn')) : t('today.back.lighterOff')

  return (
    <>
      <section aria-labelledby="today-back" className={cn(surfaceClass, 'relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-xl p-4')}>
        <h2 id="today-back" className="type-display-m">
          {t('today.back.title')}
        </h2>
        <p className="type-body-l text-foreground">{t('today.back.text', { count: back.days })}</p>
        <div className="flex flex-col gap-1">
          <span className="type-caption text-muted-foreground tabular-nums">{whenLine(view, i18n)}</span>
          <span className="type-title">{programDayName(t, plan.dayName)}</span>
          {workout ? (
            <span className="type-caption text-muted-foreground tabular-nums">
              {t('today.exercises', { count: workout.exercises })} · {t('today.minutes', { minutes: workout.minutes })}
            </span>
          ) : null}
        </div>
        <label className="flex min-h-[52px] cursor-pointer items-center gap-3 border-t border-border pt-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-body-strong">{t('today.back.lighter')}</span>
            <span className="type-caption text-muted-foreground tabular-nums">{detail}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={back.lighter}
            disabled={saving}
            onChange={(event) => {
              setSaving(true)
              void setLighterFirstSession(store, event.currentTarget.checked).finally(() => setSaving(false))
            }}
            className="peer sr-only"
          />
          {/* Si çelësat e Cilësimeve: i ndezur në bojë, me dorezën në ngjyrën e kartës (150 ms). */}
          <span
            aria-hidden
            className="flex h-8 w-[52px] shrink-0 items-center rounded-pill border-2 border-muted-foreground p-[3px] transition-colors duration-150 ease-out peer-checked:justify-end peer-checked:border-foreground peer-checked:bg-foreground peer-checked:*:bg-surface"
          >
            <span className="size-5 rounded-pill bg-muted-foreground" />
          </span>
        </label>
        <Button variant={today ? 'primary' : 'secondary'} size="lg" className="w-full" disabled={!workout || workout.exercises === 0} {...starter.buttonProps}>
          {starter.label(mode === 'session' ? t('today.resume') : t('today.start'))}
        </Button>
      </section>
      {starter.sheet}
    </>
  )
}

/**
 * Ditë pushimi ose stërvitja e sotme u bë (bordet "Sot · Pushim", "Sot · Diela"): stërvitja e radhës si rresht me datën,
 * emrin dhe ushtrimet; prekja hap fletën e ditës së saj (vetëm për t'u parë).
 */
function NextWorkoutRow({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const [, setParams] = useSearchParams()
  const { workout, snapshot, nextDate } = view
  if (!snapshot || snapshot.completed || !workout) return null
  const plan = snapshot.plan
  const tomorrow = nextDate === shiftDate(localDate(view.now), 1)
  const sameWeek = !nextDate || mondayOf(nextDate) === mondayOf(localDate(view.now))
  // Java e re e programit nis me stërvitjen e radhës (bordi "Sot · e diel"): peshat e saj që presin vendimin
  // dalin në rresht; brenda të njëjtës javë rreshti mbetet si te "Sot · Pushim".
  const pending = sameWeek ? 0 : view.pendingWeights
  const line = [
    nextDate ? (tomorrow ? t('today.when.tomorrow') : null) : null,
    nextDate ? fmt.date(atNoon(nextDate)) : null,
    sameWeek ? null : t('plan.week', { week: plan.week }),
    t('today.workoutTitle', { day: plan.dayNumber }),
  ]
    .filter(Boolean)
    .join(' · ')
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-caption text-muted-foreground tabular-nums">{capitalize(line)}</span>
        <span className="type-display-s">{programDayName(t, plan.dayName)}</span>
        <span className="type-caption text-muted-foreground tabular-nums">
          {pending > 0
            ? [workout.first ? t('today.repsRange', { reps: repsText(workout.first.target) }) : null, t('today.weightsWaiting', { count: pending })].filter(Boolean).join(' · ')
            : `${t('today.exercises', { count: workout.exercises })} · ${t('today.minutes', { minutes: workout.minutes })}`}
        </span>
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
    </>
  )
  const className = 'flex min-h-row items-center gap-3 border-t border-border pt-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
  // Peshat e reja pret vendimin (bordi "Sot · e diel"): i gjithë rreshti hap peshat e javës.
  if (pending > 0) {
    return (
      <Link to="/programi/peshat" className={className}>
        {body}
      </Link>
    )
  }
  return nextDate ? (
    <button
      type="button"
      className={className}
      onClick={() =>
        setParams((current) => {
          const next = new URLSearchParams(current)
          next.set(DAY_PARAM, nextDate)
          return next
        })
      }
    >
      {body}
    </button>
  ) : (
    <Link to="/programi" className={className}>
      {body}
    </Link>
  )
}

/**
 * Modeli 3D i trupit si figurë e kartës (bordi "Sot"): muskujt kryesorë të stërvitjes në prush,
 * kamera te grupi kryesor, i prerë në të djathtë pas tekstit. Vetëm zbukurim: nuk lexohet (fjalët e
 * kartës e thonë); prekja e tij hap Trupin (lidhja sipër tij). Tekstet e ngarkimit nuk shfaqen këtu.
 */
function WorkoutModel({ primary, focus }: { primary: string[]; focus: string[] }) {
  const { t } = useI18n()
  const primaryKey = primary.join(',')
  const keys = useMemo(() => new Set(primaryKey.split(',')), [primaryKey])
  const paint = useCallback((key: string) => (keys.has(key) ? MUSCLE_ROLE.primary.tone : null), [keys])
  return (
    <div aria-hidden className="pointer-events-none absolute -top-2.5 -right-[76px] size-[276px] [&_span]:hidden">
      <Suspense fallback={null}>
        <BodyModel
          className="h-full"
          paint={paint}
          face={focus}
          focus={focus}
          back={facesBack(focus)}
          onBackChange={noop}
          onPick={noop}
          label={t('today.muscles')}
        />
      </Suspense>
    </div>
  )
}

/** "Kapërce këtë stërvitje" (SPEC §4): lidhje e qetë poshtë kartës, vetëm me dorë, pas konfirmimit në fletë. */
function SkipWorkout() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const open = params.get('veprim') === 'kaperce'
  const close = () => navigate(-1)
  return (
    <>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setParams({ veprim: 'kaperce' })}
          className="-my-2 -ml-2 min-h-touch self-start rounded-md px-2 text-sm font-semibold text-muted-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground"
        >
          {t('today.skip')}
        </button>
        {open ? (
          <Sheet title={t('today.skip')} description={t('today.skipText')} onClose={close}>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void skipWorkout(store)
                    .then(close)
                    .finally(() => setBusy(false))
                }}
              >
                {t('today.skipConfirm')}
              </Button>
            </div>
          </Sheet>
        ) : null}
    </>
  )
}

/** Pas stërvitjes së fundit (SPEC §4): rinis nga Faza 1, ose zgjidh një program tjetër. */
function ProgrammeCompleted({ snapshot }: { snapshot: TrainingSnapshot }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const restartFrom = snapshot.blocks.find((block) => block.position === 1) ?? snapshot.blocks[0]
  const block = programBlockName(t, restartFrom.name)
  return (
    <section aria-labelledby="today-completed" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-4')}>
      <span className="type-caption text-muted-foreground">{snapshot.programName}</span>
      <h2 id="today-completed" className="type-display-s">
        {t('today.completedTitle')}
      </h2>
      <p className="type-body-l text-foreground">{t('today.completedText', { block })}</p>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void restartProgram(store, restartFrom.id).finally(() => setBusy(false))
        }}
      >
        {t('today.restart', { block })}
      </Button>
      <Link to="/programet" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
        {t('today.otherProgramme')}
      </Link>
    </section>
  )
}

function NoProgramme() {
  const { t } = useI18n()
  return (
    <section aria-labelledby="today-no-programme" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-4')}>
      <h2 id="today-no-programme" className="type-display-s">
        {t('today.noProgrammeTitle')}
      </h2>
      <p className="type-body text-muted-foreground">{t('today.noProgrammeText')}</p>
      <Link to="/programet" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
        {t('today.chooseProgramme')}
      </Link>
    </section>
  )
}
