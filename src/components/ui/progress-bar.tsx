import { cva } from 'class-variance-authority'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { surfaceClass } from './surface'

// Shiriti 6 px kundrejt objektivit, në kartë me vlerën dhe objektivin ("96/180"). Makrot dallohen
// me ngjyra me lartësi drite të ndryshme: proteina `ember`, karbohidratet `data`, yndyrat `sand`.
// Mbi 100% shiriti mbetet plot dhe karta e thotë me fjalë. Mbushet nga e majta në 320 ms.

export type ProgressTone = 'ember' | 'data' | 'sand'

const fill = cva('h-full origin-left animate-fill rounded-pill', {
  variants: { tone: { ember: 'bg-ember', data: 'bg-data', sand: 'bg-sand' } },
})

/** Vetëm shiriti. `ground="page"` mbi sfondin e faqes merr gjurmën `track`; brenda kartës `surface-2`. */
export function ProgressTrack({ ratio, tone = 'ember', ground = 'card', className }: { ratio: number; tone?: ProgressTone; ground?: 'card' | 'page'; className?: string }) {
  const width = Math.max(0, Math.min(ratio, 1)) * 100
  return (
    <div aria-hidden className={cn('h-1.5 overflow-hidden rounded-pill', ground === 'page' ? 'bg-track' : 'bg-surface-2', className)}>
      <div className={fill({ tone })} style={{ width: `${width}%` }} />
    </div>
  )
}

export function ProgressBar({
  label,
  value,
  target,
  unit,
  unitName,
  tone = 'ember',
  className,
}: {
  label: string
  value: number
  target: number
  /** Njësia e shkurtër pas objektivit ("g"); pa të vetëm numrat. */
  unit?: string
  /** Njësia me fjalë për lexuesin e ekranit ("gramë"). */
  unitName: string
  tone?: ProgressTone
  className?: string
}) {
  const { t, fmt } = useI18n()
  const over = value > target
  const ratio = target > 0 ? value / target : 0
  const spoken = t(over ? 'ui.progress.spokenOver' : 'ui.progress.spoken', { label, value, target, unit: unitName })
  return (
    <div role="group" aria-label={spoken} className={cn(surfaceClass, 'flex min-w-0 flex-col gap-2 rounded-lg p-3', className)}>
      <span aria-hidden className="text-[13px] leading-[1.35] text-muted-foreground">
        {label}
      </span>
      <span aria-hidden className="font-display text-[26px] leading-none font-extrabold whitespace-nowrap tabular-nums">
        {fmt.number(value)}
        <span className="text-[15px] font-semibold text-muted-foreground">
          /{fmt.number(target)}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <ProgressTrack ratio={ratio} tone={tone} />
      {over ? (
        <span aria-hidden className="text-[13px] leading-[1.35] text-muted-foreground">
          {t('ui.progress.over')}
        </span>
      ) : null}
    </div>
  )
}
