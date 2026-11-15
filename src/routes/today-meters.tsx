import { type PointerEvent, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { RollingNumber } from '@/components/ui/rolling-number'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import type { TodayView } from '@/data/today'
import { addWater, undoWater, waterDay } from '@/data/water'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { GLASS_ML } from '@/nutrition/water'
import { SHEET, useOpenSheet } from './readiness-sheets'

// Matësit e drejtpërdrejtë te Sot (V57, SPEC §0.3f; bordi "Sot"): kaloritë (çfarë mbetet, hark), proteina (gramë, një
// segment për vakt) dhe uji (litra, gota që mbushet). Kaloritë dhe proteina hapin Ushqimin. Uji: një prekje shton 250 ml
// me njoftimin "U shtua 250 ml · Zhbëj"; shtypja e gjatë hap 250, 330, 500 ml dhe "Sasi tjetër".

const UNDO_MS = 6000
const LONG_PRESS_MS = 450
const MOVE_SLOP = 10
const WATER_SIZES = [250, 330, 500] as const
const MIN_ML = 50
const MAX_ML = 2000

const tileClass = cn(surfaceClass, 'flex min-h-[104px] min-w-0 flex-col gap-1 rounded-lg p-3 text-left text-foreground')
const numberClass = 'font-display text-[28px] leading-none font-extrabold whitespace-nowrap tabular-nums'

function Title({ icon, children }: { icon: 'flaka' | 'kofsha' | 'pika-uji'; children: string }) {
  return (
    <span aria-hidden className="flex items-center gap-1.5 text-xs leading-[1.2] text-muted-foreground">
      <Icon name={icon} size={16} className="text-ember-text" />
      {children}
    </span>
  )
}

/** Harku i kalorive: sa pjesë e objektivit u ha (mbi 100% mbetet plot). */
function Arc({ ratio }: { ratio: number }) {
  const radius = 11
  const length = 2 * Math.PI * radius
  const shown = Math.max(0, Math.min(ratio, 1))
  return (
    <svg aria-hidden viewBox="0 0 28 28" className="absolute top-2.5 right-2.5 size-7 -rotate-90" fill="none" strokeWidth={3} strokeLinecap="round">
      <circle cx="14" cy="14" r={radius} className="stroke-track" />
      <circle cx="14" cy="14" r={radius} className="stroke-ember-text transition-[stroke-dashoffset] duration-320 ease-out motion-reduce:transition-none" strokeDasharray={length} strokeDashoffset={length * (1 - shown)} />
    </svg>
  )
}

/** Gota që mbushet me ujin e ditës. */
function Glass({ ratio }: { ratio: number }) {
  const id = useId()
  const shown = Math.max(0, Math.min(ratio, 1))
  return (
    <svg aria-hidden viewBox="0 0 26 34" className="absolute top-2.5 right-2.5 h-[34px] w-[26px]">
      <clipPath id={id}>
        <path d="M3 2h20l-2.5 30h-15z" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="26" height="34" className="fill-data transition-transform duration-320 ease-out motion-reduce:transition-none" style={{ transform: `translateY(${32 - 30 * shown}px)` }} />
      </g>
      <path d="M3 2h20l-2.5 30h-15z" fill="none" className="stroke-subtle" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

export function TodayMeters({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const { kcal, targetKcal, proteinG, targetProteinG } = view.food
  const left = targetKcal === null ? kcal : targetKcal - kcal
  const eatenMeals = view.meals.filter((meal) => meal.eaten).length
  return (
    <section aria-label={t('sot.meters.label')} className="grid grid-cols-3 gap-2">
      <Link
        to="/ushqimi"
        aria-label={targetKcal === null ? t('sot.cal.spokenNoTarget', { eaten: fmt.number(kcal) }) : t('sot.cal.spoken', { eaten: fmt.number(kcal), target: fmt.number(targetKcal) })}
        className={cn(tileClass, 'relative')}
      >
        <Title icon="flaka">{t('sot.cal.title')}</Title>
        {targetKcal ? <Arc ratio={kcal / targetKcal} /> : null}
        <span className={cn(numberClass, 'mt-1')}>
          <RollingNumber value={Math.abs(left)} />
        </span>
        <span aria-hidden className="text-xs leading-[1.2] text-muted-foreground">
          {targetKcal === null ? t('sot.cal.noTarget') : left >= 0 ? t('sot.cal.left') : t('sot.cal.over')}
        </span>
        {targetKcal ? (
          <span aria-hidden className="mt-auto text-xs leading-[1.2] whitespace-nowrap text-muted-foreground tabular-nums">
            {fmt.number(kcal)} / {fmt.number(targetKcal)}
          </span>
        ) : null}
      </Link>
      <Link
        to="/ushqimi"
        aria-label={targetProteinG === null ? t('sot.protein.spokenNoTarget', { protein: fmt.number(proteinG) }) : t('sot.protein.spoken', { protein: fmt.number(proteinG), target: fmt.number(targetProteinG) })}
        className={tileClass}
      >
        <Title icon="kofsha">{t('sot.protein.title')}</Title>
        <span className={cn(numberClass, 'mt-1')}>
          <RollingNumber value={proteinG} />
          <span className="font-text text-sm font-normal text-muted-foreground"> g</span>
          <span className="font-text text-xs font-normal text-muted-foreground"> {targetProteinG === null ? '' : t('sot.protein.of', { target: fmt.number(targetProteinG) })}</span>
        </span>
        {view.meals.length > 0 ? (
          <>
            <span aria-hidden className="flex gap-0.5">
              {view.meals.map((meal) => (
                <span key={meal.meal} className={cn('h-1 min-w-0 flex-1 rounded-pill', meal.eaten ? 'bg-foreground' : 'bg-track')} />
              ))}
            </span>
            <span aria-hidden className="mt-auto text-xs leading-[1.2] whitespace-nowrap text-muted-foreground tabular-nums">
              {t('sot.protein.meals', { done: eatenMeals, count: view.meals.length })}
            </span>
          </>
        ) : null}
      </Link>
      <WaterTile date={view.date} />
    </section>
  )
}

const litres = (fmt: { number: (value: number, options?: { minDigits?: number; maxDigits?: number }) => string }, ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })

function WaterTile({ date }: { date: string }) {
  const { t, fmt } = useI18n()
  const day = useLocalQuery(() => waterDay(store, date), [date])
  const open = useOpenSheet()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [added, setAdded] = useState<{ id: string; ml: number } | null>(null)
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const fired = useRef(false)
  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [added])
  useEffect(() => () => clearTimeout(press.current?.timer), [])

  async function add(ml: number) {
    setAdded({ id: await addWater(store, date, store.now(), ml), ml })
  }
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  const down = (event: PointerEvent) => {
    fired.current = false
    cancel()
    press.current = {
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        fired.current = true
        press.current = null
        open('uji')
      }, LONG_PRESS_MS),
    }
  }
  const move = (event: PointerEvent) => {
    if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > MOVE_SLOP) cancel()
  }
  if (!day) return <div aria-hidden className={cn(tileClass, 'min-h-[104px]')} />

  const total = litres(fmt, day.totalMl)
  const target = day.targetMl === null ? null : litres(fmt, day.targetMl)
  const sheet = params.get(SHEET)
  const close = () => navigate(-1)
  const pick = (ml: number) => {
    void add(ml).then(close)
  }
  return (
    <>
      <button
        type="button"
        aria-label={`${target === null ? t('sot.water.spokenNoTarget', { total }) : t('sot.water.spoken', { total, target })}. ${t('sot.water.add', { ml: GLASS_ML })}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(event) => {
          event.preventDefault()
          cancel()
          fired.current = true
          open('uji')
        }}
        onClick={() => {
          if (fired.current) {
            fired.current = false
            return
          }
          void add(GLASS_ML)
        }}
        className={cn(tileClass, 'relative touch-manipulation select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
      >
        <Title icon="pika-uji">{t('sot.water.title')}</Title>
        {day.targetMl ? <Glass ratio={day.totalMl / day.targetMl} /> : <Glass ratio={0} />}
        <span className={cn(numberClass, 'mt-1')}>
          <RollingNumber value={day.totalMl / 1000} format={() => total} />
          <span className="font-text text-sm font-normal text-muted-foreground"> L</span>
        </span>
        <span aria-hidden className="text-xs leading-[1.2] whitespace-nowrap text-muted-foreground tabular-nums">
          {target === null ? t('sot.water.ofNoTarget') : t('sot.water.of', { target })}
        </span>
        <span aria-hidden className="mt-auto self-start rounded-pill border border-subtle px-2 py-0.5 text-xs font-semibold tabular-nums">
          +{fmt.unit(GLASS_ML, 'ml')}
        </span>
      </button>
      {added ? (
        <div role="status" className="fixed inset-x-4 bottom-[calc(var(--spacing-tab-bar)+var(--safe-bottom)+84px)] z-30 mx-auto flex min-h-button max-w-[448px] items-center justify-between gap-3 rounded-md bg-foreground py-1 pr-1.5 pl-4 text-background">
          <span className="text-[15px] font-semibold tabular-nums">{t('sot.water.added', { ml: fmt.number(added.ml) })}</span>
          <Button
            variant="ghost"
            className="text-background underline underline-offset-[3px]"
            onClick={async () => {
              await undoWater(store, added.id)
              setAdded(null)
            }}
          >
            {t('sot.water.undo')}
          </Button>
        </div>
      ) : null}
      {sheet === 'uji' ? (
        <Sheet title={t('sot.water.menu')} onClose={close}>
          <div className="grid grid-cols-1 gap-2 pb-4">
            {WATER_SIZES.map((ml) => (
              <Button key={ml} variant="secondary" size="lg" onClick={() => pick(ml)}>
                {fmt.unit(ml, 'ml')}
              </Button>
            ))}
            <Button variant="outline" size="lg" onClick={() => open('uji-sasia', {}, true)}>
              {t('sot.water.custom')}
            </Button>
          </div>
        </Sheet>
      ) : null}
      {sheet === 'uji-sasia' ? <CustomAmount onClose={close} onAdd={pick} /> : null}
    </>
  )
}

function CustomAmount({ onClose, onAdd }: { onClose: () => void; onAdd: (ml: number) => void }) {
  const { t, fmt } = useI18n()
  const [text, setText] = useState('')
  const ml = Number(text.replace(',', '.'))
  const valid = text.trim() !== '' && Number.isInteger(ml) && ml >= MIN_ML && ml <= MAX_ML
  return (
    <Sheet
      title={t('sot.water.custom')}
      onClose={onClose}
      footer={
        <Button variant="secondary" size="lg" className="w-full" disabled={!valid} onClick={() => onAdd(ml)}>
          {t('sot.water.customAdd')}
        </Button>
      }
    >
      <label className="flex flex-col gap-2 pb-4">
        <span className="type-label text-muted-foreground">{t('sot.water.customLabel')}</span>
        <input
          inputMode="numeric"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby="sot-water-range"
          className="min-h-button rounded-md border border-subtle bg-surface-2 px-3 text-[19px] tabular-nums text-foreground"
        />
        <span id="sot-water-range" className={cn('type-caption', text !== '' && !valid ? 'text-danger' : 'text-muted-foreground')}>
          {t('sot.water.customRange', { min: fmt.number(MIN_ML), max: fmt.number(MAX_ML) })}
        </span>
      </label>
    </Sheet>
  )
}
