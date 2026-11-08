import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type ProgrammeBlock, type ProgrammeDay, type ProgrammeHome, programmeHome } from '@/data/programme'
import { programView, startWorkout } from '@/data/training'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { prepareRestNotifications } from '@/lib/rest-alarm'
import { editorPath } from './editor-nav'
import { blockName, dayShort, dotted, setsText, techniqueName, weekLabel, weekShort } from './programme-format'

// Programi (bordi "Programi", V2-E1-09): programi aktiv me blloqet dhe javët, java e treguesit me
// ditët, stërvitja e radhës me ushtrimin e parë dhe "Fillo stërvitjen" (prushi i vetëm i ekranit), dhe
// rrugët te biblioteka, editori, peshat e javës dhe programet. Datat e ditëve janë parashikim (Q3).

const AUTHORS = { shortcut_to_size: 'Jim Stoppani' } as const

export function ProgramPage() {
  const { t } = useI18n()
  const [now] = useState(() => new Date())
  const home = useLocalQuery(() => programmeHome(store, now), [now])

  if (home === undefined) return <h1 className="sr-only">{t('tab.programme')}</h1>
  if (home === null) {
    return (
      <div className="flex flex-col gap-3">
        <ScreenHeader eyebrow={t('tab.programme')} title={t('programme.noProgramme')} actions={<LibraryButton />} />
        <p className="type-body text-muted-foreground">{t('programme.noProgrammeText')}</p>
        <Link to="/programet" className={cn(buttonVariants({ variant: 'outline' }), 'h-12 justify-between rounded-md px-3.5')}>
          {t('programme.programmes')}
          <Icon name="hap" size={20} />
        </Link>
      </div>
    )
  }

  const author = home.source === 'custom' ? null : AUTHORS[home.source]
  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader
        eyebrow={author ? t('programme.activeBy', { author }) : t('programme.active')}
        title={home.programName}
        actions={
          <>
            <LibraryButton />
            <Link
              to={editorPath(home.programId)}
              aria-label={t('programme.edit')}
              className={buttonVariants({ variant: 'secondary', ground: 'page', size: 'icon', className: 'rounded-md' })}
            >
              <Icon name="laps" size={22} />
            </Link>
          </>
        }
      />
      <Blocks home={home} />
      {home.completed ? (
        <p className="type-body text-muted-foreground">{t('programme.completedText')}</p>
      ) : (
        <WeekDays home={home} now={now} />
      )}
      {home.review ? <WeightsLink review={home.review} /> : null}
      <Link to="/programet" className={cn(buttonVariants({ variant: 'outline' }), 'h-12 justify-between rounded-md px-3.5')}>
        {t('programme.allProgrammes')}
        <Icon name="hap" size={20} />
      </Link>
    </div>
  )
}

function LibraryButton() {
  const { t } = useI18n()
  return (
    <Link
      to="/programi/biblioteka"
      aria-label={t('programme.library')}
      className={buttonVariants({ variant: 'secondary', ground: 'page', size: 'icon', className: 'rounded-md' })}
    >
      <Icon name="libri" size={22} />
    </Link>
  )
}

/** Blloqet si shirita javësh: e bëra me prush, java e tanishme me vijë prushi, të tjerat gjurmë. */
function Blocks({ home }: { home: ProgrammeHome }) {
  const { t } = useI18n()
  const label = home.completed ? t('programme.completed') : weekLabel(t, home.week)
  const spoken = [
    ...home.blocks.map((block) => t('programme.blockDone', { count: block.doneWeeks, block: blockName(t, block.name), total: block.weeks })),
    home.completed ? null : t('programme.now', { label }),
  ]
  return (
    <section aria-label={t('programme.blocks')} className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-lg px-3.5 py-3')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="type-title font-extrabold">{label}</span>
        <span className="type-caption whitespace-nowrap text-muted-foreground tabular-nums">
          {t('programme.weekOf', { current: home.weekNumber, total: home.totalWeeks })}
        </span>
      </div>
      <div
        role="img"
        aria-label={spoken.filter(Boolean).join('. ')}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${home.blocks.length}, minmax(0, 1fr))` }}
      >
        {home.blocks.map((block) => (
          <BlockBar key={block.id} block={block} />
        ))}
      </div>
    </section>
  )
}

function BlockBar({ block }: { block: ProgrammeBlock }) {
  const { t } = useI18n()
  const current = block.currentWeek !== null
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex gap-[3px]">
        {Array.from({ length: block.weeks }, (_, index) => {
          const week = index + 1
          // Javët para treguesit kanë mbaruar (të bëra ose të kapërcyera); radha nuk kthehet pas.
          const done = current ? week < block.currentWeek! : week <= block.doneWeeks
          return (
            <span
              key={week}
              className={cn(
                'h-3 flex-1 rounded-[4px]',
                week === block.currentWeek ? 'border-2 border-ember-text' : done ? 'bg-ember' : 'bg-surface-2',
              )}
            />
          )
        })}
      </div>
      <span className={cn('truncate text-xs leading-4', current ? 'font-bold text-foreground' : 'text-muted-foreground')}>{blockName(t, block.name)}</span>
    </div>
  )
}

function WeekDays({ home, now }: { home: ProgrammeHome; now: Date }) {
  const { t } = useI18n()
  return (
    <section aria-labelledby="program-week" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 pb-0.5">
        <h2 id="program-week" className="type-label text-muted-foreground">
          {t('programme.weekDays', { week: weekShort(t, home.week) })}
        </h2>
        <span className="type-caption text-muted-foreground tabular-nums">{t('programme.doneOf', { done: home.doneDays, total: home.days.length })}</span>
      </div>
      {home.days.map((day) =>
        home.next?.dayId === day.dayId ? <NextWorkout key={day.dayId} home={home} day={day} now={now} /> : <DayRow key={day.dayId} home={home} day={day} />,
      )}
    </section>
  )
}

const dayPath = (home: ProgrammeHome, dayId: string) => `/programi/${home.week.blockId}/${home.week.week}/${dayId}`

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

function NextWorkout({ home, day, now }: { home: ProgrammeHome; day: ProgrammeDay; now: Date }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const next = home.next!
  const first = next.first
  const when = day.date ? (sameDay(day.date, now) ? t('programme.todayOn', { date: fmt.date(day.date) }) : fmt.date(day.date)) : null

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
    <article
      aria-label={`${t('programme.workout', { number: day.dayNumber })}, ${day.name}`}
      className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-3.5')}
    >
      <Link
        to={dayPath(home, day.dayId)}
        aria-label={t('programme.dayLabel', { number: day.dayNumber, name: day.name, when: dotted([when, t('programme.minutes', { minutes: day.minutes })]) })}
        className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-pill border-2 border-ember-text text-sm font-bold tabular-nums">
          {day.dayNumber}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="type-caption text-muted-foreground tabular-nums">{dotted([when, t('programme.minutes', { minutes: day.minutes })])}</span>
          <span className="font-display text-[26px] leading-none font-extrabold uppercase">{day.name}</span>
        </span>
      </Link>
      {first ? (
        <div className="flex flex-col gap-1">
          <span className="type-body-strong tabular-nums">
            {dotted([first.name, setsText(fmt, first.sets, first.target), first.weightKg !== null ? fmt.unit(first.weightKg, 'kg') : null])}
          </span>
          {day.exercises.length > 1 ? (
            <span className="text-sm leading-[1.4] text-muted-foreground">
              {day.exercises.slice(1).map((name, index) => (
                <span key={`${name}-${index}`}>
                  {index > 0 ? ' · ' : null}
                  <span className="whitespace-nowrap">{name}</span>
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      <Button variant="primary" size="lg" className="w-full" disabled={busy || !first} onClick={() => void start()}>
        {next.inProgress ? t('programme.resume') : t('programme.start')}
      </Button>
    </article>
  )
}

function DayRow({ home, day }: { home: ProgrammeHome; day: ProgrammeDay }) {
  const { t, fmt } = useI18n()
  const finished = day.status === 'done' || day.status === 'skipped'
  const when = day.status === 'done' ? t('programme.dayDone') : day.status === 'skipped' ? t('programme.daySkipped') : day.date ? dayShort(fmt, day.date) : null
  return (
    <Link
      to={dayPath(home, day.dayId)}
      aria-label={t('programme.dayLabel', { number: day.dayNumber, name: day.name, when: when ?? '' }).replace(/, $/, '')}
      className={cn(surfaceClass, 'flex min-h-row items-center gap-3 rounded-lg px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
    >
      <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-pill bg-surface-2 text-sm text-muted-foreground tabular-nums">
        {finished ? <Icon name="zgjedhur" size={16} className="text-foreground" /> : day.dayNumber}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex justify-between gap-2">
          <span className="type-body-strong">{day.name}</span>
          {when ? <span className="text-[13px] leading-5 whitespace-nowrap text-muted-foreground">{when}</span> : null}
        </span>
        <span className="truncate text-sm leading-5 text-muted-foreground">{dotted(day.lead)}</span>
      </span>
    </Link>
  )
}

function WeightsLink({ review }: { review: NonNullable<ProgrammeHome['review']> }) {
  const { t } = useI18n()
  return (
    <Link
      to="/programi/peshat"
      className={cn(surfaceClass, 'flex min-h-row items-center gap-3 rounded-lg px-3.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
    >
      <Icon name="rritje" size={22} className="text-ember-text" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-body-strong">{t('programme.weights.title')}</span>
        <span className="type-caption text-muted-foreground">{dotted([weekLabel(t, review.block), t(`programme.weights.${review.status}`)])}</span>
      </span>
      <Icon name="hap" size={20} className="text-muted-foreground" />
    </Link>
  )
}

/** Një stërvitje e programit, në çdo javë: ushtrimet, setet, intervali dhe teknika e setit të fundit. */
export function WorkoutPage() {
  const { t, fmt } = useI18n()
  const { blockId = '', week = '1', dayId = '' } = useParams()
  const view = useLocalQuery(() => programView(store), [])
  if (view === undefined) return <h1 className="sr-only">{t('term.workout')}</h1>
  const entry = view?.overview.weeks.find((candidate) => candidate.blockId === blockId && candidate.week === Number(week))
  const day = entry?.days.find((candidate) => candidate.dayId === dayId)
  if (!view || !entry || !day) {
    return (
      <div className="flex flex-col gap-3">
        <BackHeader title={t('term.workout')} back={t('programme.backToProgramme')} fallback="/programi" />
        <p className="type-body text-muted-foreground">{t('programme.workoutMissing')}</p>
      </div>
    )
  }
  const plan = view.plan(blockId, Number(week), dayId)
  const blockWeeks = view.overview.weeks.filter((candidate) => candidate.blockId === blockId).length
  return (
    <div className="flex flex-col gap-3">
      <BackHeader title={t('programme.workout', { number: day.dayNumber })} back={t('programme.backToProgramme')} fallback="/programi" />
      <p className="-mt-2 type-body text-muted-foreground">{dotted([weekLabel(t, { blockName: entry.blockName, blockWeeks, week: entry.week }), day.name])}</p>
      <ol className={cn(surfaceClass, 'flex flex-col rounded-lg px-3.5')}>
        {plan.slots.map((slot, index) => {
          const exercise = view.exercises[slot.exerciseId]
          const technique = techniqueName(t, slot.technique)
          const query = new URLSearchParams({ blloku: blockId, java: week, dita: dayId, slot: slot.slotId })
          return (
            <li key={slot.slotId} className="border-b border-border last:border-b-0">
              <Link to={`/ushtrimi/${slot.exerciseId}?${query}`} className="flex min-h-row items-center gap-3 py-2 tabular-nums">
                <span className="w-5 type-caption text-muted-foreground">{index + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="type-body-strong">{exercise?.name}</span>
                  <span className="type-caption text-muted-foreground">
                    {dotted([setsText(fmt, slot.sets, slot.target), technique ? t('programme.lastSet', { technique }) : null])}
                  </span>
                </span>
                <Icon name="hap" size={20} className="text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
