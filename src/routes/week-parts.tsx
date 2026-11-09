import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { RollingNumber } from '@/components/ui/rolling-number'
import { cn } from '@/lib/cn'
import { useSpark } from './goal-motion'
import type { GoalCell } from './week-format'

// Pjesët e përbashkëta të javës (bordet "Sot", "Qëllimet", "Java", "Sot · Diela"): matësit e tre
// qëllimeve me shiritin me segmente, dhe lidhja mbrapa me tekst ("‹ Sot").

/** Shiriti me segmente: i mbushuri prush (mbushet nga e majta, 320 ms), dita rezervë me vijë të ndërprerë. */
export function GoalSegments({ cell, ground = 'page', className }: { cell: GoalCell; ground?: 'page' | 'card'; className?: string }) {
  if (cell.segments === 0) return <span aria-hidden className={cn('h-1.5 rounded-pill', ground === 'page' ? 'bg-track' : 'bg-surface-2', className)} />
  return (
    <span aria-hidden className={cn('grid gap-[3px]', className)} style={{ gridTemplateColumns: `repeat(${cell.segments}, minmax(0, 1fr))` }}>
      {Array.from({ length: cell.segments }, (_, index) => {
        const filled = index < cell.filled
        const spare = cell.spare && index === cell.filled
        return (
          <span
            key={index}
            className={cn(
              'box-border h-1.5 rounded-pill',
              filled ? 'origin-left animate-fill bg-ember' : spare ? 'border border-dashed border-ember-text' : ground === 'page' ? 'bg-track' : 'bg-surface-2',
            )}
          />
        )
      })}
    </span>
  )
}

/** Vlera e madhe e një qëllimi me njësinë e vogël pas saj: "2 nga 4", "3+1 rezervë". */
export function GoalValue({ cell, size = 24 }: { cell: GoalCell; size?: 24 | 28 }) {
  const numeric = /^\d+$/.test(cell.value)
  return (
    <span className={cn('font-display leading-none font-extrabold whitespace-nowrap tabular-nums', size === 28 ? 'text-[28px]' : 'text-2xl')}>
      {numeric ? <RollingNumber value={Number(cell.value)} /> : cell.value}
      <span className="font-text text-sm font-normal text-muted-foreground"> {cell.unit}</span>
    </span>
  )
}

/** Unaza e shkëndijës rreth vlerës së një qëllimi të sapoarritur (dekor, `goal-motion.ts`). */
function Spark() {
  const ref = useSpark<HTMLSpanElement>()
  return <span ref={ref} aria-hidden className="pointer-events-none absolute -inset-2 rounded-pill border-2 border-ember-text opacity-0" />
}

/** Java e plotë (`WEEK_COMPLETE`): unaza rreth tre matësve, 600 ms, një herë në javë (dekor, `goal-motion.ts`). */
export function WeekSpark() {
  const ref = useSpark<HTMLSpanElement>('week')
  return <span ref={ref} aria-hidden data-spark="week" className="pointer-events-none absolute -inset-1.5 rounded-lg border-2 border-ember-text opacity-0" />
}

/** Tre matësit në një rresht (Sot): emri, vlera dhe shiriti. Pa `to` janë vetëm pamje; `celebrate`: qëllimet që sapo u arritën. */
export function GoalMeters({
  cells,
  to,
  label,
  ground = 'page',
  celebrate,
}: {
  cells: GoalCell[]
  to?: string
  label: string
  ground?: 'page' | 'card'
  celebrate?: ReadonlySet<string>
}) {
  const body = cells.map((cell) => (
    <span key={cell.key} className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] leading-[1.35] text-muted-foreground">{cell.label}</span>
      <span className="relative self-start">
        <GoalValue cell={cell} />
        {celebrate?.has(cell.key) ? <Spark /> : null}
      </span>
      <GoalSegments cell={cell} ground={ground} />
    </span>
  ))
  const className = 'grid grid-cols-3 gap-3 py-0.5 text-foreground'
  return to ? (
    <Link to={to} aria-label={label} className={cn(className, 'min-h-touch rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}>
      {body}
    </Link>
  ) : (
    <div role="img" aria-label={label} className={className}>
      {body}
    </div>
  )
}

/** Matësit e shkurtër të kartës së së dielës: "4/4", "6/7", me një shirit të plotë kur arrihet. */
export function GoalMetersShort({ cells, label }: { cells: GoalCell[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative grid grid-cols-3 gap-3">
      {cells.map((cell) => (
        <span key={cell.key} className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{cell.label}</span>
          <span className="font-display text-2xl leading-none font-extrabold tabular-nums">{cell.short}</span>
          <span aria-hidden className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
            <span
              className="block h-full origin-left animate-fill rounded-pill bg-ember"
              style={{ width: `${cell.met ? 100 : cell.segments === 0 ? 0 : (cell.filled / cell.segments) * 100}%` }}
            />
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * Lidhja mbrapa me tekst (bordet "Qëllimet" dhe "Java": "‹ Sot"): kthehet aty nga erdhi përdoruesi,
 * ose te `fallback` kur faqja është e para në histori.
 */
export function BackLink({ text, label, fallback }: { text: string; label: string; fallback: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <div className="flex min-h-[52px] items-center">
      <Button
        variant="ghost"
        aria-label={label}
        className="-ml-3 gap-1 px-2 font-text text-[15px] font-semibold tracking-normal normal-case"
        onClick={() => (location.key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1))}
      >
        <Icon name="mbrapa" size={22} />
        {text}
      </Button>
    </div>
  )
}
