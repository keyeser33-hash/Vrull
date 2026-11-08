import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { InsightCard } from '@/components/ui/insight-card'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type WeekReview, weekReview } from '@/data/programme'
import { acceptWeekWeights, changeWeekWeight, postponeWeekWeights } from '@/data/week-weights'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { roundDown, weightStep } from '@/program/loads'
import type { Equipment } from '@/program/types'
import { oneRmSource } from '@/progress/exercise-records'
import { daySummary, rowChange } from '@/progress/week-review'
import type { WeekWeightRow } from '@/progress/week-weights'
import { ExerciseThumb } from './programme-parts'
import { blockName, dotted, equipmentName, rangeText, techniqueName, weekLabel, weekShort } from './programme-format'

// Peshat e javës (bordi "Sugjerimi", V2-E1-09; SPEC §7, V23): për javën që shqyrtohet, çdo ushtrim me
// peshë merr propozimin me llogarinë që e jep. "Prano peshat" i bën propozimet pesha të javës, "Më
// vonë" mban peshën e fundit, "Ndrysho" vendos një peshë me dorë që mbetet edhe pas tyre. Asgjë nuk
// ndryshon pa përdoruesin. Logjika: progress/week-weights.ts; ruajtja: data/week-weights.ts.

export function WeekWeightsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const review = useLocalQuery(() => weekReview(store, now), [now])
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const header = <BackHeader title={t('programme.weights.title')} back={t('programme.backToProgramme')} fallback="/programi" />

  if (review === undefined) return header
  if (review === null) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="type-body text-muted-foreground">{t('programme.weights.noWeek')}</p>
      </div>
    )
  }

  const editing = review.rows.find((row) => row.slotId === params.get('ndrysho'))
  const decide = async (action: typeof acceptWeekWeights) => {
    setBusy(true)
    try {
      await action(store, review.week)
      navigate('/programi', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {header}
      <Intro review={review} />
      {review.rows.length === 0 ? <p className="type-body text-muted-foreground">{t('programme.weights.none')}</p> : null}
      {review.days.map((day, index) => (
        <DaySection
          key={day.dayId}
          review={review}
          day={day}
          rows={review.rows.filter((row) => row.dayId === day.dayId)}
          initiallyOpen={index === 0}
          onChange={(slotId) => setParams((current) => (current.set('ndrysho', slotId), current))}
        />
      ))}

      <div className="sticky bottom-0 -mx-4 -mb-[calc(var(--safe-bottom)+24px)] mt-1 flex flex-col gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+20px)]">
        <span className="text-[13px] leading-[1.4] text-muted-foreground">{laterNote(review, t)}</span>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="outline" size="xl" className="text-xl" disabled={busy} onClick={() => void decide(postponeWeekWeights)}>
            {t('programme.weights.later')}
          </Button>
          <Button variant="primary" size="xl" disabled={busy || review.rows.length === 0} onClick={() => void decide(acceptWeekWeights)}>
            {t('programme.weights.accept')}
          </Button>
        </div>
      </div>

      {editing ? <ChangeSheet review={review} row={editing} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

/** "Faza 1 · Java 3, nga 15 nëntor. 6–8 përsëritje, drop set te seti i fundit." dhe llogaria. */
function Intro({ review }: { review: WeekReview }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const label = weekLabel(t, review.block)
  const start = review.days[0]?.date
  const technique = review.headline ? techniqueName(t, review.headline.technique) : null
  const reps = review.headline?.target.kind === 'reps' ? rangeText(fmt, review.headline.target) : null
  const plan = reps ? (technique ? t('programme.weights.plan', { reps, technique }) : t('programme.weights.planPlain', { reps })) : null
  const next = accusative(review.block, t)
  const lead = review.closed && review.previous ? t('programme.weights.closed', { week: weekShort(t, review.previous), next }) : t('programme.weights.open', { next })
  const formula = formulaText(review, i18n)
  return (
    <>
      <p className="type-caption text-muted-foreground">
        <b className="text-[15px] font-semibold text-foreground">
          {start ? t('programme.weights.when', { label, date: fmt.date(start, { weekday: false }) }) : t('programme.weights.whenUndated', { label })}
        </b>
        {plan ? ` ${plan}` : null}
      </p>
      <InsightCard icon="rritje">
        <span className="flex flex-col gap-1.5">
          <span className="text-[15px] leading-[1.4]">{lead}</span>
          {formula ? <span className="text-[13px] leading-[1.4] text-muted-foreground">{formula}</span> : null}
        </span>
      </InsightCard>
    </>
  )
}

/** "Javën 3"; për bllokun me një javë, emri i tij ("Javën 0" për Java 0). */
function accusative(block: WeekReview['block'], t: I18n['t']) {
  if (block.blockWeeks > 1) return t('programme.weights.weekAcc', { number: String(block.week) })
  const week = /^Java (\d+)$/.exec(block.blockName)
  return week ? t('programme.weights.weekAcc', { number: week[1] }) : blockName(t, block.blockName)
}

function laterNote(review: WeekReview, t: I18n['t']) {
  const previous = review.previous
  const number = previous ? (previous.blockWeeks > 1 ? String(previous.week) : /^Java (\d+)$/.exec(previous.blockName)?.[1]) : undefined
  return number !== undefined ? t('programme.weights.laterNote', { week: t('programme.weights.weekGen', { number }) }) : t('programme.weights.laterNoteLast')
}

/** "Pesha = 1RM aktuale … ÷ (1 + 8/30), poshtë te hapi: shufër 2,5 · dumbbell 2 · kabëll 5 kg." */
function formulaText(review: WeekReview, { t, fmt }: I18n) {
  const fromOneRm = review.rows.filter((row) => row.proposal.basis?.kind === 'one_rm')
  const reps = fromOneRm[0]?.proposal.basis?.kind === 'one_rm' ? fromOneRm[0].proposal.basis.reps : null
  if (reps === null) return null
  const equipment = [...new Set(fromOneRm.map((row) => review.exercises[row.exerciseId]?.equipment).filter((value): value is Equipment => Boolean(value)))]
  const steps = equipment.map((value) => `${equipmentName(t, value).toLocaleLowerCase(fmt.locale)} ${fmt.number(weightStep(value, review.steps))}`)
  return t('programme.weights.formula', { reps: String(reps), steps: `${steps.join(' · ')} kg` })
}

function DaySection({
  review,
  day,
  rows,
  initiallyOpen,
  onChange,
}: {
  review: WeekReview
  day: WeekReview['days'][number]
  rows: WeekWeightRow[]
  initiallyOpen: boolean
  onChange: (slotId: string) => void
}) {
  const { t, fmt } = useI18n()
  const [open, setOpen] = useState(initiallyOpen)
  const [showSame, setShowSame] = useState(false)
  const summary = daySummary(rows)
  const name = (row: WeekWeightRow) => review.exercises[row.exerciseId]?.name ?? ''
  const title = t('programme.workout', { number: day.dayNumber })

  if (!open) {
    const count = rows.length
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        aria-label={t('programme.weights.dayLabel', { number: day.dayNumber, name: day.name, weights: t('programme.weights.count', { count }) })}
        className={cn(surfaceClass, 'flex min-h-12 items-center justify-between gap-2.5 rounded-lg py-0.5 pr-1 pl-3.5 text-left')}
      >
        <span className="min-w-0 truncate text-[15px] font-semibold">
          {title} · <span className="font-normal text-muted-foreground">{day.name.toLowerCase()}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 type-caption text-muted-foreground tabular-nums">
          {t('programme.weights.count', { count })}
          <span className="flex size-touch items-center justify-center">
            <Icon name="poshte" size={20} />
          </span>
        </span>
      </button>
    )
  }

  const changed = rows.filter((row) => ['up', 'down', 'new'].includes(rowChange(row)))
  const same = rows.filter((row) => rowChange(row) === 'same')
  const none = rows.filter((row) => rowChange(row) === 'none')
  const counts = dotted([
    summary.up + summary.new ? t('programme.weights.up', { count: summary.up + summary.new }) : null,
    summary.down ? t('programme.weights.down', { count: summary.down }) : null,
    summary.same ? t('programme.weights.sameCount', { count: summary.same }) : null,
    summary.none ? t('programme.weights.noneCount', { count: summary.none }) : null,
  ])
  return (
    <section aria-label={`${title} · ${day.name}`} className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 pb-0.5">
        <h2 className="type-title font-extrabold">{dotted([title, day.date ? fmt.weekday(day.date) : null])}</h2>
        <span className="text-[13px] leading-5 text-muted-foreground tabular-nums">{counts}</span>
      </div>
      <ul className="flex flex-col border-t border-border">
        {changed.map((row) => (
          <WeightRow key={row.slotId} review={review} row={row} name={name(row)} onChange={() => onChange(row.slotId)} />
        ))}
      </ul>
      {same.length ? (
        <div className="flex flex-col border-t border-border">
          <button
            type="button"
            aria-expanded={showSame}
            onClick={() => setShowSame(!showSame)}
            className="flex min-h-12 items-center justify-between gap-2.5 py-1 text-left"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold">{t('programme.weights.moreSame', { count: same.length })}</span>
              <span className="truncate text-[13px] leading-5 text-muted-foreground">{dotted(same.map(name))}</span>
            </span>
            <span className="flex size-touch shrink-0 items-center justify-center">
              <Icon name="poshte" size={20} className={cn(showSame && 'rotate-180')} />
            </span>
          </button>
          {showSame ? (
            <ul className="flex flex-col border-t border-border">
              {same.map((row) => (
                <WeightRow key={row.slotId} review={review} row={row} name={name(row)} onChange={() => onChange(row.slotId)} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {none.length ? <NoSuggestion rows={none} name={name} /> : null}
    </section>
  )
}

function WeightRow({ review, row, name, onChange }: { review: WeekReview; row: WeekWeightRow; name: string; onChange: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const change = rowChange(row)
  const weight = row.weightKg!
  const delta = row.previousKg !== null ? weight - row.previousKg : 0
  const spoken =
    change === 'same'
      ? t('programme.weights.rowSame', { name, to: weight })
      : row.previousKg === null
        ? t('programme.weights.rowNew', { name, to: weight })
        : t('programme.weights.rowChange', { name, from: row.previousKg, to: weight })
  return (
    <li aria-label={spoken} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border py-1.5 last:border-b-0">
      <ExerciseThumb libraryId={review.exercises[row.exerciseId]?.libraryId ?? null} size="square" className="row-span-2" />
      <span className="min-w-0 type-body-strong">{name}</span>
      <Button variant="outline" aria-label={t('programme.weights.changeFor', { name })} className="row-span-2 rounded-sm px-3 text-[17px]" onClick={onChange}>
        {t('programme.weights.change')}
      </Button>
      <span aria-hidden className="col-start-2 flex items-baseline gap-2 tabular-nums">
        {row.previousKg !== null ? (
          <>
            <span className="text-base text-muted-foreground">{fmt.number(row.previousKg)}</span>
            <span className="text-base text-muted-foreground">→</span>
          </>
        ) : null}
        <span className="font-display text-[30px] leading-none font-extrabold">{fmt.number(weight)}</span>
        <span className="text-sm text-muted-foreground">kg</span>
        {change === 'same' ? (
          <span className="text-[15px] font-semibold text-muted-foreground">{t('programme.weights.same')}</span>
        ) : row.previousKg !== null ? (
          <span className={cn('text-[15px] font-semibold', delta > 0 ? 'text-data' : 'text-muted-foreground')}>{`${delta > 0 ? '+' : '−'}${fmt.unit(Math.abs(delta), 'kg')}`}</span>
        ) : null}
      </span>
      <span className="col-span-3 pl-14 text-[13px] leading-5 text-muted-foreground tabular-nums">{explain(review, row, i18n)}</span>
    </li>
  )
}

/** Llogaria e peshës (§7), si te bordi: "87,5 ÷ 1,267 = 69,1 → 67,5 · 1RM më 8 nëntor". */
function explain(review: WeekReview, row: WeekWeightRow, { t, fmt }: I18n): string {
  if (row.decision?.status === 'changed') return t('programme.weights.changed', { weight: row.proposal.weightKg ?? row.weightKg ?? 0 })
  const basis = row.proposal.basis
  const one = (value: number) => fmt.number(value, { minDigits: 1, maxDigits: 1 })
  switch (basis?.kind) {
    case 'one_rm': {
      const math = t('programme.weights.oneRm', {
        oneRm: one(basis.oneRmKg),
        factor: fmt.number(1 + basis.reps / 30, { minDigits: 3, maxDigits: 3 }),
        exact: one(basis.exactKg),
        weight: fmt.number(row.proposal.weightKg ?? 0),
      })
      if (rowChange(row) === 'same') return dotted([math, t('programme.weights.step', { step: basis.stepKg })])
      const source = oneRmSource(review.history, row.exerciseId, basis.oneRmKg, review.overrides[row.exerciseId] ?? null)
      const note = source?.kind === 'manual' ? t('programme.weights.manual') : source ? t('programme.weights.oneRmOn', { date: fmt.date(new Date(source.at), { weekday: false }) }) : null
      return dotted([math, note])
    }
    case 'percent_1rm':
      return t('programme.weights.percent', { percent: basis.percent, oneRm: one(basis.oneRmKg), exact: one(basis.exactKg), weight: fmt.number(row.proposal.weightKg ?? 0) })
    case 'last_weight':
      return t('programme.weights.lastWeight')
    case 'progression':
      return basis.earned
        ? t('programme.weights.earned', { last: basis.lastKg, increment: basis.incrementKg, reps: basis.topReps, rir: basis.minRir })
        : t('programme.weights.notEarned', { last: basis.lastKg, reps: basis.topReps, rir: basis.minRir })
    case 'linear':
      return t('programme.weights.linear')
    default:
      return ''
  }
}

/** Ushtrimet pa sugjerim: pa histori ("Zgjidh peshën ku mbyll X–Y") ose pa 1RM për %1RM. */
function NoSuggestion({ rows, name }: { rows: WeekWeightRow[]; name: (row: WeekWeightRow) => string }) {
  const { t, fmt } = useI18n()
  const text = (row: WeekWeightRow) =>
    row.proposal.basis?.kind === 'choose'
      ? t('programme.weights.choose', { range: rangeText(fmt, { kind: 'reps', min: row.proposal.basis.min, max: row.proposal.basis.max, beyond: false }) })
      : t('programme.weights.needsOneRm')
  const groups = [...new Map(rows.map((row) => [text(row), rows.filter((other) => text(other) === text(row))])).entries()]
  return (
    <div className="mt-1 flex flex-col gap-1">
      {groups.map(([explanation, list]) => (
        <div key={explanation} className={cn(surfaceClass, 'flex flex-col gap-0.5 rounded-md px-3 py-2.5')}>
          <span className="text-[15px] font-semibold">{dotted(list.map(name))}</span>
          <span className="text-[13px] leading-[1.4] text-muted-foreground">{explanation}</span>
        </div>
      ))}
    </div>
  )
}

/** "Ndrysho": pesha e slotit për këtë javë, me hapin e pajisjes; mbetet edhe pas "Prano peshat". */
function ChangeSheet({ review, row, onClose }: { review: WeekReview; row: WeekWeightRow; onClose: () => void }) {
  const { t, fmt } = useI18n()
  const exercise = review.exercises[row.exerciseId]
  const step = weightStep(exercise?.equipment ?? 'other', review.steps)
  const [weight, setWeight] = useState(row.weightKg ?? row.previousKg ?? step)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await changeWeekWeight(store, review.week, row.slotId, weight)
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      title={exercise?.name ?? ''}
      description={t('programme.weights.changeTitle', { label: weekLabel(t, review.block) })}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
          {t('programme.weights.saveWeight')}
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-3 py-2">
        <Button
          variant="secondary"
          className="size-button rounded-md px-0 text-3xl"
          aria-label={t('programme.weights.lower', { step })}
          disabled={weight - step < 0}
          onClick={() => setWeight((value) => roundDown(Math.max(0, value - step), 0.25))}
        >
          −
        </Button>
        <span className="flex items-end gap-1.5" aria-live="polite">
          <span className="type-display-xl">{fmt.number(weight)}</span>
          <span className="pb-2 type-body text-muted-foreground">kg</span>
        </span>
        <Button
          variant="secondary"
          className="size-button rounded-md px-0 text-3xl"
          aria-label={t('programme.weights.raise', { step })}
          onClick={() => setWeight((value) => roundDown(value + step, 0.25))}
        >
          +
        </Button>
      </div>
    </Sheet>
  )
}
