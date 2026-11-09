import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { RollingNumber } from '@/components/ui/rolling-number'
import { store, useLocalQuery } from '@/data/app-data'
import { addWater, undoWater, waterDay } from '@/data/water'
import { useI18n } from '@/i18n/use-i18n'
import { GLASS_ML, TRAINING_EXTRA_ML } from '@/nutrition/water'

// Uji te Sot (V36; pamja e 0.23, bordi "Sot": një listë pas ushqimit): litrat e ditës kundrejt
// objektivit me shiritin, një prekje shton 250 ml; njoftimi poshtë jep "Kthe mbrapsht" për pak sekonda.

const UNDO_MS = 6000

type NumberFormat = { number: (value: number, options?: { minDigits?: number; maxDigits?: number }) => string }
const litres = (fmt: NumberFormat, ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })

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

  const total = litres(fmt, day.totalMl)
  const note = day.targetMl === null ? t('today.water.noTarget') : training ? t('today.water.trainingExtra', { litres: litres(fmt, TRAINING_EXTRA_ML) }) : null

  return (
    <section aria-labelledby="water-title" className="flex flex-col gap-2.5 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="water-title" className="type-label text-muted-foreground">
          {t('today.water.title')}
        </h2>
        {note ? <span className="type-caption text-muted-foreground tabular-nums">{note}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-display text-[28px] leading-none font-extrabold whitespace-nowrap tabular-nums">
            <RollingNumber value={day.totalMl / 1000} format={() => total} />
            <span className="font-text text-sm font-normal text-muted-foreground">
              {' '}
              {day.targetMl === null ? t('today.water.ofNoTarget') : t('today.water.of', { target: litres(fmt, day.targetMl) })}
            </span>
          </span>
          {day.targetMl ? (
            <span role="img" aria-label={t('today.water.spoken', { total, target: litres(fmt, day.targetMl) })}>
              <ProgressTrack ratio={day.totalMl / day.targetMl} ground="page" />
            </span>
          ) : null}
        </span>
        <Button
          variant="secondary"
          ground="page"
          className="h-12 rounded-md px-4 text-[19px]"
          aria-label={t('today.water.addLabel', { ml: GLASS_ML })}
          onClick={async () => setAdded(await addWater(store, date))}
        >
          <Icon name="gota" size={20} />
          {t('today.water.add', { ml: GLASS_ML })}
        </Button>
      </div>
      {added ? (
        <div role="status" className="flex min-h-button items-center justify-between gap-3 rounded-md bg-foreground py-1 pr-1.5 pl-4 text-background">
          <span className="text-[15px] font-semibold">{t('today.water.added', { total })}</span>
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
