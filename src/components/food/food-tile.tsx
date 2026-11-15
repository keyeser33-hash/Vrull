import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// Pllaka e një ushqimi te listat e Ushqimit të ri (SPEC §0.3h): sfondi `surface-2`, ikona njëngjyrëshe, kurrë prush.
// Deri te ikonat e ushqimeve (V30, V2-E3-31) del ikona e përgjithshme e pjatës; madhësitë sipas bordeve 0.42.

const SIZES = { xs: { box: 'size-6 rounded-[6px]', icon: 15 }, sm: { box: 'size-8 rounded-lg', icon: 18 }, md: { box: 'size-10 rounded-[10px]', icon: 24 }, lg: { box: 'size-12 rounded-xl', icon: 28 } } as const

export function FoodTile({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center bg-surface-2 text-muted-foreground', s.box, className)}>
      <Icon name="pjata" size={s.icon} />
    </span>
  )
}
