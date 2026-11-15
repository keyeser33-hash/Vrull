import type { ReactNode } from 'react'
import { useState } from 'react'
import { FoodTile } from '@/components/food/food-tile'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type MealSlot, type NutritionDay, logTemplateMeal } from '@/data/nutrition'
import { readSchedule, trainingTimeOn } from '@/data/schedule-settings'
import { trainingSnapshot } from '@/data/training'
import { foodName, mealName, nameInSentence, portionText, programWeekLabel, supplementName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { kcalText, relativeTime } from '@/routes/nutrition-format'
import type { MealKey } from '@/nutrition/meals'
import { logWithUndo } from './meal-actions'
import type { ShowToast } from './meal-sheet'

// Vija e kohës "Dita" (SPEC §0.3h, bordet "Ushqimi · Dita", "Mbrëmje", "Regjistruar"): çdo vakt në një rresht me orën dhe
// shenjën në shinë. Të regjistruarat janë të ngjeshura (emri, një pllakë për çdo regjistrim deri në 5, kcal dhe proteina);
// "Pa regjistruar" ka artikujt e planit dhe "Si në plan" dytësor; i radhësi është i hapur (karta me prushin e vetëm të
// ekranit); ato që vijnë janë të zbehta me artikujt në një rresht; në ditë stërvitjeje vjen rreshti i stërvitjes.

const MAX_TILES = 5

function Row({ time, strong = false, marker, children }: { time: string; strong?: boolean; marker: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-1.5">
      <span className={cn('w-10 shrink-0 pt-5 text-[13px] leading-[1.35] tabular-nums', strong ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')}>{time}</span>
      <span aria-hidden className="relative flex w-6 shrink-0 justify-center self-stretch">
        <span className="absolute inset-y-0 w-0.5 bg-border" />
        <span className="relative mt-[18px] flex h-[22px] items-center">{marker}</span>
      </span>
      {children}
    </li>
  )
}

const dot = {
  done: (
    <span className="flex size-[18px] items-center justify-center rounded-pill bg-foreground text-background">
      <Icon name="zgjedhur" size={12} />
    </span>
  ),
  missed: <span className="size-3.5 rounded-pill border-2 border-dashed border-muted-foreground bg-background" />,
  next: <span className="size-3.5 rounded-pill border-[3px] border-ember-text bg-background" />,
  todo: <span className="size-2.5 rounded-pill border-2 border-muted-foreground bg-background" />,
  workout: (
    <span className="flex size-[22px] items-center justify-center rounded-pill bg-surface-2 text-muted-foreground">
      <Icon name="programi" size={14} />
    </span>
  ),
}

export function DayTimeline({ day, now, onOpen, onToast }: { day: NutritionDay; now: Date; onOpen: (meal: MealKey) => void; onToast: ShowToast }) {
  const i18n = useI18n()
  const { t } = i18n
  const training = useLocalQuery(
    async () => (day.dayType === 'training' ? { time: trainingTimeOn(await readSchedule(store), day.date), snapshot: await trainingSnapshot(store) } : null),
    [day.date, day.dayType],
  )
  const workoutAt = training ? day.meals.findIndex((meal) => meal.time > training.time) : -1
  const workoutIndex = training ? (workoutAt === -1 ? day.meals.length : workoutAt) : -1
  const rows = day.meals.map((meal) => <MealRow key={meal.meal} day={day} meal={meal} now={now} onOpen={onOpen} onToast={onToast} />)
  if (training) rows.splice(workoutIndex, 0, <WorkoutRow key="workout" day={day} now={now} time={training.time} plan={training.snapshot && !training.snapshot.completed ? training.snapshot.plan : null} />)
  return (
    <section aria-labelledby="day-title" className="flex flex-col">
      <h2 id="day-title" className="type-label text-muted-foreground">
        {t('food.day')}
      </h2>
      <ol className="mt-1 flex list-none flex-col p-0">{rows}</ol>
    </section>
  )
}

/** Artikujt e planit në një rresht ("gjizë, ananas, Clif Bar"). */
function planNames(t: ReturnType<typeof useI18n>['t'], lang: string, meal: MealSlot) {
  return meal.template.map((line, index) => (index === 0 ? foodName(t, { name: line.name, sourceId: line.sourceId }) : nameInSentence(foodName(t, { name: line.name, sourceId: line.sourceId }), lang))).join(', ')
}

function MealRow({ day, meal, now, onOpen, onToast }: { day: NutritionDay; meal: MealSlot; now: Date; onOpen: (meal: MealKey) => void; onToast: ShowToast }) {
  const i18n = useI18n()
  const { t, lang } = i18n
  const name = mealName(t, meal.meal)
  if (meal.status === 'done') {
    const kcal = kcalText(i18n, meal.totals.kcal)
    const protein = Math.round(meal.totals.proteinG)
    return (
      <Row time={meal.time} marker={dot.done}>
        <button
          type="button"
          aria-label={t('foodday.row.logged', { meal: name, time: meal.time, kcal, protein })}
          onClick={() => onOpen(meal.meal)}
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2.5 py-3 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[15px] leading-5 font-semibold">{name}</span>
            <span aria-hidden className="flex gap-1">
              {meal.entries.slice(0, MAX_TILES).map((entry) => (
                <FoodTile key={entry.id} size="xs" />
              ))}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
            <span className="text-[15px] leading-5 font-semibold">{kcal} kcal</span>
            <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('foodday.protein', { protein })}</span>
          </span>
        </button>
      </Row>
    )
  }
  if (meal.status === 'next') return <NextMeal day={day} meal={meal} now={now} onOpen={onOpen} onToast={onToast} />
  const names = meal.template.length > 0 ? planNames(t, lang, meal) : ''
  if (meal.status === 'missed') {
    return (
      <Row time={meal.time} marker={dot.missed}>
        <span className="flex min-h-16 min-w-0 flex-1 items-center gap-2.5 py-2.5">
          <button type="button" aria-label={t('foodday.row.unlogged', { meal: name, time: meal.time })} onClick={() => onOpen(meal.meal)} className="flex min-h-touch min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
            <span className="text-[15px] leading-5 font-semibold">{name}</span>
            <span className="truncate text-[13px] leading-[1.35] text-muted-foreground">{names ? t('foodday.unloggedWith', { items: names }) : t('food.status.missed')}</span>
          </button>
          {meal.template.length > 0 ? (
            <Button
              variant="outline"
              className="px-3.5 text-base"
              aria-label={t('foodday.asPlanFor', { meal: name })}
              onClick={() => {
                void (async () => {
                  const { kcal, undo } = await logWithUndo(store, day.date, meal.meal, () => logTemplateMeal(store, day.date, meal.meal))
                  onToast(t('foodday.added', { meal: name, kcal: Math.round(kcal) }), undo)
                })()
              }}
            >
              {t('food.quick.plan')}
            </Button>
          ) : null}
        </span>
      </Row>
    )
  }
  return (
    <Row time={meal.time} marker={dot.todo}>
      <button type="button" aria-label={t('foodday.row.upcoming', { meal: name, time: meal.time })} onClick={() => onOpen(meal.meal)} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 text-left">
        <span className="text-[15px] leading-5 font-medium text-muted-foreground">{name}</span>
        {names ? <span className="truncate text-[13px] leading-[1.35] text-muted-foreground">{names}</span> : null}
      </button>
    </Row>
  )
}

/** Vakti i radhës i hapur: artikujt e planit me porcionin, suplementet e vaktit, "Si në plan" (prushi) dhe "Ndrysho". */
function NextMeal({ day, meal, now, onOpen, onToast }: { day: NutritionDay; meal: MealSlot; now: Date; onOpen: (meal: MealKey) => void; onToast: ShowToast }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const [busy, setBusy] = useState(false)
  const name = mealName(t, meal.meal)
  const heading = day.isToday ? t('foodday.nextIn', { span: relativeTime(i18n, meal.time, now) }) : t('food.status.next')
  const supplements = [...new Set(meal.supplements.map((item) => supplementName(t, item.name)))]
  return (
    <Row time={meal.time} strong marker={dot.next}>
      <section aria-labelledby="next-meal" className={cn(surfaceClass, 'my-1.5 mb-2 flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl p-3.5')}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] leading-[1.35] font-semibold text-ember-text">{heading}</span>
          {meal.template.length > 0 ? (
            <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{t('foodday.nextTotals', { kcal: kcalText(i18n, meal.templateTotals.kcal), protein: Math.round(meal.templateTotals.proteinG) })}</span>
          ) : null}
        </div>
        <h2 id="next-meal" className="-mt-1 type-display-s">
          {name}
        </h2>
        {meal.template.length > 0 ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {meal.template.map((line, index) => (
              <li key={`${line.food}-${index}`} className="flex min-h-10 items-center gap-2.5">
                <FoodTile size="sm" />
                <span className="min-w-0 flex-1 text-[15px] leading-5">{foodName(t, { name: line.name, sourceId: line.sourceId })}</span>
                <span className="shrink-0 text-sm leading-5 whitespace-nowrap text-muted-foreground">{portionText(t, fmt, line.portion)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 type-caption text-muted-foreground">{t('food.noTemplate')}</p>
        )}
        {supplements.length > 0 ? (
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('foodday.with', { names: supplements.map((item) => nameInSentence(item, lang)).join(', ') })}</span>
        ) : null}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="lg"
            className="min-w-0 flex-1 px-3"
            disabled={busy || meal.template.length === 0}
            onClick={() => {
              setBusy(true)
              void (async () => {
                const { kcal, undo } = await logWithUndo(store, day.date, meal.meal, () => logTemplateMeal(store, day.date, meal.meal))
                onToast(t('foodday.added', { meal: name, kcal: Math.round(kcal) }), undo)
              })().finally(() => setBusy(false))
            }}
          >
            {t('food.quick.plan')}
          </Button>
          <Button variant="outline" size="lg" className="px-4" onClick={() => onOpen(meal.meal)}>
            {t('food.edit')}
          </Button>
        </div>
      </section>
    </Row>
  )
}

function WorkoutRow({ day, now, time, plan }: { day: NutritionDay; now: Date; time: string; plan: Parameters<typeof programWeekLabel>[1] & { dayNumber: number } | null }) {
  const i18n = useI18n()
  const { t } = i18n
  const [hours, minutes] = time.split(':').map(Number)
  const upcoming = day.isToday && hours * 60 + minutes > now.getHours() * 60 + now.getMinutes()
  const detail = [plan ? programWeekLabel(t, plan) : null, upcoming ? relativeTime(i18n, time, now) : null].filter(Boolean).join(' · ')
  return (
    <Row time={time} marker={dot.workout}>
      <span className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5">
        <span className="text-[15px] leading-5 font-medium text-muted-foreground">{plan ? t('today.workoutTitle', { day: plan.dayNumber }) : t('foodday.workout')}</span>
        {detail ? <span className="truncate text-[13px] leading-[1.35] text-muted-foreground">{detail}</span> : null}
      </span>
    </Row>
  )
}
