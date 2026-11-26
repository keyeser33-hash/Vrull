import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { type BasketItem, basketTotals } from '@/data/basket'
import type { NutritionDay } from '@/data/nutrition'
import { foodName, mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { gramsText, kcalText, macrosLine } from '@/routes/nutrition-format'
import type { MealKey } from '@/nutrition/meals'
import { FoodTile } from './food-tile'
import { portionLabel, sourceKey } from './food-labels'
import { MealChip } from './meal-chip'

// Rishikimi i shportës (bordi "Ushqimi · Shporta"; SPEC §0.3h): çdo rresht me sasinë që preket dhe heqjen, vakti që
// ndërrohet me një prekje, totali, "Sot pas regjistrimit" kundrejt objektivave, prushi "Shto te <vakti>" dhe "Fshi shportën".

export function BasketSheet({
  items,
  day,
  meal,
  time,
  busy,
  onClose,
  onChangeMeal,
  onEdit,
  onRemove,
  onSubmit,
  onClear,
}: {
  items: BasketItem[]
  day: NutritionDay
  meal: MealKey
  time: string
  busy: boolean
  onClose: () => void
  onChangeMeal: () => void
  onEdit: (foodId: string) => void
  onRemove: (foodId: string) => void
  onSubmit: () => void
  onClear: () => void
}) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const totals = basketTotals(items)
  const after = { kcal: day.totals.kcal + totals.kcal, proteinG: day.totals.proteinG + totals.proteinG }
  const targets = day.targets
  const label = mealName(t, meal)
  const tracks = [
    { key: 'kcal', value: kcalText(i18n, after.kcal), target: targets ? kcalText(i18n, targets.kcal) : null, unit: 'kcal', ratio: targets ? after.kcal / targets.kcal : 0 },
    { key: 'protein', value: fmt.number(after.proteinG, { maxDigits: 1 }), target: targets ? fmt.number(targets.proteinG, { maxDigits: 0 }) : null, unit: 'g P', ratio: targets ? after.proteinG / targets.proteinG : 0 },
  ]
  return (
    <Sheet
      title={t('foodsearch.basket.title')}
      description={t('foodsearch.review.hint', { count: items.length })}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-1">
          <Button variant="primary" size="xl" disabled={busy || items.length === 0} className="h-auto min-h-14 flex-col gap-0.5 py-2" onClick={onSubmit}>
            <span>{t('foodsearch.basket.addTo', { meal: label })}</span>
            <span className="font-text text-[13px] font-semibold tracking-normal normal-case tabular-nums">{t('foodsearch.review.detail', { count: items.length, kcal: kcalText(i18n, totals.kcal) })}</span>
          </Button>
          <Button variant="ghost" className="font-text text-sm font-semibold tracking-normal text-muted-foreground normal-case" disabled={busy} onClick={onClear}>
            {t('foodsearch.review.clear')}
          </Button>
        </div>
      }
    >
      {/* Çipi thotë vetë "Te <vakti> · <ora>". */}
      <MealChip meal={meal} time={time} onClick={onChangeMeal} className="self-start" />
      <ul className="flex shrink-0 flex-col border-b border-border">
        {items.map((item) => {
          const name = foodName(t, item)
          const portion = portionLabel(i18n, item)
          const grams = item.grams === null ? null : gramsText(i18n, item.grams)
          const quantity = grams && portion !== grams ? `${portion} · ${grams}` : portion
          const macros = basketTotals([item])
          return (
            <li key={item.foodId} className="flex min-h-[72px] items-center gap-3 border-t border-border">
              <FoodTile size="md" names={[item.name, name]} />
              <button type="button" aria-label={t('foodsearch.review.quantity', { food: name, quantity })} onClick={() => onEdit(item.foodId)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-0.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground">
                <span className="flex items-center gap-2">
                  <span className="truncate type-body-strong">{name}</span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{t(sourceKey(item))}</span>
                </span>
                <span className="text-sm tabular-nums">
                  <span className="underline decoration-muted-foreground underline-offset-[3px]">{quantity}</span>
                  <span className="text-muted-foreground">{` · ${t('foodday.sheet.lineMacros', { kcal: kcalText(i18n, macros.kcal), protein: Math.round(macros.proteinG) })}`}</span>
                </span>
              </button>
              <Button variant="secondary" size="icon" aria-label={t('foodsearch.basket.remove', { food: name })} onClick={() => onRemove(item.foodId)}>
                <Icon name="mbyll-vrull" size={20} />
              </Button>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onClose} className="flex min-h-11 shrink-0 items-center gap-1.5 self-start type-body-strong text-ember-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        <Icon name="plus" size={18} />
        {t('foodsearch.review.another')}
      </button>
      <div className="flex shrink-0 items-baseline justify-between gap-2 tabular-nums">
        <span className="font-display text-[28px] leading-none font-extrabold">{`${kcalText(i18n, totals.kcal)} kcal`}</span>
        <span className="text-sm text-muted-foreground">{macrosLine(i18n, totals)}</span>
      </div>
      <section
        aria-label={
          targets
            ? t('foodsearch.review.afterLabel', { kcal: kcalText(i18n, after.kcal), kcalTarget: kcalText(i18n, targets.kcal), protein: fmt.number(after.proteinG, { maxDigits: 1 }), proteinTarget: fmt.number(targets.proteinG, { maxDigits: 0 }) })
            : t('foodsearch.review.afterLabelNoTarget', { kcal: kcalText(i18n, after.kcal), protein: fmt.number(after.proteinG, { maxDigits: 1 }) })
        }
        className="flex shrink-0 flex-col gap-2.5 rounded-lg border border-border bg-background px-3.5 py-3"
      >
        <span className="text-[13px] text-muted-foreground">{t('foodsearch.review.after')}</span>
        <div className="grid grid-cols-2 gap-3">
          {tracks.map((track) => (
            <span key={track.key} className="flex min-w-0 flex-col gap-1.5">
              <span className="font-display text-[26px] leading-none font-extrabold whitespace-nowrap tabular-nums">
                {track.value}
                {track.target ? <span className="font-text text-sm font-normal text-muted-foreground">{` / ${track.target} ${track.unit}`}</span> : <span className="font-text text-sm font-normal text-muted-foreground">{` ${track.unit}`}</span>}
              </span>
              {track.target ? <ProgressTrack ratio={track.ratio} ground="page" /> : null}
            </span>
          ))}
        </div>
      </section>
    </Sheet>
  )
}
