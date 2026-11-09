import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MUSCLE_ROLE } from '@/components/body/roles'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { RollingNumber } from '@/components/ui/rolling-number'
import { surfaceClass } from '@/components/ui/surface'
import { type WeekDay, WeekStrip } from '@/components/ui/week-strip'
import { store, useLocalQuery } from '@/data/app-data'
import { type TodayView, todayView } from '@/data/today'
import { type WeekGoalsView, weekGoalsView, type WeekSummary, weekSummary } from '@/data/weekly-goals'
import { setLighterFirstSession } from '@/data/welcome-back'
import { MissedDayCard } from './missed-day-card'
import { WeeklyCheckCard } from './weekly-check-card'
import { WaterCard } from './water-card'
import { AiBoxDock } from './ai-box-dock'
import { restartProgram, skipWorkout, startWorkout, type TrainingSnapshot } from '@/data/training'
import type { I18n } from '@/i18n'
import { mealName, muscleName, programBlockName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { facesBack } from '@/body/model-focus'
import { localDate, shiftDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { prepareRestNotifications } from '@/lib/rest-alarm'
import { webglAvailable } from '@/lib/webgl'
import { UpdateNotice } from './app-update'
import { repsText, targetLine } from './today-format'
import { atNoon, capitalize, goalCells, goalsSpoken, summaryTitle, weekRangeText } from './week-format'
import { useGoalCelebration } from './goal-motion'
import { GoalMeters, GoalMetersShort } from './week-parts'

// Sot (V2-E1-06; pamja e re e 0.23, SPEC §0.3c, bordet "Sot", "Sot · Ditë · EN", "Kthimi", "Sot ·
// Diela"): titulli "Sot" me datën dhe javën e programit; java me rripin e ditëve dhe tre matësit e
// qëllimeve (hapin Qëllimet e javës); një kartë kryesore: stërvitja e sotme (me muskujt në 3D), ose
// "Mirë se u ktheve" pas 7 ditësh pa seancë, ose "Java jote" nga e diela 20:00 deri të hënën kur s'ka
// stërvitje sot (në një të hënë stërvitjeje: stërvitja dhe rreshti "Java N · Shiko"). "Kapërce këtë
// stërvitje" si lidhje e qetë poshtë kartës; ushqimi dhe uji si lista; kutia e AI-së poshtë.
// Gjendjet e mëparshme mbeten: seanca e hapur, pushimi, pas mbylljes, programi i përfunduar, pa program.

const BodyModel = lazy(() => import('@/components/body/body-model'))

const noop = () => {}

/** Gjithçka e Sot në një lexim, që karta kryesore të mos ndërrohet pas vizatimit të parë. */
async function todayScreen() {
  const view = await todayView(store)
  const open = view.mode !== 'none' && view.mode !== 'completed'
  const [goals, summary] = await Promise.all([open ? weekGoalsView(store) : null, open && view.weekCard ? weekSummary(store, view.weekCard) : null])
  return { view, goals, summary }
}

export function TodayPage() {
  const screen = useLocalQuery(todayScreen, [])
  const i18n = useI18n()
  const { t } = i18n
  const navigate = useNavigate()
  if (!screen) {
    return (
      <div className="flex flex-col gap-3.5">
        <h1 className="sr-only">{t('tab.today')}</h1>
        <div aria-hidden className="h-[132px] rounded-lg bg-surface" />
        <div aria-hidden className="h-[276px] rounded-xl bg-surface" />
      </div>
    )
  }
  const { view, goals, summary } = screen
  const programme = view.mode !== 'none' && view.mode !== 'completed'
  const back = programme ? view.welcomeBack : null
  const workoutToday = view.mode === 'train' || view.mode === 'session'
  // "Java jote" zë vendin e kartës kur sot s'ka stërvitje; përndryshe vjen si rresht i shkurtër. Pas
  // pushimit (Mirë se u ktheve) asnjëra: java e kaluar ishte e zbrazët dhe karta e kthimit flet pa faj.
  const weekCard = summary && !back && !workoutToday ? summary : null
  const weekRow = summary && !back && !weekCard ? summary : null
  const openDay = (id: string) => navigate(`/progresi/historiku/${id}`)
  return (
    <div className="flex flex-col gap-3.5">
      <TodayHeader view={view} />
      <UpdateNotice />
      {weekRow ? <WeekRow summary={weekRow} /> : null}
      {programme && goals && !back && !weekCard ? <WeekSection view={view} goals={goals} days={weekDays(view, i18n, openDay)} /> : null}
      {back ? null : <MissedDayCard view={view} />}
      <WeeklyCheckCard date={view.date} />
      {view.mode === 'none' ? (
        <NoProgramme />
      ) : view.mode === 'completed' ? (
        <ProgrammeCompleted snapshot={view.snapshot!} />
      ) : weekCard ? (
        <>
          <WeekCard summary={weekCard} />
          <NextWorkoutRow summary={weekCard} view={view} />
        </>
      ) : back ? (
        <WelcomeBackCard view={view} />
      ) : (
        <>
          <WorkoutCard view={view} />
          {view.mode === 'session' ? null : <SkipWorkout />}
        </>
      )}
      {back && goals ? <WeekSection view={view} goals={goals} fresh /> : null}
      <FoodSection view={view} />
      <WaterCard date={view.date} training={view.trainingDay} />
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

/** Java e bordit; një ditë e bërë hap seancën e saj te historiku. */
function weekDays(view: TodayView, { t, fmt }: I18n, open: (sessionId: string) => void): WeekDay[] {
  return view.week.map((day) => ({
    key: day.date,
    letter: t(`today.weekLetter.${day.weekday}` as 'today.weekLetter.1'),
    name: t('today.weekDay', { weekday: fmt.weekday(atNoon(day.date)), day: String(day.day) }),
    day: day.day,
    state: day.state,
    today: day.today,
    onSelect: day.sessionId ? () => open(day.sessionId!) : undefined,
  }))
}

/**
 * Java (bordi "Sot"): "Java N" me lidhjen "Qëllimet", rripi i ditëve dhe tre matësit që hapin Qëllimet
 * e javës. Pas pushimit (bordi "Kthimi") vjen pas kartës si "Java e re", pa rripin, me ditën rezervë.
 */
function WeekSection({ view, goals, days, fresh = false }: { view: TodayView; goals: WeekGoalsView; days?: WeekDay[]; fresh?: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const plan = view.snapshot!.plan
  const cells = goalCells(i18n, goals)
  const celebrate = useGoalCelebration(goals.monday, cells.filter((cell) => cell.met).map((cell) => cell.key))
  const title = fresh ? t('today.week.fresh') : t('plan.week', { week: plan.week })
  const spare = goals.spare
  return (
    <section aria-labelledby="today-week" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="today-week" className="type-label text-muted-foreground">
          {title}
        </h2>
        <Link to="/sot/java" className="-my-3 -mr-2 flex min-h-12 items-center gap-1 rounded-md px-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-foreground">
          {t('today.week.goals')}
          <Icon name="hap" size={16} />
        </Link>
      </div>
      {days ? <WeekStrip days={days} /> : null}
      <GoalMeters cells={cells} to="/sot/java" label={goalsSpoken(i18n, cells, goals.complete)} celebrate={celebrate} />
      {fresh && spare && !spare.used ? <span className="type-caption text-muted-foreground">{t('week.spare.blockFree', { block: programBlockName(t, spare.blockName) })}</span> : null}
    </section>
  )
}

/** Ora dhe dita e stërvitjes që tregon karta: "Sot · 17:15 · Stërvitja 1", "Nesër · 17:15 · Stërvitja 2". */
function whenLine(view: TodayView, { t, fmt }: I18n): string {
  const plan = view.snapshot!.plan
  const workout = t('today.workoutTitle', { day: plan.dayNumber })
  if (view.mode === 'train' || view.mode === 'session') return [t('today.when.today'), view.trainingTime, workout].join(' · ')
  if (!view.nextDate) return workout
  const tomorrow = view.nextDate === shiftDate(localDate(view.now), 1)
  const when = tomorrow ? t('today.when.tomorrow') : capitalize(fmt.date(atNoon(view.nextDate)))
  return [when, ...(view.nextTime ? [view.nextTime] : []), workout].join(' · ')
}

function useStart() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
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
  return { busy, start }
}

function WorkoutCard({ view }: { view: TodayView }) {
  const i18n = useI18n()
  const { t } = i18n
  const { busy, start } = useStart()
  const { mode, workout } = view
  const plan = view.snapshot!.plan
  if (!workout) return null
  const upcoming = mode === 'rest' || mode === 'done'
  const meta = mode === 'session' ? `${whenLine(view, i18n)} · ${t('today.setsLogged', { done: workout.loggedSets, count: workout.sets })}` : whenLine(view, i18n)
  const model = webglAvailable() && workout.focus !== null
  const action = mode === 'session' ? t('today.resume') : view.firstEver ? t('today.startFirst') : t('today.start')

  return (
    <section
      aria-label={t(upcoming ? 'today.nextLabel' : 'today.workoutLabel')}
      className={cn(surfaceClass, 'relative flex shrink-0 flex-col gap-2 overflow-hidden rounded-xl p-4', model && 'min-h-[262px]')}
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
      <span className="relative max-w-[250px] type-caption text-muted-foreground tabular-nums">{meta}</span>
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
      <Button variant={upcoming ? 'secondary' : 'primary'} size="lg" className="relative mt-auto w-full" disabled={busy || workout.exercises === 0} onClick={() => void start()}>
        {action}
      </Button>
    </section>
  )
}

/**
 * "Mirë se u ktheve" (V43, bordi "Kthimi"): pa faj, stërvitja e radhës dhe çelësi "Seanca e parë më e
 * lehtë" (i ndezur), që i jep seancës së parë 90% të peshës së javës; ruhet vetëm në telefon për sot.
 */
function WelcomeBackCard({ view }: { view: TodayView }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const { busy, start } = useStart()
  const [saving, setSaving] = useState(false)
  const back = view.welcomeBack!
  const { workout, mode } = view
  const plan = view.snapshot!.plan
  const today = mode === 'train' || mode === 'session'
  const first = workout?.first
  const example =
    first && first.weightKg !== null && first.weekKg !== null
      ? t('today.back.lighterExample', { exercise: first.name, weight: fmt.number(first.weightKg), reps: repsText(first.target), week: fmt.number(first.weekKg) })
      : null
  const detail = back.lighter ? (example ?? t('today.back.lighterOn')) : t('today.back.lighterOff')

  return (
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
      <Button variant={today ? 'primary' : 'secondary'} size="lg" className="w-full" disabled={busy || !workout || workout.exercises === 0} onClick={() => void start()}>
        {mode === 'session' ? t('today.resume') : t('today.start')}
      </Button>
    </section>
  )
}

/**
 * "Java jote" (V43, bordi "Sot · Diela"): nga e diela 20:00 deri të hënën, kur sot s'ka stërvitje. Qëllimet
 * e shkurtra, rekordet, vargu dhe "Shiko javën" (prushi i ekranit).
 */
function WeekCard({ summary }: { summary: WeekSummary }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const cells = goalCells(i18n, summary.goals, !!summary.spare)
  const top = summary.training.records.top[0]
  return (
    <section aria-labelledby="today-week-card" className={cn(surfaceClass, 'relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-xl p-4')}>
      <span aria-hidden className="pointer-events-none absolute top-0 right-0 h-[130px] w-[150px] bg-speed-lines" />
      <span className="relative type-caption text-muted-foreground tabular-nums">
        {t('week.yours')} · {weekRangeText(i18n, summary.monday)}
      </span>
      <h2 id="today-week-card" className="relative -mt-1.5 type-display-m">
        {summaryTitle(i18n, summary)}
      </h2>
      <GoalMetersShort cells={cells} label={goalsSpoken(i18n, cells, summary.goals.complete)} />
      <ul className="relative m-0 flex list-none flex-col p-0 text-[15px]">
        {summary.training.records.count > 0 ? (
          <li className="flex min-h-10 items-center justify-between gap-2 border-t border-border">
            <span>{t('week.summary.records.count', { count: summary.training.records.count })}</span>
            {top ? (
              <span className="truncate text-muted-foreground tabular-nums">{t('week.summary.topRecord', { exercise: top.name, kg: fmt.unit(top.e1rmKg, 'kg', { maxDigits: 1 }) })}</span>
            ) : null}
          </li>
        ) : null}
        <li className="flex min-h-10 items-center justify-between gap-2 border-y border-border">
          <span>{t('week.summary.streak')}</span>
          <span className="text-muted-foreground tabular-nums">{t('week.summary.streakValue', { count: summary.streak })}</span>
        </li>
        {/* ARRITJA E RE (V2-E2-21, agjenti i arritjeve): rreshti "Arritje e re · <emri>" vjen këtu, kur
            arritja u dha këtë javë; orkestruesi e lidh me API-në e arritjeve. */}
      </ul>
      <Link to={`/progresi/java/${summary.monday}`} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'relative w-full')}>
        {t('week.summary.see')}
      </Link>
    </section>
  )
}

/** Rreshti i shkurtër i javës kur sot ka stërvitje (e hëna): "Java 2 · 2–8 nëntor · Shiko". */
function WeekRow({ summary }: { summary: WeekSummary }) {
  const i18n = useI18n()
  const { t } = i18n
  const range = weekRangeText(i18n, summary.monday)
  const week = summary.programWeek ? t('plan.week', { week: summary.programWeek.week }) : t('week.yours')
  return (
    <Link
      to={`/progresi/java/${summary.monday}`}
      aria-label={t('week.summary.seeLabel', { range })}
      className={cn(surfaceClass, 'flex min-h-row items-center gap-3 rounded-lg py-2 pr-3 pl-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-body-strong">{summaryTitle(i18n, summary)}</span>
        <span className="type-caption text-muted-foreground tabular-nums">
          {week} · {range}
        </span>
      </span>
      <span className="text-sm font-semibold">{t('week.summary.seeShort')}</span>
      <Icon name="hap" size={18} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** Stërvitja e radhës pas kartës "Java jote": "Nesër · 17:15 · Java 4 · Stërvitja 1". */
function NextWorkoutRow({ summary, view }: { summary: WeekSummary; view: TodayView }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const next = summary.next
  if (!next) return null
  const tomorrow = next.date === shiftDate(localDate(view.now), 1)
  const when = !next.date ? null : next.date === localDate(view.now) ? t('today.when.today') : tomorrow ? t('today.when.tomorrow') : capitalize(fmt.date(atNoon(next.date)))
  const line = [when, next.time, programWeekLabel(t, next.plan), t('today.workoutTitle', { day: next.plan.dayNumber })].filter(Boolean).join(' · ')
  return (
    <Link to="/programi" className="flex min-h-row items-center gap-3 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-caption text-muted-foreground tabular-nums">{line}</span>
        <span className="type-title">{programDayName(t, next.plan.dayName)}</span>
        <span className="type-caption text-muted-foreground tabular-nums">
          {t('today.exercises', { count: next.plan.slots.length })} · {t('today.minutes', { minutes: next.minutes })}
        </span>
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
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

/** Ushqimi si listë (bordi "Sot"): kaloritë dhe proteina kundrejt objektivave, vakti i radhës; hap Ushqimin. */
function FoodSection({ view }: { view: TodayView }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const { kcal, targetKcal, proteinG, targetProteinG, next } = view.food
  const spoken =
    targetKcal !== null && targetProteinG !== null
      ? t('today.food.spoken', { kcal: fmt.number(kcal), target: fmt.number(targetKcal), protein: fmt.number(proteinG), proteinTarget: fmt.number(targetProteinG) })
      : t('today.food.spokenNoTarget', { kcal: fmt.number(kcal), protein: fmt.number(proteinG) })
  return (
    <Link
      to="/ushqimi"
      aria-label={spoken}
      className="flex flex-col gap-2.5 border-t border-border pt-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="type-label text-muted-foreground">{t('today.food.title')}</span>
        {next ? <span className="truncate type-caption text-muted-foreground tabular-nums">{t('today.food.next', { meal: mealName(t, next.meal), time: next.time })}</span> : null}
      </span>
      <span className="grid grid-cols-2 gap-4">
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="font-display text-[28px] leading-none font-extrabold whitespace-nowrap tabular-nums">
            <RollingNumber value={kcal} />
            <span className="font-text text-sm font-normal text-muted-foreground"> {targetKcal === null ? t('today.food.kcal') : t('today.food.kcalOf', { target: fmt.number(targetKcal) })}</span>
          </span>
          {targetKcal ? <ProgressTrack ratio={kcal / targetKcal} ground="page" /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="font-display text-[28px] leading-none font-extrabold whitespace-nowrap tabular-nums">
            <RollingNumber value={proteinG} />
            <span className="font-text text-sm font-normal text-muted-foreground">
              {' '}
              {targetProteinG === null ? t('today.food.protein') : t('today.food.proteinOf', { target: fmt.number(targetProteinG) })}
            </span>
          </span>
          {targetProteinG ? <ProgressTrack ratio={proteinG / targetProteinG} ground="page" /> : null}
        </span>
      </span>
    </Link>
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
