import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { logWithUndo } from '@/components/food/meal-actions'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { currentFoodDate, logTemplateMeal, type MealSlot, type NutritionDay, nutritionDay } from '@/data/nutrition'
import { copyYesterdayMeal, yesterdayMeal } from '@/data/quick-food'
import { setMealSkipped } from '@/data/schedule-settings'
import { foodName, mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { shiftDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import type { MealKey } from '@/nutrition/meals'
import { kcalText } from './nutrition-format'

// "Mbyll ditën" (V70, V71; bordi "3 · Mbyll ditën" te kanavaca "Vrull - Propozimi UX"): të gjitha vaktet e ditës së
// ushqimit në një ekran, për kë e shënon ushqimin një herë në mbrëmje. Çdo vakt i hapur ka katër veprime me një
// prekje: Si në plan, Si dje, Tjetër (hap Shto ushqim) dhe E kapërceva. Vakti i mbyllur tregon çfarë u shënua dhe
// hapet sërish. Poshtë: proteina e ditës kundrejt objektivit dhe sa vakte janë mbyllur. Vlen për ditën e ushqimit të
// sotme (V46) dhe, me `?data=`, për të djeshmen (edhe aty "Si dje" kopjon ditën para saj): aty "Tjetër" mungon, sepse Shto ushqim regjistron vetëm te sot.

/** Vakti është i mbyllur: i ngrënë ose i kapërcyer. */
const closed = (meal: MealSlot) => meal.status === 'done' || meal.status === 'skipped'

export function CloseDayPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asked = params.get('data')
  const view = useLocalQuery(async () => {
    const now = store.now()
    const today = await currentFoodDate(store, now)
    // Vetëm sot ose dje: ditët më të vjetra ndryshohen vakt pas vakti te Ushqimi.
    const date = asked === shiftDate(today, -1) ? asked : today
    const day = await nutritionDay(store, date, now)
    const yesterday: Partial<Record<MealKey, boolean>> = {}
    for (const meal of day.meals) yesterday[meal.meal] = (await yesterdayMeal(store, date, meal.meal)) !== null
    return { day, yesterday }
  }, [asked])
  const back = view && !view.day.isToday ? `/ushqimi?data=${view.day.date}` : '/ushqimi'

  if (!view) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title={t('foodday.close.title')} fallback={back} back={t('foodday.close.back')} />
        <div aria-hidden className="h-36 rounded-lg bg-surface" />
        <div aria-hidden className="h-36 rounded-lg bg-surface" />
      </div>
    )
  }
  const { day, yesterday } = view
  const done = day.meals.filter(closed).length
  const left = day.meals.length - done
  const protein = Math.round(day.totals.proteinG)
  const target = day.targets ? Math.round(day.targets.proteinG) : null

  return (
    <div className="flex min-h-full flex-col gap-4">
      <BackHeader title={day.isToday ? t('foodday.close.title') : t('foodday.close.titleYesterday')} subtitle={t('foodday.close.intro')} fallback={back} back={t('foodday.close.back')} />
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {day.meals.map((meal) => (
          <MealCard key={meal.meal} day={day} meal={meal} hasYesterday={yesterday[meal.meal] === true} />
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <div className={cn(surfaceClass, 'flex items-center justify-between gap-3 rounded-lg p-3.5')}>
          <div className="flex flex-col gap-1">
            <span className="type-caption text-muted-foreground">{t('foodday.close.protein')}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="type-display-l tabular-nums">{protein}</span>
              <span className="type-caption text-muted-foreground tabular-nums">{target === null ? t('foodday.close.proteinUnit') : t('foodday.close.proteinOf', { target })}</span>
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="type-caption text-muted-foreground">{t('foodday.close.meals')}</span>
            <span className="type-display-s tabular-nums">{t('foodday.close.mealsOf', { done, total: day.meals.length })}</span>
          </div>
        </div>
        <p role="status" className="text-center type-caption text-muted-foreground">
          {left === 0 ? t('foodday.close.done') : t('foodday.close.left', { count: left })}
        </p>
        <Button variant={left === 0 ? 'primary' : 'outline'} size="xl" className="w-full" onClick={() => void navigate(back)}>
          {t('foodday.close.finish')}
        </Button>
      </div>
    </div>
  )
}

function MealCard({ day, meal, hasYesterday }: { day: NutritionDay; meal: MealSlot; hasYesterday: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const [busy, setBusy] = useState(false)
  const name = mealName(t, meal.meal)
  const plan = meal.template.map((line) => foodName(t, { name: line.name, sourceId: line.sourceId })).join(', ')
  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    void action().finally(() => setBusy(false))
  }
  const state =
    meal.status === 'done'
      ? t('foodday.close.logged', { kcal: kcalText(i18n, meal.totals.kcal), protein: Math.round(meal.totals.proteinG) })
      : meal.status === 'skipped'
        ? t('foodday.skipped')
        : t('foodday.close.unlogged')
  const action = 'h-11 min-w-0 px-1 font-text text-[13px] leading-none font-semibold normal-case tracking-normal'
  return (
    <li className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-lg p-3.5')}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="type-title">{name}</h2>
        <span className={cn('shrink-0 text-sm leading-5 font-semibold tabular-nums', closed(meal) ? 'text-foreground' : 'text-muted-foreground')}>{state}</span>
      </div>
      <p className="truncate text-sm leading-5 text-muted-foreground">
        {meal.status === 'done' ? meal.entries.map((entry) => foodName(t, entry)).join(', ') : plan || t('foodday.close.noPlan')}
      </p>
      {meal.status === 'done' ? (
        <Link to={`/ushqimi?${day.isToday ? '' : `data=${day.date}&`}vakti=${meal.meal}`} aria-label={t('foodday.close.editFor', { meal: name })} className={cn(buttonVariants({ variant: 'secondary' }), action, 'self-start px-4')}>
          {t('food.edit')}
        </Link>
      ) : meal.status === 'skipped' ? (
        <Button variant="secondary" aria-label={t('foodday.unskipFor', { meal: name })} disabled={busy} className={cn(action, 'self-start px-4')} onClick={() => run(() => setMealSkipped(store, day.date, meal.meal, false))}>
          {t('foodday.unskip')}
        </Button>
      ) : (
        <div className={cn('grid gap-1.5', day.isToday ? 'grid-cols-4' : 'grid-cols-3')}>
          <Button variant="secondary" aria-label={t('foodday.asPlanFor', { meal: name })} disabled={busy || meal.template.length === 0} className={action} onClick={() => run(() => logWithUndo(store, day.date, meal.meal, () => logTemplateMeal(store, day.date, meal.meal)))}>
            {t('food.quick.plan')}
          </Button>
          <Button variant="secondary" aria-label={t('foodday.close.yesterdayFor', { meal: name })} disabled={busy || !hasYesterday} className={action} onClick={() => run(() => copyYesterdayMeal(store, day.date, meal.meal))}>
            {t('food.quick.yesterday')}
          </Button>
          {day.isToday ? (
            <Link to={`/ushqimi/shto/${meal.meal}`} aria-label={t('foodday.close.otherFor', { meal: name })} className={cn(buttonVariants({ variant: 'secondary' }), action)}>
              {t('foodday.close.other')}
            </Link>
          ) : null}
          <Button variant="secondary" aria-label={t('foodday.skipFor', { meal: name })} disabled={busy} className={action} onClick={() => run(() => setMealSkipped(store, day.date, meal.meal, true))}>
            {t('foodday.skip')}
          </Button>
        </div>
      )}
    </li>
  )
}
