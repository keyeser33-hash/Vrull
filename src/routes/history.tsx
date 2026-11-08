import { type FormEvent, useId, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { ExercisePhoto } from '@/components/ui/exercise-photo'
import { Icon } from '@/components/ui/icons'
import { RirPicker } from '@/components/ui/rir-picker'
import { Stepper } from '@/components/ui/stepper'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import {
  editSet,
  type HistoryOverview,
  historyOverview,
  type HistorySession,
  type HistoryWeek,
  type PastExercise,
  type PastSession,
  pastSession,
  type PastSet,
} from '@/data/history'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { weightStep } from '@/program/loads'
import { monthMarks, previewEdit } from '@/progress/history'
import {
  capitalize,
  dayDate,
  dayNameText,
  durationParts,
  durationText,
  kg1,
  listText,
  monthName,
  monthTitle,
  segmentsText,
  sessionDateText,
  setsSummary,
  setText,
  spokenDuration,
  summaryText,
  weekLabel,
} from './history-format'
import { dayThemeName, muscleName } from '@/i18n/domain'

// Historiku (V2-E1-15; bordet "Hist-Seancat" dhe "Hist-Seanca"), brenda Progresit: seancat sipas
// javës së programit me kalendarin e muajit, dhe seanca e kaluar me setet, rekordet dhe volumin.
// "Ndrysho një set" i bën setet të prekshme; fleta e setit ruan ndryshimin në telefon (sinkronizohet
// më vonë) dhe e1RM-ja, rekordet dhe peshat e sugjeruara rillogariten nga setet. "Ndaj kartën" e
// bordit vjen me kartat e Etapës 4 (V26) dhe mungon deri atëherë; fotot e ushtrimeve vijnë me
// faqen e ushtrimit (E1-09): deri atëherë vend-mbajtësi "Pa foto" (DESIGN.md › Fotot).

const monthKey = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`
const parseMonth = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return { year, monthIndex: month - 1 }
}
const shiftMonth = (key: string, by: number) => {
  const { year, monthIndex } = parseMonth(key)
  const at = new Date(year, monthIndex + by, 1)
  return monthKey(at.getFullYear(), at.getMonth())
}

export function HistoryPage() {
  const { t, fmt } = useI18n()
  const overview = useLocalQuery(() => historyOverview(store), [])
  const [today] = useState(() => localDate(new Date()))
  const header = <BackHeader title={t('history.title')} back={t('body.backToProgress')} fallback="/progresi" />
  if (!overview) {
    return (
      <div className="flex flex-col gap-3.5">
        {header}
        <div aria-hidden className="h-40 rounded-lg bg-surface" />
      </div>
    )
  }
  if (overview.total === 0) {
    return (
      <div className="flex flex-col gap-3.5">
        {header}
        <div className="flex flex-col gap-3">
          <h2 className="type-display-l">{t('history.emptyTitle')}</h2>
          <p className="type-body text-muted-foreground">{t('history.emptyText')}</p>
        </div>
      </div>
    )
  }
  const since = fmt.date(dayDate(overview.first!), { weekday: false })
  const subtitle = overview.programName
    ? t('history.subtitle', { programme: overview.programName, count: overview.total, date: since })
    : t('history.subtitleNoProgramme', { count: overview.total, date: since })
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col">
        {header}
        <span className="-mt-1 type-caption text-muted-foreground tabular-nums">{subtitle}</span>
      </div>
      <MonthCard overview={overview} today={today} />
      {overview.weeks.map((week) => (
        <WeekSection key={week.key} week={week} today={today} activeProgram={overview.programName} />
      ))}
    </div>
  )
}

/** Kalendari i muajit: një shirit për ditë (seancë, pushim, ditët që vijnë), sot me unazë. */
function MonthCard({ overview, today }: { overview: HistoryOverview; today: string }) {
  const { t, fmt, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const titleId = useId()
  const current = today.slice(0, 7)
  const first = (overview.first ?? today).slice(0, 7)
  const asked = params.get('muaji')
  const month = asked && /^\d{4}-\d{2}$/.test(asked) && asked >= first && asked <= current ? asked : current
  const { year, monthIndex } = parseMonth(month)
  const dates = Object.keys(overview.byDate).filter((date) => date.startsWith(month))
  const marks = monthMarks(year, monthIndex, new Set(dates), today, overview.weekStart)
  const records = dates.reduce((total, date) => total + overview.byDate[date].records, 0)
  const sessions = dates.reduce((total, date) => total + overview.byDate[date].sessions, 0)
  const name = (key: string) => {
    const at = parseMonth(key)
    return monthName(fmt, at.year, at.monthIndex)
  }
  const days = marks.filter((mark) => mark.kind === 'session').map((mark) => fmt.number(mark.day))
  const spoken = [
    days.length ? t('history.calendar.sessions', { days: `${listText(t, days)} ${name(month)}` }) : t('history.calendar.none'),
    ...(today.startsWith(month) ? [t('history.calendar.today', { date: fmt.date(dayDate(today), { weekday: false }) })] : []),
  ].join('; ')
  const go = (key: string) => setParams({ muaji: key }, { replace: true })

  return (
    <section aria-labelledby={titleId} className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg pt-1 pr-1.5 pb-3 pl-3.5')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 id={titleId} className="type-title">
            {monthTitle(fmt, lang, year, monthIndex)}
          </h2>
          <span className="type-caption text-muted-foreground tabular-nums">{`${t('history.sessions', { count: sessions })} · ${t('history.records', { count: records })}`}</span>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" className="rounded-pill" aria-label={t('history.previousMonth', { month: name(shiftMonth(month, -1)) })} disabled={month <= first} onClick={() => go(shiftMonth(month, -1))}>
            <Icon name="mbrapa" size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-pill" aria-label={t('history.nextMonth', { month: name(shiftMonth(month, 1)) })} disabled={month >= current} onClick={() => go(shiftMonth(month, 1))}>
            <Icon name="hap" size={20} />
          </Button>
        </div>
      </div>
      <div role="img" aria-label={`${capitalize(name(month), lang)}: ${spoken}`} className="flex flex-col gap-1.5 pr-2">
        <div className="flex h-8 items-end gap-[3px]">
          {marks.map((mark) => (
            <span
              key={mark.date}
              className={cn(
                'min-w-0 flex-1 rounded-[3px]',
                mark.kind === 'session' && 'h-7 bg-ember',
                mark.kind === 'rest' && 'h-2 bg-subtle',
                mark.kind === 'future' && 'h-2 border border-subtle',
                mark.today && 'outline-2 outline-offset-2 outline-foreground',
              )}
            />
          ))}
        </div>
        <div aria-hidden className="flex gap-[3px]">
          {marks.map((mark) => (
            <span key={mark.date} className={cn('min-w-0 flex-1 overflow-visible text-xs whitespace-nowrap tabular-nums', mark.today ? 'font-bold text-foreground' : 'text-muted-foreground')}>
              {mark.weekStart ? fmt.number(mark.day) : ''}
            </span>
          ))}
        </div>
      </div>
      <div aria-hidden className="flex flex-wrap gap-x-3.5 gap-y-1 pr-2 text-[13px] leading-[1.35] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-2 rounded-[2px] bg-ember" />
          {t('history.legend.session')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-2 rounded-[2px] bg-subtle" />
          {t('history.legend.rest')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-2 rounded-[2px] bg-ember outline-2 outline-offset-1 outline-foreground" />
          {t('history.legend.today')}
        </span>
        <span>{t(`history.weekStart.${overview.weekStart}` as 'history.weekStart.0')}</span>
      </div>
    </section>
  )
}

function WeekSection({ week, today, activeProgram }: { week: HistoryWeek; today: string; activeProgram: string | null }) {
  const { t } = useI18n()
  const id = useId()
  const label = weekLabel(t, week)
  const title = week.programName && week.programName !== activeProgram ? `${week.programName} · ${label}` : label
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 pb-0.5">
        <h2 id={id} className="type-label text-muted-foreground">
          {title}
        </h2>
        {week.days > 0 ? <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{t('history.weekDone', { done: week.done, total: week.days })}</span> : null}
      </div>
      <ul className="flex flex-col border-t border-border">
        {week.sessions.map((session) => (
          <li key={session.id} className="border-b border-border last:border-b-0">
            <SessionLink session={session} today={today} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function SessionLink({ session, today }: { session: HistorySession; today: string }) {
  const { t, fmt, lang } = useI18n()
  const date = sessionDateText(t, fmt, lang, session.date, today)
  const name = dayNameText(t, session.dayName)
  const lines = session.records.map((record) => t('history.recordLine', { name: record.name, value: fmt.unit(record.e1rmKg, 'kg', { minDigits: 1, maxDigits: 1 }) }))
  const spoken = [
    date,
    session.dayNumber ? t('history.workout', { n: session.dayNumber }) : null,
    name ? name.toLocaleLowerCase(lang) : null,
    session.minutes === null ? null : spokenDuration(t, session.minutes),
    t('history.setsCount', { count: session.workSets }),
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <Link
      to={`/progresi/historiku/${session.id}`}
      aria-label={lines.length ? `${spoken}. ${lines.join('. ')}` : spoken}
      className="flex min-h-[62px] items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-mark font-display text-lg font-bold tabular-nums">
        {session.dayNumber ?? '–'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 type-body-strong">{name || t('history.workout', { n: session.dayNumber ?? 1 })}</span>
          {session.minutes === null ? null : <span className="shrink-0 type-caption text-muted-foreground tabular-nums">{durationText(t, session.minutes)}</span>}
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 type-caption text-muted-foreground">{date}</span>
          <span className="shrink-0 type-caption text-muted-foreground tabular-nums">{t('history.setsCount', { count: session.workSets })}</span>
        </span>
        {lines.map((line) => (
          <span key={line} className="mt-0.5 flex items-center gap-1.5 text-sm leading-[1.35] font-semibold">
            <Icon name="kupa" size={16} className="text-ember-text" />
            {line}
          </span>
        ))}
      </span>
      <Icon name="hap" size={18} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

// ---------------------------------------------------------------------------------------------
// Seanca e kaluar.

export function PastSessionPage() {
  const { sessionId = '' } = useParams()
  const { t } = useI18n()
  const session = useLocalQuery(() => pastSession(store, sessionId), [sessionId])
  if (session === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <BackHeader title={t('history.title')} back={t('history.backToHistory')} fallback="/progresi/historiku" />
        <div aria-hidden className="h-40 rounded-lg bg-surface" />
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="flex flex-col gap-3">
        <BackHeader title={t('history.title')} back={t('history.backToHistory')} fallback="/progresi/historiku" />
        <p className="type-body text-muted-foreground">{t('history.notFound')}</p>
      </div>
    )
  }
  return <PastSessionView session={session} />
}

function PastSessionView({ session }: { session: PastSession }) {
  const { t, fmt, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const editing = params.get('ndrysho') === '1'
  const openSetId = params.get('seti')
  const exercisesId = useId()

  const title = session.theme ? dayThemeName(t, session.theme) : t('history.workout', { n: session.dayNumber ?? 1 })
  const name = dayNameText(t, session.dayName)
  const label = weekLabel(t, session)
  const planLine = session.dayNumber && name ? t('history.planLine', { label, n: session.dayNumber, name: name.toLocaleLowerCase(lang) }) : label
  const duration = session.minutes === null ? null : durationParts(t, session.minutes)

  // Ushtrimi me rekordin më të madh hapet si kartë "Rekord i ri" (një në ekran); të tjerët me radhë.
  const featured = session.exercises
    .filter((exercise) => exercise.record)
    .reduce<PastExercise | null>((top, exercise) => (top && top.record!.gainKg >= exercise.record!.gainKg ? top : exercise), null)
  const others = session.exercises.filter((exercise) => exercise !== featured)

  const openSet = openSetId ? session.exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set }))).find((entry) => entry.set.id === openSetId) : undefined
  // Mënyra e ndryshimit dhe fleta hyjnë në histori, që butoni mbrapa i Android-it t'i mbyllë një nga një;
  // "Mbaro" dhe "Mbyll" kthehen mbrapa, përveç kur faqja u hap drejt me parametrin.
  const closeSheet = () => (location.key === 'default' ? setParams({ ndrysho: '1' }, { replace: true }) : navigate(-1))
  const toggleEditing = () => {
    if (!editing) setParams({ ndrysho: '1' })
    else if (location.key === 'default') setParams({}, { replace: true })
    else navigate(-1)
  }
  const pick = (set: PastSet) => setParams({ ndrysho: '1', seti: set.id })

  return (
    <div className="flex flex-col gap-3">
      <BackHeader title={title} back={t('history.backToHistory')} fallback="/progresi/historiku" />
      <div className="-mt-2 flex flex-col gap-px">
        <span className="type-body-strong">{capitalize(fmt.date(dayDate(session.date), { year: true }), lang)}</span>
        <span className="type-caption text-muted-foreground">{planLine}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile
          label={t('history.duration')}
          value={duration?.value ?? '–'}
          unit={duration?.unit}
          spoken={session.minutes === null ? t('history.noDuration') : t('history.durationSpoken', { duration: spokenDuration(t, session.minutes) })}
        />
        <Tile label={t('history.workSets')} value={fmt.number(session.workSets)} spoken={t('history.workSetsSpoken', { count: session.workSets })} />
        <Tile label={t('history.recordsTile')} value={fmt.number(session.recordsCount)} spoken={t('history.records', { count: session.recordsCount })} />
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="outline" size="lg" className="w-full" onClick={toggleEditing} aria-describedby={`${exercisesId}-hint`}>
          {editing ? <Icon name="zgjedhur" size={20} /> : <Icon name="edito" size={20} />}
          {editing ? t('history.editDone') : t('history.editSet')}
        </Button>
        <p id={`${exercisesId}-hint`} className="type-caption text-muted-foreground">
          {editing ? t('history.editPick') : t('history.editHint')}
        </p>
      </div>

      {session.volume.length > 0 ? <VolumeCard session={session} /> : null}

      <section aria-labelledby={exercisesId} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={exercisesId} className="shrink-0 type-label text-muted-foreground">
            {t('history.exercises', { count: session.exercises.length })}
          </h2>
          <span className="min-w-0 text-right text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{summaryText(t, fmt, lang, session.summary)}</span>
        </div>
        {featured ? <RecordCard exercise={featured} editing={editing} onPick={pick} /> : null}
        <ul aria-label={featured ? t('history.otherExercises') : undefined} className={cn('flex flex-col', editing && 'gap-2')}>
          {others.map((exercise) =>
            editing ? (
              <li key={exercise.exerciseId} className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-lg px-3.5 pt-3 pb-1.5')}>
                <ExerciseHeader exercise={exercise} />
                <SetList exercise={exercise} editing onPick={pick} divider="border-border" />
              </li>
            ) : (
              <ExerciseRow key={exercise.exerciseId} exercise={exercise} />
            ),
          )}
        </ul>
      </section>

      {openSet ? <EditSetSheet key={openSet.set.id} session={session} exercise={openSet.exercise} set={openSet.set} onClose={closeSheet} /> : null}
    </div>
  )
}

/** Pllaka e numrit: etiketa sipër, numri 36 px me njësinë e vogël anash. */
function Tile({ label, value, unit, spoken }: { label: string; value: string; unit?: string; spoken: string }) {
  return (
    <div role="group" aria-label={spoken} className={cn(surfaceClass, 'flex min-w-0 flex-col gap-0.5 rounded-lg p-3')}>
      <span aria-hidden className="truncate text-[13px] leading-[1.35] text-muted-foreground">
        {label}
      </span>
      <span aria-hidden className="flex items-baseline gap-1">
        <span className="font-display text-4xl leading-none font-extrabold whitespace-nowrap tabular-nums">{value}</span>
        {unit ? <span className="text-[13px] text-muted-foreground">{unit}</span> : null}
      </span>
    </div>
  )
}

function VolumeCard({ session }: { session: PastSession }) {
  const { t, fmt } = useI18n()
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-lg px-3.5 py-3')}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="type-title">
          {t('history.volume')}
        </h2>
        <span className="text-[13px] text-muted-foreground">{t('history.volumeRule')}</span>
      </div>
      <dl className="grid grid-cols-4 gap-2">
        {session.volume.slice(0, 4).map((entry) => (
          <div key={entry.groupId} className="flex min-w-0 flex-col-reverse gap-0.5">
            <dt className="truncate text-[13px] text-muted-foreground">{muscleName(t, entry.groupId)}</dt>
            <dd className="font-display text-3xl leading-none font-extrabold tabular-nums">{fmt.number(entry.sets)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function E1rmValue({ value, size }: { value: number | null; size: 'l' | 'm' }) {
  const { t, fmt } = useI18n()
  if (value === null) return <span className="shrink-0 type-caption text-muted-foreground">{t('history.noE1rm')}</span>
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className={size === 'l' ? 'type-display-s tabular-nums' : 'font-display text-[22px] leading-none font-bold tabular-nums'}>{kg1(fmt, value)}</span>
      <span className="text-xs text-muted-foreground">{t('history.e1rmKg')}</span>
    </span>
  )
}

function ExerciseHeader({ exercise }: { exercise: PastExercise }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3">
      <ExercisePhoto libraryId={exercise.libraryId} size="square" ground="card" />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <h3 className="min-w-0 truncate type-body-strong">{exercise.name}</h3>
        {exercise.record ? <Icon name="kupa" size={16} label={t('history.record')} className="text-ember-text" /> : null}
      </span>
      <E1rmValue value={exercise.bestE1rmKg} size="m" />
    </div>
  )
}

/** Rreshti i ushtrimit: emri, "50 kg · 12, 11, 10 + 3" dhe e1RM-ja më e mirë e seancës. */
function ExerciseRow({ exercise }: { exercise: PastExercise }) {
  const { t, fmt } = useI18n()
  const { weight, reps } = setsSummary(fmt, exercise.sets)
  return (
    <li className="flex min-h-row items-center gap-3 border-b border-border py-1.5 last:border-b-0">
      <ExercisePhoto libraryId={exercise.libraryId} size="square" />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate type-body-strong">{exercise.name}</span>
          {exercise.record ? <Icon name="kupa" size={16} label={t('history.record')} className="text-ember-text" /> : null}
        </span>
        <span className="type-body tabular-nums">
          {weight ? <span className="font-semibold">{weight}</span> : null}
          <span className="text-muted-foreground">{weight ? ` · ${reps}` : reps}</span>
        </span>
      </span>
      <E1rmValue value={exercise.bestE1rmKg} size="m" />
    </li>
  )
}

/** Karta "Rekord i ri" (bordi): ushtrimi me setet, e1RM e çdo seti dhe shtesa që nga më i miri i mëparshëm. */
function RecordCard({ exercise, editing, onPick }: { exercise: PastExercise; editing: boolean; onPick: (set: PastSet) => void }) {
  const { t, fmt } = useI18n()
  const id = useId()
  const record = exercise.record!
  const previous = record.previous
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5 rounded-lg border border-insight-border bg-insight px-3.5 pt-3 pb-2">
      <div className="flex items-center gap-3">
        <ExercisePhoto libraryId={exercise.libraryId} size="square" ground="card" className="size-12" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-[13px] leading-[1.35] font-bold text-ember-text">
            <Icon name="kupa" size={16} />
            {t('history.newRecord')}
          </span>
          <h3 id={id} className="type-title">
            {exercise.name}
          </h3>
        </span>
        <E1rmValue value={exercise.bestE1rmKg} size="l" />
      </div>
      <SetList exercise={exercise} editing={editing} onPick={onPick} divider="border-insight-border" />
      {previous && record.previousBestKg > 0 ? (
        <p className="border-t border-insight-border pt-1.5 text-sm leading-[1.4] tabular-nums">
          <span className="font-semibold text-data">{`+${fmt.unit(record.gainKg, 'kg', { minDigits: 1, maxDigits: 1 })}`}</span>{' '}
          <span className="text-muted-foreground">
            {t('history.recordFrom', {
              previous: kg1(fmt, record.previousBestKg),
              label: weekLabel(t, previous),
              set: previous.rir === null ? setText(fmt, { ...previous, seconds: null }) : t('history.setWithRir', { set: setText(fmt, { ...previous, seconds: null }), rir: previous.rir }),
            })}
          </span>
        </p>
      ) : null}
    </section>
  )
}

function SetList({ exercise, editing, onPick, divider }: { exercise: PastExercise; editing: boolean; onPick: (set: PastSet) => void; divider: string }) {
  const { t, fmt } = useI18n()
  return (
    <ol aria-label={exercise.name} className="flex flex-col">
      {exercise.sets.map((set) => {
        const row = <SetRow exercise={exercise} set={set} editing={editing} />
        const editable = editing && set.reps !== null
        return (
          <li key={set.id} className={cn('border-t', divider)}>
            {editable ? (
              <button
                type="button"
                onClick={() => onPick(set)}
                aria-label={t('history.editSetLabel', { n: set.setNumber, exercise: exercise.name, value: setText(fmt, set) })}
                className="w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
              >
                {row}
              </button>
            ) : (
              row
            )}
          </li>
        )
      })}
    </ol>
  )
}

function SetRow({ exercise, set, editing }: { exercise: PastExercise; set: PastSet; editing: boolean }) {
  const { t, fmt } = useI18n()
  const extra = segmentsText(fmt, set)
  const note = set.segments.length
    ? set.technique === 'rest_pause'
      ? t('history.segments.rest_pause', { sets: set.segments.map((segment) => setText(fmt, { weightKg: segment.weightKg ?? set.weightKg, reps: segment.reps, seconds: null })).join(', '), seconds: exercise.technique?.type === 'rest_pause' ? (exercise.technique.restSeconds ?? 15) : 15 })
      : t(set.technique === 'drop_set' ? 'history.segments.drop_set' : 'history.segments.other', {
          sets: set.segments.map((segment) => setText(fmt, { weightKg: segment.weightKg ?? set.weightKg, reps: segment.reps, seconds: null })).join(', '),
        })
    : null
  return (
    <div className={cn('grid min-h-touch items-center gap-x-2 gap-y-0.5', note && 'py-1.5', editing ? 'grid-cols-[56px_minmax(0,1fr)_auto_20px]' : 'grid-cols-[56px_minmax(0,1fr)_auto]')}>
      <span className="type-caption text-muted-foreground">{t('history.setN', { n: set.setNumber })}</span>
      <span className={cn('font-display text-2xl leading-none tabular-nums', set.record ? 'font-extrabold' : 'font-bold')}>
        {setText(fmt, set)}
        {extra ? <span className="text-muted-foreground"> {extra}</span> : null}
      </span>
      {set.record ? (
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-bold text-ember-text">{t('history.record')}</span>
          <span className="font-display text-[22px] leading-none font-extrabold tabular-nums">{kg1(fmt, set.e1rmKg!)}</span>
        </span>
      ) : (
        <span className="font-display text-[22px] leading-none font-bold text-muted-foreground tabular-nums">{set.e1rmKg === null ? '' : kg1(fmt, set.e1rmKg)}</span>
      )}
      {editing ? set.reps === null ? <span /> : <Icon name="edito" size={18} className="text-muted-foreground" /> : null}
      {note ? <span className={cn('type-caption text-muted-foreground', editing ? 'col-span-3 col-start-2' : 'col-span-2 col-start-2')}>{note}</span> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Fleta "Ndrysho setin".

const MAX_WEIGHT = 500
const MAX_REPS = 200
const roundWeight = (value: number) => Math.round(value * 100) / 100

function EditSetSheet({ session, exercise, set, onClose }: { session: PastSession; exercise: PastExercise; set: PastSet; onClose: () => void }) {
  const { t, fmt, lang } = useI18n()
  const step = weightStep(exercise.equipment, session.weightSteps)
  const [weight, setWeight] = useState(set.weightKg ?? 0)
  const [reps, setReps] = useState(set.reps ?? 1)
  const [rir, setRir] = useState<number | null>(set.rir)
  const [typing, setTyping] = useState<'weight' | 'reps' | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const showRir = set.rir !== null || (exercise.target?.kind === 'reps' && exercise.target.rir !== undefined)
  // Pa peshë mbetet pa peshë, derisa përdoruesi të vendosë një.
  const weightKg = set.weightKg === null && weight === 0 ? null : weight
  const changed = weightKg !== set.weightKg || reps !== set.reps || rir !== set.rir
  const preview = previewEdit(session.history, set.id, { weightKg, reps, rir })
  const value = preview.e1rmKg === null ? null : fmt.unit(preview.e1rmKg, 'kg', { minDigits: 1, maxDigits: 1 })
  const previewText =
    value === null
      ? t('history.edit.noE1rm')
      : preview.record
        ? t('history.edit.previewRecord', { value, gain: `+${fmt.unit(preview.record.gainKg, 'kg', { minDigits: 1, maxDigits: 1 })}` })
        : `${t('history.edit.preview', { value })}${set.record ? ` · ${t('history.edit.loseRecord')}` : ''}`

  async function save() {
    setBusy(true)
    setFailed(false)
    try {
      await editSet(store, set.id, { weightKg, reps, rir })
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={t('history.edit.title', { n: set.setNumber })}
      description={`${exercise.name} · ${capitalize(fmt.date(dayDate(session.date)), lang)}`}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" disabled={!changed || busy} onClick={() => void save()}>
          {t('history.edit.save')}
        </Button>
      }
    >
      <Stepper
        label={t('history.setN', { n: set.setNumber })}
        weight={weight}
        reps={reps}
        weightStep={step}
        canLowerWeight={weight > 0}
        canLowerReps={reps > 1}
        onWeightStep={(direction) => setWeight((current) => Math.min(MAX_WEIGHT, Math.max(0, roundWeight(current + direction * step))))}
        onRepsStep={(direction) => setReps((current) => Math.min(MAX_REPS, Math.max(1, current + direction)))}
        onEditWeight={() => setTyping('weight')}
        onEditReps={() => setTyping('reps')}
      />
      {typing ? (
        <TypeValue
          key={typing}
          kind={typing}
          initial={typing === 'weight' ? fmt.number(weight) : String(reps)}
          onApply={(next) => {
            if (typing === 'weight') setWeight(next)
            else setReps(next)
            setTyping(null)
          }}
        />
      ) : null}
      {showRir ? <RirPicker value={rir} onChange={setRir} /> : null}
      <p aria-live="polite" className="type-body text-muted-foreground tabular-nums">
        {previewText}
      </p>
      {failed ? (
        <p role="alert" className="type-caption text-danger">
          {t('history.edit.failed')}
        </p>
      ) : null}
    </Sheet>
  )
}

/** Prekja e numrit te stepper-i: pesha ose përsëritjet me tastierën numerike. */
function TypeValue({ kind, initial, onApply }: { kind: 'weight' | 'reps'; initial: string; onApply: (value: number) => void }) {
  const { t, fmt } = useI18n()
  const id = useId()
  const [text, setText] = useState(initial.replace(/\s/g, ''))
  const [error, setError] = useState<string | null>(null)
  function apply(event: FormEvent) {
    event.preventDefault()
    const normalized = text.trim().replace(',', '.')
    const value = Number(normalized)
    const ok =
      kind === 'weight'
        ? /^\d{1,3}(\.\d{1,2})?$/.test(normalized) && value <= MAX_WEIGHT
        : /^\d{1,3}$/.test(normalized) && value >= 1 && value <= MAX_REPS
    if (!ok) {
      setError(kind === 'weight' ? t('history.edit.invalidWeight', { max: MAX_WEIGHT, example: fmt.number(62.5) }) : t('history.edit.invalidReps', { max: MAX_REPS }))
      return
    }
    onApply(value)
  }
  return (
    <form onSubmit={apply} noValidate className="flex flex-col gap-1.5">
      <label htmlFor={id} className="type-caption font-medium">
        {kind === 'weight' ? t('history.edit.weight') : t('history.edit.reps')}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          autoFocus
          inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.currentTarget.value)
            setError(null)
          }}
          className={cn(inputClass, 'min-w-0 flex-1')}
        />
        <Button type="submit" variant="secondary" ground="card" className="h-auto min-h-touch">
          {t('history.edit.apply')}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="type-caption text-danger">
          {error}
        </p>
      ) : null}
    </form>
  )
}

