import { cn } from '@/lib/cn'

// Figura e trupit përpara dhe mbrapa (SPEC §14, ekrani Sot; rruga 2D e §18 për Trupin). Çdo
// zonë lidhet me çelësat e muskujve të Shtojcës D. Kryesorët me `brand`, ndihmësit gri.
// Rri mbi `panel`, që mbetet i errët në çdo temë.

type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number; r: number } | { kind: 'circle'; cx: number; cy: number; r: number }
type Region = { keys: string[]; shapes: Shape[] }

const rect = (x: number, y: number, w: number, h: number, r = Math.min(w, h) / 2): Shape => ({ kind: 'rect', x, y, w, h, r })
const both = (x: number, y: number, w: number, h: number, r?: number) => [rect(x, y, w, h, r), rect(60 - x - w, y, w, h, r)]

// Silueta: koka, qafa, trupi, krahët, legeni, kofshët, kërcinjtë. Një pamje është 60 × 144.
const SILHOUETTE: Shape[] = [
  { kind: 'circle', cx: 30, cy: 10, r: 8 },
  rect(26, 16, 8, 8, 3),
  rect(16, 22, 28, 44, 10),
  ...both(6, 24, 9, 22, 4.5),
  ...both(5, 47, 8, 21, 4),
  rect(18, 63, 24, 13, 5),
  ...both(18, 74, 11, 34, 5),
  ...both(19, 110, 9, 28, 4.5),
]

const FRONT: Region[] = [
  { keys: ['sternocleidomastoid'], shapes: [rect(26.5, 17, 7, 6, 2.5)] },
  { keys: ['deltoid_anterior', 'deltoid_lateral'], shapes: both(6, 23.5, 9, 8, 4) },
  { keys: ['pectoralis_major_clavicular'], shapes: both(18.5, 25, 11, 6, 3) },
  { keys: ['pectoralis_major_sternocostal', 'pectoralis_minor'], shapes: both(18.5, 31.5, 11, 8, 4) },
  { keys: ['biceps_brachii', 'brachialis'], shapes: both(6.5, 32.5, 8, 13, 4) },
  { keys: ['brachioradialis', 'forearm_flexors'], shapes: both(5.5, 48, 7, 15, 3.5) },
  { keys: ['rectus_abdominis'], shapes: [rect(25, 41, 10, 22, 4)] },
  { keys: ['external_oblique'], shapes: both(18, 42, 6, 18, 3) },
  { keys: ['gluteus_medius', 'tensor_fasciae_latae'], shapes: both(18, 64, 5, 9, 2.5) },
  { keys: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'], shapes: both(18.5, 76, 8, 29, 4) },
  { keys: ['adductor_magnus', 'adductor_longus'], shapes: both(26.5, 77, 2.5, 18, 1.25) },
  { keys: ['gastrocnemius', 'soleus'], shapes: both(19, 112, 9, 16, 4.5) },
]

const BACK: Region[] = [
  { keys: ['trapezius'], shapes: [rect(21, 20, 18, 13, 5)] },
  { keys: ['deltoid_posterior', 'deltoid_lateral'], shapes: both(6, 23.5, 9, 8, 4) },
  { keys: ['infraspinatus', 'teres_major'], shapes: both(17.5, 33, 8, 7, 3) },
  { keys: ['rhomboid_major', 'rhomboid_minor'], shapes: [rect(26, 33, 8, 8, 3)] },
  { keys: ['latissimus_dorsi'], shapes: both(17, 41, 8.5, 17, 4) },
  { keys: ['erector_spinae'], shapes: [rect(26.5, 42, 7, 21, 3)] },
  { keys: ['triceps_brachii'], shapes: both(6, 27, 9, 19, 4.5) },
  { keys: ['brachioradialis', 'forearm_flexors'], shapes: both(5.5, 48, 7, 15, 3.5) },
  { keys: ['gluteus_medius'], shapes: both(18.5, 62.5, 10.5, 5, 2.5) },
  { keys: ['gluteus_maximus'], shapes: both(18.5, 66, 10.5, 11, 5) },
  { keys: ['biceps_femoris', 'semitendinosus', 'semimembranosus'], shapes: both(18.5, 80, 9.5, 26, 4.5) },
  { keys: ['adductor_magnus'], shapes: both(27, 78, 2, 14, 1) },
  { keys: ['gastrocnemius', 'soleus'], shapes: both(19, 110, 9, 20, 4.5) },
]

function ShapeEl({ shape, className }: { shape: Shape; className: string }) {
  return shape.kind === 'circle' ? (
    <circle cx={shape.cx} cy={shape.cy} r={shape.r} className={className} />
  ) : (
    <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} className={className} />
  )
}

function View({ regions, primary, secondary }: { regions: Region[]; primary: Set<string>; secondary: Set<string> }) {
  const level = (region: Region) =>
    region.keys.some((key) => primary.has(key)) ? 'primary' : region.keys.some((key) => secondary.has(key)) ? 'secondary' : null
  return (
    <>
      {SILHOUETTE.map((shape, index) => (
        <ShapeEl key={`s${index}`} shape={shape} className="fill-panel-border" />
      ))}
      {regions.flatMap((region, index) => {
        const value = level(region)
        if (!value) return []
        const className = value === 'primary' ? 'fill-brand' : 'fill-panel-muted-foreground opacity-60'
        return region.shapes.map((shape, part) => <ShapeEl key={`r${index}-${part}`} shape={shape} className={className} />)
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
}: {
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
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        <View regions={FRONT} primary={primarySet} secondary={secondarySet} />
        <g transform="translate(72 0)">
          <View regions={BACK} primary={primarySet} secondary={secondarySet} />
        </g>
      </svg>
      <figcaption aria-hidden className="flex gap-6 text-xs leading-4 text-panel-muted-foreground">
        <span>Përpara</span>
        <span>Mbrapa</span>
      </figcaption>
    </figure>
  )
}
