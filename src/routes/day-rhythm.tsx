import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/icons'
import { store } from '@/data/app-data'
import { moveMealTimes } from '@/data/schedule-settings'
import { isTrainingMode, type TodayView } from '@/data/today'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { MealKey } from '@/nutrition/meals'
import { untilText } from './until-text'
import { canMoveMeal, clockText, type MealMove, moveMeals, nearestPoint, type RhythmPoint, rhythmOf } from '@/today/rhythm'

// Ritmi i ditës te Sot (V57, SPEC §0.3f; bordet "Sot", "Sot · Rreshqit", "Sot · Lëviz"): vija nga zgjimi te gjumi me vaktet
// e orarit (të ngrënat të mbushura), stërvitjen dhe "Tani". Një prekje hap vaktin ose stërvitjen; rrëshqitja jep një
// flluskë pa lëvizur faqen (`touch-action: pan-y`); shtypja e gjatë lëviz një vakt që vjen (V35) dhe vaktet e zakonshme
// pas tij lëvizin bashkë me të. Zonat e prekjes janë 44 px (gjetja e pikës më të afërt); lexuesi i ekranit ka butona
// të vërtetë për çdo pikë. Pa animacion: nuk ka çfarë të reduktohet me "lëvizje të reduktuar".

const PAD = 12
const HIT = 22
const LONG_PRESS_MS = 400
const SLOP = 8
const BUBBLE_MS = 4000
const BUBBLE_WIDTH = 224

const WORKOUT_DOT = 'absolute top-[11px] flex size-[22px] -translate-x-1/2 items-center justify-center rounded-pill border-[1.5px] border-ember-text'
const WORKOUT_DONE = 'bg-ember text-on-ember'
const WORKOUT_TODO = 'bg-background text-ember-text'

const leftOf = (fraction: number) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${fraction})`

function workoutPoint(view: TodayView) {
  return isTrainingMode(view) || view.mode === 'done' ? { time: view.trainingTime, done: view.mode === 'done' } : null
}

export function DayRhythm({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const area = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ id: number; x: number; y: number; point: RhythmPoint | null; mode: 'pending' | 'scrub' | 'drag'; timer?: ReturnType<typeof setTimeout> } | null>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ meal: MealKey; move: MealMove | null; from: number } | null>(null)
  const [announce, setAnnounce] = useState('')

  const rhythm = rhythmOf({ wakeTime: view.wakeTime, sleepTime: view.sleepTime, meals: view.meals, workout: workoutPoint(view), nowMinutes: view.nowMinutes })
  const span = rhythm.endMinutes - rhythm.startMinutes

  useEffect(() => {
    if (!bubble) return
    const timer = setTimeout(() => setBubble(null), BUBBLE_MS)
    return () => clearTimeout(timer)
  }, [bubble])
  useEffect(() => () => clearTimeout(gesture.current?.timer), [])

  const fractionOf = (minutes: number) => Math.min(1, Math.max(0, (minutes - rhythm.startMinutes) / span))
  const shown = (point: RhythmPoint): RhythmPoint => {
    const moved = drag?.move ? (point.id === drag.move.meal ? drag.move.minutes : drag.move.shifts.find((shift) => shift.meal === point.id)?.to) : undefined
    return moved === undefined ? point : { ...point, minutes: moved, time: clockText(moved), fraction: fractionOf(moved) }
  }
  const points = rhythm.points.map(shown)
  const nameOf = (point: RhythmPoint) => (point.kind === 'meal' ? mealName(t, point.id as MealKey) : t('sot.day.session'))

  const open = (point: RhythmPoint) => {
    if (point.kind === 'meal') navigate(`/ushqimi?vakti=${point.id}`)
    else document.getElementById('sot-workout')?.scrollIntoView({ block: 'center' })
  }
  const spoken = (point: RhythmPoint) =>
    point.kind === 'workout'
      ? t(point.done ? 'sot.rhythm.workoutDone' : 'sot.rhythm.workout', { time: point.time })
      : t(point.done ? 'sot.rhythm.mealDone' : 'sot.rhythm.meal', { meal: nameOf(point), time: point.time })

  const geometry = (clientX: number) => {
    const rect = area.current?.getBoundingClientRect()
    const width = Math.max(1, (rect?.width ?? 0) - PAD * 2)
    return { inner: width, fraction: Math.min(1, Math.max(0, (clientX - (rect?.left ?? 0) - PAD) / width)) }
  }
  const hit = (clientX: number) => {
    const { inner, fraction } = geometry(clientX)
    const near = nearestPoint(rhythm.points, fraction)
    return near && Math.abs(near.fraction - fraction) * inner <= HIT ? near : null
  }
  const capture = (event: PointerEvent) => {
    try {
      area.current?.setPointerCapture(event.pointerId)
    } catch {
      // jsdom dhe disa WebView nuk e kanë: gjesti vazhdon pa të.
    }
  }
  const end = () => {
    clearTimeout(gesture.current?.timer)
    gesture.current = null
  }

  const down = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    end()
    const point = hit(event.clientX)
    const current: NonNullable<typeof gesture.current> = { id: event.pointerId, x: event.clientX, y: event.clientY, point, mode: 'pending' }
    gesture.current = current
    if (point && canMoveMeal(point, rhythm.nowMinutes)) {
      current.timer = setTimeout(() => {
        if (gesture.current !== current || current.mode !== 'pending') return
        current.mode = 'drag'
        setBubble(null)
        setDrag({ meal: point.id as MealKey, move: null, from: point.minutes })
        capture(event)
      }, LONG_PRESS_MS)
    }
  }
  const move = (event: PointerEvent) => {
    const current = gesture.current
    if (!current) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (current.mode === 'pending') {
      if (Math.abs(dx) <= SLOP || Math.abs(dx) < Math.abs(dy)) return
      clearTimeout(current.timer)
      current.mode = 'scrub'
      capture(event)
    }
    const { fraction } = geometry(event.clientX)
    if (current.mode === 'scrub') {
      setBubble(nearestPoint(rhythm.points, fraction)?.id ?? null)
    } else if (current.mode === 'drag' && current.point) {
      const wanted = rhythm.startMinutes + fraction * span
      setDrag({ meal: current.point.id as MealKey, move: moveMeals(rhythm.points, current.point.id as MealKey, wanted, rhythm.nowMinutes), from: current.point.minutes })
    }
  }
  const up = async () => {
    const current = gesture.current
    end()
    if (!current) return
    if (current.mode === 'pending' && current.point) open(current.point)
    if (current.mode !== 'drag') return
    const result = drag?.move
    setDrag(null)
    if (!result || result.delta === 0) return
    const times: Partial<Record<MealKey, string>> = { [result.meal]: clockText(result.minutes) }
    for (const shift of result.shifts) times[shift.meal] = clockText(shift.to)
    try {
      await moveMealTimes(store, times, view.date)
      setAnnounce(t('sot.rhythm.moved', { meal: mealName(t, result.meal), time: clockText(result.minutes) }))
    } catch {
      setAnnounce(t('sot.rhythm.moveFailed'))
    }
  }
  const cancel = () => {
    end()
    setDrag(null)
  }

  const bubblePoint = drag ? null : points.find((point) => point.id === bubble)
  const dragged = drag ? points.find((point) => point.id === drag.meal) : null
  const next = rhythm.next
  const nextLine = !next
    ? t('sot.rhythm.nextNone')
    : (rhythm.nextInMinutes ?? 0) > 0
      ? t('sot.rhythm.next', { meal: mealName(t, next.id as MealKey), time: next.time, until: untilText(t, rhythm.nextInMinutes ?? 0) })
      : t('sot.rhythm.nextDue', { meal: mealName(t, next.id as MealKey), time: next.time })

  return (
    <section aria-label={t('sot.rhythm.label', { wake: rhythm.wakeTime, sleep: rhythm.sleepTime })} className="flex flex-col gap-1.5">
      <div
        ref={area}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => void up()}
        onPointerCancel={cancel}
        onContextMenu={(event) => event.preventDefault()}
        className="relative h-14 touch-pan-y select-none"
      >
        <span aria-hidden className="absolute top-[42px] right-3 left-3 h-0.5 rounded-pill bg-track" />
        <span aria-hidden className="absolute top-[42px] left-3 h-0.5 rounded-pill bg-foreground" style={{ width: `calc((100% - ${PAD * 2}px) * ${rhythm.nowFraction})` }} />
        <span aria-hidden className="absolute top-3.5 bottom-0 w-px -translate-x-1/2 bg-ember-text" style={{ left: leftOf(rhythm.nowFraction) }} />
        <span aria-hidden className="absolute top-0 -translate-x-1/2 text-[11px] leading-[1.2] font-semibold whitespace-nowrap text-ember-text tabular-nums" style={{ left: leftOf(rhythm.nowFraction) }}>
          {rhythm.nowTime}
        </span>
        {dragged && drag ? <span aria-hidden className="absolute top-[36px] h-3.5 w-0 -translate-x-1/2 border-l border-dashed border-muted-foreground" style={{ left: leftOf(fractionOf(drag.from)) }} /> : null}
        {points.map((point) =>
          point.kind === 'workout' ? (
            <span
              key={point.id}
              aria-hidden
              className={cn(WORKOUT_DOT, point.done ? WORKOUT_DONE : WORKOUT_TODO)}
              style={{ left: leftOf(point.fraction) }}
            >
              <Icon name="programi" size={14} />
            </span>
          ) : (
            <span
              key={point.id}
              aria-hidden
              className={cn(
                'absolute top-[39px] box-border size-2 -translate-x-1/2 rounded-pill border',
                point.done ? 'border-foreground bg-foreground' : point.past ? 'border-foreground bg-background' : 'border-muted-foreground bg-background',
                drag?.meal === point.id && 'size-3.5 top-9 border-foreground bg-foreground',
              )}
              style={{ left: leftOf(point.fraction) }}
            />
          ),
        )}
        {points.map((point) => (
          <button key={point.id} type="button" className="sr-only" onClick={() => open(point)}>
            {spoken(point)}
          </button>
        ))}
        {dragged && drag ? (
          <Bubble at={dragged.fraction}>
            <span className="type-body-strong tabular-nums">{t('sot.rhythm.moving', { meal: mealName(t, drag.meal), from: clockText(drag.from), to: dragged.time })}</span>
            {drag.move && drag.move.shifts.length > 0 ? <span className="type-caption text-muted-foreground">{t('sot.rhythm.moveTogether')}</span> : null}
            <span className="type-caption text-muted-foreground">{t('sot.rhythm.moveRelease')}</span>
          </Bubble>
        ) : bubblePoint ? (
          <Bubble at={bubblePoint.fraction}>
            <span className="type-body-strong tabular-nums">{t(bubblePoint.kind === 'meal' ? 'sot.rhythm.bubbleMeal' : 'sot.rhythm.bubbleWorkout', { time: bubblePoint.time, meal: nameOf(bubblePoint) })}</span>
            {bubblePoint.kind === 'meal' ? (
              <span className="flex items-center gap-1 type-caption text-muted-foreground tabular-nums">
                {bubblePoint.done ? <Icon name="zgjedhur" size={12} /> : null}
                {bubblePoint.done ? t('sot.rhythm.bubbleEaten', { kcal: fmt.number(bubblePoint.kcal), protein: fmt.number(bubblePoint.proteinG) }) : t('sot.rhythm.bubbleEmpty')}
              </span>
            ) : null}
            <span className="type-caption text-muted-foreground">{t('sot.rhythm.bubbleOpen')}</span>
          </Bubble>
        ) : null}
      </div>
      <p className="m-0 flex items-baseline justify-between gap-3 type-caption text-foreground tabular-nums">
        <span className="min-w-0 truncate">{nextLine}</span>
        <span className="shrink-0 text-muted-foreground">{t('sot.rhythm.sleep', { time: rhythm.sleepTime })}</span>
      </p>
      <span role="status" className="sr-only">
        {announce}
      </span>
      <span className="sr-only">{t('sot.rhythm.nowAt', { time: rhythm.nowTime })}</span>
    </section>
  )
}

/** Flluska mbi vijë: nuk merr prekje (`pointer-events-none`), që gjesti të vazhdojë poshtë saj. */
function Bubble({ at, children }: { at: number; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[52px] z-10 flex -translate-x-1/2 flex-col gap-0.5 rounded-md border border-subtle bg-surface-2 px-3 py-2 text-foreground"
      style={{ left: `clamp(${BUBBLE_WIDTH / 2}px, ${leftOf(at)}, calc(100% - ${BUBBLE_WIDTH / 2}px))`, width: BUBBLE_WIDTH }}
    >
      {children}
    </div>
  )
}
