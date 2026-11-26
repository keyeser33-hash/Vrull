import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { InsightCard } from '@/components/ui/insight-card'
import { store, useLocalQuery } from '@/data/app-data'
import { currentFoodDate } from '@/data/nutrition'
import { type FoodLogging, MEAL_SETS, mealPlanOn, readSchedule, saveFoodSetup } from '@/data/schedule-settings'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { shiftDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'

// Nisja e Ushqimit (V68, V69; bordet "1 · Plani im" dhe "13 · Hapat e parë" te kanavaca "Vrull - Propozimi UX"): sa
// vakte ha përdoruesi (3, 4 ose 5) dhe kur i shënon (gjatë ditës ose në mbrëmje). "Ruaj" heq vaktet e tepërta nga
// plani (nga nesër), ruan mënyrën e regjistrimit dhe hap Planin tim, ku përdoruesi shkruan çfarë ha zakonisht.

const COUNTS = [3, 4, 5] as const
const MODES: readonly FoodLogging[] = ['day', 'evening']
const option = 'min-h-12 rounded-md border px-3 py-2 text-center text-[15px] leading-5 font-semibold transition-transform duration-100 ease-out motion-safe:active:scale-[0.97]'
const picked = (on: boolean) => (on ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground')

export function FoodSetupPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const saved = useLocalQuery(async () => {
    const today = await currentFoodDate(store, store.now())
    const schedule = await readSchedule(store)
    // Numri i tanishëm i vakteve (pa ato rreth stërvitjes), i afruar te 3–5.
    const kept = 7 - mealPlanOn(schedule.plan, shiftDate(today, 1)).removed.filter((meal) => meal !== 'pre_workout' && meal !== 'post_workout').length
    return { today, meals: (kept <= 3 ? 3 : kept >= 5 && kept < 7 ? 5 : 4) as 3 | 4 | 5, logging: schedule.plan.logging }
  }, [])
  const [meals, setMeals] = useState<3 | 4 | 5 | null>(null)
  const [logging, setLogging] = useState<FoodLogging | null>(null)
  const [busy, setBusy] = useState(false)

  if (!saved) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title={t('foodday.setup.title')} fallback="/ushqimi" back={t('foodday.setup.back')} />
        <div aria-hidden className="h-40 rounded-lg bg-surface" />
      </div>
    )
  }
  const count = meals ?? saved.meals
  const mode = logging ?? saved.logging ?? 'evening'
  return (
    <div className="flex min-h-full flex-col gap-5">
      <BackHeader title={t('foodday.setup.title')} subtitle={t('foodday.setup.intro')} fallback="/ushqimi" back={t('foodday.setup.back')} />
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 type-label text-muted-foreground">{t('foodday.setup.meals')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {COUNTS.map((value) => (
            <button key={value} type="button" aria-pressed={count === value} onClick={() => setMeals(value)} className={cn(option, picked(count === value))}>
              {t('foodday.setup.mealsOption', { count: value })}
            </button>
          ))}
        </div>
        <p className="text-sm leading-5 text-muted-foreground">{t('foodday.setup.mealsList', { meals: MEAL_SETS[count].map((meal) => mealName(t, meal)).join(', ') })}</p>
      </fieldset>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 type-label text-muted-foreground">{t('foodday.setup.logging')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setLogging(value)} className={cn(option, 'min-h-16', picked(mode === value))}>
              {t(`foodday.setup.logging.${value}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <InsightCard icon={null}>
        <b className="font-semibold">{t('foodday.setup.effect')}</b>
        <br />
        {t(`foodday.setup.effect.${mode}`)}
      </InsightCard>
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <p className="text-center type-caption text-muted-foreground">{t('foodday.setup.fromTomorrow')}</p>
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void saveFoodSetup(store, { meals: count, logging: mode }, saved.today).then(() => navigate('/ushqimi/plani', { replace: true }))
          }}
        >
          {t('foodday.setup.save')}
        </Button>
      </div>
    </div>
  )
}
