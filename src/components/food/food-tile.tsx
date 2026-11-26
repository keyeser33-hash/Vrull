import { foodIconFromNames } from '@/catalog/food-icon-map'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { FoodIcon } from './food-icon'

// Pllaka e një ushqimi te listat e Ushqimit të ri (SPEC §0.3h): sfondi `surface-2` dhe ilustrimi me ngjyra i ushqimit
// (V67), i zgjedhur nga emrat e rreshtit. Kur asnjë emër nuk tregon formë, del ikona e përgjithshme e pjatës.

const SIZES = { xs: { box: 'size-6 rounded-[6px]', icon: 15, art: 18 }, sm: { box: 'size-8 rounded-lg', icon: 18, art: 24 }, md: { box: 'size-10 rounded-[10px]', icon: 24, art: 30 }, lg: { box: 'size-12 rounded-xl', icon: 28, art: 36 } } as const

export function FoodTile({ size = 'md', names, className }: { size?: keyof typeof SIZES; names?: readonly (string | null | undefined)[]; className?: string }) {
  const s = SIZES[size]
  const art = names ? foodIconFromNames(names) : null
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center bg-surface-2 text-muted-foreground', s.box, className)}>
      {art ? <FoodIcon name={art} size={s.art} /> : <Icon name="pjata" size={s.icon} />}
    </span>
  )
}
