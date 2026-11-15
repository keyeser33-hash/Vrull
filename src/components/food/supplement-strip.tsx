import { useState } from 'react'
import { Link } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import type { MealSlot, NutritionDay } from '@/data/nutrition'
import { setSupplementEnabled, setSupplementTaken, supplementList } from '@/data/supplements'
import { mealName, supplementDose, supplementEvidence, supplementName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { MealKey } from '@/nutrition/meals'
import type { ShowToast } from './meal-sheet'
import { SupplementChip } from './supplement-chip'

// Rripi i suplementeve (SPEC §0.3h, Q1 dhe raundi 2; bordi "Ushqimi · Dita"): gjurma e ditës me një buton për çdo orë
// me suplemente (e marra me ✓, e hapura me kornizë prushi, të tjerat me numrin), grupi i hapur me çipat ("E mora" me
// "Zhbëj" 6 s), "Të N" për të mbeturat e grupit, dhe "N nga M" që hap fletën e plotë të ditës.

const remaining = (meal: MealSlot) => meal.supplements.filter((item) => !item.taken)
const take = (date: string, meal: MealKey, id: string, taken: boolean) => setSupplementTaken(store, { date, supplementId: id, meal }, taken)

export function SupplementStrip({ day, onOpenList, onToast }: { day: NutritionDay; onOpenList: () => void; onToast: ShowToast }) {
  const { t } = useI18n()
  const slots = day.meals.filter((meal) => meal.supplements.length > 0)
  const [picked, setPicked] = useState<MealKey | 'closed' | null>(null)
  if (slots.length === 0) return null
  const total = slots.reduce((count, meal) => count + meal.supplements.length, 0)
  const taken = slots.reduce((count, meal) => count + meal.supplements.length - remaining(meal).length, 0)
  const fallback = day.next && remaining(day.next).length > 0 ? day.next : slots.find((meal) => remaining(meal).length > 0)
  const openMeal = picked === 'closed' ? undefined : (slots.find((meal) => meal.meal === picked) ?? fallback)
  const done = taken === total

  const takeGroup = (meal: MealSlot) => {
    const items = remaining(meal)
    void (async () => {
      for (const item of items) await take(day.date, meal.meal, item.id, true)
    })()
    setPicked(null)
    onToast(t('foodday.supp.toastGroup', { count: items.length }), async () => {
      for (const item of items) await take(day.date, meal.meal, item.id, false)
    })
  }

  return (
    <section aria-labelledby="supp-title" className={cn(surfaceClass, 'flex flex-col gap-2.5 rounded-xl px-3 pt-1 pb-3')}>
      <div className="flex min-h-touch items-center justify-between gap-2">
        <h2 id="supp-title" className="type-label text-muted-foreground">
          {t('food.supplements')}
        </h2>
        <button
          type="button"
          aria-label={t('foodday.supp.open', { taken, total })}
          onClick={onOpenList}
          className="-mr-1.5 flex min-h-touch items-center gap-0.5 rounded-md pr-1 pl-2.5 text-sm leading-5 font-semibold tabular-nums"
        >
          {t('food.supplementsTaken', { taken, total })}
          <Icon name="poshte" size={16} className="-rotate-90 text-muted-foreground" />
        </button>
      </div>
      <div role="group" aria-label={t('foodday.supp.slots')} className="-mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(48px,1fr))] gap-1.5">
        {slots.map((meal) => {
          const left = remaining(meal).length
          const open = openMeal?.meal === meal.meal
          return (
            <button
              key={meal.meal}
              type="button"
              aria-pressed={open}
              aria-label={left === 0 ? t('foodday.supp.slotDone', { time: meal.time }) : t('foodday.supp.slot', { time: meal.time, count: left })}
              onClick={() => setPicked(open ? 'closed' : meal.meal)}
              className={cn(
                'flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border',
                open ? 'border-2 border-ember-text bg-surface-2 text-foreground' : left === 0 ? 'border-border text-muted-foreground' : 'border-border text-foreground',
              )}
            >
              <span className="text-xs leading-4 text-muted-foreground tabular-nums">{meal.time}</span>
              <span className={cn('text-sm leading-none tabular-nums', open && 'font-bold')}>{left === 0 ? <Icon name="zgjedhur" size={14} /> : left}</span>
            </button>
          )
        })}
      </div>
      {done ? (
        <p className="flex min-h-touch items-center gap-2 text-sm leading-5 font-semibold">
          <Icon name="zgjedhur" size={16} className="text-ember-text" />
          {t('foodday.supp.allDone')}
        </p>
      ) : null}
      {openMeal ? (
        <>
          <div className="flex min-h-touch items-center justify-between gap-2">
            <span className="text-sm leading-5 font-semibold tabular-nums">{t('foodday.supp.group', { meal: mealName(t, openMeal.meal), time: openMeal.time })}</span>
            {remaining(openMeal).length > 1 ? (
              <Button
                variant="secondary"
                aria-label={t('food.takeGroupLabel', { count: remaining(openMeal).length, name: supplementName(t, remaining(openMeal)[0].name), meal: mealName(t, openMeal.meal) })}
                className="px-3.5"
                onClick={() => takeGroup(openMeal)}
              >
                {t('food.takeGroup', { count: remaining(openMeal).length })}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {openMeal.supplements.map((item) => (
              <SupplementChip
                key={item.id}
                item={item}
                onToggle={() => {
                  const name = supplementName(t, item.name)
                  void take(day.date, openMeal.meal, item.id, !item.taken)
                  if (item.taken) return
                  // Grupi që u mbyll kalon te tjetri; pa të, rripi mbetet te ky.
                  if (remaining(openMeal).length === 1) setPicked(null)
                  onToast(t('foodday.supp.toast', { name }), () => take(day.date, openMeal.meal, item.id, false))
                }}
              />
            ))}
          </div>
          {openMeal.supplements.some((item) => item.powder && !item.taken) ? <p className="m-0 text-[13px] leading-[1.35] text-muted-foreground">{t('foodday.supp.powderHint')}</p> : null}
        </>
      ) : null}
    </section>
  )
}

/** Fleta e plotë e ditës (bordi "Ushqimi · Suplementet"): grupet sipas orës me kutinë, dozën dhe evidencën; "Ndrysho listën" i aktivizon ose çaktivizon. */
export function SupplementsSheet({ day, onClose }: { day: NutritionDay; onClose: () => void }) {
  const { t, fmt } = useI18n()
  const [editing, setEditing] = useState(false)
  const list = useLocalQuery(() => supplementList(store), [])
  const slots = day.meals.filter((meal) => meal.supplements.length > 0)
  const total = slots.reduce((count, meal) => count + meal.supplements.length, 0)
  const taken = slots.reduce((count, meal) => count + meal.supplements.filter((item) => item.taken).length, 0)
  const toggle = (
    <Button variant="ghost" className="-ml-2 self-start px-2" onClick={() => setEditing((value) => !value)}>
      {t(editing ? 'foodday.supp.done' : 'food.editList')}
    </Button>
  )
  return (
    <Sheet
      title={t('foodday.supp.sheetTitle')}
      description={t('foodday.supp.sheetDetail', { taken, total, date: fmt.date(new Date(`${day.date}T12:00:00`)) })}
      onClose={onClose}
      footer={
        <Link to="/ushqimi/suplementi" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full gap-2')}>
          <Icon name="plus" size={20} />
          {t('food.supplement.add')}
        </Link>
      }
    >
      {toggle}
      {editing ? (
        <>
          <p className="text-sm leading-5 text-muted-foreground">{t('food.supplementsHint')}</p>
          <ul className="flex flex-col">
            {(list ?? []).map((item) => (
              <li key={item.id} className="flex items-center gap-1 border-t border-border first:border-t-0">
                {item.custom ? (
                  <Link to={`/ushqimi/suplementi/${item.id}`} aria-label={t('food.supplement.editName', { name: item.name })} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0 text-muted-foreground')}>
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
        </>
      ) : (
        <>
          {slots.map((meal) => {
            const left = remaining(meal)
            return (
              <section key={meal.meal} aria-label={t('foodday.supp.group', { meal: mealName(t, meal.meal), time: meal.time })} className="flex flex-col">
                <div className="flex min-h-touch items-center justify-between gap-2">
                  <h3 className="m-0 text-sm leading-5 font-semibold tabular-nums">{t('foodday.supp.group', { meal: mealName(t, meal.meal), time: meal.time })}</h3>
                  {left.length > 1 ? (
                    <Button
                      variant="secondary"
                      className="px-3.5"
                      aria-label={t('food.takeGroupLabel', { count: left.length, name: supplementName(t, left[0].name), meal: mealName(t, meal.meal) })}
                      onClick={() => {
                        void (async () => {
                          for (const item of left) await take(day.date, meal.meal, item.id, true)
                        })()
                      }}
                    >
                      {t('food.takeGroup', { count: left.length })}
                    </Button>
                  ) : null}
                </div>
                <ul className="flex flex-col">
                  {meal.supplements.map((item) => (
                    <li key={item.id}>
                      <label className={cn('flex min-h-14 cursor-pointer items-center gap-3 border-t border-border', item.taken && 'opacity-60')}>
                        <input type="checkbox" checked={item.taken} onChange={() => void take(day.date, meal.meal, item.id, !item.taken)} className="size-5 shrink-0 accent-current" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[15px] leading-5">{supplementName(t, item.name)}</span>
                          <span className="text-xs leading-4 text-muted-foreground tabular-nums">{supplementDose(t, item.name, item.doseText, { amount: item.doseAmount, unit: item.doseUnit, fmt })}</span>
                        </span>
                        <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-1 text-xs leading-4 font-medium text-muted-foreground">{t(`food.evidence.${item.evidence}`)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          <p className="text-[13px] leading-[1.35] text-muted-foreground">{t('foodday.supp.sheetHint')}</p>
        </>
      )}
    </Sheet>
  )
}
