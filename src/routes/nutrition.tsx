import { type ReactNode, useEffect, useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Expand } from '@/components/ui/expand'
import { Icon } from '@/components/ui/icons'
import { InsightCard } from '@/components/ui/insight-card'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { RollingNumber } from '@/components/ui/rolling-number'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { setSupplementEnabled, setSupplementTaken, supplementList, toggleSupplement } from '@/data/supplements'
import { currentFoodDate, logTemplateMeal, type MealSlot, type MealSupplement, type NutritionDay, nutritionDay, removeDiaryEntry, setDayType } from '@/data/nutrition'
import { type I18n, NBSP } from '@/i18n'
import { foodName, mealName, nameInSentence, portionText, supplementDose, supplementEvidence, supplementName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import type { MealKey } from '@/nutrition/meals'
import type { Macros } from '@/nutrition/targets'
import { JIM_RANGE_KG } from '@/nutrition/targets'
import { cn } from '@/lib/cn'
import { gramsText, kcalText, macrosLine, relativeTime } from './nutrition-format'
import { QuickActions, QuickMacrosSheet } from './meal-quick'

// Ushqimi (0.23, SPEC §0.3c "Pamja e re", bordi "Ushqimi · pamja e re"): kreu me datën dhe llojin e
// ditës; kaloritë që mbeten si numri i ekranit, me makrot dhe shiritat poshtë; karta "Vakti i radhës"
// me "Si në plan" (veprimi kryesor, prushi) dhe "Ndrysho"; "Dita": vaktet e regjistruara në një rresht
// që hapet, të tjerat me orën; suplementet sipas orës, me një buton për gjithë grupin; në fund
// Objektivat · Plani im · Oraret. Uji mbetet vetëm te Sot. Një vakt hapet në fletë (?vakti=...), që
// butoni mbrapa i Android-it ta mbyllë. Tekstet nga katalogu ('food.*'); emrat e shabllonit dhe të
// suplementeve nga `@/i18n/domain`.

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
        <div aria-hidden className="h-36 rounded-xl bg-surface" />
        <div aria-hidden className="h-72 rounded-xl bg-surface" />
        <div aria-hidden className="h-80 rounded-lg bg-surface" />
      </div>
    )
  }
  const meal = day.meals.find((entry) => entry.meal === opened)

  return (
    <div className="flex flex-col gap-5">
      <FoodHeader day={day} now={now} />
      <DayHero day={day} />
      {day.next ? <NextMeal day={day} meal={day.next} now={now} onEdit={() => openMeal(day.next!.meal)} /> : <DayDone day={day} />}
      <DayMeals day={day} onOpen={openMeal} />
      <Supplements day={day} onEdit={() => setParams({ ndrysho: 'suplementet' })} />
      <PlanLinks day={day} />
      {meal ? <MealSheet date={day.date} meal={meal} onClose={() => navigate(-1)} /> : null}
      {params.get('ndrysho') === 'suplementet' ? <SupplementsSheet onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

/** Kreu: data dhe lloji i ditës, që ndërrohet me një prekje (vlen vetëm për këtë datë). */
function FoodHeader({ day, now }: { day?: NutritionDay; now?: Date }) {
  const { t, fmt } = useI18n()
  const training = day?.dayType === 'training'
  const subtitle =
    day && now ? (
      <span className="tabular-nums">
        {fmt.date(now, { weekday: false })}
        {`${NBSP}·${NBSP}`}
        <button
          type="button"
          aria-label={t(training ? 'food.dayType.toRest' : 'food.dayType.toTraining')}
          onClick={() => void setDayType(store, day.date, training ? 'rest' : 'training')}
          className="-mx-1 -my-[11px] inline-flex min-h-11 min-w-11 items-center rounded-md px-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          {t(training ? 'food.dayType.training' : 'food.dayType.rest')}
        </button>
      </span>
    ) : undefined
  return <ScreenHeader title={t('tab.food')} subtitle={subtitle} />
}

/** "3 037 kcal · P 260 · K 255 · Y 108 g" / "3,037 kcal · P 260 · C 255 · F 108 g". */
const totalsLine = (i18n: I18n, macros: Macros) => i18n.t('food.totals', { kcal: kcalText(i18n, macros.kcal), macros: macrosLine(i18n, macros) })

/**
 * Kaloritë që mbeten (bordi: numri i madh, "1 640 nga 3 020"), pastaj proteina, karbohidratet dhe
 * yndyrat me shiritat kundrejt objektivave. Numrat rrotullohen kur ndryshojnë (`RollingNumber`); mbi
 * objektiv numri thotë sa kaloi dhe shiriti mbetet plot me fjalët "mbi objektiv".
 */
function DayHero({ day }: { day: NutritionDay }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const eaten = Math.round(day.totals.kcal)
  const target = day.targets ? Math.round(day.targets.kcal) : null
  const left = target === null ? null : target - eaten
  const spoken =
    target === null || left === null
      ? t('food.hero.noTargets', { eaten })
      : left >= 0
        ? t('food.hero.left', { eaten, target, left })
        : t('food.hero.over', { eaten, target, over: -left })
  const macros = day.targets
    ? [
        { key: 'protein', label: t('food.protein'), value: Math.round(day.totals.proteinG), target: Math.round(day.targets.proteinG) },
        { key: 'carbs', label: t('food.carbs'), value: Math.round(day.totals.carbsG), target: Math.round(day.targets.carbsG) },
        { key: 'fat', label: t('food.fat'), value: Math.round(day.totals.fatG), target: Math.round(day.targets.fatG) },
      ]
    : []
  return (
    <section aria-label={spoken} className="flex flex-col gap-3.5">
      <div className="flex items-end gap-3">
        <RollingNumber value={left === null ? eaten : Math.abs(left)} format={(value) => kcalText(i18n, value)} className="type-display-xl" />
        <span className="flex min-w-0 flex-col gap-0.5 pb-0.5">
          <span className="type-body-strong">{t(left === null ? 'food.eatenKcal' : left >= 0 ? 'food.left' : 'food.overTarget')}</span>
          {target === null ? null : <span className="type-caption text-muted-foreground tabular-nums">{t('food.eatenOf', { eaten, target })}</span>}
        </span>
      </div>
      {day.targets ? (
        <div className="grid grid-cols-3 gap-3">
          {macros.map((row) => {
            const over = row.value > row.target
            return (
              <div
                key={row.key}
                role="group"
                aria-label={t(over ? 'ui.progress.spokenOver' : 'ui.progress.spoken', { label: row.label, value: row.value, target: row.target, unit: t('food.gramsName') })}
                className="flex min-w-0 flex-col gap-1.5"
              >
                <span aria-hidden className="truncate text-[13px] leading-[1.35] text-muted-foreground">
                  {row.label}
                </span>
                <span aria-hidden className="font-display text-[22px] leading-none font-extrabold whitespace-nowrap tabular-nums">
                  <RollingNumber value={row.value} />
                  <span className="font-text text-[13px] font-normal text-muted-foreground"> / {fmt.unit(row.target, 'g')}</span>
                </span>
                <ProgressTrack ratio={row.target > 0 ? row.value / row.target : 0} ground="page" />
                {over ? (
                  <span aria-hidden className="text-[13px] leading-[1.35] text-muted-foreground">
                    {t('ui.progress.over')}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm leading-5 text-muted-foreground">{t('food.noTargets')}</p>
      )}
    </section>
  )
}

/** Artikujt e shabllonit të Jimit: emri në gjuhën e app-it dhe sasia si te PDF-ja. */
function TemplateLines({ lines }: { lines: MealSlot['template'] }) {
  const { t, fmt } = useI18n()
  return (
    <ul className="flex flex-col border-b border-border tabular-nums">
      {lines.map((item, index) => (
        <li key={`${item.food}-${index}`} className="flex min-h-10 items-center justify-between gap-3 border-t border-border py-1.5 text-[15px] leading-5">
          <span>{foodName(t, { name: item.name, sourceId: item.sourceId })}</span>
          <span className="shrink-0 text-muted-foreground">{portionText(t, fmt, item.portion)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Karta e vetme e ekranit: vakti i radhës me planin; "Si në plan" e regjistron me një prekje. */
function NextMeal({ day, meal, now, onEdit }: { day: NutritionDay; meal: MealSlot; now: Date; onEdit: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [busy, setBusy] = useState(false)
  const when = day.isToday ? `${meal.time} · ${relativeTime(i18n, meal.time, now)}` : meal.time
  return (
    <section aria-labelledby="next-meal" className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl p-4')}>
      <span className="type-caption text-muted-foreground tabular-nums">
        {t('food.next')} · {when}
      </span>
      <h2 id="next-meal" className="type-display-s">
        {mealName(t, meal.meal)}
      </h2>
      {meal.template.length > 0 ? (
        <>
          <TemplateLines lines={meal.template} />
          <span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">
            {t('food.about', { kcal: Math.round(meal.templateTotals.kcal) })} · {macrosLine(i18n, meal.templateTotals)}
          </span>
        </>
      ) : (
        <p className="type-caption text-muted-foreground">{t('food.noTemplate')}</p>
      )}
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2 pt-0.5">
        <Button
          variant="primary"
          size="lg"
          className="min-w-0 px-3"
          disabled={busy || meal.template.length === 0}
          onClick={() => {
            setBusy(true)
            void logTemplateMeal(store, day.date, meal.meal).finally(() => setBusy(false))
          }}
        >
          {t('food.quick.plan')}
        </Button>
        <Button variant="secondary" size="lg" className="min-w-0 px-3" onClick={onEdit}>
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

function statusText(i18n: I18n, meal: MealSlot) {
  return meal.status === 'done' ? i18n.t('food.status.done', { kcal: kcalText(i18n, meal.totals.kcal) }) : i18n.t(`food.status.${meal.status}`)
}

/** Emrat e një liste në fjali: i pari siç është, të tjerët me shkronjë të vogël ("Kreatinë, beta-alaninë, BCAA"). */
const nameList = (names: string[], lang: string) => [...new Set(names)].map((name, index) => (index === 0 ? name : nameInSentence(name, lang))).join(', ')

/** Rreshti që hapet/mbyllet: shigjeta poshtë rrotullohet 150 ms (ndryshim gjendjeje). */
function Chevron({ open }: { open: boolean }) {
  return <Icon name="poshte" size={18} className={cn('text-muted-foreground transition-transform duration-150 ease-out', open && 'rotate-180')} />
}

/**
 * "Dita": vaktet e regjistruara bashkë në një rresht që hapet ("4 vakte të regjistruara", emrat dhe
 * kaloritë), pastaj vaktet e tjera me orën; i radhësi me shenjën "I radhës". Çdo vakt hap fletën e tij.
 */
function DayMeals({ day, onOpen }: { day: NutritionDay; onOpen: (meal: MealKey) => void }) {
  const i18n = useI18n()
  const { t, lang } = i18n
  const listId = useId()
  const [open, setOpen] = useState(false)
  const logged = day.meals.filter((meal) => meal.status === 'done')
  const rest = day.meals.filter((meal) => meal.status !== 'done')
  const loggedKcal = logged.reduce((sum, meal) => sum + meal.totals.kcal, 0)
  return (
    <section aria-labelledby="day-title" className="flex flex-col">
      <h2 id="day-title" className="mb-1.5 type-label text-muted-foreground">
        {t('food.day')}
      </h2>
      <div className="flex flex-col border-b border-border">
        {logged.length > 0 ? (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((value) => !value)}
              className="flex min-h-[52px] w-full items-center gap-3 border-t border-border py-1.5 text-left hover:bg-surface"
            >
              <span aria-hidden className="flex w-12 shrink-0 justify-center text-ember-text">
                <Icon name="zgjedhur" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-5 font-semibold">{t('food.loggedMeals', { count: logged.length })}</span>
                <span className="truncate text-[13px] leading-[1.35] text-muted-foreground">{nameList(logged.map((meal) => mealName(t, meal.meal)), lang)}</span>
              </span>
              <span className="shrink-0 text-sm leading-5 text-muted-foreground tabular-nums">{kcalText(i18n, loggedKcal)} kcal</span>
              <Chevron open={open} />
            </button>
            <Expand open={open}>
              <ul id={listId} className="flex flex-col">
                {logged.map((meal) => (
                  <MealRow key={meal.meal} meal={meal} onOpen={onOpen} end={<span className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{kcalText(i18n, meal.totals.kcal)} kcal</span>} />
                ))}
              </ul>
            </Expand>
          </>
        ) : null}
        <ul className="flex flex-col">
          {rest.map((meal) => {
            const count = meal.supplements.length
            const end =
              meal.status === 'next' ? (
                <span className="flex h-6 shrink-0 items-center rounded-[6px] bg-ember px-2 text-xs leading-4 font-bold text-on-ember">{t('food.status.next')}</span>
              ) : meal.status === 'missed' ? (
                <span className="shrink-0 text-[13px] leading-[1.35] text-muted-foreground">{t('food.status.missed')}</span>
              ) : count > 0 ? (
                <span className="shrink-0 text-[13px] leading-[1.35] text-muted-foreground">{t('food.supplementCount', { count })}</span>
              ) : null
            return <MealRow key={meal.meal} meal={meal} onOpen={onOpen} end={end} extra={meal.status === 'todo' && count > 0 ? t('food.supplementCount', { count }) : undefined} />
          })}
        </ul>
      </div>
    </section>
  )
}

function MealRow({ meal, onOpen, end, extra }: { meal: MealSlot; onOpen: (meal: MealKey) => void; end: ReactNode; extra?: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const next = meal.status === 'next'
  const label = [mealName(t, meal.meal), meal.time, statusText(i18n, meal), extra].filter(Boolean).join(', ')
  return (
    <li>
      <button type="button" onClick={() => onOpen(meal.meal)} aria-label={label} className="flex min-h-12 w-full items-center gap-3 border-t border-border py-1.5 text-left hover:bg-surface">
        <span className={cn('w-12 shrink-0 text-sm leading-5 tabular-nums', next ? 'font-bold text-foreground' : 'text-muted-foreground')}>{meal.time}</span>
        <span className={cn('min-w-0 flex-1 truncate text-[15px] leading-5', (next || meal.status === 'done') && 'font-semibold')}>{mealName(t, meal.meal)}</span>
        {end}
      </button>
    </li>
  )
}

function MealSheet({ date, meal, onClose }: { date: string; meal: MealSlot; onClose: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const [macros, setMacros] = useState(false)
  if (macros) return <QuickMacrosSheet date={date} meal={meal} onClose={() => setMacros(false)} onSaved={() => setMacros(false)} />
  return (
    <Sheet title={`${mealName(t, meal.meal)} · ${meal.time}`} description={meal.entries.length > 0 ? totalsLine(i18n, meal.totals) : t('food.quick.empty')} onClose={onClose}>
      {meal.entries.length > 0 ? (
        <ul className="flex shrink-0 flex-col tabular-nums">
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
      ) : null}
      {/* Vakti me ≤ 2 prekje (V2-E2-16): "Si në plan" mbetet kur vakti ka vetëm proteinën e shënuar "E mora". */}
      <QuickActions date={date} meal={meal} onMacros={() => setMacros(true)} />
    </Sheet>
  )
}

interface Taken {
  meal: MealSlot
  item: MealSupplement
}

/**
 * Suplementet sipas orës (bordi): një rresht për të marrat ("Marrë" dhe emrat), pastaj një rresht për çdo
 * vakt me ato që mbeten, me një buton që i shënon të gjitha ("Të 5"; "E mora" kur është një). Rreshti i
 * të marrave dhe grupet hapen në listën me një kuti për secilin, që një suplement shënohet ose hiqet më vete.
 */
function Supplements({ day, onEdit }: { day: NutritionDay; onEdit: () => void }) {
  const i18n = useI18n()
  const { t, lang } = i18n
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const idBase = useId()
  const slots = day.meals.filter((meal) => meal.supplements.length > 0)
  const total = slots.reduce((count, meal) => count + meal.supplements.length, 0)
  const taken: Taken[] = slots.flatMap((meal) => meal.supplements.filter((item) => item.taken).map((item) => ({ meal, item })))
  const groups = slots.map((meal) => ({ meal, items: meal.supplements.filter((item) => !item.taken) })).filter((group) => group.items.length > 0)
  const toggleOpen = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  // Grupi shënohet një nga një, me rregullat e `setSupplementTaken` (pluhuri që numërohet te ushqimi).
  const takeAll = (meal: MealSlot, items: MealSupplement[]) => {
    setBusy(true)
    void (async () => {
      for (const item of items) await setSupplementTaken(store, { date: day.date, supplementId: item.id, meal: meal.meal }, true)
    })().finally(() => setBusy(false))
  }
  const name = (item: MealSupplement) => supplementName(t, item.name)
  return (
    <section aria-labelledby="supplements-title" className="flex flex-col">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 id="supplements-title" className="type-label text-muted-foreground">
          {t('food.supplements')} <span className="tabular-nums">· {t('food.supplementsTaken', { taken: taken.length, total })}</span>
        </h2>
        <Button variant="ghost" className="-mr-2 px-2" onClick={onEdit}>
          {t('food.editList')}
        </Button>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">{t('food.noSupplements')}</p>
      ) : (
        <div className="flex flex-col border-b border-border">
          {taken.length > 0 ? (
            <div className="border-t border-border">
              <button
                type="button"
                aria-expanded={open.has('taken')}
                aria-controls={`${idBase}-taken`}
                onClick={() => toggleOpen('taken')}
                className="flex min-h-[52px] w-full items-center gap-3 py-1.5 text-left hover:bg-surface"
              >
                <span aria-hidden className="flex w-12 shrink-0 justify-center text-ember-text">
                  <Icon name="zgjedhur" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] leading-5 font-semibold">{t('food.supplementsDone')}</span>
                  <span className="truncate text-[13px] leading-[1.35] text-muted-foreground">{nameList(taken.map(({ item }) => name(item)), lang)}</span>
                </span>
                <Chevron open={open.has('taken')} />
              </button>
              <Expand open={open.has('taken')}>
                <ul id={`${idBase}-taken`} className="flex flex-col pb-1 pl-[60px]">
                  {taken.map(({ meal, item }) => (
                    <SupplementCheck key={`${meal.meal}-${item.id}`} date={day.date} meal={meal} item={item} withMeal />
                  ))}
                </ul>
              </Expand>
            </div>
          ) : null}
          {groups.map(({ meal, items }) => {
            const single = items.length === 1
            const key = meal.meal
            const title = single ? name(items[0]) : `${mealName(t, meal.meal)} · ${items.length}`
            const detail = single ? `${mealName(t, meal.meal)} · ${doseText(i18n, items[0])}` : nameList(items.map(name), lang)
            const text = (
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] leading-5">{title}</span>
                <span className="truncate text-[13px] leading-[1.35] text-muted-foreground">{detail}</span>
              </span>
            )
            return (
              <div key={key} className="border-t border-border">
                <div className="flex min-h-[60px] items-center gap-3 py-1.5">
                  <span className="w-12 shrink-0 text-sm leading-5 text-muted-foreground tabular-nums">{meal.time}</span>
                  {single ? (
                    text
                  ) : (
                    <button
                      type="button"
                      aria-expanded={open.has(key)}
                      aria-controls={`${idBase}-${key}`}
                      onClick={() => toggleOpen(key)}
                      className="flex min-h-touch min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {text}
                      <Chevron open={open.has(key)} />
                    </button>
                  )}
                  <Button
                    variant="secondary"
                    ground="page"
                    className="px-3.5"
                    disabled={busy}
                    aria-label={t('food.takeGroupLabel', { count: items.length, name: name(items[0]), meal: mealName(t, meal.meal) })}
                    onClick={() => takeAll(meal, items)}
                  >
                    {t('food.takeGroup', { count: items.length })}
                  </Button>
                </div>
                {single ? null : (
                  <Expand open={open.has(key)}>
                    <ul id={`${idBase}-${key}`} className="flex flex-col pb-1 pl-[60px]">
                      {items.map((item) => (
                        <SupplementCheck key={item.id} date={day.date} meal={meal} item={item} />
                      ))}
                    </ul>
                  </Expand>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** Doza në gjuhën e app-it ("1,5–5 g", "1 lugë"). */
const doseText = ({ t, fmt }: Pick<I18n, 't' | 'fmt'>, item: MealSupplement) => supplementDose(t, item.name, item.doseText, { amount: item.doseAmount, unit: item.doseUnit, fmt })

/** Një suplement me kutinë e vet: e shënon ose e heq më vete, me dozën dhe evidencën. */
function SupplementCheck({ date, meal, item, withMeal = false }: { date: string; meal: MealSlot; item: MealSupplement; withMeal?: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const dose = doseText(i18n, item)
  return (
    <li>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={item.taken}
          onChange={() => void toggleSupplement(store, { date, supplementId: item.id, meal: meal.meal })}
          className="size-5 shrink-0 accent-current"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] leading-5">{supplementName(t, item.name)}</span>
          <span className="text-xs leading-4 text-muted-foreground tabular-nums">{withMeal ? `${meal.time} · ${mealName(t, meal.meal)} · ${dose}` : dose}</span>
        </span>
        <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-1 text-xs leading-4 font-medium text-muted-foreground">{t(`food.evidence.${item.evidence}`)}</span>
      </label>
    </li>
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
