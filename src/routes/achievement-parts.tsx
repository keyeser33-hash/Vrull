import { Icon, type IconName } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { Listed } from './achievement-format'

// Shenja e arritjes (V43; bordet "Progresi · Arritjet", "Arritjet · detaji", "Mbyllja"): rrethi me
// ikonën e arritjes (V2-E3-30, jo shkurtime), i përbashkët për faqen, fletën dhe mbylljen. Tekstet: `achievement-format.ts`.

// Mbushja me prush mban tekstin `on-ember`; unaza dhe vija e ndërprerë mbeten mbi sipërfaqen e pllakës.
const FILLED = 'bg-ember text-on-ember'
const RING = 'border-2 border-ember-text text-foreground'
const DASHED = 'border-2 border-dashed border-subtle text-muted-foreground'

const SIZES = {
  row: { box: 'size-11', icon: 22 },
  tile: { box: 'size-11', icon: 22 },
  hero: { box: 'size-[104px]', icon: 48 },
} as const

/** Ikona e çdo arritjeje (`src/components/ui/icons.tsx`); emri e thotë vetë arritjen, ikona vetëm e shoqëron. */
const ICON_OF: Record<Listed['key'], IconName> = {
  first_session: 'luaj',
  first_record: 'kupa',
  full_week: 'kalendari',
  streak_4: 'zjarri',
  records_10: 'rritje',
  phase_1: 'zgjedhur',
  sessions_25: 'programi',
  food_7: 'pjata',
  water_7: 'gota',
  programme: 'flamuri',
}

/**
 * Shenja: e mbushur me prush kur është e re (dhe te fleta kur është fituar), me unazë prushi kur është
 * fituar, me vijë të ndërprerë kur mungon. Dekorative: emri dhe gjendja jepen me fjalë pranë saj.
 */
export function AchievementBadge({ achievement, size, filled }: { achievement: Listed; size: keyof typeof SIZES; filled?: boolean }) {
  const { key, earnedOn } = achievement
  const earned = earnedOn !== null
  const fill = earned && (filled ?? achievement.isNew)
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-pill',
        SIZES[size].box,
        fill ? FILLED : earned ? RING : DASHED,
        fill && size === 'hero' ? 'outline-1 outline-offset-[6px] outline-ember-text' : '',
      )}
    >
      <Icon name={ICON_OF[key]} size={SIZES[size].icon} />
    </span>
  )
}
