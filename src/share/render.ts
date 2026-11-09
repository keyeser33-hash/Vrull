import { VRULL_MARK } from '@/components/ui/vrull-mark'
import { CARD, type CardColor, DISPLAY, type DrawOp, font, type Measure, TEXT, type WeekCardContent, weekCardLayout } from './week-card'

// Vizatimi i kartës së javës me Canvas 2D (V43, SPEC §0.3c): fontet e paketuara (Barlow, Barlow
// Condensed), ngjyrat e temës OLED nga tokenat e globals.css (lexohen nga një element me
// data-theme="oled", pa hex këtu) dhe shenja e Vrullit nga `logo.tsx`. Karta del gjithnjë e errët, si
// bordi, cilado qoftë tema e app-it.

type Palette = Record<CardColor | 'onEmber', string>

const TOKENS: Record<keyof Palette, string> = {
  background: '--background',
  foreground: '--foreground',
  muted: '--muted-foreground',
  ember: '--ember',
  border: '--border',
  onEmber: '--on-ember',
}

/** Ngjyrat e temës OLED; null kur CSS-i nuk është ngarkuar (p.sh. provat). */
function oledPalette(): Palette | null {
  const probe = document.createElement('div')
  probe.dataset.theme = 'oled'
  probe.hidden = true
  document.body.append(probe)
  try {
    const style = getComputedStyle(probe)
    const palette = Object.fromEntries(Object.entries(TOKENS).map(([key, token]) => [key, style.getPropertyValue(token).trim()])) as Palette
    return Object.values(palette).every(Boolean) ? palette : null
  } finally {
    probe.remove()
  }
}

/** Fontet e kartës, që canvas-i të mos vizatojë me fontin rezervë. */
async function loadFonts() {
  const fonts = document.fonts
  if (!fonts) return
  const specs = [font(800, 100, DISPLAY), font(700, 100, DISPLAY), font(400, 100, TEXT)]
  await Promise.all(specs.map((spec) => fonts.load(spec, 'ËÇëç0123456789').catch(() => [])))
}

type SpacedContext = CanvasRenderingContext2D & { letterSpacing?: string }

function measurer(ctx: SpacedContext): Measure {
  return (text, spec, spacing = 0) => {
    ctx.font = spec
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    return ctx.measureText(text).width + spacing * Math.max(Array.from(text).length - 1, 0)
  }
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, op: Extract<DrawOp, { kind: 'speed-lines' }>, color: string) {
  // Si sfondi "Vija shpejtësie": vija prushi 115°, 16%, çdo 14 px të bordit (× 3,375).
  const period = 14 * (CARD.width / 320)
  const stroke = 2 * (CARD.width / 320)
  const radius = Math.hypot(op.w, op.h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(op.x, op.y, op.w, op.h)
  ctx.clip()
  ctx.translate(op.x + op.w / 2, op.y + op.h / 2)
  ctx.rotate((115 * Math.PI) / 180)
  ctx.globalAlpha = 0.16
  ctx.fillStyle = color
  for (let offset = -radius; offset < radius; offset += period) ctx.fillRect(-radius, offset, 2 * radius, stroke)
  ctx.restore()
}

function drawMark(ctx: CanvasRenderingContext2D, op: Extract<DrawOp, { kind: 'mark' }>, palette: Palette) {
  const scale = op.size / VRULL_MARK.size
  ctx.save()
  ctx.translate(op.x, op.y)
  ctx.scale(scale, scale)
  ctx.fillStyle = palette.ember
  ctx.beginPath()
  ctx.roundRect(0, 0, VRULL_MARK.size, VRULL_MARK.size, VRULL_MARK.radius)
  ctx.fill()
  ctx.strokeStyle = palette.onEmber
  ctx.lineWidth = VRULL_MARK.stroke
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(new Path2D(VRULL_MARK.path))
  ctx.restore()
}

/** Karta si canvas 1080 × 1350; null kur shfletuesi nuk vizaton (pa canvas ose pa CSS). */
export async function renderWeekCard(content: WeekCardContent, lang: string): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD.width
  canvas.height = CARD.height
  let ctx: SpacedContext | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  const palette = oledPalette()
  if (!ctx || !palette) return null
  await loadFonts()
  const ops = weekCardLayout(content, measurer(ctx), lang)
  for (const op of ops) {
    if (op.kind === 'fill') {
      ctx.fillStyle = palette[op.color]
      ctx.fillRect(op.x, op.y, op.w, op.h)
    } else if (op.kind === 'speed-lines') drawSpeedLines(ctx, op, palette.ember)
    else if (op.kind === 'mark') drawMark(ctx, op, palette)
    else {
      ctx.font = op.font
      ctx.fillStyle = palette[op.color]
      ctx.textAlign = op.align
      ctx.textBaseline = 'alphabetic'
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${op.letterSpacing}px`
      ctx.fillText(op.text, op.x, op.y)
    }
  }
  return canvas
}

/** PNG si base64 (pa "data:image/png;base64,"), për ndarjen dhe galerinë. */
export function pngBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1] ?? ''
}
