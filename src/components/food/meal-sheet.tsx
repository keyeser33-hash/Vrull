import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon, type IconName } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { type MealSlot, type NutritionDay, removeDiaryEntry, logTemplateMeal } from '@/data/nutrition'
import { copyYesterdayMeal, yesterdayMeal } from '@/data/quick-food'
import { setMealSkipped } from '@/data/schedule-settings'
import { setSupplementTaken } from '@/data/supplements'
import { foodName, mealName, portionText } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { gramsText, kcalText, macrosLine } from '@/routes/nutrition-format'
import { QuickMacrosSheet } from '@/routes/meal-quick'
import { FoodTile } from './food-tile'
import { logWithUndo } from './meal-actions'
import { SupplementChip } from './supplement-chip'
import { useMealPhoto } from './use-meal-photo'

// Fleta e vaktit (bordi "Ushqimi · Fleta e vaktit"; SPEC §0.3h): regjistrimet me heqjen, artikujt e planit me sasinë
// që hap Planin tim dhe "Ndërro", "Shto ushqim", Si dje · Foto · Makrot · Barkodi, suplementet e vaktit si çipa,
// dhe "Si në plan" (prushi, i vetmi i fletës). Pas "Si në plan" ose "Si dje" fleta mbyllet dhe njoftimi jep "Zhbëj".

export type ShowToast = (text: string, undo: () => Promise<unknown> | void) => void

export function MealSheet({ day, meal, onClose, onToast }: { day: NutritionDay; meal: MealSlot; onClose: () => void; onToast: ShowToast }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const [macros, setMacros] = useState(false)
  const [busy, setBusy] = useState(false)
  const photo = useMealPhoto(day.date, meal.meal)
  const yesterday = useLocalQuery(() => yesterdayMeal(store, day.date, meal.meal), [day.date, meal.meal])
  if (macros) return <QuickMacrosSheet date={day.date} meal={meal} onClose={() => setMacros(false)} onSaved={() => setMacros(false)} />

  const label = mealName(t, meal.meal)
  const planLink = (extra = '') => `/ushqimi/plani?vakti=${meal.meal}${day.dayType === 'rest' ? '&dita=pushimi' : ''}${extra}`
  const planned = meal.status !== 'done' && meal.template.length > 0
  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    void (async () => {
      const { kcal, undo } = await logWithUndo(store, day.date, meal.meal, action)
      onClose()
      onToast(t('foodday.added', { meal: label, kcal: Math.round(kcal) }), undo)
    })().finally(() => setBusy(false))
  }
  const description =
    meal.entries.length > 0
      ? t('food.totals', { kcal: kcalText(i18n, meal.totals.kcal), macros: macrosLine(i18n, meal.totals) })
      : planned
        ? t('foodday.sheet.plan', { kcal: kcalText(i18n, meal.templateTotals.kcal), macros: macrosLine(i18n, meal.templateTotals) })
        : t('food.quick.empty')
  const action = 'h-16 min-w-0 flex-col gap-1 px-1 font-text text-[13px] leading-none font-semibold normal-case tracking-normal'
  const grid: { key: string; icon: IconName; text: string; disabled?: boolean; onClick?: () => void; to?: string }[] = [
    { key: 'yesterday', icon: 'rrotullo', text: t('foodday.sheet.yesterday'), disabled: busy || !yesterday, onClick: () => run(() => copyYesterdayMeal(store, day.date, meal.meal)) },
    { key: 'photo', icon: 'kamera', text: t('food.quick.photo'), disabled: photo.disabled, onClick: photo.open },
    { key: 'macros', icon: 'laps', text: t('food.quick.macros'), onClick: () => setMacros(true) },
    { key: 'barcode', icon: 'barkodi-vija', text: t('foodday.sheet.barcode'), to: `/ushqimi/shto/${meal.meal}?barkod=1` },
  ]
  return (
    <Sheet
      title={`${label} · ${meal.time}`}
      description={description}
      onClose={onClose}
      footer={
        planned ? (
          <Button variant="primary" className="h-auto min-h-16 w-full justify-between gap-3 rounded-md px-4 py-2.5 text-left normal-case" disabled={busy} onClick={() => run(() => logTemplateMeal(store, day.date, meal.meal))}>
            <span className="text-2xl leading-none uppercase">{t('food.quick.plan')}</span>
            <span className="shrink-0 font-text text-sm font-medium tracking-normal tabular-nums">{t('foodday.sheet.planDetail', { count: meal.template.length, kcal: Math.round(meal.templateTotals.kcal) })}</span>
          </Button>
        ) : undefined
      }
    >
      {meal.entries.length > 0 ? (
        <ul className="flex shrink-0 flex-col tabular-nums">
          {meal.entries.map((entry) => {
            const name = foodName(t, entry)
            return (
              <li key={entry.id} className="flex min-h-14 items-center gap-3 border-t border-border first:border-t-0">
                <FoodTile size="md" names={[entry.name, name]} />
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
      {planned ? (
        <ul className="flex shrink-0 flex-col border-b border-border tabular-nums">
          {meal.template.map((line, index) => {
            const name = foodName(t, { name: line.name, sourceId: line.sourceId })
            const portion = portionText(t, fmt, line.portion)
            return (
              <li key={`${line.food}-${index}`} className="flex min-h-16 items-center gap-3 border-t border-border">
                <FoodTile size="md" names={[line.name, name]} />
                <Link to={planLink()} aria-label={t('foodday.sheet.quantity', { food: name, portion })} className="flex min-h-[60px] min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
                  <span className="truncate text-base leading-6 font-semibold">{name}</span>
                  <span className="text-sm leading-5">
                    <span className="underline decoration-muted-foreground underline-offset-[3px]">{portion}</span>
                    <span className="text-muted-foreground">{` · ${t('foodday.sheet.lineMacros', { kcal: kcalText(i18n, line.kcal), protein: Math.round(line.proteinG) })}`}</span>
                  </span>
                </Link>
                <Link to={planLink(`&nderro=${index}`)} aria-label={t('foodday.sheet.swap', { food: name })} className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }), 'shrink-0')}>
                  <Icon name="nderro" size={20} />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
      <Link to={`/ushqimi/shto/${meal.meal}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full shrink-0 gap-2')}>
        <Icon name="plus" size={20} />
        {t('foodday.sheet.add')}
      </Link>
      <div className="grid shrink-0 grid-cols-4 gap-2">
        {grid.map((entry) => {
          const content: ReactNode = (
            <>
              <Icon name={entry.icon} size={22} />
              {entry.text}
            </>
          )
          return entry.to ? (
            <Link key={entry.key} to={entry.to} className={cn(buttonVariants({ variant: 'secondary' }), action)}>
              {content}
            </Link>
          ) : (
            <Button key={entry.key} variant="secondary" disabled={entry.disabled} onClick={entry.onClick} className={action}>
              {content}
            </Button>
          )
        })}
      </div>
      {/* "E kapërceva" (V71): vakti mbyllet pa ushqim; njoftimi e hap sërish me "Zhbëj". */}
      {meal.status !== 'done' ? (
        <Button
          variant="ghost"
          className="w-full shrink-0"
          disabled={busy}
          onClick={() => {
            const skip = meal.status !== 'skipped'
            void setMealSkipped(store, day.date, meal.meal, skip)
            onClose()
            if (skip) onToast(t('foodday.skippedToast', { meal: label }), () => setMealSkipped(store, day.date, meal.meal, false))
          }}
        >
          {meal.status === 'skipped' ? t('foodday.unskip') : t('foodday.skip')}
        </Button>
      ) : null}
      {photo.input}
      {meal.supplements.length > 0 ? (
        <div className="flex shrink-0 flex-col gap-2">
          <span className="type-label text-muted-foreground">{t('food.supplements')}</span>
          <div className="flex flex-wrap gap-2">
            {meal.supplements.map((item) => (
              <SupplementChip key={item.id} item={item} onToggle={() => void setSupplementTaken(store, { date: day.date, supplementId: item.id, meal: meal.meal }, !item.taken)} />
            ))}
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
