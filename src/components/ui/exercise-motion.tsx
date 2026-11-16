import { type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { useExercisePhoto } from '@/lib/exercise-photo'
import { useReducedMotion } from '@/lib/music-hooks'
import { motionPosition, type Tempo, timeForPosition } from '@/program/motion'
import { Button } from './button'
import { Icon } from './icons'

// Lëvizja e ushtrimit (SPEC §0.3g, V58, bordet "Lëvizja e ushtrimit"): dy fotot e free-exercise-db,
// fillimi (0.jpg) dhe fundi (1.jpg), bardh e zi, ndërrohen me një kalim të butë sipas tempos
// (`program/motion.ts`). Poshtë: tempo me fjalë. Rrëshqitja e gishtit e çon nga fillimi te fundi (dhe e
// ndal), prekja e ndal ose e rinis. E palosshme në një rresht; `onExpand` shton "Zgjero", që prindi e lidh
// me `ExerciseMotionSheet` (ekrani i plotë, me rrëshqitësin "Fillimi — Fundi"). Me lëvizje të reduktuar
// mbetet foto e fillimit me çelësin "Fillimi / Fundi". Pa foto të fillimit nuk del asgjë (vetëm sinjalet
// dhe muskujt të prindit); pa foto të fundit mbetet foto e fillimit, pa lëvizje.

export interface ExerciseMotionProps {
  /** ID-ja te free-exercise-db (`libraryId`); pa të nuk del asgjë. */
  libraryId: string | null
  name: string
  tempo: Tempo
  /** Teksti "Poshtë 2 s · lart 1 s": jo për mbajtjet (plank), ku tempo s'është e njohur. */
  showTempo?: boolean
  /** Rreshti i palosur me prekje hap lëvizjen; pa këtë lëvizja rri gjithnjë e hapur. */
  foldable?: boolean
  defaultFolded?: boolean
  /** "Zgjero": hap ekranin e plotë; i prindit. */
  onExpand?: () => void
  /** Rrëshqitësi "Fillimi — Fundi" poshtë fotos (ekrani i plotë). */
  slider?: boolean
  /** Mbi foto (p.sh. shigjeta mbrapa te faqja e ushtrimit). */
  overlay?: ReactNode
  /** Foto del gjerë sa kutia, me këtë lartësi (parazgjedhja 3:2). */
  stageClassName?: string
  className?: string
}

const DRAG_PX = 8

export function ExerciseMotion({
  libraryId,
  name,
  tempo,
  showTempo = true,
  foldable = false,
  defaultFolded = false,
  onExpand,
  slider = false,
  overlay,
  stageClassName,
  className,
}: ExerciseMotionProps) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  const [folded, setFolded] = useState(foldable && defaultFolded)
  const [paused, setPaused] = useState(false)
  const [side, setSide] = useState<'start' | 'end'>('start')
  const start = useExercisePhoto(libraryId)
  const end = useExercisePhoto(libraryId, !folded, 'end')
  const hasEnd = end.status === 'ready'

  const stage = useRef<HTMLDivElement>(null)
  const endImg = useRef<HTMLImageElement>(null)
  const range = useRef<HTMLInputElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  // Koha brenda ciklit (ms), ora e kornizës së fundit dhe pozicioni i dorës kur rri e ndalur.
  const phase = useRef(0)
  const pausedRef = useRef(false)
  const held = useRef(0)
  const tempoRef = useRef(tempo)
  useEffect(() => {
    tempoRef.current = tempo
  }, [tempo])

  const apply = useCallback((position: number) => {
    if (endImg.current) endImg.current.style.opacity = String(position)
    const percent = `${position * 100}%`
    if (fill.current) fill.current.style.width = percent
    if (dot.current) dot.current.style.left = percent
    if (range.current) range.current.value = String(Math.round(position * 1000))
  }, [])

  const setPausedBoth = useCallback((value: boolean) => {
    pausedRef.current = value
    setPaused(value)
  }, [])

  // Cikli: një kornizë për foto, pa re-vizatim të React-it; kalimi i butë vjen nga opaciteti i fotos së fundit.
  const animating = !reduced && hasEnd && !folded
  useEffect(() => {
    if (!animating) return
    let frame = 0
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      if (!pausedRef.current) {
        phase.current += now - last
        apply(motionPosition(phase.current, tempoRef.current))
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animating, apply])

  // Me lëvizje të reduktuar: vetëm njëra nga dy fotot, me çelësin.
  useEffect(() => {
    if (reduced) apply(side === 'end' ? 1 : 0)
  }, [reduced, side, apply, hasEnd, folded])

  const hold = (position: number) => {
    held.current = position
    phase.current = timeForPosition(position, tempoRef.current)
    apply(position)
  }
  const resume = () => {
    phase.current = timeForPosition(held.current, tempoRef.current)
    setPausedBoth(false)
  }
  const toggle = () => {
    if (pausedRef.current) return resume()
    held.current = motionPosition(phase.current, tempoRef.current)
    setPausedBoth(true)
  }

  // Gishti: rrëshqitja anash çon fotot, prekja ndal ose rinis (touch-action pan-y lë faqen të lëvizë vertikalisht).
  const gesture = useRef<{ x: number; from: number; moved: boolean } | null>(null)
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!animating) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = { x: event.clientX, from: motionPosition(phase.current, tempoRef.current), moved: false }
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = event.clientX - g.x
    if (!g.moved && Math.abs(dx) < DRAG_PX) return
    g.moved = true
    setPausedBoth(true)
    const width = stage.current?.getBoundingClientRect().width || 1
    hold(Math.min(1, Math.max(0, g.from + dx / width)))
  }
  const up = () => {
    const g = gesture.current
    gesture.current = null
    if (g && !g.moved) toggle()
  }
  const cancel = () => {
    gesture.current = null
  }
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!animating || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    toggle()
  }

  const tempoText = t('programme.motion.tempoValue', { down: tempo.downS, up: tempo.upS })

  if (!libraryId || start.status === 'missing') return null

  if (folded) {
    return (
      <button
        type="button"
        onClick={() => setFolded(false)}
        aria-expanded={false}
        aria-label={t('programme.motion.unfold')}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-lg border border-surface-border bg-surface py-1.5 pr-3 pl-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
          className,
        )}
      >
        <span aria-hidden className="flex h-11 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2">
          {start.status === 'ready' ? <img src={start.src} alt="" className="size-full object-cover grayscale" /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="type-body-strong">{t('programme.motion.title')}</span>
          {showTempo ? <span className="type-caption text-muted-foreground">{tempoText}</span> : null}
        </span>
        <Icon name="chevron-poshte" size={20} className="text-muted-foreground" />
      </button>
    )
  }

  return (
    <section aria-label={t('programme.motion.title')} className={cn('flex flex-col', className)}>
      <div
        ref={stage}
        role={animating ? 'button' : undefined}
        tabIndex={animating ? 0 : undefined}
        aria-label={animating ? (paused ? t('programme.motion.play') : t('programme.motion.pause')) : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onKeyDown={key}
        className={cn(
          'relative aspect-[3/2] w-full touch-pan-y overflow-hidden bg-surface-2 select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground',
          stageClassName,
        )}
      >
        {start.status === 'ready' ? (
          <img src={start.src} alt={t('programme.motion.startAlt', { name })} draggable={false} className="absolute inset-0 size-full object-cover grayscale" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Icon name="programi" size={18} />
          </span>
        )}
        {hasEnd ? (
          <img
            ref={endImg}
            src={end.src}
            alt={t('programme.motion.endAlt', { name })}
            draggable={false}
            style={{ opacity: side === 'end' && reduced ? 1 : 0 }}
            className="absolute inset-0 size-full object-cover opacity-0 grayscale motion-safe:will-change-[opacity]"
          />
        ) : null}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background to-transparent" />
        {animating && paused ? (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-pill bg-background/70 text-foreground backdrop-blur-sm">
              <Icon name="luaj" size={26} />
            </span>
          </span>
        ) : null}
        {overlay}
      </div>

      {reduced && hasEnd ? (
        <div className="flex flex-col gap-2 px-4 pt-3">
          <p className="type-caption text-muted-foreground">{t('programme.motion.reduced')}</p>
          <div role="group" aria-label={t('programme.motion.switch')} className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
            {(['start', 'end'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={side === value}
                onClick={() => setSide(value)}
                className={cn(
                  'min-h-touch rounded-sm type-body-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                  side === value ? 'bg-surface text-foreground' : 'text-muted-foreground',
                )}
              >
                {t(value === 'start' ? 'programme.motion.start' : 'programme.motion.end')}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {slider && animating ? (
        <div className="px-4 pt-3">
          <div className="relative h-11">
            <span aria-hidden className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-surface-2" />
            <span aria-hidden className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2">
              <span ref={fill} className="block h-full rounded-pill bg-foreground" style={{ width: '0%' }} />
              <span ref={dot} className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-foreground" style={{ left: '0%' }} />
            </span>
            <input
              ref={range}
              type="range"
              min={0}
              max={1000}
              step={1}
              defaultValue={0}
              aria-label={t('programme.motion.slider')}
              onInput={(event) => {
                setPausedBoth(true)
                hold(Number(event.currentTarget.value) / 1000)
              }}
              className="peer absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground" />
          </div>
          <div className="flex justify-between text-[13px] leading-[1.35] text-muted-foreground">
            <span>{t('programme.motion.start')}</span>
            <span>{t('programme.motion.end')}</span>
          </div>
        </div>
      ) : null}

      {showTempo || foldable || onExpand ? (
        <div className="mx-4 mt-2 flex min-h-12 items-center gap-2 border-y border-border">
          {showTempo ? (
            <>
              <Icon name="metronomi" size={18} className="text-muted-foreground" />
              <span className="type-caption text-muted-foreground">{t('programme.motion.tempo')}</span>
              <span className="type-body-strong ml-auto">{tempoText}</span>
            </>
          ) : (
            <span className="flex-1" />
          )}
          {foldable ? (
            <Button variant="ghost" size="icon" aria-label={t('programme.motion.fold')} aria-expanded onClick={() => setFolded(true)}>
              <Icon name="chevron-lart" size={20} />
            </Button>
          ) : null}
        </div>
      ) : null}

      {onExpand ? (
        <div className="px-4 pt-3">
          <Button variant="outline" className="w-full" onClick={onExpand}>
            <Icon name="zmadho" size={18} />
            {t('programme.motion.expand')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/** Ekrani i plotë i lëvizjes (fleta me rrëshqitësin "Fillimi — Fundi"); `children` vijnë poshtë tempos (sinjalet, "Shiko videon"). */
export function ExerciseMotionSheet({
  libraryId,
  name,
  tempo,
  showTempo,
  onClose,
  children,
}: Pick<ExerciseMotionProps, 'libraryId' | 'name' | 'tempo' | 'showTempo'> & { onClose: () => void; children?: ReactNode }) {
  return (
    <Sheet title={name} onClose={onClose}>
      <div className="-mx-4 flex flex-col gap-3">
        <ExerciseMotion libraryId={libraryId} name={name} tempo={tempo} showTempo={showTempo} slider />
      </div>
      {children}
    </Sheet>
  )
}
