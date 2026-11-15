import { Sheet } from '@/components/layout/sheet'
import { Icon } from '@/components/ui/icons'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { MealKey } from '@/nutrition/meals'

// Çipi i vaktit "Te Dreka · 13:00" (bordet "Ushqimi · Kërko" dhe "Shporta") dhe fleta ku zgjidhet vakti i ditës.

export interface MealOption {
  meal: MealKey
  time: string
}

export function MealChip({ meal, time, onClick, className }: { meal: MealKey; time: string; onClick: () => void; className?: string }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex min-h-11 shrink-0 items-center gap-1 rounded-pill border border-subtle py-0 pr-2.5 pl-3 text-sm font-semibold whitespace-nowrap text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground', className)}
    >
      {t('foodsearch.mealChip', { meal: mealName(t, meal), time })}
      <Icon name="poshte" size={16} className="text-muted-foreground" />
    </button>
  )
}

export function MealPicker({ meals, selected, onPick, onClose }: { meals: MealOption[]; selected: MealKey; onPick: (meal: MealKey) => void; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet title={t('foodsearch.mealSheet.title')} onClose={onClose}>
      <ul className="flex flex-col">
        {meals.map((option) => (
          <li key={option.meal} className="border-t border-border first:border-t-0">
            <button
              type="button"
              aria-pressed={option.meal === selected}
              onClick={() => onPick(option.meal)}
              className="flex min-h-14 w-full items-center justify-between gap-3 text-left type-body-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
            >
              <span>{t('foodsearch.mealSheet.row', { meal: mealName(t, option.meal), time: option.time })}</span>
              {option.meal === selected ? <Icon name="zgjedhur" size={22} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
