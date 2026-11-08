import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MUSCLE_ROLE } from '@/components/body/roles'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { StatTile } from '@/components/ui/stat-tile'
import { surfaceClass } from '@/components/ui/surface'
import { type WeekDay, WeekStrip } from '@/components/ui/week-strip'
import { store, useLocalQuery } from '@/data/app-data'
import { type TodayView, todayView } from '@/data/today'
import { restartProgram, skipWorkout, startWorkout, type TrainingSnapshot } from '@/data/training'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { facesBack } from '@/body/model-focus'
import { cn } from '@/lib/cn'
import { prepareRestNotifications } from '@/lib/rest-alarm'
import { webglAvailable } from '@/lib/webgl'
import { UpdateNotice } from './app-update'
import { blockText, programDayName, programLabel, targetLine } from './today-format'

// Sot (V2-E1-06, bordi "Sot", pamja energjike): kreu me datën dhe javën e programit, titulli sipas
// grupit kryesor ("Dita e gjoksit"), java kalendarike, karta e stërvitjes me muskujt e saj në 3D dhe
// një veprim prushi ("Fillo stërvitjen" ose "Vazhdo stërvitjen"), dhe proteina e sotme.
// Gjendjet: dita e stërvitjes, dita e pushimit (pa prush: stërvitja e radhës me datën), stërvitja e
// sotme e mbyllur, seanca e hapur, para setit të parë, programi i përfunduar dhe pa program.
// Të bordit që vijnë më vonë, pa të dhëna të shpikura: pllakat "Gati" dhe "Uji" dhe pamja e lodhur
// (Etapa 3: gatishmëria, uji), "A e dije?" (Etapa 3: Mëso), sfida e javës (Etapa 4: miqtë).

const BodyModel = lazy(() => import('@/components/body/body-model'))

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)
const atNoon = (date: string) => new Date(`${date}T12:00:00`)
const noop = () => {}

export function TodayPage() {
  const view = useLocalQuery(() => todayView(store), [])
  const i18n = useI18n()
  const { t } = i18n
  if (!view) {
    return (
      <div className="flex flex-col gap-3.5">
        <h1 className="sr-only">{t('tab.today')}</h1>
        <div aria-hidden className="h-[132px] rounded-lg bg-surface" />
        <div aria-hidden className="h-[276px] rounded-xl bg-surface" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3.5">
      <TodayHeader view={view} />
      {view.mode === 'none' || view.mode === 'completed' ? null : <WeekStrip days={weekDays(view, i18n)} />}
      <UpdateNotice />
      {view.mode === 'none' ? (
        <NoProgramme />
      ) : view.mode === 'completed' ? (
        <ProgrammeCompleted snapshot={view.snapshot!} />
      ) : (
        <>
          <WorkoutCard view={view} />
          <Tiles view={view} />
          {view.mode === 'session' ? null : <SkipWorkout />}
        </>
      )}
    </div>
  )
}

function TodayHeader({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const { mode, snapshot, workout } = view
  const date = capitalize(fmt.date(view.now))
  const plan = snapshot && !snapshot.completed ? snapshot.plan : null
  const eyebrow = plan ? `${date} · ${programLabel(t, plan)}` : date
  const next = view.nextDate ? t('today.subtitle.next', { day: fmt.date(atNoon(view.nextDate)) }) : undefined
  let title: string
  let subtitle: string | undefined
  if (mode === 'none') title = t('tab.today')
  else if (mode === 'completed') {
    title = t('today.completedTitle')
    subtitle = snapshot?.programName
  } else if (mode === 'rest' || mode === 'done') {
    title = t(mode === 'rest' ? 'today.restTitle' : 'today.doneTitle')
    subtitle = next
  } else {
    const group = workout?.focus?.group.id
    title = group ? t(`today.dayOf.${group}` as 'today.dayOf.gjoksi') : t('today.workoutTitle', { day: plan!.dayNumber })
    subtitle =
      mode === 'session'
        ? t('today.subtitle.session')
        : view.firstEver
          ? t('today.subtitle.first')
          : workout?.recovery && workout.recovery !== 'gati'
            ? t('today.subtitle.recovering')
            : t('today.subtitle.ready')
  }
  return <ScreenHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
}

function weekDays(view: TodayView, { t, fmt }: I18n): WeekDay[] {
  return view.week.map((day) => ({
    key: day.date,
    letter: t(`today.weekLetter.${day.weekday}` as 'today.weekLetter.1'),
    name: t('today.weekDay', { weekday: fmt.weekday(atNoon(day.date)), day: String(day.day) }),
    day: day.day,
    state: day.state,
    today: day.today,
  }))
}

function WorkoutCard({ view }: { view: TodayView }) {
  const i18n = useI18n()
  const { t } = i18n
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const { mode, workout } = view
  const plan = view.snapshot!.plan
  if (!workout) return null
  const upcoming = mode === 'rest' || mode === 'done'
  // Te pushimi dhe pas mbylljes kreu e thotë që kjo është stërvitja e radhës, me datën.
  const meta = [
    t('today.workoutTitle', { day: plan.dayNumber }),
    ...(mode === 'session'
      ? [t('today.setsLogged', { done: workout.loggedSets, count: workout.sets })]
      : [t('today.exercises', { count: workout.exercises }), t('today.minutes', { minutes: workout.minutes })]),
  ].join(' · ')
  const model = webglAvailable() && workout.focus !== null
  const action = mode === 'session' ? t('today.resume') : view.firstEver ? t('today.startFirst') : t('today.start')

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
    <section
      aria-label={t(upcoming ? 'today.nextLabel' : 'today.workoutLabel')}
      className={cn(surfaceClass, 'relative flex flex-col overflow-hidden rounded-xl p-4', model && 'min-h-[276px]')}
    >
      {model ? (
        <>
          <WorkoutModel primary={workout.primary} focus={workout.focus!.keys} />
          {/* Teksti mbi model: karta zbehet drejt së tejdukshmes me ngjyrën e vet (DESIGN.md › Rregullat e temave). */}
          <div aria-hidden className="absolute inset-0 bg-linear-to-r from-surface from-40% to-surface/0 to-72%" />
        </>
      ) : null}
      <div className="relative flex flex-1 flex-col gap-2">
        <span className="max-w-[250px] type-caption text-muted-foreground tabular-nums">{meta}</span>
        <h2 className="max-w-[216px] type-display-s">{programDayName(t, plan.dayName)}</h2>
        {workout.first ? <p className="max-w-[190px] type-body text-foreground tabular-nums">{targetLine(i18n, workout.first)}</p> : null}
        {workout.focus && workout.recovery ? (
          <p className="flex items-center gap-1.5 type-caption text-muted-foreground">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', workout.recovery === 'gati' ? 'bg-success' : 'bg-sand')} />
            {t('today.recovery', {
              group: t(`today.group.${workout.focus.group.id}` as 'today.group.gjoksi'),
              status: t(`today.recovery.${workout.recovery}`),
            })}
          </p>
        ) : null}
        <Button
          variant={upcoming ? 'secondary' : 'primary'}
          size="lg"
          className="mt-auto w-full"
          disabled={busy || workout.exercises === 0}
          onClick={() => void start()}
        >
          {action}
        </Button>
      </div>
    </section>
  )
}

/**
 * Modeli 3D i trupit si figurë e kartës (bordi "Sot"): muskujt kryesorë të stërvitjes në prush,
 * kamera te grupi kryesor, i prerë në të djathtë pas tekstit. Vetëm zbukurim: nuk preket dhe nuk
 * lexohet (fjalët e kartës e thonë); tekstet e ngarkimit të modelit nuk shfaqen këtu.
 */
function WorkoutModel({ primary, focus }: { primary: string[]; focus: string[] }) {
  const { t } = useI18n()
  const primaryKey = primary.join(',')
  const keys = useMemo(() => new Set(primaryKey.split(',')), [primaryKey])
  const paint = useCallback((key: string) => (keys.has(key) ? MUSCLE_ROLE.primary.tone : null), [keys])
  return (
    <div aria-hidden className="pointer-events-none absolute -top-1.5 -right-[76px] size-[284px] [&_span]:hidden">
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

/** Pllakat e bordit. Tani proteina e sotme; "Gati" dhe "Uji" zënë vendin e tyre me Etapën 3. */
function Tiles({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const { eatenG, targetG } = view.protein
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile
        label={t('today.protein')}
        value={fmt.unit(eatenG, 'g')}
        ariaLabel={targetG ? t('today.proteinSpokenOf', { count: eatenG, target: targetG }) : t('today.proteinSpoken', { count: eatenG })}
        tone="data"
        onSelect={() => navigate('/ushqimi')}
      />
    </div>
  )
}

/** "Kapërce këtë stërvitje" (SPEC §4): vetëm me dorë, pas konfirmimit në fletë. */
function SkipWorkout() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const open = params.get('veprim') === 'kaperce'
  const close = () => navigate(-1)
  return (
    <>
      <Button variant="ghost" className="self-center text-muted-foreground" onClick={() => setParams({ veprim: 'kaperce' })}>
        {t('today.skip')}
      </Button>
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
  const block = blockText(t, restartFrom.name)
  return (
    <section aria-label={t('today.completedTitle')} className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-4')}>
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
