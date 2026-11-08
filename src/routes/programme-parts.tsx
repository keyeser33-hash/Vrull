import { type ButtonHTMLAttributes, type ReactNode, useRef } from 'react'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { useExercisePhoto, useInView } from '@/lib/exercise-photo'
import { cn } from '@/lib/cn'

// Pjesët e përbashkëta të ekraneve të programit (V2-E1-09): foto e vogël e ushtrimit me "Pa foto",
// çipat e filtrave dhe të zgjedhjeve (bordet "Biblioteka", "KrijoUshtrim").

/** Foto e ushtrimit bardh e zi (SPEC §0.3a), ose vend-mbajtësi "Pa foto"; kurrë një foto e shpikur. */
export function ExerciseThumb({
  libraryId,
  size = 'row',
  ground = 'page',
  className,
}: {
  libraryId: string | null
  size?: 'row' | 'square'
  /** Vend-mbajtësi: `surface` mbi faqe, `surface-2` brenda kartës. */
  ground?: 'page' | 'card'
  className?: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLSpanElement>(null)
  const photo = useExercisePhoto(libraryId, useInView(ref))
  const box = size === 'row' ? 'h-12 w-[72px]' : 'size-11'
  return (
    <span ref={ref} aria-hidden className={cn('flex shrink-0 overflow-hidden rounded-[8px]', box, className)}>
      {photo.status === 'ready' ? (
        <img src={photo.src} alt="" className="size-full object-cover grayscale" />
      ) : (
        <span
          className={cn(
            'flex size-full items-center justify-center gap-1 rounded-[8px] border border-dashed border-subtle text-muted-foreground',
            ground === 'card' ? 'bg-surface-2' : 'bg-surface',
          )}
        >
          <Icon name="programi" size={16} />
          {size === 'row' && photo.status === 'missing' ? <span className="text-xs leading-4">{t('programme.noPhoto')}</span> : null}
        </span>
      )}
    </span>
  )
}

/** Çip 44 px: i zgjedhuri në bojë (`foreground`), të tjerët `surface` me kufi (DESIGN.md › segmenti). */
export function Chip({
  selected,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-touch shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-[15px] leading-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        selected ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border bg-surface font-medium text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
