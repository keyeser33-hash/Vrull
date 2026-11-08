import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Pjesët e përbashkëta të ekraneve të programit (V2-E1-09): çipat e filtrave dhe të zgjedhjeve (bordet
// "Biblioteka", "KrijoUshtrim"). Foto e ushtrimit: `ExercisePhoto` te components/ui/exercise-photo.tsx.

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
