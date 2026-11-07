import { BACK, FRONT, type Region, type Shape, SILHOUETTE } from '@/body/figure-regions'
import { MUSCLE_ROLE } from './roles'
import { cn } from '@/lib/cn'

// Figura e trupit përpara dhe mbrapa (SPEC §14, ekrani Sot; rruga 2D e §18 për Trupin). Çdo
// zonë lidhet me çelësat e muskujve të Shtojcës D. Kryesorët me `brand`, ndihmësit gri.
// Rri mbi `panel`, që mbetet i errët në çdo temë.

function ShapeEl({ shape, className }: { shape: Shape; className: string }) {
  return shape.kind === 'circle' ? (
    <circle cx={shape.cx} cy={shape.cy} r={shape.r} className={className} />
  ) : (
    <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} className={className} />
  )
}

interface Painter {
  /** Klasa e mbushjes për një zonë sipas çelësave të saj; null: vetëm silueta. */
  paint?: (keys: string[]) => string | null
  /** Prekja e një zone (Trupi): hap muskulin. */
  onPick?: (keys: string[]) => void
  pickLabel?: (keys: string[]) => string
}

function View({ regions, primary, secondary, paint, onPick, pickLabel }: { regions: Region[]; primary: Set<string>; secondary: Set<string> } & Painter) {
  const level = (region: Region) =>
    region.keys.some((key) => primary.has(key)) ? 'primary' : region.keys.some((key) => secondary.has(key)) ? 'secondary' : null
  return (
    <>
      {SILHOUETTE.map((shape, index) => (
        <ShapeEl key={`s${index}`} shape={shape} className="fill-panel-border" />
      ))}
      {regions.flatMap((region, index) => {
        const value = level(region)
        const className = paint ? paint(region.keys) : value ? MUSCLE_ROLE[value].fill : null
        const shapes = region.shapes.map((shape, part) => (
          <ShapeEl key={`r${index}-${part}`} shape={shape} className={className ?? (onPick ? 'fill-transparent' : '')} />
        ))
        if (onPick) {
          return [
            <g
              key={`g${index}`}
              role="button"
              tabIndex={0}
              aria-label={pickLabel?.(region.keys)}
              onClick={() => onPick(region.keys)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onPick(region.keys)
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>*]:stroke-panel-foreground [&:focus-visible>*]:stroke-1"
            >
              {shapes}
            </g>,
          ]
        }
        return className ? shapes : []
      })}
    </>
  )
}

export function BodyFigure({
  primary,
  secondary = [],
  label,
  scale = 1,
  className,
  paint,
  onPick,
  pickLabel,
}: Painter & {
  primary: string[]
  secondary?: string[]
  /** "Muskujt e sotëm: gjoksi, tricepsi dhe pulpat". Pa etiketë, figura është zbukurim. */
  label?: string
  /** 1 = 132 × 144 px (paneli i Sot). */
  scale?: number
  className?: string
}) {
  const primarySet = new Set(primary)
  const secondarySet = new Set(secondary.filter((key) => !primarySet.has(key)))
  return (
    <figure className={cn('m-0 flex flex-col items-center gap-1.5', className)}>
      <svg
        viewBox="0 0 132 144"
        width={132 * scale}
        height={144 * scale}
        className="h-auto max-h-full max-w-full"
        {...(label ? { role: onPick ? 'group' : 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        <View regions={FRONT} primary={primarySet} secondary={secondarySet} paint={paint} onPick={onPick} pickLabel={pickLabel} />
        <g transform="translate(72 0)">
          <View regions={BACK} primary={primarySet} secondary={secondarySet} paint={paint} onPick={onPick} pickLabel={pickLabel} />
        </g>
      </svg>
      <figcaption aria-hidden className="flex gap-6 text-xs leading-4 text-panel-muted-foreground">
        <span>Përpara</span>
        <span>Mbrapa</span>
      </figcaption>
    </figure>
  )
}
