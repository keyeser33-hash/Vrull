import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { weeklyCheckHistory, type WeeklyCheckStatus, decideWeeklyCheck, firstWeeklyCheckDate, nextWeeklyCheckDate, type WeeklyCheckView, readWeeklyCheck } from '@/data/weekly-check'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { kcalText } from './nutrition-format'

// Kontrolli javor (V33, V2-E2-04, bordi "Sot · Kontrolli javor"): java e kaluar me peshën trend,
// synimin dhe ushqimin e regjistruar; propozimi me "Po" dhe "Jo tani". Del te Sot dhe te Objektivat
// derisa përdoruesi të vendosë; "Jo tani" e heq deri të hënën tjetër.

type Proposal = Extract<WeeklyCheckView['result'], { kind: 'proposal' }>

/** Karta del vetëm kur ka propozim pa vendim. */
export function WeeklyCheckCard({ date, className }: { date: string; className?: string }) {
  const view = useLocalQuery(() => readWeeklyCheck(store, date), [date])
  if (!view || view.decided || view.result.kind !== 'proposal') return null
  return <WeeklyCheckProposal view={view} result={view.result} date={date} className={className} />
}

const oneDecimal = { minDigits: 1, maxDigits: 1 }
const weightText = ({ fmt }: Pick<I18n, 'fmt'>, kg: number) => fmt.unit(kg, 'kg', oneDecimal)
const signedWeight = (i18n: Pick<I18n, 'fmt'>, kg: number) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${weightText(i18n, Math.abs(kg))}`

function headline({ t, fmt }: I18n, change: number) {
  if (Math.round(change * 10) === 0) return t('today.weeklyCheck.same')
  const kg = weightText({ fmt }, Math.abs(change))
  return change > 0 ? t('today.weeklyCheck.up', { kg }) : t('today.weeklyCheck.down', { kg })
}

function WeeklyCheckProposal({ view, result, date, className }: { view: WeeklyCheckView; result: Proposal; date: string; className?: string }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const titleId = `weekly-check-${view.weekStart}`
  const amount = t('today.weeklyCheck.amount', { kcal: Math.abs(result.kcal) })
  const numbers = { training: kcalText(i18n, view.training ?? 0), rest: kcalText(i18n, view.rest ?? 0) }

  async function decide(status: WeeklyCheckStatus) {
    setBusy(true)
    setFailed(false)
    try {
      await decideWeeklyCheck(store, view, status, date)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={titleId} className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-4', className)}>
      <span className="type-label text-data">{t('today.weeklyCheck.label', { week: view.week })}</span>
      <h2 id={titleId} className="type-display-s">
        {headline(i18n, result.changeKg)}
      </h2>
      <p className="text-[15px] leading-[1.45]">
        {view.goal === 'maintain' ? t('today.weeklyCheck.goalMaintain') : t('today.weeklyCheck.goalRate', { change: signedWeight(i18n, result.plannedChangeKg) })}{' '}
        {t('today.weeklyCheck.logged', { days: result.loggedDays, kcal: kcalText(i18n, Math.round(result.averageKcal / 10) * 10) })}
      </p>
      {view.goalKg !== null ? <TrendChart view={view} goalKg={view.goalKg} /> : null}
      <p className="border-t border-border pt-2.5 text-[15px] leading-[1.45] tabular-nums">
        {result.kcal === 0 ? (
          t('today.weeklyCheck.onTrack')
        ) : (
          <>
            {t(result.kcal > 0 ? 'today.weeklyCheck.addLead' : 'today.weeklyCheck.removeLead')} <b className="font-semibold">{amount}</b>{' '}
            {t(result.kcal > 0 ? 'today.weeklyCheck.addRest' : 'today.weeklyCheck.removeRest', numbers)}
          </>
        )}
      </p>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('today.weeklyCheck.failed')}
        </p>
      ) : null}
      {result.kcal === 0 ? (
        <Button variant="secondary" ground="card" size="lg" disabled={busy} onClick={() => void decide('accepted')}>
          {t('today.weeklyCheck.ok')}
        </Button>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-2">
          <Button variant="secondary" ground="card" size="lg" className="px-3" disabled={busy} onClick={() => void decide('accepted')}>
            {t(result.kcal > 0 ? 'today.weeklyCheck.accept' : 'today.weeklyCheck.acceptRemove', { kcal: fmt.number(Math.abs(result.kcal)) })}
          </Button>
          <Button variant="outline" size="lg" className="px-3" disabled={busy} onClick={() => void decide('dismissed')}>
            {t('today.weeklyCheck.later')}
          </Button>
        </div>
      )}
    </section>
  )
}

const CHART = { width: 356, height: 86, left: 4, right: 352, top: 10, bottom: 76 }

/** Pesha trend e 14 ditëve dhe vija e synimit në javën e rishikuar. */
function TrendChart({ view, goalKg }: { view: WeeklyCheckView; goalKg: number }) {
  const i18n = useI18n()
  const { t } = i18n
  if (view.result.kind !== 'proposal' || view.trend.length === 0) return null
  const { previousTrendKg, trendKg } = view.result
  const values = [...view.trend.map((point) => point.kg), previousTrendKg, goalKg]
  const min = Math.min(...values) - 0.2
  const max = Math.max(...values) + 0.2
  const x = (day: number) => CHART.left + (day / 13) * (CHART.right - CHART.left)
  const y = (kg: number) => CHART.bottom - ((kg - min) / (max - min)) * (CHART.bottom - CHART.top)
  const path = view.trend.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.day).toFixed(1)} ${y(point.kg).toFixed(1)}`).join(' ')
  const last = view.trend.at(-1)!
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <svg
        role="img"
        aria-label={t('today.weeklyCheck.chart', { from: weightText(i18n, view.trend[0].kg), to: weightText(i18n, trendKg), goal: weightText(i18n, goalKg) })}
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        className="block h-auto w-full"
      >
        <path d={`M${CHART.left} ${CHART.bottom} L${CHART.right} ${CHART.bottom}`} className="stroke-border" strokeWidth={1} />
        <path d={`M${x(6)} ${y(previousTrendKg)} L${x(13)} ${y(goalKg)}`} className="stroke-muted-foreground" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" fill="none" />
        <path d={path} className="stroke-data" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx={x(last.day)} cy={y(last.kg)} r={4} className="fill-data" />
        <circle cx={x(13)} cy={y(goalKg)} r={4} className="fill-none stroke-muted-foreground" strokeWidth={2} />
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-data" />
          {t('today.weeklyCheck.trend', { kg: weightText(i18n, trendKg) })}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" />
          {t('today.weeklyCheck.goal', { kg: weightText(i18n, goalKg) })}
        </span>
      </figcaption>
    </figure>
  )
}

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

/** Objektivat › Kontrolli javor: gjendja e javës dhe korrigjimet e pranuara. */
export function WeeklyCheckSummary({ date, from }: { date: string; from: string }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const data = useLocalQuery(async () => ({ view: await readWeeklyCheck(store, date), history: await weeklyCheckHistory(store) }), [date])
  if (!data) return null
  const { view, history } = data
  const first = firstWeeklyCheckDate(from)
  const next = view ? fmt.date(atNoon(nextWeeklyCheckDate(view.weekStart))) : ''
  const status = !view
    ? first > date
      ? t('food.targets.weeklyCheck.first', { date: fmt.date(atNoon(first)) })
      : null
    : view.decided
      ? t(view.decided.status === 'accepted' ? 'food.targets.weeklyCheck.accepted' : 'food.targets.weeklyCheck.dismissed', { week: view.week, date: next })
      : view.result.kind === 'insufficient'
        ? t('food.targets.weeklyCheck.insufficient', { week: view.week, date: next })
        : null
  if (!status && history.length === 0) return null
  return (
    <section aria-labelledby="targets-weekly-check" className="flex flex-col gap-1.5">
      <h2 id="targets-weekly-check" className="type-label text-muted-foreground">
        {t('food.targets.weeklyCheck.title')}
      </h2>
      {status ? <p className="text-sm leading-[1.4] text-muted-foreground">{status}</p> : null}
      {history.length > 0 ? (
        <dl aria-label={t('food.targets.weeklyCheck.history')} className="m-0">
          {history.map((entry, index) => (
            <div key={entry.weekStart} className={cn('flex min-h-12 items-center justify-between gap-3', index < history.length - 1 && 'border-b border-border')}>
              <dt className="flex flex-col">
                <span className="text-[15px]">{t('food.targets.weeklyCheck.week', { week: entry.week })}</span>
                <span className="text-[13px] text-muted-foreground">{t('food.targets.weeklyCheck.from', { date: fmt.date(atNoon(entry.from)) })}</span>
              </dt>
              <dd className="m-0 font-display text-[19px] font-bold text-data tabular-nums">{`${entry.kcal > 0 ? '+' : '−'}${fmt.number(Math.abs(entry.kcal))}`}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}
