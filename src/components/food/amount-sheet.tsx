import { useState } from 'react'
import { ValueStepper } from '@/components/forms/value-stepper'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { store, useLocalQuery } from '@/data/app-data'
import { type BasketItem, itemMacros } from '@/data/basket'
import { favoriteFoods, setFavorite } from '@/data/quick-food'
import { foodName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { kcalText, parseGrams } from '@/routes/nutrition-format'
import { servingCount, sourceKey, unitNoun } from './food-labels'

// Sasia e një ushqimi (bordi "Ushqimi · Sasia"; SPEC §0.3h): njësitë si çipa (porcioni i ushqimit dhe gramët), ± dhe numri
// me tastierë, çipat ½ · 1 · 2 · 3 · 4, makrot e sasisë, "Nga sa mbetet sot", ylli i të preferuarave dhe prushi "Shto në
// shportë" (te rishikimi i shportës: "Ruaj sasinë"). Numri ruhet në njësinë e zgjedhur; shporta mban gramët.

const MAX_GRAMS = 2000
const TIMES = [
  { count: 0.5, text: '½' },
  { count: 1, text: '1' },
  { count: 2, text: '2' },
  { count: 3, text: '3' },
  { count: 4, text: '4' },
] as const

type Unit = 'serving' | 'gram'
const round1 = (value: number) => Math.round(value * 10) / 10

export interface LeftToday {
  kcal: number
  proteinG: number
}

function startOf(item: BasketItem): { unit: Unit; count: number } {
  if (item.servings !== null) return { unit: 'serving', count: item.servings }
  const grams = item.grams ?? 100
  const count = servingCount(grams, item.servingG)
  return count !== null ? { unit: 'serving', count } : { unit: 'gram', count: grams }
}

export function AmountSheet({ item, mode, left, onClose, onSubmit }: { item: BasketItem; mode: 'add' | 'edit'; left: LeftToday | null; onClose: () => void; onSubmit: (item: BasketItem) => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const quick = item.servings !== null
  const hasServing = quick || item.servingG !== null
  const [state, setState] = useState(() => startOf(item))
  const { unit, count } = state
  const noun = (quick ? null : unitNoun(item.servingLabel)) ?? t('foodsearch.unit.serving')
  const servingG = item.servingG ?? 100
  const grams = unit === 'gram' ? count : count * servingG
  const result: BasketItem = quick ? { ...item, servings: count } : { ...item, grams: round1(grams) }
  const macros = itemMacros(result)
  const name = foodName(t, item)
  const favorites = useLocalQuery(() => favoriteFoods(store), [])
  const favorite = !!favorites?.some((entry) => entry.foodId === item.foodId)

  const limit = (next: number) => (unit === 'gram' ? next <= MAX_GRAMS : quick ? next <= 99 : next * servingG <= MAX_GRAMS)
  const set = (next: number) => limit(next) && next > 0 && setState({ unit, count: round1(next) })
  const step = unit === 'gram' ? (count < 50 ? 5 : 10) : 1
  const minus = () => setState({ unit, count: Math.max(unit === 'gram' ? 1 : 0.5, round1(count - step)) })
  const plus = () => limit(count + step) && setState({ unit, count: round1(count + step) })
  const switchTo = (next: Unit) => {
    if (next === unit) return
    setState(next === 'gram' ? { unit: 'gram', count: round1(count * servingG) } : { unit: 'serving', count: servingCount(count, servingG) ?? 1 })
  }

  const units: { unit: Unit; text: string }[] = [
    ...(hasServing ? [{ unit: 'serving' as const, text: quick ? noun : t('foodsearch.amount.servingChip', { unit: noun, grams: fmt.unit(servingG, 'g', { maxDigits: 1 }) }) }] : []),
    ...(quick ? [] : [{ unit: 'gram' as const, text: t('foodsearch.amount.gram') }]),
  ]
  const description = quick ? t(sourceKey(item)) : [t(sourceKey(item)), t('foodsearch.per100', { kcal: kcalText(i18n, item.per100.kcal) })].join(' · ')
  const chip = 'min-h-11 rounded-pill border px-3.5 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

  return (
    <Sheet
      title={name}
      description={description}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" className="h-auto min-h-[58px] flex-col gap-0.5 py-2" onClick={() => onSubmit(result)}>
          <span>{mode === 'edit' ? t('foodsearch.amount.save') : t('foodsearch.amount.add')}</span>
          <span className="font-text text-[13px] font-semibold tracking-normal normal-case tabular-nums">{t('foodsearch.amount.detail', { kcal: kcalText(i18n, macros.kcal), protein: fmt.number(Math.round(macros.proteinG)) })}</span>
        </Button>
      }
    >
      <div className="flex shrink-0 items-start gap-2">
        <div role="group" aria-label={t('foodsearch.amount.units')} className="flex min-w-0 flex-1 flex-wrap gap-2">
          {units.map((entry) => (
            <button key={entry.unit} type="button" aria-pressed={unit === entry.unit} onClick={() => switchTo(entry.unit)} className={cn(chip, unit === entry.unit ? 'border-foreground bg-foreground text-background' : 'border-subtle text-foreground')}>
              {entry.text}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? t('foodsearch.amount.unfavorite') : t('foodsearch.amount.favorite')}
          onClick={() => void setFavorite(store, item.foodId, favorite ? null : quick ? 100 : Math.round(grams * 10) / 10)}
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground', favorite ? 'border-foreground bg-surface-2 text-ember-text' : 'border-subtle text-foreground')}
        >
          <Icon name="yll" size={22} />
        </button>
      </div>

      <ValueStepper
        label={t('foodsearch.amount.label')}
        hideLabel
        variant="hero"
        text={fmt.number(count, { maxDigits: 1 })}
        unit={unit === 'gram' ? 'g' : noun}
        inputMode="decimal"
        minusLabel={unit === 'gram' ? t('foodsearch.amount.lessG', { step }) : t('foodsearch.amount.lessOne')}
        plusLabel={unit === 'gram' ? t('foodsearch.amount.moreG', { step }) : t('foodsearch.amount.moreOne')}
        onMinus={minus}
        onPlus={plus}
        onCommit={(text) => {
          const value = parseGrams(text)
          if (value !== null) set(value)
        }}
      />
      {unit === 'serving' && !quick ? <p className="-mt-3 text-center type-caption text-muted-foreground tabular-nums">{fmt.unit(round1(grams), 'g', { maxDigits: 1 })}</p> : null}

      {unit === 'serving' ? (
        <div role="group" aria-label={t('foodsearch.amount.times')} className="grid shrink-0 grid-cols-5 gap-2">
          {TIMES.map((entry) => (
            <button key={entry.text} type="button" aria-pressed={count === entry.count} onClick={() => set(entry.count)} className={cn('min-h-11 rounded-md border text-[15px] font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground', count === entry.count ? 'border-foreground bg-surface-2 font-bold' : 'border-subtle')}>
              {entry.text}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid shrink-0 grid-cols-4 gap-2 border-y border-border py-3.5 tabular-nums">
        {[
          { value: kcalText(i18n, macros.kcal), label: t('foodsearch.amount.kcal') },
          { value: fmt.number(macros.proteinG, { maxDigits: 1 }), label: t('foodsearch.amount.protein') },
          { value: fmt.number(macros.carbsG, { maxDigits: 1 }), label: t('foodsearch.amount.carbs') },
          { value: fmt.number(macros.fatG, { maxDigits: 1 }), label: t('foodsearch.amount.fat') },
        ].map((entry) => (
          <span key={entry.label} className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-[26px] leading-none font-extrabold">{entry.value}</span>
            <span className="text-xs text-muted-foreground">{entry.label}</span>
          </span>
        ))}
      </div>

      {left ? (
        <section aria-labelledby="amount-left" className="flex shrink-0 flex-col gap-2.5">
          <h3 id="amount-left" className="type-label text-muted-foreground">
            {t('foodsearch.left.title')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <LeftBar value={macros.kcal} left={left.kcal} text={(value, rest) => t('foodsearch.left.kcal', { value, left: rest })} full={t('foodsearch.left.kcalFull')} />
            <LeftBar value={macros.proteinG} left={left.proteinG} digits={1} text={(value, rest) => t('foodsearch.left.protein', { value, left: rest })} full={t('foodsearch.left.proteinFull')} />
          </div>
        </section>
      ) : null}
    </Sheet>
  )
}

/** Sa e mbush ky ushqim nga ajo që mbetet sot: përqindja, vlera kundrejt asaj që mbetet dhe shiriti; pa të mbetur, një fjali. */
function LeftBar({ value, left, digits = 0, text, full }: { value: number; left: number; digits?: number; text: (value: string, left: string) => string; full: string }) {
  const { fmt } = useI18n()
  if (left <= 0) return <p className="type-caption text-muted-foreground">{full}</p>
  const format = (number: number) => fmt.number(number, { maxDigits: digits })
  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm tabular-nums">
        <b className="text-base font-semibold">{fmt.number(Math.round((value / left) * 100))}%</b> <span className="text-muted-foreground">· {text(format(value), format(left))}</span>
      </span>
      <ProgressTrack ratio={value / left} />
    </span>
  )
}
