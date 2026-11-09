import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { type WeekSummary, weekSummary } from '@/data/weekly-goals'
import type { I18n } from '@/i18n'
import { programBlockName, programDayName, programWeekLabel } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { atNoon, capitalize, goalCells, hoursText, metGoals, signedText, summaryCaption, summaryTitle } from './week-format'
import { BackLink, GoalSegments } from './week-parts'

// Përmbledhja e javës (V43, SPEC §0.3c, bordet "Java" dhe "Java · Rezerva"; /progresi/java/:e-hëna):
// qëllimet, dita rezervë kur u përdor, stërvitja (setet e punës, koha, rekordet me tri të parët),
// ushqimi, uji, pesha dhe java tjetër; "Ndaj javën" hap kartën. Java jo e plotë: "Java N u mbyll" dhe
// teksti numëron çfarë u arrit, pa faj. Hapet nga karta "Java jote" te Sot, nga njoftimi i së dielës
// dhe nga Progresi › Përmbledhja.

const MONDAY = /^\d{4}-\d{2}-\d{2}$/

export function WeekSummaryPage() {
  const { t } = useI18n()
  const { monday = '' } = useParams()
  const summary = useLocalQuery(() => (MONDAY.test(monday) ? weekSummary(store, monday) : Promise.resolve(null)), [monday])
  const back = <BackLink text={t('common.back')} label={t('common.back')} fallback="/progresi" />
  if (summary === undefined) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <div aria-hidden className="h-[420px] rounded-xl bg-surface" />
      </div>
    )
  }
  if (summary === null) {
    return (
      <div className="flex flex-col gap-3">
        {back}
        <h1 className="type-display-m">{t('week.yours')}</h1>
        <p className="type-body text-muted-foreground">{t('week.summary.notFound')}</p>
      </div>
    )
  }
  return <Summary summary={summary} back={back} />
}

function Summary({ summary, back }: { summary: WeekSummary; back: ReactNode }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const navigate = useNavigate()
  const cells = goalCells(i18n, summary.goals, !!summary.spare)
  const lead = summary.goals.complete
    ? t('week.summary.completeLead', { count: summary.streak })
    : [t('week.summary.metCount', { count: metGoals(summary) }), summary.spare ? t('week.summary.spareLead') : null].filter(Boolean).join(' ')
  const { training } = summary
  const shown = training.records.top
  return (
    <div className="flex flex-col gap-[18px]">
      {back}
      <div className="relative flex flex-col gap-1.5">
        <span aria-hidden className="pointer-events-none absolute -top-14 -right-4 h-[110px] w-[150px] bg-speed-lines" />
        <span className="relative type-caption text-muted-foreground tabular-nums">{summaryCaption(i18n, summary)}</span>
        <h1 className="relative type-display-l">{summaryTitle(i18n, summary)}</h1>
        <p className="relative type-body-l text-foreground">{lead}</p>
      </div>

      <ul aria-label={t('week.summary.goals')} className="m-0 grid list-none grid-cols-3 gap-3 p-0">
        {cells.map((cell) => (
          <li key={cell.key} className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-1 text-[13px] leading-[1.35] text-muted-foreground">
              {cell.met ? <Icon name="zgjedhur" size={14} label={t('week.goal.met')} className="text-ember-text" /> : null}
              {cell.label}
            </span>
            <span className="font-display text-[28px] leading-none font-extrabold whitespace-nowrap tabular-nums">
              {cell.value}
              <span className="font-text text-sm font-normal text-muted-foreground"> {cell.unit}</span>
            </span>
            <GoalSegments cell={cell} />
          </li>
        ))}
      </ul>

      {summary.spare ? (
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md border border-dashed border-ember-text text-ember-text">
            <Icon name="kalendari" size={20} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="type-body-strong">{t('week.summary.spareUsed')}</span>
            <span className="type-caption text-muted-foreground tabular-nums">
              {[
                summary.spare.date
                  ? t(`week.spare.for.${atNoon(summary.spare.date).getDay() || 7}` as 'week.spare.for.1', { date: fmt.date(atNoon(summary.spare.date), { weekday: false }) })
                  : null,
                t('week.summary.spareNext'),
              ]
                .filter(Boolean)
                .join(' ')}
            </span>
          </span>
        </div>
      ) : null}

      {/* ARRITJA E RE (V2-E2-21, agjenti i arritjeve): rreshti "Arritje e re" (shenja 56 px, emri, rregulli,
          lidhja te Progresi › Arritjet) vjen këtu, kur një arritje u dha këtë javë; orkestruesi e lidh me
          API-në e arritjeve. */}

      <section aria-labelledby="summary-training" className="flex flex-col gap-3 border-t border-border pt-3.5">
        <h2 id="summary-training" className="type-label text-muted-foreground">
          {t('week.summary.training')}
        </h2>
        {training.sessions === 0 ? <p className="type-body text-muted-foreground">{t('week.summary.noSessions')}</p> : null}
        <dl className="m-0 grid grid-cols-3 gap-3">
          <Stat label={t('week.summary.sets')} value={fmt.number(training.workSets)} />
          <Stat
            label={t('week.summary.time')}
            value={hoursText(training.minutes)}
            spoken={t('week.summary.timeSpoken', { hours: Math.floor(training.minutes / 60), minutes: Math.round(training.minutes % 60) })}
          />
          <Stat label={t('week.summary.records')} value={fmt.number(training.records.count)} />
        </dl>
        {shown.length > 0 ? (
          <ul aria-label={t('week.summary.recordsList')} className="m-0 flex list-none flex-col p-0">
            {shown.map((record) => (
              <li key={record.exerciseId} className="flex min-h-11 items-center justify-between gap-3 border-t border-border">
                <span className="min-w-0 truncate text-[15px] font-semibold">{record.name}</span>
                <span className="shrink-0 type-caption text-muted-foreground tabular-nums">
                  {t('week.summary.recordLine', { kg: fmt.unit(record.e1rmKg, 'kg', { maxDigits: 1 }) })} · <span className="text-ember-text">{signedText(i18n, record.gainKg)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {training.records.count > shown.length ? (
          <Link to="/progresi/historiku" className="-my-1 flex min-h-11 items-center gap-1 self-start text-sm font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
            {t('week.summary.allRecords', { count: training.records.count })}
            <Icon name="hap" size={16} />
          </Link>
        ) : null}
      </section>

      <FoodWaterWeight summary={summary} />
      <NextWeek summary={summary} />

      <div className="flex flex-col gap-2 pt-1">
        <Button variant="primary" size="xl" onClick={() => navigate(`/progresi/java/${summary.monday}/karta`)}>
          <Icon name="ndaj" size={22} />
          {t('week.share.action')}
        </Button>
        <span className="text-center text-[13px] leading-[1.4] text-muted-foreground">{t('week.share.note')}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, spoken }: { label: string; value: string; spoken?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[13px] leading-[1.35] text-muted-foreground">{label}</dt>
      <dd className="m-0 font-display text-[34px] leading-none font-extrabold tabular-nums" aria-label={spoken}>
        {value}
      </dd>
    </div>
  )
}

const litres = ({ fmt }: Pick<I18n, 'fmt'>, ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 1 })

/** Ushqimi, uji dhe pesha e javës: vetëm këtu, kurrë te karta për ndarje. */
function FoodWaterWeight({ summary }: { summary: WeekSummary }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const none = t('week.summary.noData')
  const { food, water, weight, goals } = summary
  const rows: { label: string; detail?: string; value: ReactNode }[] = [
    {
      label: t('week.summary.foodAverage'),
      detail: goals.food && !goals.food.met ? t('week.summary.foodDays', { count: goals.food.counted }) : undefined,
      value: food.averageKcal === null ? none : t('week.summary.foodValue', { kcal: fmt.number(food.averageKcal), protein: fmt.number(food.averageProteinG ?? 0) }),
    },
    { label: t('week.summary.waterAverage'), value: water.averageMl === null ? none : `${litres(i18n, water.averageMl)} L` },
    {
      label: t('week.summary.weightAverage'),
      detail: summary.closed ? undefined : t('week.summary.checkTomorrow'),
      value:
        weight.averageKg === null ? (
          none
        ) : (
          <>
            {fmt.unit(weight.averageKg, 'kg', { minDigits: 1, maxDigits: 1 })}
            {weight.changeKg !== null ? (
              <>
                {' · '}
                <span className="text-data">{signedText(i18n, weight.changeKg)}</span>
              </>
            ) : null}
          </>
        ),
    },
  ]
  return (
    <section aria-labelledby="summary-food" className="flex flex-col gap-1 border-t border-border pt-3.5">
      <h2 id="summary-food" className="type-label text-muted-foreground">
        {t('week.summary.foodWaterWeight')}
      </h2>
      {rows.map((row) => (
        <div key={row.label} className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px]">{row.label}</span>
            {row.detail ? <span className="text-[13px] leading-[1.35] text-muted-foreground">{row.detail}</span> : null}
          </span>
          <span className="shrink-0 text-right text-[15px] tabular-nums">{row.value}</span>
        </div>
      ))}
    </section>
  )
}

/** Java tjetër: stërvitja e radhës me datën dhe orën; hap Programin. */
function NextWeek({ summary }: { summary: WeekSummary }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const next = summary.next
  if (!next) return null
  const when = next.date ? [capitalize(fmt.date(atNoon(next.date))), next.time].filter(Boolean).join(' · ') : null
  const lastWeek = next.plan.blockName && next.plan.week === next.plan.blockWeeks && next.plan.blockWeeks > 1
  const caption = [t('week.summary.next'), lastWeek ? t('week.summary.lastBlockWeek', { block: programBlockName(t, next.plan.blockName) }) : null, when].filter(Boolean).join(' · ')
  return (
    <Link
      to="/programi"
      className="flex min-h-row items-center gap-3 border-t border-border pt-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <span className={cn('flex min-w-0 flex-1 flex-col gap-1')}>
        <span className="type-caption text-muted-foreground tabular-nums">{caption}</span>
        <span className="type-body-strong">
          {t('week.summary.nextWorkout', { week: programWeekLabel(t, next.plan), day: next.plan.dayNumber, name: programDayName(t, next.plan.dayName) })}
        </span>
        <span className="type-caption text-muted-foreground tabular-nums">
          {t('week.summary.nextDetail', { exercises: t('today.exercises', { count: next.plan.slots.length }), minutes: next.minutes })}
        </span>
      </span>
      <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}
