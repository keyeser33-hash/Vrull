import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Rreshti i listave të Vrullit (brenda një <ul>): emri 16 px 600, detaji 14 px `muted-foreground`,
// vlera djathtas në Barlow Condensed 20 px; ndarës 1 px `border`, të paktën 56 px. I gjithë rreshti
// preket dhe hap detajin; veprimi brenda tij (p.sh. "Si zakonisht") ka zonën e vet 44 px.
export function ListRow({
  name,
  detail,
  value,
  action,
  onSelect,
  className,
}: {
  name: ReactNode
  detail?: ReactNode
  value?: ReactNode
  /** Një buton dytësor në fund të rreshtit, mbi zonën e prekjes së rreshtit. */
  action?: ReactNode
  onSelect?: () => void
  className?: string
}) {
  return (
    <li className={cn('relative flex min-h-row items-center justify-between gap-2.5 border-b border-border py-2 last:border-b-0', className)}>
      <div className="flex min-w-0 flex-col">
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className="text-left type-body-strong outline-none after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-foreground"
          >
            {name}
          </button>
        ) : (
          <span className="type-body-strong">{name}</span>
        )}
        {detail ? <span className="type-caption text-muted-foreground">{detail}</span> : null}
      </div>
      {value !== undefined && value !== null ? (
        <span className="shrink-0 font-display text-xl font-bold tabular-nums">{value}</span>
      ) : null}
      {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
    </li>
  )
}
