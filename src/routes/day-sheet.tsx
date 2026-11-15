import { Link } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { buttonVariants } from '@/components/ui/button-variants'
import { store, useLocalQuery } from '@/data/app-data'
import { dayDetail, plannedWorkout } from '@/data/day-detail'
import type { TodayView } from '@/data/today'
import { programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { levelLabel } from './readiness-format'
import { trainingsAhead } from './sheet-params'
import { atNoon, capitalize } from './week-format'

// Fleta e ditës te Sot (V57, SPEC §0.3f): çdo datë e rripit të javës hap një fletë. E kaluara: seanca ("Hap seancën"),
// ushqimi ("Hap ditën e ushqimit"), uji dhe gjendja e ditës. E ardhmja: stërvitja e planifikuar ose pushimi, vetëm për
// t'u parë. Sot nuk hap fletë (prekja e mbyll fletën). Hapet me `?dita=YYYY-MM-DD`, që butoni mbrapa i Android-it ta mbyllë.

const linkClass = buttonVariants({ variant: 'secondary', size: 'lg' })
const sectionClass = 'flex flex-col gap-1 border-t border-border py-3'
const labelClass = 'type-label text-muted-foreground'

export function DaySheet({ view, date, onClose }: { view: TodayView; date: string; onClose: () => void }) {
  const { fmt } = useI18n()
  const today = localDate(view.now)
  const future = date > today
  const day = view.week.find((candidate) => candidate.date === date)
  const title = capitalize(fmt.date(atNoon(date)))
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="pb-4">{future ? <Future view={view} date={date} planned={day?.state === 'planned'} /> : <Past date={date} state={day?.state ?? 'rest'} />}</div>
    </Sheet>
  )
}

function Future({ view, date, planned }: { view: TodayView; date: string; planned: boolean }) {
  const { t } = useI18n()
  const ahead = trainingsAhead(view.week, localDate(view.now), date)
  const workout = useLocalQuery(() => (planned ? plannedWorkout(store, ahead) : Promise.resolve(null)), [planned, ahead, date])
  return (
    <>
      {planned && workout ? (
        <section aria-labelledby="day-planned" className={sectionClass}>
          <h3 id="day-planned" className={labelClass}>
            {t('sot.day.planned')}
          </h3>
          <p className="type-title">{programDayName(t, workout.plan.dayName)}</p>
          <p className="type-caption text-muted-foreground tabular-nums">
            {t('today.workoutTitle', { day: workout.plan.dayNumber })} · {t('today.exercises', { count: workout.exercises.length })} · {t('today.minutes', { minutes: workout.minutes })}
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 type-body tabular-nums">
            {workout.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`}>{t('sot.day.exerciseSets', { sets: exercise.sets, name: exercise.name })}</li>
            ))}
          </ul>
        </section>
      ) : planned && workout === undefined ? (
        // Leximi i stërvitjes ende s'ka mbaruar: vend bosh, jo "Pa program të hapur".
        <div aria-hidden className="h-28" />
      ) : planned ? (
        <section className={sectionClass}>
          <p className="type-body text-muted-foreground">{t('sot.day.noProgramme')}</p>
        </section>
      ) : (
        <section className={sectionClass}>
          <p className="type-title">{t('sot.day.rest')}</p>
        </section>
      )}
      <p className="type-caption border-t border-border pt-3 text-muted-foreground">{t('sot.day.viewOnly')}</p>
    </>
  )
}

function Past({ date, state }: { date: string; state: 'done' | 'rest' | 'planned' | 'missed' }) {
  const { t, fmt } = useI18n()
  const detail = useLocalQuery(() => dayDetail(store, date), [date])
  if (!detail) return <div aria-hidden className="h-40" />
  const { session, food, water, readiness } = detail
  const litres = (ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })
  const reached = (value: boolean | null) => (value === null ? null : <span className="text-muted-foreground">{t(value ? 'sot.day.reached' : 'sot.day.notReached')}</span>)
  return (
    <>
      <section aria-labelledby="day-session" className={sectionClass}>
        <h3 id="day-session" className={labelClass}>
          {t('sot.day.session')}
        </h3>
        {session ? (
          <>
            <p className="type-title">
              {session.dayNumber ? `${t('today.workoutTitle', { day: session.dayNumber })} · ` : ''}
              {session.dayName ? programDayName(t, session.dayName) : ''}
            </p>
            <p className="type-caption text-muted-foreground tabular-nums">
              {[session.minutes ? t('sot.day.sessionMeta', { minutes: session.minutes, sets: session.workSets }) : null, session.records > 0 ? t('sot.day.sessionRecords', { count: session.records }) : null].filter(Boolean).join(' · ')}
            </p>
            <Link to={`/progresi/historiku/${session.id}`} className={cn(linkClass, 'mt-2 w-full')}>
              {t('sot.day.openSession')}
            </Link>
          </>
        ) : (
          <p className="type-body text-muted-foreground">{t(state === 'rest' ? 'sot.day.rest' : 'sot.day.noSession')}</p>
        )}
      </section>
      <section aria-labelledby="day-food" className={sectionClass}>
        <h3 id="day-food" className={labelClass}>
          {t('sot.day.food')}
        </h3>
        <p className="type-body tabular-nums">
          {food.targetKcal === null
            ? t('sot.day.foodLineNoTarget', { kcal: fmt.number(food.kcal), protein: fmt.number(food.proteinG) })
            : t('sot.day.foodLine', { kcal: fmt.number(food.kcal), target: fmt.number(food.targetKcal), protein: fmt.number(food.proteinG) })}{' '}
          {reached(food.reached)}
        </p>
        <Link to={`/ushqimi?data=${date}`} className={cn(linkClass, 'mt-2 w-full')}>
          {t('sot.day.openFood')}
        </Link>
      </section>
      <section aria-labelledby="day-water" className={sectionClass}>
        <h3 id="day-water" className={labelClass}>
          {t('sot.day.water')}
        </h3>
        <p className="type-body tabular-nums">
          {water.targetMl === null ? t('sot.day.waterLineNoTarget', { total: litres(water.ml) }) : t('sot.day.waterLine', { total: litres(water.ml), target: litres(water.targetMl) })} {reached(water.reached)}
        </p>
      </section>
      <section aria-labelledby="day-state" className={sectionClass}>
        <h3 id="day-state" className={labelClass}>
          {t('sot.day.state')}
        </h3>
        <p className="type-body text-foreground tabular-nums">
          {readiness ? t('sot.day.stateLine', { percent: fmt.number(readiness.percent), level: levelLabel(t, readiness.level) }) : <span className="text-muted-foreground">{t('sot.day.noState')}</span>}
        </p>
      </section>
    </>
  )
}
