import { useRef } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { useExercisePhoto, useInView } from '@/lib/exercise-photo'
import { Icon } from './icons'

// Foto e ushtrimit sipas ID-së së free-exercise-db (`exercises.library_id`, ExerciseRecord.libraryId):
// bardh e zi (SPEC §0.3a), nga app-i për Shortcut to Size, nga telefoni ose nga interneti për të tjerat
// (lib/exercise-photo.ts). Pa foto: vend-mbajtësi me "Pa foto"; gjatë pritjes vetëm ikona. Kurrë një
// foto e shpikur. Madhësitë: `row` 72 × 48 (listat), `square` 44 × 44; `className` e ndryshon
// (p.sh. `size-12`). Dekorative: emri i ushtrimit është gjithnjë pranë saj.

export function ExercisePhoto({
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
            'flex size-full items-center justify-center gap-1 rounded-[8px] border border-dashed border-subtle px-0.5 text-center text-muted-foreground',
            ground === 'card' ? 'bg-surface-2' : 'bg-surface',
          )}
        >
          {size === 'row' || photo.status === 'loading' ? <Icon name="programi" size={16} /> : null}
          {photo.status === 'missing' ? (
            <span className={size === 'row' ? 'text-xs leading-4' : 'text-[11px] leading-[1.1]'}>{t('programme.noPhoto')}</span>
          ) : null}
        </span>
      )}
    </span>
  )
}
