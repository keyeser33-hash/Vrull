import { useState } from 'react'
import { Link } from 'react-router'
import { logWithUndo } from '@/components/food/meal-actions'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { currentFoodDate, logTemplateMeal, nutritionDay } from '@/data/nutrition'
import { foodName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Vakti pas stërvitjes te mbyllja e seancës (V78; bordi "12 · Fundi i stërvitjes" te kanavaca "Vrull - Propozimi UX"):
// hapi i radhës pas setit të fundit, me një prekje. Del vetëm kur dita e sotme e ka vaktin "Pas stërvitjes" dhe ai
// nuk është as i shënuar, as i kapërcyer. "Si në plan" e shënon dhe lë "Zhbëj"; "Më vonë" e mbyll kartën.

export function PostWorkoutMeal() {
  const { t, fmt } = useI18n()
  const [later, setLater] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logged, setLogged] = useState<{ undo: () => Promise<void> } | null>(null)
  const view = useLocalQuery(async () => {
    const now = store.now()
    const day = await nutritionDay(store, await currentFoodDate(store, now), now)
    return { date: day.date, meal: day.meals.find((meal) => meal.meal === 'post_workout') ?? null }
  }, [])
  const meal = view?.meal
  if (!view || !meal || later) return null
  if (logged) {
    return (
      <section aria-live="polite" className={cn(surfaceClass, 'flex items-center justify-between gap-3 rounded-lg px-3.5 py-2')}>
        <span className="type-body">{t('after.meal.logged')}</span>
        <Button
          variant="ghost"
          onClick={() => {
            void logged.undo().then(() => setLogged(null))
          }}
        >
          {t('foodday.undo')}
        </Button>
      </section>
    )
  }
  if (meal.status === 'done' || meal.status === 'skipped' || meal.template.length === 0) return null
  const protein = Math.round(meal.template.reduce((sum, line) => sum + line.proteinG, 0))
  const action = 'h-auto min-h-touch px-1 py-2 text-[13px] leading-tight font-semibold tracking-normal whitespace-normal normal-case'
  return (
    <section aria-labelledby="post-workout-meal" className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-3.5')}>
      <h2 id="post-workout-meal" className="type-label text-muted-foreground">
        {t('after.meal.title')}
      </h2>
      <p className="type-body tabular-nums">
        {t('after.meal.detail', { foods: meal.template.map((line) => foodName(t, { name: line.name, sourceId: line.sourceId })).join(', '), protein: fmt.unit(protein, 'g') })}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          variant="secondary"
          disabled={busy}
          className={action}
          onClick={() => {
            setBusy(true)
            void logWithUndo(store, view.date, 'post_workout', () => logTemplateMeal(store, view.date, 'post_workout'))
              .then(({ undo }) => setLogged({ undo }))
              .finally(() => setBusy(false))
          }}
        >
          {t('after.meal.plan')}
        </Button>
        <Link to="/ushqimi/shto/post_workout" className={cn(buttonVariants({ variant: 'secondary' }), action)}>
          {t('after.meal.other')}
        </Link>
        <Button variant="ghost" className={action} onClick={() => setLater(true)}>
          {t('after.meal.later')}
        </Button>
      </div>
    </section>
  )
}
