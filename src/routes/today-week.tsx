import { Link, useNavigate, useSearchParams } from 'react-router'
import { Icon } from '@/components/ui/icons'
import { type WeekDay, WeekStrip } from '@/components/ui/week-strip'
import type { TodayView } from '@/data/today'
import type { WeekGoalsView } from '@/data/weekly-goals'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { dayDots } from '@/today/week-dots'
import { DaySheet } from './day-sheet'
import { DAY_PARAM } from './sheet-params'
import { atNoon } from './week-format'

// Java te Sot (V57, SPEC §0.3f; bordi "Sot"): "Java N" me "Qëllimet", rripi i shtatë ditëve me tri pika nën çdo datë
// (stërvitja, ushqimi, uji; rregullat e V43) dhe rreshti që i shpjegon. Çdo datë hap fletën e saj; sot e mbyll fletën.

export function TodayWeek({ view, goals }: { view: TodayView; goals: WeekGoalsView | null }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = localDate(view.now)
  const opened = params.get(DAY_PARAM)
  const plan = view.snapshot && !view.snapshot.completed ? view.snapshot.plan : null

  const open = (date: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set(DAY_PARAM, date)
      return next
    })
  const days: WeekDay[] = view.week.map((day) => ({
    key: day.date,
    letter: t(`today.weekLetter.${day.weekday}` as 'today.weekLetter.1'),
    name: t('today.weekDay', { weekday: fmt.weekday(atNoon(day.date)), day: String(day.day) }),
    day: day.day,
    state: day.state,
    today: day.today,
    dots: goals ? dayDots(goals, day.date) : null,
    // Sot e mbyll fletën kur është hapur; përndryshe s'ka çfarë të hapë.
    onSelect: day.today ? (opened ? () => navigate(-1) : undefined) : () => open(day.date),
  }))
  return (
    <section aria-labelledby="today-week" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="today-week" className="type-label text-muted-foreground">
          {plan ? t('plan.week', { week: plan.week }) : t('week.yours')}
        </h2>
        <Link to="/sot/java" className="-my-3 -mr-2 flex min-h-12 items-center gap-1 rounded-md px-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-foreground">
          {t('today.week.goals')}
          <Icon name="hap" size={16} />
        </Link>
      </div>
      <WeekStrip days={days} />
      <p className="m-0 type-caption text-muted-foreground">{t('sot.week.legend')}</p>
      {opened && opened !== today ? <DaySheet view={view} date={opened} onClose={() => navigate(-1)} /> : null}
    </section>
  )
}
