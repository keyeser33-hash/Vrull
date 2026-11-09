import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { InsightCard } from '@/components/ui/insight-card'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { setSupplementEnabled, supplementList, toggleSupplement } from '@/data/supplements'
import { waterDay } from '@/data/water'
import { currentFoodDate, logTemplateMeal, type MealSlot, type MealStatus, type NutritionDay, nutritionDay, removeDiaryEntry, setDayType } from '@/data/nutrition'
import { type I18n, NBSP } from '@/i18n'
import { foodName, mealName, nameInSentence, portionText, supplementDose, supplementEvidence, supplementName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import type { MealKey } from '@/nutrition/meals'
import type { Macros } from '@/nutrition/targets'
import { JIM_RANGE_KG } from '@/nutrition/targets'
import { cn } from '@/lib/cn'
import { gramsText, kcalText, macrosLine, relativeTime } from './nutrition-format'

// Ushqimi i v1 në sistemin Vrull (V2-E1-05; ekrani i ri vjen me Etapën 2): kreu me butonin e
// profilit, shiriti i kcal të ditës; karta "Vakti i radhës" me artikujt e planit, "Regjistro
// <vaktin>" (veprimi kryesor, prushi) dhe "Ndrysho"; poshtë dita si orar vertikal; në fund makrot
// kundrejt objektivave. Një vakt hapet në fletë (?vakti=...), që butoni mbrapa i Android-it ta mbyllë.
// Tekstet nga katalogu ('food.*'); emrat e shabllonit dhe të suplementeve nga `@/i18n/domain`.

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
  // Dita e ushqimit (V46): pas mesnate, deri 3 orë para zgjimit, mbetet dita e djeshme.
  const day = useLocalQuery(async () => nutritionDay(store, await currentFoodDate(store, now), now), [now.getTime()])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const opened = params.get('vakti') as MealKey | null
  const openMeal = (meal: MealKey) => setParams({ vakti: meal })

  if (!day) {
    return (
      <div className="flex flex-col gap-4">
        <FoodHeader />
        <div aria-hidden className="h-11 rounded-md bg-surface" />
        <div aria-hidden className="h-72 rounded-xl bg-surface" />
        <div aria-hidden className="h-80 rounded-lg bg-surface" />
      </div>
    )
  }
  const meal = day.meals.find((entry) => entry.meal === opened)

  return (
    <div className="flex flex-col gap-5">
      <FoodHeader />
      <DayHeader day={day} now={now} />
      {day.next ? <NextMeal day={day} meal={day.next} now={now} onEdit={() => openMeal(day.next!.meal)} /> : <DayDone day={day} />}
      <Timeline day={day} onOpen={openMeal} />
      <Supplements day={day} onEdit={() => setParams({ ndrysho: 'suplementet' })} />
      <MacroTotals day={day} />
      <WaterTotal date={day.date} />
      {meal ? <MealSheet date={day.date} meal={meal} onClose={() => navigate(-1)} /> : null}
      {params.get('ndrysho') === 'suplementet' ? <SupplementsSheet onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function FoodHeader() {
  const { t } = useI18n()
  return <ScreenHeader title={t('tab.food')} />
}

/** "3 037 kcal · P 260 · K 255 · Y 108 g" / "3,037 kcal · P 260 · C 255 · F 108 g". */
const totalsLine = (i18n: I18n, macros: Macros) => i18n.t('food.totals', { kcal: kcalText(i18n, macros.kcal), macros: macrosLine(i18n, macros) })

function DayHeader({ day, now }: { day: NutritionDay; now: Date }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const training = day.dayType === 'training'
  const progress = day.targets ? Math.min(100, (day.totals.kcal / day.targets.kcal) * 100) : 0
  return (
    <header className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center justify-between gap-3 text-sm leading-5 text-muted-foreground tabular-nums">
        <span className="flex min-w-0 items-center">
          <span className="truncate">{fmt.date(now, { weekday: false })}</span>
          {`${NBSP}·${NBSP}`}
          <button
            type="button"
            aria-label={t(training ? 'food.dayType.toRest' : 'food.dayType.toTraining')}
            onClick={() => void setDayType(store, day.date, training ? 'rest' : 'training')}
            className="-mx-1 min-h-11 min-w-11 shrink-0 rounded-md px-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {t(training ? 'food.dayType.training' : 'food.dayType.rest')}
          </button>
        </span>
        <span className="shrink-0">
          <b className="font-semibold text-foreground">{kcalText(i18n, day.totals.kcal)}</b>
          {day.targets ? ` / ${kcalText(i18n, day.targets.kcal)}` : ''} kcal
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('food.kcalToday')}
        aria-valuemin={0}
        aria-valuemax={day.targets?.kcal ?? 0}
        aria-valuenow={Math.round(day.totals.kcal)}
        className="h-1.5 overflow-hidden rounded-pill bg-track"
      >
        <div className="h-full rounded-pill bg-ember" style={{ width: `${progress}%` }} />
      </div>
    </header>
  )
}

/** Artikujt e shabllonit të Jimit: emri në gjuhën e app-it dhe sasia si te PDF-ja. */
function TemplateLines({ lines, rowClassName, nameClassName, amountClassName }: { lines: MealSlot['template']; rowClassName: string; nameClassName?: string; amountClassName: string }) {
  const { t, fmt } = useI18n()
  return (
    <ul className="flex flex-col tabular-nums">
      {lines.map((item, index) => (
        <li key={`${item.food}-${index}`} className={cn('flex justify-between gap-3 border-t border-border', rowClassName)}>
          <span className={nameClassName}>{foodName(t, { name: item.name, sourceId: item.sourceId })}</span>
          <span className={cn('shrink-0 text-muted-foreground', amountClassName)}>{portionText(t, fmt, item.portion)}</span>
        </li>
      ))}
    </ul>
  )
}

function NextMeal({ day, meal, now, onEdit }: { day: NutritionDay; meal: MealSlot; now: Date; onEdit: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [busy, setBusy] = useState(false)
  const today = day.isToday
  return (
    <section aria-labelledby="next-meal" className={cn(surfaceClass, 'flex flex-col gap-3.5 rounded-xl p-4')}>
      <div className="flex flex-col gap-1">
        <span className="type-label text-muted-foreground">{t('food.next')}</span>
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h2 id="next-meal" className="type-display-s">
            {mealName(t, meal.meal)}
          </h2>
          <span className="type-body text-muted-foreground tabular-nums">
            {meal.time}
            {today ? ` · ${relativeTime(i18n, meal.time, now)}` : ''}
          </span>
        </div>
      </div>
      {meal.template.length > 0 ? (
        <>
          <TemplateLines lines={meal.template} rowClassName="py-[7px] text-sm leading-5" amountClassName="" />
          <div className="flex justify-between gap-3 text-xs leading-4 text-muted-foreground tabular-nums">
            <span>{t('food.about', { kcal: Math.round(meal.templateTotals.kcal) })}</span>
            <span>{macrosLine(i18n, meal.templateTotals)}</span>
          </div>
        </>
      ) : (
        <p className="type-caption text-muted-foreground">{t('food.noTemplate')}</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="min-w-0 flex-1 px-4"
          disabled={busy || meal.template.length === 0}
          onClick={() => {
            setBusy(true)
            void logTemplateMeal(store, day.date, meal.meal).finally(() => setBusy(false))
          }}
        >
          {t(`food.log.${meal.meal}`)}
        </Button>
        <Button variant="secondary" size="lg" className="shrink-0 px-5" onClick={onEdit}>
          {t('food.edit')}
        </Button>
      </div>
    </section>
  )
}

function DayDone({ day }: { day: NutritionDay }) {
  const i18n = useI18n()
  return (
    <section aria-labelledby="day-done" className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-xl p-4')}>
      <h2 id="day-done" className="type-title">
        {i18n.t('food.dayDone')}
      </h2>
      <p className="type-caption text-muted-foreground tabular-nums">{totalsLine(i18n, day.totals)}</p>
    </section>
  )
}

const BADGE: Record<MealStatus, string> = {
  done: 'bg-surface-2 text-success',
  next: 'bg-surface-2 text-foreground',
  todo: 'text-muted-foreground',
  missed: 'text-muted-foreground',
}

const DOT: Record<MealStatus, string> = {
  done: 'bg-foreground',
  next: 'bg-ember ring-[3px] ring-insight-border',
  todo: 'border-[1.5px] border-subtle',
  missed: 'border-[1.5px] border-dashed border-subtle',
}

function statusText(i18n: I18n, meal: MealSlot) {
  return meal.status === 'done' ? i18n.t('food.status.done', { kcal: kcalText(i18n, meal.totals.kcal) }) : i18n.t(`food.status.${meal.status}`)
}

function Timeline({ day, onOpen }: { day: NutritionDay; onOpen: (meal: MealKey) => void }) {
  const i18n = useI18n()
  const { t, lang } = i18n
  return (
    <section aria-labelledby="day-title" className="flex flex-col">
      <h2 id="day-title" className="mb-1 type-label text-muted-foreground">
        {t('food.day')}
      </h2>
      <ol className="flex flex-col">
        {day.meals.map((meal) => (
          <li key={meal.meal}>
            <button
              type="button"
              onClick={() => onOpen(meal.meal)}
              aria-label={`${mealName(t, meal.meal)}, ${meal.time}, ${statusText(i18n, meal)}`}
              className="grid min-h-12 w-full grid-cols-[44px_20px_minmax(0,1fr)_auto] items-center gap-2 rounded-md text-left tabular-nums hover:bg-surface"
            >
              <span className="text-xs leading-4 text-muted-foreground">{meal.time}</span>
              <span aria-hidden className={cn('size-2.5 justify-self-center rounded-full', DOT[meal.status])} />
              <span className="flex min-w-0 flex-col">
                <span className={cn('truncate text-sm leading-5', meal.status === 'todo' || meal.status === 'missed' ? 'text-muted-foreground' : 'font-semibold')}>
                  {mealName(t, meal.meal)}
                </span>
                {meal.supplements.length > 0 ? (
                  <span className="truncate text-xs leading-4 text-muted-foreground">
                    {t('food.withSupplements', { list: meal.supplements.map((item) => nameInSentence(supplementName(t, item.name), lang)).join(', ') })}
                  </span>
                ) : null}
              </span>
              <span className={cn('rounded-full px-2 py-1 text-xs leading-4 font-medium whitespace-nowrap', BADGE[meal.status])}>{statusText(i18n, meal)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function MacroTotals({ day }: { day: NutritionDay }) {
  const { t, fmt } = useI18n()
  // Makrot me ngjyrat e Vrullit: proteina prushi, karbohidratet vjollcë, yndyrat rërë.
  const rows = [
    { key: 'protein', label: t('food.protein'), value: day.totals.proteinG, target: day.targets?.proteinG, fill: 'bg-ember' },
    { key: 'carbs', label: t('food.carbs'), value: day.totals.carbsG, target: day.targets?.carbsG, fill: 'bg-data' },
    { key: 'fat', label: t('food.fat'), value: day.totals.fatG, target: day.targets?.fatG, fill: 'bg-sand' },
  ]
  return (
    <section aria-labelledby="macros-title" className="flex flex-col gap-3">
      <h2 id="macros-title" className="type-label text-muted-foreground">
        {t('food.macrosTitle')}
      </h2>
      {day.targets ? null : <p className="text-sm leading-5 text-muted-foreground">{t('food.noTargets')}</p>}
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
      <dl className="flex flex-col gap-3 tabular-nums">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm leading-5">
              <dt>{row.label}</dt>
              <dd className="text-muted-foreground">
                <b className="font-semibold text-foreground">{fmt.number(Math.round(row.value))}</b>
                {row.target ? ` / ${fmt.number(row.target)}` : ''} g
              </dd>
            </div>
            {row.target ? (
              <div aria-hidden className="h-1.5 overflow-hidden rounded-pill bg-track">
                <div className={cn('h-full rounded-pill', row.fill)} style={{ width: `${Math.min(100, (row.value / row.target) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </dl>
      {day.targetsSource === 'jim' ? (
        <p className="text-xs leading-4 text-muted-foreground">{t('food.proteinNote', { jimLow: 3.3, jimHigh: 4.1, studyLow: 1.6, studyHigh: 2.2 })}</p>
      ) : null}
      <Link
        to="/ushqimi/objektivat"
        className="flex min-h-touch items-center justify-between gap-3 border-t border-border pt-2 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {t('food.targets.link')}
        <Icon name="hap" size={20} className="text-muted-foreground" />
      </Link>
      <Link
        to="/ushqimi/plani"
        className="flex min-h-touch items-center justify-between gap-3 border-t border-border pt-2 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {t('food.plan.title')}
        <Icon name="hap" size={20} className="text-muted-foreground" />
      </Link>
      <Link
        to="/ushqimi/oraret"
        className="flex min-h-touch items-center justify-between gap-3 border-t border-border pt-2 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {t('food.schedule.title')}
        <Icon name="hap" size={20} className="text-muted-foreground" />
      </Link>
      {day.outsideJimRange ? (
        <p className="text-xs leading-4 text-muted-foreground">{t('food.outsideJim', { min: JIM_RANGE_KG.min, max: JIM_RANGE_KG.max })}</p>
      ) : null}
    </section>
  )
}

/** Uji i ditës (V36): totali kundrejt objektivit; gotat shtohen te Sot. */
function WaterTotal({ date }: { date: string }) {
  const { t, fmt } = useI18n()
  const water = useLocalQuery(() => waterDay(store, date), [date])
  if (!water) return null
  const litres = (ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })
  return (
    <div className="flex min-h-touch items-center justify-between gap-3 border-t border-border pt-2 text-sm leading-5 tabular-nums">
      <span>{t('food.water')}</span>
      <span className="text-muted-foreground">
        <b className="font-semibold text-foreground">{litres(water.totalMl)}</b>
        {water.targetMl === null ? ' L' : ` / ${litres(water.targetMl)} L`}
      </span>
    </div>
  )
}

function MealSheet({ date, meal, onClose }: { date: string; meal: MealSlot; onClose: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={`${mealName(t, meal.meal)} · ${meal.time}`} onClose={onClose}>
      {meal.entries.length > 0 ? (
        <>
          <ul className="flex flex-col tabular-nums">
            {meal.entries.map((entry) => {
              const name = foodName(t, entry)
              return (
                <li key={entry.id} className="flex min-h-12 items-center gap-3 border-t border-border first:border-t-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base leading-6">{name}</span>
                    <span className="text-xs leading-4 text-muted-foreground">
                      {entry.grams === null ? '' : `${gramsText(i18n, entry.grams)} · `}
                      {kcalText(i18n, entry.kcal)} kcal
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={t('food.remove', { food: name })} onClick={() => void removeDiaryEntry(store, entry.id)}>
                    <Icon name="fshi" size={20} />
                  </Button>
                </li>
              )
            })}
          </ul>
          <p className="text-sm leading-5 text-muted-foreground tabular-nums">{totalsLine(i18n, meal.totals)}</p>
          {meal.status === 'done' ? null : (
            // Vetëm proteina e shënuar "E mora": plani i vaktit mbetet për t'u regjistruar.
            <Button
              variant="secondary"
              size="lg"
              disabled={busy || meal.template.length === 0}
              onClick={() => {
                setBusy(true)
                void logTemplateMeal(store, date, meal.meal).finally(() => setBusy(false))
              }}
            >
              {t('food.logPlan')}
            </Button>
          )}
          <AddFoodLink meal={meal.meal} />
        </>
      ) : (
        <>
          <p className="text-sm leading-5 text-muted-foreground">{t('food.fromPlan')}</p>
          <TemplateLines lines={meal.template} rowClassName="min-h-11 items-center first:border-t-0" nameClassName="text-base leading-6" amountClassName="text-sm leading-5" />
          <Button
            variant="secondary"
            size="lg"
            disabled={busy || meal.template.length === 0}
            onClick={() => {
              setBusy(true)
              void logTemplateMeal(store, date, meal.meal).finally(() => setBusy(false))
            }}
          >
            {t('food.logPlan')}
          </Button>
          <AddFoodLink meal={meal.meal} />
        </>
      )}
    </Sheet>
  )
}

function AddFoodLink({ meal }: { meal: MealKey }) {
  const { t } = useI18n()
  return (
    <Link to={`/ushqimi/shto/${meal}`} replace className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
      <Icon name="shto" size={20} />
      {t('food.add')}
    </Link>
  )
}

function Supplements({ day, onEdit }: { day: NutritionDay; onEdit: () => void }) {
  const { t, fmt } = useI18n()
  const meals = day.meals.filter((meal) => meal.supplements.length > 0)
  const total = meals.reduce((count, meal) => count + meal.supplements.length, 0)
  const taken = meals.reduce((count, meal) => count + meal.supplements.filter((item) => item.taken).length, 0)
  return (
    <section aria-labelledby="supplements-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="supplements-title" className="type-label text-muted-foreground">
          {t('food.supplements')} <span className="tabular-nums">· {t('food.supplementsTaken', { taken, total })}</span>
        </h2>
        <Button variant="ghost" onClick={onEdit}>
          {t('food.editList')}
        </Button>
      </div>
      {meals.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">{t('food.noSupplements')}</p>
      ) : (
        <div className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
          {meals.map((meal) => (
            <fieldset key={meal.meal} className="border-t border-border px-4 py-1 first:border-t-0">
              <legend className="sr-only">
                {mealName(t, meal.meal)}, {meal.time}
              </legend>
              <span aria-hidden className="block pt-2 text-xs leading-4 text-muted-foreground tabular-nums">
                {meal.time} · {mealName(t, meal.meal)}
              </span>
              {meal.supplements.map((item) => (
                <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.taken}
                    onChange={() => void toggleSupplement(store, { date: day.date, supplementId: item.id, meal: meal.meal })}
                    className="size-5 shrink-0 accent-current"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('text-base leading-6', item.taken && 'text-muted-foreground line-through')}>{supplementName(t, item.name)}</span>
                    <span className="text-xs leading-4 text-muted-foreground">{supplementDose(t, item.name, item.doseText, { amount: item.doseAmount, unit: item.doseUnit, fmt })}</span>
                  </span>
                  <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-1 text-xs leading-4 font-medium text-muted-foreground">{t(`food.evidence.${item.evidence}`)}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </section>
  )
}

function SupplementsSheet({ onClose }: { onClose: () => void }) {
  const { t, fmt } = useI18n()
  const list = useLocalQuery(() => supplementList(store), [])
  return (
    <Sheet
      title={t('food.supplements')}
      onClose={onClose}
      footer={
        <Link to="/ushqimi/suplementi" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full gap-2')}>
          <Icon name="plus" size={20} />
          {t('food.supplement.add')}
        </Link>
      }
    >
      <p className="text-sm leading-5 text-muted-foreground">{t('food.supplementsHint')}</p>
      <ul className="flex flex-col">
        {(list ?? []).map((item) => (
          <li key={item.id} className="flex items-center gap-1 border-t border-border first:border-t-0">
            {item.custom ? (
              <Link
                to={`/ushqimi/suplementi/${item.id}`}
                aria-label={t('food.supplement.editName', { name: item.name })}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0 text-muted-foreground')}
              >
                <Icon name="laps" size={18} />
              </Link>
            ) : null}
            <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base leading-6">{supplementName(t, item.name)}</span>
                <span className="text-xs leading-4 text-muted-foreground">
                  {supplementDose(t, item.name, item.doseText, { amount: item.doseAmount, unit: item.doseUnit, fmt })} · {supplementEvidence(t, item.name, item.evidence)}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={item.enabled}
                onChange={(event) => void setSupplementEnabled(store, item.id, event.currentTarget.checked)}
                className="size-5 shrink-0 accent-current"
              />
            </label>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
