import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { baselineKind, SHAPE_MEASURES, type ShapeChange, type ShapeComparison, type ShapeScales } from '@/body/body-shape'
import type { Tone } from '@/body/model-math'
import type { Still } from '@/components/body/body-still'
import { BackHeader } from '@/components/layout/page'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { shapeView } from '@/data/body'
import type { I18n } from '@/i18n'
import { programBlockName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import { oneDecimal, signedDecimal } from './body-format'

// Trupi sipas matjeve (V12, V2-E1-14; bordi "Trupi sipas matjeve"). Dy pamje të modelit 3D, Java 0
// dhe sot, ku muskujt e çdo zone ndjekin raportin e perimetrit (body/body-shape.ts); në mes, ndryshimi
// në cm me vijat te zona. Poshtë, perimetrat nga baza te matja e fundit dhe "Shto matjen e sotme".
// Pamjet renderohen një herë si imazhe (body-still.ts), pa një kontekst WebGL për secilën.

const IMAGE = { width: 118, height: 300 }
/** Muskujt gri, që pamjet të lexohen si formë, pa ngjyrat e volumit ose të rikuperimit. */
const NEUTRAL: Tone = { token: '--muted-foreground', alpha: 0.45 }
const LABEL_GAP = 24

type MeasureKey = Extract<Parameters<I18n['t']>[0], `bodyModel.measure.${string}`>
const measureName = ({ t }: I18n, id: string) => t(`bodyModel.measure.${id}` as MeasureKey)
const dayText = ({ fmt }: I18n, date: string) => fmt.date(new Date(`${date}T12:00:00`), { weekday: false })

export function BodyShapePage() {
  const i18n = useI18n()
  const { t } = i18n
  const view = useLocalQuery(() => shapeView(store), [])
  const [three] = useState(webglAvailable)
  const header = (
    <div className="flex flex-col">
      <BackHeader title={t('bodyModel.shape.title')} back={t('bodyModel.layers.back')} fallback="/progresi/trupi" />
      <p className="type-caption text-muted-foreground">{t('bodyModel.shape.intro')}</p>
    </div>
  )
  const add = (
    <Link to="/progresi/matja" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full')}>
      {t('bodyModel.shape.add')}
    </Link>
  )
  if (!view) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <div aria-hidden className="h-[360px] rounded-xl bg-surface" />
      </div>
    )
  }
  const { comparison } = view
  if (!comparison) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <p className={cn(surfaceClass, 'rounded-xl p-4 type-body-l')}>{t('bodyModel.shape.empty')}</p>
        {add}
      </div>
    )
  }
  const label = baselineKind(comparison.from, view.start) === 'start' && view.startLabel ? programBlockName(t, view.startLabel) : t('bodyModel.shape.first')
  const from = dayText(i18n, comparison.from)
  const to = dayText(i18n, comparison.to)

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      <section aria-label={t('bodyModel.shape.compare', { from: label })} className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-xl p-3')}>
        <div aria-hidden className="grid grid-cols-[minmax(0,118px)_minmax(0,1fr)_minmax(0,118px)] items-center text-center">
          <span className="font-display text-xl font-bold text-muted-foreground uppercase">{label}</span>
          <span className="text-xs text-muted-foreground">{t('bodyModel.shape.change')}</span>
          <span className="font-display text-xl font-extrabold uppercase">{t('bodyModel.shape.today')}</span>
        </div>
        {three ? <ShapeStage comparison={comparison} scales={view.scales} fromAlt={t('bodyModel.shape.fromAlt', { label, date: from })} /> : null}
        <p className="text-center type-caption text-muted-foreground">{t('bodyModel.shape.note', { label, from, to })}</p>
      </section>

      <section aria-labelledby="shape-list" className="flex flex-col">
        <h2 id="shape-list" className="mb-0.5 type-label text-muted-foreground">
          {t('bodyModel.shape.list', { from, to })}
        </h2>
        <ul className="flex flex-col">
          {comparison.changes.map((change) => (
            <li key={change.id}>
              <Link
                to={`/progresi/${change.keys[0]}`}
                className="flex min-h-[50px] items-center justify-between gap-2.5 border-b border-border py-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="type-body-strong">{measureName(i18n, change.id)}</span>
                  <span className="type-caption text-muted-foreground tabular-nums">
                    {t('bodyModel.shape.values', { from: oneDecimal(i18n, change.from.value), to: i18n.fmt.unit(change.to.value, 'cm', { minDigits: 1, maxDigits: 1 }) })}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-display text-[22px] font-bold text-data tabular-nums">{`${signedDecimal(i18n, change.delta)} cm`}</span>
                  <Icon name="hap" size={18} className="text-muted-foreground" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {add}
    </div>
  )
}

/**
 * Dy pamjet me etiketat në mes. Pikat e zonave vijnë nga vetë renderimi (body-still.ts), ndaj vijat
 * bien te muskujt edhe kur forma ndryshon; etiketat afër njëra-tjetrës shtyhen poshtë.
 */
function ShapeStage({ comparison, scales, fromAlt }: { comparison: ShapeComparison; scales: ShapeScales; fromAlt: string }) {
  const i18n = useI18n()
  const { t } = i18n
  const stage = useRef<HTMLDivElement>(null)
  const [stills, setStills] = useState<Still[] | null>(null)
  const [width, setWidth] = useState(332)
  const scaleKey = JSON.stringify(scales)

  useEffect(() => {
    const element = stage.current
    if (!element) return
    setWidth(element.clientWidth || 332)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWidth(element.clientWidth || 332))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = stage.current
    if (!element) return
    let cancelled = false
    let made: Still[] = []
    const shape = JSON.parse(scaleKey) as ShapeScales
    void import('@/components/body/body-still')
      .then(({ renderBodyStills }) => renderBodyStills(element, [{ paint: () => NEUTRAL }, { paint: () => NEUTRAL, shape }], IMAGE))
      .then((result) => {
        made = result
        if (cancelled) result.forEach((still) => URL.revokeObjectURL(still.url))
        else setStills(result)
      })
      // Pa model (p.sh. WebView-i pa kontekst WebGL): mbeten numrat dhe lista.
      .catch(() => {})
    return () => {
      cancelled = true
      made.forEach((still) => URL.revokeObjectURL(still.url))
    }
  }, [scaleKey])

  const rightX = width - IMAGE.width
  const labels = stills ? placeLabels(comparison.changes, stills, rightX) : []

  return (
    <div ref={stage} className="relative h-[300px] w-full">
      {stills ? (
        <>
          <img src={stills[0].url} alt={fromAlt} width={IMAGE.width} height={IMAGE.height} className="absolute top-0 left-0 opacity-60" />
          <img src={stills[1].url} alt={t('bodyModel.shape.todayAlt')} width={IMAGE.width} height={IMAGE.height} className="absolute top-0 right-0" />
          <svg aria-hidden width={width} height={IMAGE.height} className="absolute inset-0 text-muted-foreground">
            {labels.map((item) => (
              <g key={item.change.id}>
                <path
                  d={`M${item.left[0]} ${item.left[1]}L${IMAGE.width} ${item.y}M${rightX} ${item.y}L${item.right[0]} ${item.right[1]}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={item.left[0]} cy={item.left[1]} r={3} className="fill-foreground" />
                <circle cx={item.right[0]} cy={item.right[1]} r={3} className="fill-foreground" />
              </g>
            ))}
          </svg>
          {labels.map((item) => (
            <span
              key={item.change.id}
              aria-hidden
              className="absolute flex h-[22px] items-center justify-center gap-1"
              style={{ left: IMAGE.width, right: IMAGE.width, top: item.y - 11 }}
            >
              <span className="truncate text-[13px] text-muted-foreground">{measureName(i18n, item.change.id)}</span>
              <span className="font-display text-[17px] font-bold text-data tabular-nums">{signedDecimal(i18n, item.change.delta)}</span>
            </span>
          ))}
        </>
      ) : null}
    </div>
  )
}

/** Pikat e çdo zone te të dy pamjet (ana nga mesi) dhe lartësia e etiketës, pa mbivendosje. */
function placeLabels(changes: ShapeChange[], stills: Still[], rightX: number) {
  const items = changes.flatMap((change) => {
    const anchor = SHAPE_MEASURES.find((measure) => measure.id === change.id)!.anchor
    const left = stills[0].points[change.id]
    const right = stills[1].points[change.id]
    if (!left || !right) return []
    // Te pamja majtas, ana më afër mesit është ajo djathtas; te pamja djathtas, ajo majtas.
    const a = anchor === 'mid' ? left.mid : (left.sides.at(-1) ?? left.mid)
    const b = anchor === 'mid' ? right.mid : (right.sides[0] ?? right.mid)
    return [{ change, left: a, right: [b[0] + rightX, b[1]] as [number, number], y: (a[1] + b[1]) / 2 }]
  })
  items.sort((a, b) => a.y - b.y)
  for (let index = 0; index < items.length; index++) {
    const previous = items[index - 1]
    items[index].y = Math.min(Math.max(items[index].y, previous ? previous.y + LABEL_GAP : 11), IMAGE.height - 11)
  }
  return items
}
