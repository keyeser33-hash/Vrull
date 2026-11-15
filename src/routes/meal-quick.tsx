import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { store } from '@/data/app-data'
import type { MealSlot } from '@/data/nutrition'
import { logQuickMacros, quickMacrosKcal } from '@/data/quick-food'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Makrot e shpejta (V2-E2-16; SPEC §9 "Ushqimi më i shpejtë"): fleta e vaktit te Ushqimi (`components/food/meal-sheet.tsx`)
// e hap; të fundit dhe të preferuarat kalojnë te faqja e kërkimit (V59).

const parse = (value: string) => {
  const number = Number(value.replace(',', '.'))
  return value.trim() && Number.isFinite(number) && number >= 0 ? number : null
}

/** Makrot e shpejta (bordi V22-Makrot): emri, kaloritë dhe makrot; kaloritë e shkruara ruhen. */
export function QuickMacrosSheet({ date, meal, onClose, onSaved }: { date: string; meal: MealSlot; onClose: () => void; onSaved: () => void }) {
  const { t, fmt } = useI18n()
  const ids = { name: useId(), kcal: useId(), protein: useId(), carbs: useId(), fat: useId() }
  const [fields, setFields] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [favorite, setFavoriteChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const values = { kcal: parse(fields.kcal), proteinG: parse(fields.protein) ?? 0, carbsG: parse(fields.carbs) ?? 0, fatG: parse(fields.fat) ?? 0 }
  const anyMacro = [fields.protein, fields.carbs, fields.fat].some((value) => parse(value) !== null)
  const result = quickMacrosKcal(values)
  const valid = (values.kcal !== null && values.kcal > 0) || (anyMacro && result.fromMacros > 0)
  const mealLabel = mealName(t, meal.meal)
  const numbers = { protein: fmt.number(values.proteinG), carbs: fmt.number(values.carbsG), fat: fmt.number(values.fatG) }
  const set = (key: keyof typeof fields) => (event: ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [key]: event.target.value })
  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (!valid) return
    setSaving(true)
    await logQuickMacros(store, { date, meal: meal.meal, name: fields.name.trim() || t('food.macros.defaultName'), ...values, favorite })
    onSaved()
  }
  const field = 'h-[52px] w-full shrink-0 rounded-md border border-subtle bg-background px-3 font-display text-2xl font-extrabold tabular-nums text-foreground'
  return (
    <Sheet
      title={t('food.macros.title')}
      description={`${mealLabel} · ${meal.time}`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="xl" disabled={!valid || saving} onClick={() => void save()}>
            {t('food.macros.save', { meal: mealLabel })}
          </Button>
          <span className="text-center type-caption text-muted-foreground">{t('food.macros.offline')}</span>
        </div>
      }
    >
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-3.5">
        <p className="m-0 type-body text-muted-foreground">{t('food.macros.intro')}</p>
        <div className="flex shrink-0 flex-col gap-1.5">
          <label htmlFor={ids.name} className="type-body-strong">
            {t('food.macros.name')} <span className="font-normal text-muted-foreground">{t('food.macros.nameHint')}</span>
          </label>
          <input id={ids.name} value={fields.name} onChange={set('name')} placeholder={t('food.macros.defaultName')} className="h-[52px] shrink-0 rounded-md border border-subtle bg-background px-3.5 type-body-l text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <label htmlFor={ids.kcal} className="type-body-strong">
            {t('food.macros.kcal')}
          </label>
          <input id={ids.kcal} inputMode="numeric" value={fields.kcal} onChange={set('kcal')} placeholder={anyMacro ? fmt.number(result.fromMacros) : undefined} className={cn(field, 'h-16 text-4xl')} />
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          {(
            [
              ['protein', ids.protein, 'food.macros.protein', 'bg-ember'],
              ['carbs', ids.carbs, 'food.macros.carbs', 'bg-data'],
              ['fat', ids.fat, 'food.macros.fat', 'bg-sand'],
            ] as const
          ).map(([key, id, label, dot]) => (
            <div key={key} className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={id} className="flex items-center gap-1.5 type-caption font-semibold text-foreground">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', dot)} />
                <span className="truncate">{t(label)}</span>
              </label>
              <input id={id} inputMode="decimal" value={fields[key]} onChange={set(key)} className={field} />
            </div>
          ))}
        </div>
        {anyMacro ? (
          <p role="status" className="m-0 rounded-md border border-border bg-surface-2 px-3.5 py-3 type-caption tabular-nums">
            {values.kcal !== null && values.kcal !== result.fromMacros
              ? t('food.macros.check', { fromMacros: result.fromMacros, kcal: values.kcal, ...numbers })
              : t('food.macros.computed', { kcal: result.fromMacros, ...numbers })}
          </p>
        ) : null}
        <label className="flex min-h-touch shrink-0 items-center gap-3 type-body">
          <input type="checkbox" checked={favorite} onChange={(event) => setFavoriteChecked(event.target.checked)} className="size-5 shrink-0 accent-current" />
          {t('food.macros.favorite')}
        </label>
      </form>
    </Sheet>
  )
}

