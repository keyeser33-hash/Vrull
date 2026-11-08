import { cn } from '@/lib/cn'

// Shenja e Vrullit (V24, bordet v2): katror prushi me vijën e shpejtësisë në `on-ember`, pa kufi,
// kurrë në ngjyra të tjera. Dekorative: kush e vendos i jep emrin (p.sh. butoni i profilit).
export function VrullMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" width={size} height={size} className={cn('shrink-0', className)}>
      <rect width="64" height="64" rx="16" className="fill-ember" />
      <path d="M15 43 49 21" fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-on-ember" />
    </svg>
  )
}
