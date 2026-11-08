import { cn } from '@/lib/cn'
import { surfaceClass } from './surface'

// Karta e vogël me një numër: etiketë 13 px `muted-foreground` sipër, vlera Barlow Condensed 36 px
// poshtë, me njësi të shkurtër ("96 g"). `ariaLabel` e thotë me fjalë të plota ("Proteina 96 gramë").
// `tone="data"` për një të dhënë dytësore që duhet dalluar. Prekja hap ekranin përkatës.
export function StatTile({
  label,
  value,
  ariaLabel,
  tone = 'default',
  onSelect,
  className,
}: {
  label: string
  value: string
  ariaLabel: string
  tone?: 'default' | 'data'
  onSelect?: () => void
  className?: string
}) {
  const body = (
    <>
      <span aria-hidden className="text-[13px] leading-[1.35] text-muted-foreground">
        {label}
      </span>
      <span
        aria-hidden
        className={cn('font-display text-4xl leading-none font-extrabold whitespace-nowrap tabular-nums', tone === 'data' ? 'text-data' : 'text-foreground')}
      >
        {value}
      </span>
    </>
  )
  const classes = cn(surfaceClass, 'flex min-h-touch min-w-0 flex-col items-start gap-0.5 rounded-lg p-3 text-left', className)
  return onSelect ? (
    <button type="button" aria-label={ariaLabel} onClick={onSelect} className={classes}>
      {body}
    </button>
  ) : (
    <div role="group" aria-label={ariaLabel} className={classes}>
      {body}
    </div>
  )
}
