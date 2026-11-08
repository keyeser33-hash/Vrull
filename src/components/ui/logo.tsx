import { cn } from '@/lib/cn'

// Shenja e Vrullit (V24; sistemi i dizajnit, assets/Logos/vrull-mark.svg, bordi "Vrull · Identiteti"):
// katror prushi me rreze 14, me V-në dhe dy vijat e shpejtësisë në `on-ember`, pa kufi, kurrë në ngjyra
// të tjera. Dekorative: kush e vendos i jep emrin (p.sh. butoni i profilit). Ikona e app-it, nisja,
// favicon-i dhe ikona e njoftimit krijohen nga kjo shenjë (`tools/app-icon/build.mjs`).
export function VrullMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" width={size} height={size} className={cn('shrink-0', className)}>
      <rect width="64" height="64" rx="14" className="fill-ember" />
      <path
        d="M14 18L28 46L34 34M38 18L50 18M34 26L44 26"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-on-ember"
      />
    </svg>
  )
}
