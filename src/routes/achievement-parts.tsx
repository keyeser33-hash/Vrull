import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { Listed } from './achievement-format'

// Shenja e arritjes (V43; bordet "Progresi · Arritjet", "Arritjet · detaji", "Mbyllja"): rrethi me
// shkurtimin, i përbashkët për faqen, fletën dhe mbylljen. Tekstet: `achievement-format.ts`.

// Mbushja me prush mban tekstin `on-ember`; unaza dhe vija e ndërprerë mbeten mbi sipërfaqen e pllakës.
const FILLED = 'bg-ember text-on-ember'
const RING = 'border-2 border-ember-text text-foreground'
const DASHED = 'border-2 border-dashed border-subtle text-muted-foreground'

const SIZES = {
  row: 'size-11 text-lg',
  tile: 'size-11 text-xl',
  hero: 'size-[104px] text-[44px]',
} as const

/**
 * Shenja: e mbushur me prush kur është e re (dhe te fleta kur është fituar), me unazë prushi kur është
 * fituar, me vijë të ndërprerë kur mungon. Dekorative: emri dhe gjendja jepen me fjalë pranë saj.
 */
export function AchievementBadge({ achievement, size, filled }: { achievement: Listed; size: keyof typeof SIZES; filled?: boolean }) {
  const { t, fmt } = useI18n()
  const { key, earnedOn, progress } = achievement
  const text = key === 'programme' && progress.target > 0 ? fmt.number(progress.target) : t(`achievements.${key}.badge`)
  const earned = earnedOn !== null
  const fill = earned && (filled ?? achievement.isNew)
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-pill font-display leading-none font-extrabold tabular-nums',
        SIZES[size],
        fill ? FILLED : earned ? RING : DASHED,
        fill && size === 'hero' ? 'outline-1 outline-offset-[6px] outline-ember-text' : '',
      )}
    >
      {text}
    </span>
  )
}
