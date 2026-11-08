import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { addWater, undoWater, waterDay } from '@/data/water'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { GLASS_ML, TRAINING_EXTRA_ML } from '@/nutrition/water'

// Uji te Sot (V36, bordi "Sot · Kontrolli javor dhe uji"): gotat e ditës kundrejt objektivit, një
// prekje shton 250 ml; njoftimi poshtë jep "Kthe mbrapsht" për pak sekonda.

const UNDO_MS = 6000

const litres = (fmt: { number: (value: number, options?: { minDigits?: number; maxDigits?: number }) => string }, ml: number) =>
  fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })

export function WaterCard({ date, training }: { date: string; training: boolean }) {
  const { t, fmt } = useI18n()
  const day = useLocalQuery(() => waterDay(store, date), [date])
  const [added, setAdded] = useState<string | null>(null)
  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [added])
  if (!day) return null

  const glasses = Math.floor(day.totalMl / GLASS_ML)
  const target = day.targetMl === null ? null : Math.round(day.targetMl / GLASS_ML)
  const cells = target ?? 0

  return (
    <section aria-labelledby="water-title" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl px-4 py-3.5')}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="water-title" className="type-display-s">
          {t('today.water.title')}
        </h2>
        <span className="text-[15px] text-muted-foreground tabular-nums">
          {day.targetMl === null
            ? t('today.water.ofNoTarget', { total: litres(fmt, day.totalMl) })
            : t('today.water.of', { total: litres(fmt, day.totalMl), target: litres(fmt, day.targetMl) })}
        </span>
      </div>
      {target ? (
        <ol aria-label={t('today.water.glasses', { count: glasses, target })} className="m-0 grid list-none gap-1 p-0" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}>
          {Array.from({ length: cells }, (_, index) => (
            <li key={index} aria-hidden className={cn('h-[22px] rounded-[5px]', index < glasses ? 'bg-ember' : 'bg-track')} />
          ))}
        </ol>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] leading-[1.4] text-muted-foreground">
          {day.targetMl === null ? t('today.water.noTarget') : training ? t('today.water.trainingExtra', { litres: litres(fmt, TRAINING_EXTRA_ML) }) : null}
        </span>
        <Button
          variant="secondary"
          ground="card"
          size="lg"
          aria-label={t('today.water.addLabel', { ml: GLASS_ML })}
          onClick={async () => setAdded(await addWater(store, date))}
        >
          {t('today.water.add', { ml: GLASS_ML })}
        </Button>
      </div>
      {added ? (
        <div role="status" className="flex min-h-button items-center justify-between gap-3 rounded-md bg-foreground py-1 pr-1.5 pl-4 text-background">
          <span className="text-[15px] font-semibold">{t('today.water.added', { total: litres(fmt, day.totalMl) })}</span>
          <Button
            variant="ghost"
            className="text-background underline underline-offset-[3px]"
            onClick={async () => {
              await undoWater(store, added)
              setAdded(null)
            }}
          >
            {t('today.water.undo')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
