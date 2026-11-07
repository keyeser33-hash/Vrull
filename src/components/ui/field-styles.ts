import { cn } from '@/lib/cn'

// Fusha e Omal UI v2: 44 px, radius 12, tekst 16 px; kufi 2 px destructive kur ka gabim.
export const inputClass = cn(
  'h-11 w-full rounded-md border border-input bg-card px-3.5 text-base text-foreground tabular-nums',
  'placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  'aria-invalid:border-destructive aria-invalid:border-2',
)
