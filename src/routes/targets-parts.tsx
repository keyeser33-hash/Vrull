import type { ReactNode } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { Activity, TargetsResult } from '@/nutrition/calculator'
import { ACTIVITY_ORDER, activityText } from './targets-format'

// Pjesët e objektivave (V32, bordet "Objektivat" dhe "Hapat e parë · Objektivat"): zgjedhja e
// aktivitetit, qëllimi dhe karta me kcal e makrot e dy llojeve të ditës. I përdorin faqja te Ushqimi
// dhe hapi te hapat e parë.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

/** Katër kartat e aktivitetit si radio; e zgjedhura me kufi prushi 2 px. */
export function ActivityPicker({
  legend,
  value,
  onChange,
  columns = 1,
}: {
  legend: ReactNode
  value: Activity | null
  onChange: (value: Activity) => void
  columns?: 1 | 2
}) {
  const i18n = useI18n()
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0">{legend}</legend>
      <div className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {ACTIVITY_ORDER.map((activity) => {
          const checked = value === activity
          return (
            <button
              key={activity}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(activity)}
              className={cn(
                'flex min-h-[60px] flex-col justify-center gap-0.5 rounded-[14px] bg-surface px-3.5 py-2 text-left',
                checked ? 'border-2 border-ember-text' : 'border border-border',
                focusRing,
              )}
            >
              <span className="text-base leading-5 font-semibold">{i18n.t(`food.targets.activity.${activity}`)}</span>
              <span className="text-[13px] leading-[1.35] text-muted-foreground">{activityText(i18n, activity)}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Kcal e dy llojeve të ditës dhe makrot e tyre (bordi "Objektivat", karta e parë). */
export function TargetsCard({ result, children }: { result: Pick<TargetsResult, 'training' | 'rest'>; children?: ReactNode }) {
  const { t, fmt } = useI18n()
  const days = [
    { key: 'training', label: t('food.targets.training'), macros: result.training },
    { key: 'rest', label: t('food.targets.rest'), macros: result.rest },
  ] as const
  const rows = [
    { key: 'protein', label: t('food.protein'), pick: (day: (typeof days)[number]) => day.macros.proteinG },
    { key: 'carbs', label: t('food.carbs'), pick: (day: (typeof days)[number]) => day.macros.carbsG },
    { key: 'fat', label: t('food.fat'), pick: (day: (typeof days)[number]) => day.macros.fatG },
  ]
  return (
    <section aria-label={t('food.targets.title')} className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        {days.map((day, index) => (
          <div key={day.key} className={cn('flex flex-col gap-1', index > 0 && 'border-l border-border pl-3')}>
            <span className="text-[13px] text-muted-foreground">{day.label}</span>
            <span className="font-display text-[56px] leading-[0.9] font-extrabold whitespace-nowrap tabular-nums">{fmt.number(day.macros.kcal)}</span>
            <span className="text-sm text-muted-foreground">kcal</span>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse text-[15px] tabular-nums">
        <caption className="sr-only">{t('food.targets.macrosCaption')}</caption>
        <thead>
          <tr className="text-[13px] text-muted-foreground">
            <th scope="col" className="pb-1.5 text-left font-medium">
              {t('food.targets.macros')}
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              {t('food.targets.trainingShort')}
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              {t('food.targets.restShort')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <th scope="row" className="py-2 text-left font-medium">
                {row.label}
              </th>
              {days.map((day) => (
                <td key={day.key} className="text-right font-bold">
                  {fmt.unit(row.pick(day), 'g')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </section>
  )
}
