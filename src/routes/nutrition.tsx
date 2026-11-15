import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AskDock } from '@/components/food/ask-dock'
import { DayTimeline } from '@/components/food/day-timeline'
import { DayHero, FoodHeader } from '@/components/food/day-summary'
import { useFoodToast } from '@/components/food/use-food-toast'
import { MealSheet } from '@/components/food/meal-sheet'
import { SupplementsSheet, SupplementStrip } from '@/components/food/supplement-strip'
import { buttonVariants } from '@/components/ui/button-variants'
import { InsightCard } from '@/components/ui/insight-card'
import { store, useLocalQuery } from '@/data/app-data'
import { currentFoodDate, type NutritionDay, nutritionDay, removeDiaryEntry } from '@/data/nutrition'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { shiftDate } from '@/lib/calendar'
import type { MealKey } from '@/nutrition/meals'
import { JIM_RANGE_KG } from '@/nutrition/targets'

// Ushqimi (V59, SPEC §0.3h, bordet "0.42 · Ushqimi i ri"): kreu me ditën (‹ ›) dhe llojin e ditës; kaloritë që mbeten,
// makrot, uji dhe "Plotëso makrot"; rripi i suplementeve; vija e kohës "Dita" me vaktin e radhës të hapur; lidhjet
// (Objektivat, Plani im, Oraret); fusha "Çfarë hëngre?" poshtë. Një vakt hapet në fletë (`?vakti=`) dhe lista e plotë e
// suplementeve në tjetër (`?suplementet=1`), që butoni mbrapa i Android-it t'i mbyllë; dita tjetër është `?data=`.
// Tekstet nga katalogu ('foodday.*', 'food.*'); emrat e shabllonit dhe të suplementeve nga `@/i18n/domain`.

/** Ora rifreskohet çdo minutë, që "Vakti i radhës" dhe "pas 20 min" të ndjekin kohën. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function NutritionPage() {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast, show, clear } = useFoodToast()
  const { t } = useI18n()
  const location = useLocation()
  const asked = params.get('data')
  // Dita e ushqimit (V46): pas mesnate, deri 3 orë para zgjimit, mbetet dita e djeshme. Jo përtej sot + 1.
  const view = useLocalQuery(async () => {
    const today = await currentFoodDate(store, now)
    const last = shiftDate(today, 1)
    const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? (asked > last ? last : asked) : today
    return { today, day: await nutritionDay(store, date, now) }
  }, [now.getTime(), asked])
  // Pas shtimit nga shporta (Shto ushqim) vjen `location.state.added`: njoftimi "U shtua te <vakti>" me "Zhbëj", që heq regjistrimet.
  useEffect(() => {
    const added = (location.state as { added?: { meal: MealKey; kcal: number; ids: string[] } } | null)?.added
    if (!added) return
    show(t('foodday.added', { meal: mealName(t, added.meal), kcal: added.kcal }), async () => {
      for (const id of added.ids) await removeDiaryEntry(store, id)
    })
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location, navigate, show, t])
  const opened = params.get('vakti') as MealKey | null
  const open = (next: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...next })
  const go = (date: string, today: string) => {
    const next = new URLSearchParams(params)
    if (date === today) next.delete('data')
    else next.set('data', date)
    setParams(next, { replace: true })
  }

  if (!view) {
    return (
      <div className="flex flex-col gap-4">
        <FoodHeader />
        <div aria-hidden className="h-36 rounded-xl bg-surface" />
        <div aria-hidden className="h-72 rounded-xl bg-surface" />
        <div aria-hidden className="h-80 rounded-lg bg-surface" />
      </div>
    )
  }
  const { day, today } = view
  const meal = day.meals.find((entry) => entry.meal === opened)

  return (
    <div className="flex flex-col gap-5">
      <FoodHeader day={day} today={today} onGo={(date) => go(date, today)} />
      <DayHero day={day} onToast={show} />
      <SupplementStrip day={day} onOpenList={() => open({ suplementet: '1' })} onToast={show} />
      <DayTimeline day={day} now={now} onOpen={(next) => open({ vakti: next })} onToast={show} />
      <PlanLinks day={day} />
      {/* Vendi i fushës "Çfarë hëngre?" mbi tab-bar-in, që pjesa e fundit të mos mbetet poshtë saj. */}
      <div aria-hidden className="h-[76px] shrink-0" />
      <AskDock day={day} toast={toast} onClearToast={clear} />
      {meal ? <MealSheet day={day} meal={meal} onClose={() => navigate(-1)} onToast={show} /> : null}
      {params.get('suplementet') === '1' ? <SupplementsSheet day={day} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

/** Objektivat · Plani im · Oraret në një rresht; ftesa te kalkulatori dhe shënimet e planit të Jimit poshtë. */
function PlanLinks({ day }: { day: NutritionDay }) {
  const { t } = useI18n()
  const link =
    'flex h-12 min-w-0 items-center justify-center rounded-md border border-border px-2 text-center text-sm leading-5 font-semibold transition-transform duration-100 ease-out hover:bg-surface motion-safe:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
  return (
    <div className="flex flex-col gap-3">
      {day.targetsSource === 'jim' ? (
        <InsightCard
          icon={null}
          actions={
            <Link to="/ushqimi/objektivat" className={buttonVariants({ variant: 'secondary', ground: 'card' })}>
              {t('food.targets.ctaAction')}
            </Link>
          }
        >
          <b className="font-semibold">{t('food.targets.cta')}</b>
          <br />
          {t('food.targets.ctaText')}
        </InsightCard>
      ) : null}
      <nav aria-label={t('food.planNav')} className="grid grid-cols-3 gap-2">
        <Link to="/ushqimi/objektivat" className={link}>
          {t('food.targets.link')}
        </Link>
        <Link to="/ushqimi/plani" className={link}>
          {t('food.plan.title')}
        </Link>
        <Link to="/ushqimi/oraret" className={link}>
          {t('food.schedule.short')}
        </Link>
      </nav>
      {day.targetsSource === 'jim' ? (
        <p className="text-xs leading-4 text-muted-foreground">{t('food.proteinNote', { jimLow: 3.3, jimHigh: 4.1, studyLow: 1.6, studyHigh: 2.2 })}</p>
      ) : null}
      {day.outsideJimRange ? <p className="text-xs leading-4 text-muted-foreground">{t('food.outsideJim', { min: JIM_RANGE_KG.min, max: JIM_RANGE_KG.max })}</p> : null}
    </div>
  )
}
