import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { jimFoodOptions, type MyPlanItem, myPlanTotals, pdfFoodOptions, resetMyPlan, saveMyPlanMeal, userFoodOptions } from '@/data/my-plan'
import { type MealSlot, type NutritionDay, planDay } from '@/data/nutrition'
import { readProfile } from '@/data/profile'
import { foodName, mealName, nameInSentence, portionText } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { sumMacros } from '@/nutrition/jim'
import { isProteinFood, macrosOf, withinPlanTargets } from '@/nutrition/my-plan'
import type { DayType } from '@/nutrition/targets'
import { Segmented, StepButton } from './builder-parts'
import { kcalText } from './nutrition-format'

// Ushqimi › Plani im (V34, V2-E2-05, bordet "Plani im", "Vakti" dhe "Ndërro ushqimin"): vaktet e
// ditës së stërvitjes dhe të pushimit me totalin kundrejt objektivave. Fleta e vaktit (`?vakti=`)
// ndryshon porcionet me hapin e njësisë dhe ndërron ose shton ushqime (`&nderro=<nr>` ose `shto`);
// butoni mbrapa i Android-it mbyll fletën e sipërme.

const REST = 'pushimi'
const ADD = 'shto'


export function MyPlanPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const dayType: DayType = params.get('dita') === REST ? 'rest' : 'training'
  const data = useLocalQuery(async () => {
    const [day, profile] = await Promise.all([planDay(store, dayType, now), readProfile(store)])
    return { day, training: profile.trainingDays.length > 0 }
  }, [dayType, now])
  const header = <BackHeader title={t('food.plan.title')} back={t('tab.food')} fallback="/ushqimi" />
  if (!data) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div aria-hidden className="h-36 rounded-xl bg-surface" />
        <div aria-hidden className="h-96 rounded-lg bg-surface" />
      </div>
    )
  }
  const { day } = data
  const open = (next: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...next })
  const opened = day.meals.find((entry) => entry.meal === params.get('vakti'))

  return (
    <div className="flex flex-col gap-4">
      {header}
      {data.training ? (
        <Segmented
          label={t('food.plan.dayType')}
          value={day.dayType}
          onChange={(next) => setParams(next === 'rest' ? { dita: REST } : {}, { replace: true })}
          options={[
            { value: 'training', label: t('food.plan.dayTraining') },
            { value: 'rest', label: t('food.plan.dayRest') },
          ]}
        />
      ) : null}
      <PlanTotals day={day} />
      <p className="text-sm leading-[1.4] text-muted-foreground">
        {t(day.jimChosen ? 'food.plan.noteJimChosen' : day.targetsSource === 'jim' ? 'food.plan.noteJim' : day.planCustom ? 'food.plan.noteCustom' : 'food.plan.note')}
      </p>
      <MealList day={day} onOpen={(meal) => open({ vakti: meal })} />
      <Link to="/ushqimi/oraret" className={cn(buttonVariants({ variant: 'secondary', ground: 'page', size: 'lg' }), 'gap-2')}>
        <Icon name="kalendari" size={20} />
        {t('food.schedule.title')}
      </Link>
      {day.planCustom ? <ResetPlan dayType={day.dayType} /> : null}
      {opened ? (
        <MealSheet
          key={`${day.dayType}-${opened.meal}`}
          day={day}
          slot={opened}
          swap={params.get('nderro')}
          onSwap={(index) => open({ nderro: index === null ? ADD : String(index) })}
          onClose={() => navigate(-1)}
        />
      ) : null}
    </div>
  )
}

function PlanTotals({ day }: { day: NutritionDay }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const totals = sumMacros(day.meals.map((meal) => meal.templateTotals))
  const targets = day.targets
  const within = targets ? withinPlanTargets(totals, targets) : false
  const rows = [
    { key: 'protein', label: t('food.protein'), value: totals.proteinG, target: targets?.proteinG },
    { key: 'carbs', label: t('food.carbs'), value: totals.carbsG, target: targets?.carbsG },
    { key: 'fat', label: t('food.fat'), value: totals.fatG, target: targets?.fatG },
  ]
  return (
    <section aria-label={t('food.plan.totals')} className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl px-4 py-3.5')}>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
        <span className="flex items-end gap-2.5 tabular-nums">
          <span className="font-display text-[52px] leading-[0.85] font-extrabold">{kcalText(i18n, totals.kcal)}</span>
          <span className="pb-0.5 text-sm text-muted-foreground">{targets ? t('food.plan.of', { target: kcalText(i18n, targets.kcal) }) : 'kcal'}</span>
        </span>
        {targets ? (
          <span className={cn('flex items-center gap-1.5 text-sm font-semibold', within ? 'text-success' : 'text-muted-foreground')}>
            {within ? <Icon name="zgjedhur" size={18} /> : null}
            {t(within ? 'food.plan.within' : 'food.plan.away')}
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 tabular-nums">
        {rows.map((row, index) => (
          <div key={row.key} className={cn('flex min-w-0 flex-col gap-0.5', index > 0 && 'border-l border-border pl-3')}>
            <dt className="truncate text-[13px] text-muted-foreground">{row.label}</dt>
            <dd className="font-display text-[22px] font-extrabold">
              {row.target ? (
                <>
                  {fmt.number(Math.round(row.value))}
                  <span className="text-sm font-semibold text-muted-foreground">{`/${fmt.unit(Math.round(row.target), 'g')}`}</span>
                </>
              ) : (
                fmt.unit(Math.round(row.value), 'g')
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** "Ton ½ kanoçe, bukë integrale 2 feta": emri dhe sasia e çdo artikulli. */
function useSummary() {
  const { t, fmt, lang } = useI18n()
  return (lines: readonly { name: string; sourceId: string | null; portion: MealSlot['template'][number]['portion'] }[]) =>
    lines
      .map((line, index) => {
        const name = index === 0 ? foodName(t, line) : nameInSentence(foodName(t, line), lang)
        const portion = portionText(t, fmt, line.portion)
        // "½ pjepër" e thotë vetë emrin: pa "Pjepër ½ pjepër".
        return portion.toLocaleLowerCase(lang).includes(name.toLocaleLowerCase(lang)) ? portion : `${name} ${portion}`
      })
      .join(', ')
}

function MealList({ day, onOpen }: { day: NutritionDay; onOpen: (meal: MealSlot['meal']) => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const summary = useSummary()
  return (
    <ol aria-label={t('food.plan.meals')} className="m-0 flex list-none flex-col p-0">
      {day.meals.map((meal) => (
        <li key={meal.meal} className="border-b border-border last:border-b-0">
          <button
            type="button"
            onClick={() => onOpen(meal.meal)}
            className="grid min-h-[76px] w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <span className="font-display text-[19px] font-bold tabular-nums">{meal.time}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-semibold">{mealName(t, meal.meal)}</span>
              <span className="text-sm leading-[1.35] text-muted-foreground">{meal.template.length > 0 ? summary(meal.template) : t('food.plan.empty')}</span>
            </span>
            <span className="flex flex-col items-end gap-0.5 tabular-nums">
              <span className="text-[15px] font-semibold">{kcalText(i18n, meal.templateTotals.kcal)}</span>
              <span className="text-[13px] text-muted-foreground">{t('food.plan.protein', { grams: Math.round(meal.templateTotals.proteinG) })}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function ResetPlan({ dayType }: { dayType: DayType }) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button variant="ghost" className="self-center text-[15px] font-normal text-muted-foreground underline underline-offset-[3px]" onClick={() => setConfirming(true)}>
        {t('food.plan.reset')}
      </Button>
    )
  }
  return (
    <div role="group" aria-label={t('food.plan.reset')} className={cn(surfaceClass, 'flex flex-col gap-3 rounded-lg p-4')}>
      <p className="text-sm leading-5">{t('food.plan.resetConfirm')}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => void resetMyPlan(store, dayType)}>
          {t('food.plan.resetYes')}
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}

const sameItems = (a: readonly MyPlanItem[], b: readonly MyPlanItem[]) => a.length === b.length && a.every((item, index) => item.food === b[index].food && item.count === b[index].count)

function MealSheet({
  day,
  slot,
  swap,
  onSwap,
  onClose,
}: {
  day: NutritionDay
  slot: MealSlot
  /** `nderro` nga adresa: numri i artikullit, `shto`, ose null kur fleta e ndërrimit është e mbyllur. */
  swap: string | null
  onSwap: (index: number | null) => void
  onClose: () => void
}) {
  const i18n = useI18n()
  const { t } = i18n
  const [initial] = useState(() => slot.template.map((line) => line.item))
  const [items, setItems] = useState(initial)
  const [expanded, setExpanded] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const totals = myPlanTotals([{ meal: slot.meal, items }])
  const dayTotals = sumMacros([...day.meals.filter((meal) => meal.meal !== slot.meal).map((meal) => meal.templateTotals), totals])
  const name = mealName(t, slot.meal)

  if (swap !== null) {
    const index = swap === ADD ? null : Number(swap)
    const item = index !== null && Number.isInteger(index) ? (items[index] ?? null) : null
    return (
      <SwapSheet
        item={item}
        onClose={onClose}
        onPick={(option) => {
          if (item && index !== null) setItems((current) => current.map((entry, position) => (position === index ? option : entry)))
          else {
            setItems((current) => [...current, option])
            setExpanded(items.length)
          }
          onClose()
        }}
      />
    )
  }

  const change = (index: number, direction: -1 | 1) => {
    const item = items[index]
    const count = Math.round((item.count + direction * item.step) * 100) / 100
    if (count < item.step) {
      setItems((current) => current.filter((_, position) => position !== index))
      setExpanded(-1)
      return
    }
    setItems((current) => current.map((entry, position) => (position === index ? { ...entry, count, grams: Math.round(count * entry.unitGrams * 100) / 100 } : entry)))
  }

  async function save() {
    setBusy(true)
    setFailed(false)
    try {
      const current = day.meals.map((meal) => ({ meal: meal.meal, items: meal.template.map((line) => line.item) }))
      await saveMyPlanMeal(store, day.dayType, current, slot.meal, items)
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={name}
      description={t('food.plan.mealMeta', { time: slot.time, day: t(day.dayType === 'training' ? 'food.plan.dayTraining' : 'food.plan.dayRest') })}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2.5">
          {day.targets ? (
            <p className="text-[13px] leading-[1.35] text-muted-foreground tabular-nums">
              {t('food.plan.dayWith', {
                kcal: kcalText(i18n, dayTotals.kcal),
                target: kcalText(i18n, day.targets.kcal),
                protein: Math.round(dayTotals.proteinG),
                targetProtein: Math.round(day.targets.proteinG),
              })}
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="text-sm text-danger">
              {t('food.schedule.saveFailed')}
            </p>
          ) : null}
          <Button variant="primary" size="xl" disabled={busy || sameItems(items, initial)} onClick={save}>
            {t('food.plan.saveMeal')}
          </Button>
        </div>
      }
    >
      <p className="flex items-baseline gap-2 tabular-nums">
        <span className="font-display text-[28px] leading-none font-extrabold">{kcalText(i18n, totals.kcal)}</span>
        <span className="text-[13px] text-muted-foreground">{t('food.plan.kcalProtein', { protein: Math.round(totals.proteinG) })}</span>
      </p>
      {items.length > 0 ? (
        <ul aria-label={t('food.plan.items', { meal: name })} className="m-0 flex list-none flex-col p-0">
          {items.map((item, index) => (
            <ItemRow
              key={`${item.food}-${index}`}
              item={item}
              expanded={index === expanded}
              onExpand={() => setExpanded(index)}
              onSwap={() => onSwap(index)}
              onChange={(direction) => change(index, direction)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('food.plan.empty')}</p>
      )}
      <Button variant="outline" className="gap-2" onClick={() => onSwap(null)}>
        <Icon name="plus" size={20} />
        {t('food.plan.add')}
      </Button>
    </Sheet>
  )
}

function ItemRow({ item, expanded, onExpand, onSwap, onChange }: { item: MyPlanItem; expanded: boolean; onExpand: () => void; onSwap: () => void; onChange: (direction: -1 | 1) => void }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const name = foodName(t, item)
  const inSentence = nameInSentence(name, lang)
  const portion = portionText(t, fmt, { count: item.count, unit: item.unit })
  const macros = macrosOf(item)
  const macroText = t('food.plan.itemMacros', { kcal: kcalText(i18n, macros.kcal), protein: Math.round(macros.proteinG) })
  const detail = item.unit === 'gram' ? macroText : `${fmt.unit(Math.round(item.grams), 'g')} · ${macroText}`
  const atMinimum = item.count - item.step < item.step - 1e-9
  return (
    <li className="flex flex-col gap-2 border-t border-border py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold">{expanded ? name : `${name} · ${portion}`}</span>
          <span className="text-[13px] text-muted-foreground tabular-nums">{detail}</span>
        </span>
        {expanded ? (
          <Button variant="outline" className="shrink-0 gap-1.5 px-3 text-[17px]" onClick={onSwap}>
            <Icon name="nderro" size={18} />
            {t('food.plan.swap')}
          </Button>
        ) : (
          <span className="flex shrink-0 gap-1.5">
            <Button variant="secondary" ground="card" size="icon" aria-label={t('food.plan.editPortion', { food: inSentence })} onClick={onExpand}>
              <Icon name="laps" size={18} />
            </Button>
            <Button variant="outline" size="icon" aria-label={t('food.plan.swapFood', { food: inSentence })} onClick={onSwap}>
              <Icon name="nderro" size={18} />
            </Button>
          </span>
        )}
      </div>
      {expanded ? (
        <div role="group" aria-label={t('food.plan.portion', { food: inSentence })} className="flex items-center gap-1.5">
          <StepButton label={t(atMinimum ? 'food.plan.remove' : 'food.plan.less', { food: inSentence })} sign="−" onClick={() => onChange(-1)} />
          <span aria-live="polite" className="flex-1 text-center font-display text-[22px] font-extrabold tabular-nums">
            {portion}
          </span>
          <StepButton label={t('food.plan.more', { food: inSentence })} sign="+" onClick={() => onChange(1)} />
        </div>
      ) : null}
    </li>
  )
}

function SwapSheet({ item, onPick, onClose }: { item: MyPlanItem | null; onPick: (option: MyPlanItem) => void; onClose: () => void }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<MyPlanItem | null>(null)
  const yours = useLocalQuery(() => userFoodOptions(store, item, query), [item, query])
  const fold = (text: string) => text.toLocaleLowerCase(lang).normalize('NFD').replace(/\p{M}/gu, '')
  const matches = (option: MyPlanItem) => !query.trim() || fold(foodName(t, option)).includes(fold(query.trim()))
  // Zëvendësimet e PDF-së së pari (V34), pastaj ushqimet e shabllonit dhe ato të përdoruesit.
  const pdf = pdfFoodOptions(item, matches, query.trim() !== '')
  const jim = jimFoodOptions(item).filter((option) => matches(option) && !pdf.some((entry) => entry.food === option.food))
  const base = item ? macrosOf(item) : null
  const name = item ? nameInSentence(foodName(t, item), lang) : ''
  const hint = !item || !base ? t('food.plan.addHint') : isProteinFood(item) ? t('food.plan.swapHintProtein', { grams: fmt.unit(Math.round(base.proteinG), 'g') }) : t('food.plan.swapHintKcal', { kcal: kcalText(i18n, base.kcal) })
  const chosen = selected ? nameInSentence(foodName(t, selected), lang) : ''

  const row = (option: MyPlanItem) => {
    const macros = macrosOf(option)
    const delta = base ? Math.round(macros.kcal - base.kcal) : null
    const isSelected = selected?.food === option.food
    return (
      <li key={option.food}>
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => setSelected(option)}
          className={cn(
            'flex min-h-row w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
            isSelected ? 'border-ember-text bg-surface-2' : 'border-border',
          )}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-base font-semibold">{`${foodName(t, option)} · ${portionText(t, fmt, { count: option.count, unit: option.unit })}`}</span>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {t('food.plan.macros', { kcal: kcalText(i18n, macros.kcal), protein: Math.round(macros.proteinG), fat: Math.round(macros.fatG) })}
            </span>
          </span>
          {delta !== null ? (
            <span className="shrink-0 font-display text-lg font-bold tabular-nums">{`${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${fmt.number(Math.abs(delta))}`}</span>
          ) : null}
        </button>
      </li>
    )
  }

  return (
    <Sheet
      title={item ? t('food.plan.swapFood', { food: name }) : t('food.plan.addTitle')}
      description={hint}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" disabled={!selected} onClick={() => selected && onPick(selected)}>
          {selected ? t(item ? 'food.plan.swapWith' : 'food.plan.addFood', { food: chosen }) : t(item ? 'food.plan.swap' : 'food.plan.add')}
        </Button>
      }
    >
      <input type="search" aria-label={t('food.plan.search')} placeholder={t('food.plan.search')} value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, 'shrink-0')} />
      {pdf.length > 0 ? (
        <section aria-labelledby="swap-pdf" className="flex flex-col gap-2">
          <h3 id="swap-pdf" className="type-label text-muted-foreground">
            {t('food.plan.fromPdf')}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">{pdf.map(row)}</ul>
        </section>
      ) : null}
      {jim.length > 0 ? (
        <section aria-labelledby="swap-jim" className="flex flex-col gap-2">
          <h3 id="swap-jim" className="type-label text-muted-foreground">
            {t('food.plan.fromJim')}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">{jim.map(row)}</ul>
        </section>
      ) : null}
      <section aria-labelledby="swap-yours" className="flex flex-col gap-2">
        <h3 id="swap-yours" className="type-label text-muted-foreground">
          {t('food.plan.fromYours')}
        </h3>
        {yours && yours.length > 0 ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{yours.map(row)}</ul> : <p className="text-sm text-muted-foreground">{t('food.plan.noFoods')}</p>}
      </section>
    </Sheet>
  )
}
