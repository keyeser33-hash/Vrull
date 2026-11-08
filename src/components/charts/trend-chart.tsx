import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Grafiku i një vlere në kohë (SPEC §8; skill-i dataviz; në Vrull me V2-E1-16b): vija 2 px në `data`
// (vjollca e të dhënave dytësore, mbi 3:1 në çdo temë) me shenjën dhe vlerën e fundit, pikat e ditës
// në `muted-foreground`, rrjeti 1 px `border`. `ground` thotë ku rri grafiku: brenda kartës (`surface`)
// ose mbi sfondin e faqes, që unaza e pikave të marrë ngjyrën e asaj që ka poshtë. Numrat dhe datat
// sipas gjuhës (`fmt`), me `tabular-nums`. Prekja ose lëvizja e gishtit tregon datën dhe vlerën; lista
// poshtë grafikut është tabela.

export interface TrendPoint {
  date: string
  value: number
}

const DAY_MS = 86_400_000
const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(Math.max(200, Math.round(element.getBoundingClientRect().width)))
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])
  return { ref, width }
}

/** Tri vija rrjeti me hap të rrumbullakët (0,5, 1, 2, 5...). */
function ticks(min: number, max: number) {
  const span = Math.max(max - min, 1)
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 50].find((candidate) => span / candidate <= 3) ?? 100
  const low = Math.floor(min / step) * step
  const high = Math.ceil(max / step) * step
  const values: number[] = []
  for (let value = low; value <= high + step / 2; value += step) values.push(Math.round(value * 100) / 100)
  return values
}

const GROUND = {
  card: { ring: 'stroke-surface', tip: 'bg-surface-2' },
  page: { ring: 'stroke-background', tip: 'bg-surface' },
} as const

export function TrendChart({
  line,
  points = [],
  ground,
  label,
  format,
  lineLabel,
  pointsLabel,
  height = 168,
}: {
  line: TrendPoint[]
  points?: TrendPoint[]
  ground: 'card' | 'page'
  label: string
  format: (value: number) => string
  lineLabel?: string
  pointsLabel?: string
  height?: number
}) {
  const { fmt } = useI18n()
  const { ref, width } = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const all = [...line, ...points]
  if (line.length === 0) return null
  const left = 36
  const right = 12
  const top = 12
  const bottom = 22
  const days = all.map((point) => dayOf(point.date))
  const firstDay = Math.min(...days)
  const lastDay = Math.max(...days)
  const values = all.map((point) => point.value)
  const grid = ticks(Math.min(...values), Math.max(...values))
  const low = grid[0]
  const high = grid.at(-1)!
  const x = (date: string) => (lastDay === firstDay ? (left + width - right) / 2 : left + ((dayOf(date) - firstDay) / (lastDay - firstDay)) * (width - left - right))
  const y = (value: number) => top + (1 - (value - low) / (high - low || 1)) * (height - top - bottom)
  const path = line.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const last = line.at(-1)!
  const shown = active === null ? null : line[active]
  const tones = GROUND[ground]
  const dateText = (date: string) => fmt.date(new Date(`${date}T12:00:00`), { weekday: false })
  // Etiketa e prekjes rri anash pikës, nga ana ku ka vend, që të mos dalë jashtë grafikut.
  const anchor = x((shown ?? last).date)
  const tipPosition = anchor < width / 2 ? { left: Math.max(0, anchor - 24) } : { right: Math.max(0, width - anchor - 24) }

  function pick(clientX: number, target: SVGElement) {
    const box = target.getBoundingClientRect()
    const position = clientX - box.left
    let best = 0
    line.forEach((point, index) => {
      if (Math.abs(x(point.date) - position) < Math.abs(x(line[best].date) - position)) best = index
    })
    setActive(best)
  }

  return (
    <figure className="flex flex-col gap-1.5">
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={label} className="block touch-pan-y">
          {grid.map((value) => (
            <g key={value}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} strokeWidth={1} className="stroke-border" />
              <text x={left - 6} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {fmt.number(value)}
              </text>
            </g>
          ))}
          <text x={left} y={height - 6} className="fill-muted-foreground text-[11px] tabular-nums">
            {dateText(all.reduce((first, point) => (point.date < first ? point.date : first), all[0].date))}
          </text>
          <text x={width - right} y={height - 6} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
            {dateText(last.date)}
          </text>
          {points.map((point) => (
            <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={3} strokeWidth={2} className={cn('fill-muted-foreground', tones.ring)} />
          ))}
          <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-data" />
          {shown ? <line x1={x(shown.date)} x2={x(shown.date)} y1={top} y2={height - bottom} strokeWidth={1} className="stroke-muted-foreground" /> : null}
          <circle cx={x((shown ?? last).date)} cy={y((shown ?? last).value)} r={4.5} strokeWidth={2} className={cn('fill-data', tones.ring)} />
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={(event) => pick(event.clientX, event.currentTarget)}
            onPointerMove={(event) => (event.buttons > 0 || event.pointerType === 'mouse' ? pick(event.clientX, event.currentTarget) : undefined)}
            onPointerLeave={(event) => (event.pointerType === 'mouse' ? setActive(null) : undefined)}
          />
        </svg>
        <div
          aria-live="polite"
          className={cn('pointer-events-none absolute top-0 rounded-sm px-2 py-1 text-xs leading-4 font-medium whitespace-nowrap text-foreground tabular-nums', tones.tip)}
          style={{ ...tipPosition, visibility: shown ? 'visible' : 'hidden' }}
        >
          {shown ? `${dateText(shown.date)} · ${format(shown.value)}` : ''}
        </div>
      </div>
      {lineLabel && pointsLabel && points.length > 0 ? (
        <figcaption className="flex gap-4 text-xs leading-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-data" />
            {lineLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-muted-foreground" />
            {pointsLabel}
          </span>
        </figcaption>
      ) : null}
    </figure>
  )
}
