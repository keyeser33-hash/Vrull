import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ListRow } from '@/components/ui/list-row'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { StatTile } from '@/components/ui/stat-tile'
import { surfaceClass } from '@/components/ui/surface'
import { loadLevel, WEEKLY_TARGET } from '@/body/body-map'
import { sessionAchievements, type SessionAchievements } from '@/data/achievements'
import { store, useLocalQuery } from '@/data/app-data'
import { type CloseWeek, sessionCloseWeek } from '@/data/session-close'
import { sessionSummary, type SessionSummary } from '@/data/training'
import { muscleName, programBlockName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { isTiredDay } from '@/lib/day-mode'
import { shiftDate } from '@/lib/calendar'
import { achievementName } from './achievement-format'
import { AchievementBadge } from './achievement-parts'
import { spokenDuration } from './session-format'
import { recordPulse, useRecordBurst } from './session-motion'

// Mbyllja e seancës (V2-E1-07; bordi "Mbyll"): stërvitja, rekordi më i madh me shkëndijat e prushit
// (600 ms, një herë; me "lëvizje të reduktuar" vetëm zbehje), kohëzgjatja, setet e punës, volumi i
// javës për grupin kryesor dhe rekordet e tjera. "Ndaj kartën" vjen me miqtë (Etapa 4). Pas tyre (V43,
// bordi "Mbyllja · java dhe rekordet"): java me stërvitjet kundrejt qëllimit, stërvitja e radhës, ushqimi
// dhe uji, dhe "Arritje e re" ose arritja më e afërt; hapja e mbylljes jep arritjet (`sessionAchievements`).

export function SessionSummaryPage() {
  const { sessionId = '' } = useParams()
  const summary = useLocalQuery(() => sessionSummary(store, sessionId), [sessionId])
  if (summary === undefined) return <div className="min-h-dvh bg-background" />
  if (!summary) return <Navigate to="/" replace />
  if (summary.status === 'in_progress') return <Navigate to="/seanca" replace />
  return <SummaryView summary={summary} />
}

const pad = (value: number) => String(value).padStart(2, '0')

function SummaryView({ summary }: { summary: SessionSummary }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const week = useLocalQuery(() => sessionCloseWeek(store, summary.id), [summary.id])
  const achievements = useLocalQuery(() => sessionAchievements(store, summary.id), [summary.id])
  const [top, ...others] = summary.records
  const label = t('session.summary.workoutLabel', { label: programWeekLabel(t, summary), day: String(summary.dayNumber) })
  const seconds = summary.durationSeconds
  const duration =
    seconds === null
      ? null
      : seconds >= 3600
        ? t('session.summary.hours', { time: `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}` })
        : t('session.summary.minutes', { minutes: Math.max(1, Math.round(seconds / 60)) })

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-4 px-4 pt-6">
          <div className="flex flex-col gap-0.5">
            <span className="type-label text-muted-foreground">{t('session.summary.closed')}</span>
            <span className="type-caption text-muted-foreground">{label}</span>
          </div>

          {top ? (
            <RecordHero record={top} />
          ) : (
            <div className="flex flex-col gap-1">
              <h1 className="type-display-l">{t('session.summary.workout', { day: String(summary.dayNumber) })}</h1>
              <p className="type-body text-muted-foreground">{programDayName(t, summary.dayName)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {duration && seconds !== null ? (
              <StatTile label={t('session.summary.duration')} value={duration} ariaLabel={t('session.summary.durationSpoken', { duration: spokenDuration(seconds, t) })} />
            ) : null}
            <StatTile label={t('session.summary.workSets')} value={fmt.number(summary.workSets)} ariaLabel={t('session.summary.workSetsSpoken', { count: summary.workSets })} />
          </div>

          {summary.volume ? <VolumeCard volume={summary.volume} /> : null}

          {others.length ? (
            <section aria-labelledby="other-records" className="flex flex-col gap-1">
              <h2 id="other-records" className="type-label text-muted-foreground">
                {t('session.summary.otherRecords')}
              </h2>
              <ul>
                {others.map((record) => (
                  <ListRow
                    key={record.exerciseId}
                    name={record.exerciseName}
                    detail={t('session.summary.otherRecord', {
                      e1rm: fmt.unit(record.e1rmKg, 'kg', { maxDigits: 1 }),
                      gain: fmt.unit(record.gainKg, 'kg', { maxDigits: 1 }),
                    })}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {week ? <CloseWeekSection week={week} summary={summary} /> : null}
          {achievements ? <CloseAchievements achievements={achievements} /> : null}
        </main>
        <div className="shrink-0 px-4 pt-2.5 pb-5">
          <Button variant="primary" size="xl" onClick={() => navigate('/', { replace: true })}>
            {t('session.summary.done')}
          </Button>
        </div>
      </div>
    </div>
  )
}

const noon = (date: string) => new Date(`${date}T12:00:00`)

/**
 * "Java 3 · 3 nga 4 stërvitje": një segment për çdo stërvitje të qëllimit, ai i kësaj seance me unazë;
 * pastaj stërvitja e radhës dhe sa mungon për qëllimin, dhe ditët e ushqimit dhe ujit.
 */
function CloseWeekSection({ week, summary }: { week: CloseWeek; summary: SessionSummary }) {
  const { t, fmt } = useI18n()
  const heading = summary.blockWeeks > 1 ? t('plan.week', { week: summary.week }) : programBlockName(t, summary.blockName)
  const segments = Math.max(week.target, week.done)
  const sentences: string[] = []
  if (week.next?.date) {
    const { date } = week.next
    const weekday = fmt.weekday(noon(date))
    const day =
      date === week.today ? t('achievements.close.today') : date === shiftDate(week.today, 1) ? t('achievements.close.tomorrow') : weekday.charAt(0).toLocaleUpperCase() + weekday.slice(1)
    sentences.push(t('achievements.close.next', { day, number: week.next.dayNumber, name: programDayName(t, week.next.dayName) }))
  }
  if (week.target > 0) sentences.push(week.met ? t('achievements.close.goalMet') : t('achievements.close.toGo', { count: week.target - week.done }))
  const spoken = t(week.sessionIndex === null ? 'achievements.close.segments' : 'achievements.close.segmentsWithThis', { done: week.done, target: week.target })
  return (
    <section aria-labelledby="close-week" className="flex flex-col gap-2.5 border-t border-border pt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="close-week" className="type-label text-muted-foreground">
          {heading}
        </h2>
        <p className="flex items-baseline gap-1">
          <span className="font-display text-2xl leading-none font-extrabold tabular-nums">{fmt.number(week.done)}</span>
          <span className="text-sm text-muted-foreground">{t('achievements.close.ofWorkouts', { count: week.target })}</span>
        </p>
      </div>
      {segments > 0 ? (
        <div role="img" aria-label={spoken} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
          {Array.from({ length: segments }, (_, index) => (
            <span
              key={index}
              data-this={index === week.sessionIndex || undefined}
              className={cn('h-2.5 rounded-pill', index < week.done ? 'bg-ember' : 'bg-track', index === week.sessionIndex && 'outline-1 outline-offset-2 outline-ember-text')}
            />
          ))}
        </div>
      ) : null}
      {sentences.length ? <p className="type-body">{sentences.join(' ')}</p> : null}
      {week.food || week.water ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-muted-foreground">
          {week.food ? (
            <span>
              {t('achievements.close.food')} <b className="font-semibold text-foreground tabular-nums">{fmt.number(week.food.counted)}</b> {t('achievements.close.ofDays', { goal: week.food.goal })}
            </span>
          ) : null}
          {week.water ? (
            <span>
              {t('achievements.close.water')} <b className="font-semibold text-foreground tabular-nums">{fmt.number(week.water.counted)}</b> {t('achievements.close.ofDays', { goal: week.water.goal })}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/** "Arritje e re" (një rresht për secilën), ose arritja më e afërt me sa mungon; hap Progresi › Arritjet. */
function CloseAchievements({ achievements }: { achievements: SessionAchievements }) {
  const i18n = useI18n()
  const { t } = i18n
  const rowClass = 'flex min-h-16 items-center gap-3 border-t border-border pt-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
  if (achievements.earned.length) {
    return (
      <ul aria-label={t('achievements.close.new')} className="flex flex-col">
        {achievements.earned.map((achievement) => (
          <li key={achievement.key}>
            <Link to="/progresi/arritjet" className={rowClass}>
              <AchievementBadge achievement={achievement} size="row" filled />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] leading-[1.35] font-semibold text-ember-text">{t('achievements.close.new')}</span>
                <span className="type-body-strong">{achievementName(i18n, achievement.key)}</span>
              </span>
              <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    )
  }
  const { nearest } = achievements
  if (!nearest) return null
  const { current, target } = nearest.progress
  return (
    <Link to="/progresi/arritjet" className={rowClass}>
      <AchievementBadge achievement={nearest} size="row" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] leading-[1.3] font-semibold tabular-nums">{t('achievements.close.nearest', { name: achievementName(i18n, nearest.key), count: target - current })}</span>
        <ProgressTrack ratio={current / target} ground="page" className="h-1" />
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}

const LEVEL_TEXT = ['session.volume.under', 'session.volume.under', 'session.volume.within', 'session.volume.over'] as const

/** "Gjoksi këtë javë": volumi kundrejt objektivit 10–20, me shiritin 0 · 10 · 20 dhe pjesën e sotme. */
function VolumeCard({ volume }: { volume: NonNullable<SessionSummary['volume']> }) {
  const { t, fmt } = useI18n()
  const { min, max } = WEEKLY_TARGET
  const name = muscleName(t, volume.groupId)
  const earlier = Math.max(0, volume.week - volume.today)
  return (
    <section aria-labelledby="week-volume" className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-lg p-3.5')}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="week-volume" className="type-title">
          {t('session.volume.title', { group: name })}
        </h2>
        <span className="shrink-0 rounded-pill bg-surface-2 px-2.5 py-1 text-[13px] leading-[1.35] font-semibold">{t(LEVEL_TEXT[loadLevel(volume.week)])}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl leading-none font-extrabold tabular-nums">{fmt.number(volume.week)}</span>
        <span className="type-body text-muted-foreground tabular-nums">{t('session.volume.target', { min, max })}</span>
      </div>
      <div role="img" aria-label={t('session.volume.spoken', { count: volume.week, min, max })} className="flex flex-col gap-1">
        <div className="relative h-2 overflow-hidden rounded-pill bg-surface-2">
          <div className="absolute inset-y-0 left-1/2 w-1/2 bg-track" />
          <div className="absolute inset-y-0 left-0 origin-left animate-fill rounded-pill bg-data" style={{ width: `${Math.min(1, volume.week / max) * 100}%` }} />
        </div>
        <div aria-hidden className="relative h-4 text-xs leading-4 text-muted-foreground tabular-nums">
          <span className="absolute left-0">{fmt.number(0)}</span>
          <span className="absolute left-1/2 -translate-x-1/2">{fmt.number(min)}</span>
          <span className="absolute right-0">{fmt.number(max)}</span>
        </div>
      </div>
      <p className="type-caption text-muted-foreground tabular-nums">
        {earlier > 0 ? t('session.volume.todayEarlier', { count: volume.today, earlier }) : t('session.volume.today', { count: volume.today })}
      </p>
    </section>
  )
}

// Shkëndijat e bordit: tetë vija dhe tetë shenja rreth numrit, në një kuti 358 × 200.
const SPARK_LINES = [
  'M292 89L324 89',
  'M280.8 25.4L306.2 9.5',
  'M282.9 149L307.2 163',
  'M216.5 18.4L224 4.2',
  'M66 89L34 89',
  'M77.2 25.4L51.8 9.5',
  'M75.1 149L50.8 163',
  'M141.5 18.4L134 4.2',
]
const SPARK_DIAMONDS = [
  [336, 52],
  [22, 52],
  [326, 182],
  [32, 182],
]
const SPARK_DOTS = [
  [262, 8],
  [96, 8],
  [346, 120],
  [12, 120],
]

export function RecordHero({ record }: { record: SessionSummary['records'][number] }) {
  const { t, fmt } = useI18n()
  const { sparks, number } = useRecordBurst<SVGSVGElement, HTMLSpanElement>()
  // Ditë e lodhur (V50): pa festim, ndaj pa shkëndija (as statike); numri mbetet.
  const sparkle = !isTiredDay()
  useEffect(() => {
    void recordPulse()
  }, [])
  const e1rm = fmt.unit(record.e1rmKg, 'kg', { maxDigits: 1 })
  const gain = fmt.unit(record.gainKg, 'kg', { maxDigits: 1 })
  return (
    <section aria-label={t('session.summary.recordSpoken', { exercise: record.exerciseName, e1rm, gain })} className="flex flex-col items-center gap-1 text-center">
      <h1 className="type-display-l">{t('session.summary.record')}</h1>
      <div aria-hidden className="relative h-[200px] w-full max-w-[358px]">
        {sparkle ? (
          <svg ref={sparks} viewBox="0 0 358 200" className="absolute inset-0 size-full">
            <g fill="none" strokeWidth={5} strokeLinecap="round" className="stroke-ember-text">
              {SPARK_LINES.map((path) => (
                <path key={path} d={path} />
              ))}
            </g>
            <g className="fill-ember-text">
              {SPARK_DIAMONDS.map(([x, y]) => (
                <rect key={`${x}:${y}`} x={x - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x} ${y})`} />
              ))}
              {SPARK_DOTS.map(([x, y]) => (
                <circle key={`${x}:${y}`} cx={x} cy={y} r={4} />
              ))}
            </g>
          </svg>
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span ref={number} className="type-display-hero text-ember-text">
            {fmt.number(record.e1rmKg, { maxDigits: 1 })}
          </span>
          <span className="type-body-l text-muted-foreground">{t('session.summary.e1rmUnit')}</span>
        </div>
      </div>
      <span className="type-body-strong tabular-nums">
        {t('session.summary.recordSet', { exercise: record.exerciseName, set: record.setNumber, value: `${fmt.number(record.weightKg)} × ${fmt.number(record.reps)}` })}
      </span>
      <span className="font-semibold text-data tabular-nums">{t('session.summary.gain', { gain })}</span>
    </section>
  )
}
