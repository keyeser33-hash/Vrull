import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { store } from '@/data/app-data'
import { moveDiaryEntries } from '@/data/meal-move'
import type { MealSlot, NutritionDay } from '@/data/nutrition'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { shiftDate } from '@/lib/calendar'
import type { ShowToast } from './meal-sheet'

// "Zhvendos" (V73): një vakt i shënuar gabim shkon te një vakt tjetër i ditës ose te dita e djeshme
// me një prekje; njoftimi e kthen me "Zhbëj".

export function MoveMealSheet({ day, meal, onClose, onMoved, onToast }: { day: NutritionDay; meal: MealSlot; onClose: () => void; onMoved: () => void; onToast: ShowToast }) {
  const { t } = useI18n()
  const label = mealName(t, meal.meal)
  const move = (to: { date: string; meal: MealSlot['meal'] }, target: string) => {
    void (async () => {
      const { undo } = await moveDiaryEntries(store, meal.entries.map((entry) => entry.id), to)
      onMoved()
      onToast(t('foodday.move.toast', { meal: label, target }), undo)
    })()
  }
  return (
    <Sheet title={t('foodday.move.title', { meal: label })} description={t('foodday.move.intro')} onClose={onClose}>
      <ul className="flex shrink-0 flex-col gap-2">
        {day.meals
          .filter((entry) => entry.meal !== meal.meal)
          .map((entry) => {
            const name = mealName(t, entry.meal)
            return (
              <li key={entry.meal}>
                <Button variant="secondary" size="lg" className="w-full justify-between normal-case" onClick={() => move({ date: day.date, meal: entry.meal }, name)}>
                  <span>{name}</span>
                  <span className="font-text text-sm font-medium tracking-normal text-muted-foreground tabular-nums">{entry.time}</span>
                </Button>
              </li>
            )
          })}
        <li>
          <Button variant="outline" size="lg" className="w-full justify-between normal-case" onClick={() => move({ date: shiftDate(day.date, -1), meal: meal.meal }, t('foodday.move.yesterdayTarget'))}>
            <span>{t('foodday.move.yesterday', { meal: label })}</span>
          </Button>
        </li>
      </ul>
    </Sheet>
  )
}
