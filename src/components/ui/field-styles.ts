import { cn } from '@/lib/cn'

// Fusha e Vrullit: 44 px, radius 12, tekst 16 px, mbushje `surface` me kufi `subtle`; placeholder-i
// `muted-foreground`; kufi 2 px `danger` kur ka gabim.
export const inputClass = cn(
  'h-touch w-full rounded-md border border-subtle bg-surface px-3.5 text-base text-foreground tabular-nums',
  'placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
  'aria-invalid:border-2 aria-invalid:border-danger',
)
