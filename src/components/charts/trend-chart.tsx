import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

// Grafiku i një vlere në kohë (SPEC §8; skill-i dataviz): vija 2 px me shenjën dhe vlerën e
// fundit, pikat e ditës të zbehta, rrjeti i qetë. Në panel (i errët në çdo temë) vija është
// --chart-1; mbi kartë merr ngjyrën e tekstit, që kontrasti të mbetet mbi 3:1 edhe në temën e
// çelët. Prekja ose lëvizja e gishtit tregon datën dhe vlerën; lista poshtë grafikut është tabela.

export interface TrendPoint {
  date: string
  value: number
}

const DAY_MS = 86_400_000
const dayOf = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS
const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

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

export function TrendChart({
  line,
  points = [],
  tone,
  label,
  format,
  lineLabel,
  pointsLabel,
  height = 168,
}: {
  line: TrendPoint[]
  points?: TrendPoint[]
  tone: 'panel' | 'card'
  label: string
  format: (value: number) => string
  lineLabel?: string
  pointsLabel?: string
  height?: number
}) {
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
  const panel = tone === 'panel'
  const shown = active === null ? null : line[active]

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
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} strokeWidth={1} className={panel ? 'stroke-panel-border' : 'stroke-border-subtle'} />
              <text x={left - 6} y={y(value) + 4} textAnchor="end" className={cn('text-[11px] tabular-nums', panel ? 'fill-panel-muted-foreground' : 'fill-muted-foreground')}>
                {String(value).replace('.', ',')}
              </text>
            </g>
          ))}
          <text x={left} y={height - 6} className={cn('text-[11px] tabular-nums', panel ? 'fill-panel-muted-foreground' : 'fill-muted-foreground')}>
            {shortDate(all.reduce((first, point) => (point.date < first ? point.date : first), all[0].date))}
          </text>
          <text x={width - right} y={height - 6} textAnchor="end" className={cn('text-[11px] tabular-nums', panel ? 'fill-panel-muted-foreground' : 'fill-muted-foreground')}>
            {shortDate(last.date)}
          </text>
          {points.map((point) => (
            <circle
              key={point.date}
              cx={x(point.date)}
              cy={y(point.value)}
              r={3}
              strokeWidth={2}
              className={panel ? 'fill-panel-muted-foreground stroke-panel' : 'fill-muted-foreground stroke-card'}
            />
          ))}
          <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={panel ? 'stroke-chart-1' : 'stroke-foreground'} />
          {shown ? <line x1={x(shown.date)} x2={x(shown.date)} y1={top} y2={height - bottom} strokeWidth={1} className={panel ? 'stroke-panel-muted-foreground' : 'stroke-muted-foreground'} /> : null}
          <circle cx={x((shown ?? last).date)} cy={y((shown ?? last).value)} r={4.5} strokeWidth={2} className={panel ? 'fill-chart-1 stroke-panel' : 'fill-foreground stroke-card'} />
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
          className={cn(
            'pointer-events-none absolute top-0 rounded-md px-2 py-1 text-xs leading-4 font-medium whitespace-nowrap tabular-nums',
            panel ? 'bg-panel-button text-panel-foreground' : 'bg-popover text-popover-foreground shadow-sm',
          )}
          style={{ left: Math.min(Math.max(x((shown ?? last).date) - 48, 0), width - 108), visibility: shown ? 'visible' : 'hidden' }}
        >
          {shown ? `${shortDate(shown.date)} · ${format(shown.value)}` : ''}
        </div>
      </div>
      {lineLabel && pointsLabel && points.length > 0 ? (
        <figcaption className={cn('flex gap-4 text-xs leading-4', panel ? 'text-panel-muted-foreground' : 'text-muted-foreground')}>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className={cn('h-0.5 w-4 rounded-full', panel ? 'bg-chart-1' : 'bg-foreground')} />
            {lineLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-2 rounded-full', panel ? 'bg-panel-muted-foreground' : 'bg-muted-foreground')} />
            {pointsLabel}
          </span>
        </figcaption>
      ) : null}
    </figure>
  )
}
