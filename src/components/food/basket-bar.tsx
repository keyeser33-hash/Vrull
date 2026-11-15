import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { type BasketItem, basketTotals } from '@/data/basket'
import { foodName, mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { kcalText } from '@/routes/nutrition-format'
import type { MealKey } from '@/nutrition/meals'
import { chipQuantity } from './food-labels'

// Rripi i shportës poshtë ekranit të kërkimit (bordi "Ushqimi · Kërko"; SPEC §0.3h): çipat me ushqimet (heqja 44 px) dhe
// prushi "Shto te <vakti>" me "N ushqime · kcal · g proteinë"; prekja e fjalës "Shporta" hap rishikimin. Prushi është i
// vetmi i ekranit.

export function BasketBar({ items, meal, busy, onOpen, onRemove, onSubmit }: { items: BasketItem[]; meal: MealKey; busy: boolean; onOpen: () => void; onRemove: (foodId: string) => void; onSubmit: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const totals = basketTotals(items)
  return (
    <section aria-label={t('foodsearch.basket.title')} className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+16px)]">
      <div className="mx-auto flex w-full max-w-[448px] flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <button type="button" aria-label={t('foodsearch.basket.open')} onClick={onOpen} className="flex min-h-11 shrink-0 items-center type-label text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
            {t('foodsearch.basket.title')}
          </button>
          <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {items.map((item) => {
              const name = foodName(t, item)
              return (
                <li key={item.foodId} className="flex h-11 shrink-0 items-center rounded-pill bg-surface-2 pl-3 text-sm font-semibold whitespace-nowrap tabular-nums">
                  <span>
                    {name} · {chipQuantity(i18n, item)}
                  </span>
                  <button type="button" aria-label={t('foodsearch.basket.remove', { food: name })} onClick={() => onRemove(item.foodId)} className="flex h-11 w-10 items-center justify-center text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground">
                    <Icon name="mbyll-vrull" size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <Button variant="primary" size="xl" disabled={busy} className="h-auto min-h-14 flex-col gap-0.5 py-2" onClick={onSubmit}>
          <span>{t('foodsearch.basket.addTo', { meal: mealName(t, meal) })}</span>
          <span className="font-text text-[13px] font-semibold tracking-normal normal-case tabular-nums">
            {t('foodsearch.basket.detail', { count: items.length, kcal: kcalText(i18n, totals.kcal), protein: fmt.number(Math.round(totals.proteinG)) })}
          </span>
        </Button>
      </div>
    </section>
  )
}
