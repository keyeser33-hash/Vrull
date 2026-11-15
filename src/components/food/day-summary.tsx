import { Link } from 'react-router'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { RollingNumber } from '@/components/ui/rolling-number'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import type { NutritionDay } from '@/data/nutrition'
import { setDayType } from '@/data/nutrition'
import { addWater, undoWater, waterDay } from '@/data/water'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { kcalText } from '@/routes/nutrition-format'
import { GLASS_ML } from '@/nutrition/water'
import type { ShowToast } from './meal-sheet'

// Kreu dhe rreshti i ditës te Ushqimi (SPEC §0.3h, bordi "Ushqimi · Dita"): "Ushqimi", dita me ‹ › dhe llojin e ditës si çip;
// kaloritë që mbeten si numri i ekranit, tre makrot me shiritat, dhe dy pllaka: uji (+250 ml me një prekje) dhe "Plotëso makrot".

const atNoon = (date: string) => new Date(`${date}T12:00:00`)

export function FoodHeader({ day, today, onGo }: { day?: NutritionDay; today?: string; onGo?: (date: string) => void }) {
  const { t, fmt } = useI18n()
  const training = day?.dayType === 'training'
  const isToday = !!day && day.date === today
  const arrow = 'flex size-touch shrink-0 items-center justify-center rounded-md text-foreground disabled:text-muted-foreground'
  return (
    <header className="flex flex-col gap-1.5">
      <ScreenHeader title={t('tab.food')} />
      {day && today && onGo ? (
        <div className="-mt-3 -mb-1 -ml-3 flex items-center justify-between gap-2">
          <span className="flex items-center">
            <button type="button" aria-label={t('foodday.prevDay')} onClick={() => onGo(shift(day.date, -1))} className={arrow}>
              <Icon name="poshte" size={20} className="rotate-90" />
            </button>
            {isToday ? (
              <span className="px-0.5 text-[15px] leading-5 font-semibold whitespace-nowrap tabular-nums">{t('foodday.today', { date: fmt.date(atNoon(day.date), { weekday: false }) })}</span>
            ) : (
              <button type="button" aria-label={t('foodday.toToday')} onClick={() => onGo(today)} className="min-h-touch px-0.5 text-[15px] leading-5 font-semibold whitespace-nowrap tabular-nums">
                {fmt.date(atNoon(day.date), { weekday: false })}
              </button>
            )}
            <button type="button" aria-label={t('foodday.nextDay')} disabled={day.date >= shift(today, 1)} onClick={() => onGo(shift(day.date, 1))} className={arrow}>
              <Icon name="poshte" size={20} className="-rotate-90" />
            </button>
          </span>
          <button
            type="button"
            aria-label={t(training ? 'food.dayType.toRest' : 'food.dayType.toTraining')}
            onClick={() => void setDayType(store, day.date, training ? 'rest' : 'training')}
            className="flex min-h-touch items-center gap-1.5 rounded-pill border border-subtle py-0 pr-3 pl-2.5 text-sm leading-5 font-semibold whitespace-nowrap"
          >
            <Icon name={training ? 'programi' : 'pauze'} size={16} className="text-muted-foreground" />
            {t(training ? 'foodday.dayType.training' : 'foodday.dayType.rest')}
            <Icon name="rrotullo" size={15} className="text-muted-foreground" />
          </button>
        </div>
      ) : null}
    </header>
  )
}

function shift(date: string, days: number) {
  const day = atNoon(date)
  day.setDate(day.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

const litres = (fmt: { number: (value: number, options?: { minDigits?: number; maxDigits?: number }) => string }, ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })

/** Kaloritë që mbeten (numri i madh), pastaj proteina, karbohidratet dhe yndyrat me shiritat kundrejt objektivave; poshtë ujin dhe "Plotëso makrot". */
export function DayHero({ day, onToast }: { day: NutritionDay; onToast: ShowToast }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const eaten = Math.round(day.totals.kcal)
  const target = day.targets ? Math.round(day.targets.kcal) : null
  const left = target === null ? null : target - eaten
  const date = fmt.date(atNoon(day.date), { weekday: false })
  const spoken =
    target === null || left === null
      ? t(day.isToday ? 'food.hero.noTargets' : 'foodday.hero.otherNone', { eaten, date })
      : left >= 0
        ? t(day.isToday ? 'food.hero.left' : 'foodday.hero.otherLeft', { eaten, target, left, date })
        : t(day.isToday ? 'food.hero.over' : 'foodday.hero.otherOver', { eaten, target, over: -left, date })
  const macros = day.targets
    ? [
        { key: 'protein', label: t('food.protein'), value: Math.round(day.totals.proteinG), target: Math.round(day.targets.proteinG) },
        { key: 'carbs', label: t('food.carbs'), value: Math.round(day.totals.carbsG), target: Math.round(day.targets.carbsG) },
        { key: 'fat', label: t('food.fat'), value: Math.round(day.totals.fatG), target: Math.round(day.targets.fatG) },
      ]
    : []
  const proteinLeft = day.targets ? Math.max(0, Math.round(day.targets.proteinG - day.totals.proteinG)) : null
  return (
    <div className="flex flex-col gap-3.5">
      <section aria-label={spoken} className="flex flex-col gap-3.5">
        <div className="flex items-end gap-3">
          <RollingNumber value={left === null ? eaten : Math.abs(left)} format={(value) => kcalText(i18n, value)} className="type-display-xl" />
          <span className="flex min-w-0 flex-col gap-0.5 pb-0.5">
            <span className="type-body-strong">{t(left === null ? 'food.eatenKcal' : left >= 0 ? 'food.left' : 'food.overTarget')}</span>
            {target === null ? null : <span className="type-caption text-muted-foreground tabular-nums">{t('food.eatenOf', { eaten, target })}</span>}
          </span>
        </div>
        {day.targets ? (
          <div className="grid grid-cols-3 gap-3">
            {macros.map((row) => {
              const over = row.value > row.target
              return (
                <div
                  key={row.key}
                  role="group"
                  aria-label={t(over ? 'ui.progress.spokenOver' : 'ui.progress.spoken', { label: row.label, value: row.value, target: row.target, unit: t('food.gramsName') })}
                  className="flex min-w-0 flex-col gap-1.5"
                >
                  <span aria-hidden className="truncate text-[13px] leading-[1.35] text-muted-foreground">
                    {row.label}
                  </span>
                  <span aria-hidden className="font-display text-[22px] leading-none font-extrabold whitespace-nowrap tabular-nums">
                    <RollingNumber value={row.value} />
                    <span className="font-text text-[13px] font-normal text-muted-foreground"> / {fmt.unit(row.target, 'g')}</span>
                  </span>
                  <ProgressTrack ratio={row.target > 0 ? row.value / row.target : 0} ground="page" />
                  {over ? (
                    <span aria-hidden className="text-[13px] leading-[1.35] text-muted-foreground">
                      {t('ui.progress.over')}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm leading-5 text-muted-foreground">{t('food.noTargets')}</p>
        )}
      </section>
      <div className={cn('grid gap-2', proteinLeft === null ? 'grid-cols-1' : 'grid-cols-2')}>
        <WaterTile date={day.date} onToast={onToast} />
        {proteinLeft === null ? null : (
          <Link
            to="/ushqimi/plotesomakrot"
            aria-label={proteinLeft > 0 ? t('foodday.fill.leftLabel', { protein: proteinLeft }) : t('foodday.fill.doneLabel')}
            className={cn(surfaceClass, 'flex min-h-14 items-center gap-2.5 rounded-lg py-2 pr-2 pl-3')}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm leading-5 font-semibold whitespace-nowrap text-ember-text">{t('foodday.fill.title')}</span>
              <span className="text-[13px] leading-[1.35] whitespace-nowrap text-muted-foreground tabular-nums">{proteinLeft > 0 ? t('foodday.fill.left', { protein: proteinLeft }) : t('foodday.fill.done')}</span>
            </span>
            <Icon name="poshte" size={18} className="-rotate-90 text-muted-foreground" />
          </Link>
        )}
      </div>
    </div>
  )
}

/** Uji i ditës: prekja shton 250 ml (si te Sot) dhe njoftimi jep "Zhbëj". */
function WaterTile({ date, onToast }: { date: string; onToast: ShowToast }) {
  const { t, fmt } = useI18n()
  const water = useLocalQuery(() => waterDay(store, date), [date])
  if (!water) return <div aria-hidden className="min-h-14 rounded-lg bg-surface" />
  const total = litres(fmt, water.totalMl)
  const target = water.targetMl === null ? null : litres(fmt, water.targetMl)
  return (
    <button
      type="button"
      aria-label={target === null ? t('foodday.water.labelNoTarget', { total, ml: GLASS_ML }) : t('foodday.water.label', { total, target, ml: GLASS_ML })}
      onClick={async () => {
        const id = await addWater(store, date)
        onToast(t('today.water.added', { total: litres(fmt, water.totalMl + GLASS_ML) }), () => undoWater(store, id))
      }}
      className={cn(surfaceClass, 'flex min-h-14 items-center gap-2.5 rounded-lg py-2 pr-2 pl-3 text-left')}
    >
      <Icon name="gota" size={20} className="shrink-0 text-muted-foreground" />
      {/* Si pllaka "Plotëso makrot": titulli lart dhe sasia poshtë, që "3,25 L" të mos fshihet pas "+250". */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 font-semibold">{t('today.water.title')}</span>
        <span className="text-[13px] leading-[1.35] whitespace-nowrap text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{total}</span> {target === null ? t('today.water.ofNoTarget') : t('today.water.of', { target })}
        </span>
        {water.targetMl ? <ProgressTrack ratio={water.totalMl / water.targetMl} ground="card" className="mt-1" /> : null}
      </span>
      <span aria-hidden className="flex h-8 shrink-0 items-center rounded-[10px] bg-surface-2 px-2 text-[13px] leading-none font-bold">
        {t('foodday.water.add', { ml: GLASS_ML })}
      </span>
    </button>
  )
}
