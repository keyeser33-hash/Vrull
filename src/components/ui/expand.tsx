import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Rreshti → detaji (DESIGN.md › Lëvizja, SPEC §0.3c): pjesa që hapet në vend, 250 ms ease-out, me rreshtin
// e rrjetës nga 0fr te 1fr. E mbyllur rri jashtë pemës së aksesueshmërisë dhe radhës së Tab-it (`inert`,
// `aria-hidden`, `invisible`); `visibility` ndërrohet në fund të mbylljes, që përmbajtja të duket gjatë
// lëvizjes. `overflow-clip` me 4 px hapësirë, që unaza e fokusit (2 px, 2 px larg) të mos pritet. Me
// lëvizje të reduktuar (`motion-safe:`) hapet dhe mbyllet menjëherë.

export function Expand({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden={open ? undefined : true}
      inert={!open}
      className={cn(
        'grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-250 motion-safe:ease-out',
        open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
      )}
    >
      <div className={cn('min-h-0 overflow-clip [overflow-clip-margin:4px]', className)}>{children}</div>
    </div>
  )
}
