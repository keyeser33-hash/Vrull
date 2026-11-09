import type { WeekSummary } from '@/data/weekly-goals'
import type { I18n } from '@/i18n'
import { programWeekLabel } from '@/i18n/domain'
import { goalCells, summaryTitle, weekRangeText } from '@/routes/week-format'

// Karta e javës për ndarje (V43, SPEC §0.3c, bordi "Karta"): foto PNG 1080 × 1350 me vetëm stërvitjen:
// stërvitjet, setet, rekordet, vargu dhe rekordi më i madh, me shenjën e Vrullit. Kurrë pesha, matjet,
// ushqimi ose uji: `weekCardContent` nuk i lexon fare. Këtu jetojnë teksti dhe vendosja (pa canvas, me
// prova); vizatimi është te `share/render.ts`. Përmasat vijnë nga bordi (320 × 400) × 3,375.

export const CARD = { width: 1080, height: 1350 } as const
/** Bordi është 320 px i gjerë; çdo masë e tij shumëzohet me këtë. */
const S = CARD.width / 320
const PAD = Math.round(20 * S)
const INNER = CARD.width - 2 * PAD

export interface WeekCardContent {
  brand: string
  /** "16–22 nëntor 2026". */
  range: string
  /** "Faza 1 · Java 3"; null pa seancë në javë. */
  label: string | null
  /** "Java e plotë" ose "Java 4 u mbyll". */
  title: string
  /** "4/4", "3+1". */
  big: string
  bigLabel: string
  stats: { value: string; label: string }[]
  /** "Shortcut to Size · Squat e1RM 101,3 kg". */
  footer: string
  /** Fjalia e parapamjes për lexuesin e ekranit. */
  spoken: string
}

/** Vetëm fushat e stërvitjes së përmbledhjes: tipi e mban kartën larg peshës, ushqimit dhe ujit. */
export type WeekCardSummary = Pick<WeekSummary, 'monday' | 'programWeek' | 'streak' | 'spare'> & {
  goals: Pick<WeekSummary['goals'], 'training' | 'complete'>
  training: Pick<WeekSummary['training'], 'workSets' | 'records'>
}

/** Tekstet e kartës, në gjuhën e app-it. */
export function weekCardContent(summary: WeekCardSummary, i18n: Pick<I18n, 't' | 'fmt'>, options: { brand: string; programme: string | null }): WeekCardContent {
  const { t, fmt } = i18n
  const [training] = goalCells(i18n, { training: summary.goals.training, food: null, water: null }, !!summary.spare)
  const { done, target } = summary.goals.training
  const big = training.spare ? training.value : `${done}/${target}`
  const bigLabel = training.spare ? t('week.card.workoutsSpare') : t('week.card.workouts', { count: target })
  const records = summary.training.records
  const top = records.top[0]
  const stats = [
    { value: fmt.number(summary.training.workSets), label: t('week.card.sets', { count: summary.training.workSets }) },
    { value: fmt.number(records.count), label: t('week.card.records', { count: records.count }) },
    { value: fmt.number(summary.streak), label: t('week.card.streak', { count: summary.streak }) },
  ]
  const footer = [options.programme, top ? t('week.card.topRecord', { exercise: top.name, kg: fmt.unit(top.e1rmKg, 'kg', { maxDigits: 1 }) }) : null].filter(Boolean).join(' · ')
  const label = summary.programWeek ? programWeekLabel(t, summary.programWeek) : null
  // Titulli pa matësit e ushqimit dhe ujit: "e plotë" mbetet, sepse thotë vetëm që u arritën qëllimet.
  const title = summaryTitle(i18n, { goals: { ...summary.goals, food: null, water: null }, programWeek: summary.programWeek })
  const range = weekRangeText(i18n, summary.monday, { year: true })
  const spoken = [label, title, `${big} ${bigLabel}`, ...stats.map((stat) => `${stat.value} ${stat.label}`), footer, range, options.brand].filter(Boolean).join(', ')
  return { brand: options.brand, range, label, title, big, bigLabel, stats, footer, spoken }
}

// --- Vendosja ---

export type CardColor = 'background' | 'foreground' | 'muted' | 'ember' | 'border'

export type DrawOp =
  | { kind: 'fill'; x: number; y: number; w: number; h: number; color: CardColor }
  | { kind: 'speed-lines'; x: number; y: number; w: number; h: number }
  | { kind: 'mark'; x: number; y: number; size: number }
  | { kind: 'text'; text: string; x: number; y: number; font: string; color: CardColor; align: 'left' | 'right'; letterSpacing: number }

/** Gjerësia e një teksti me një font canvas-i ("800 189px 'Barlow Condensed'"). */
export type Measure = (text: string, font: string, letterSpacing?: number) => number

export const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"
export const TEXT = "Barlow, system-ui, sans-serif"
export const font = (weight: number, size: number, family: string) => `${weight} ${Math.round(size * 10) / 10}px ${family}`

/** Rreshtat e një teksti brenda `width`, fjalë pas fjale. */
export function wrap(text: string, width: number, fontSpec: string, measure: Measure, letterSpacing = 0): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next, fontSpec, letterSpacing) > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** Teksti i shkurtuar me "…" kur kalon `width`. */
function fit(text: string, width: number, fontSpec: string, measure: Measure): string {
  if (measure(text, fontSpec) <= width) return text
  let cut = text
  while (cut.length > 1 && measure(`${cut}…`, fontSpec) > width) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/**
 * Vendosja e kartës në 1080 × 1350, si bordi: lart shenja, emri dhe data; java e programit dhe titulli
 * (deri në dy rreshta, që zvogëlohet kur s'nxë); poshtë numri i madh i stërvitjeve në prush, vija dhe
 * tri numrat (setet, rekordet, vargu), dhe rreshti i programit me rekordin më të madh.
 */
export function weekCardLayout(content: WeekCardContent, measure: Measure, lang: string): DrawOp[] {
  const upper = (text: string) => text.toLocaleUpperCase(lang)
  const ops: DrawOp[] = [
    { kind: 'fill', x: 0, y: 0, w: CARD.width, h: CARD.height, color: 'background' },
    { kind: 'speed-lines', x: Math.round(180 * S), y: 0, w: CARD.width - Math.round(180 * S), h: CARD.height },
  ]

  // Kreu: shenja 108 px, "VRULL" dhe data djathtas, në mes të shenjës.
  const markSize = Math.round(32 * S)
  const headMid = PAD + markSize / 2
  ops.push({ kind: 'mark', x: PAD, y: PAD, size: markSize })
  const brandFont = font(800, 20 * S, DISPLAY)
  ops.push({ kind: 'text', text: upper(content.brand), x: PAD + markSize + 8 * S, y: headMid + 0.36 * 20 * S, font: brandFont, color: 'foreground', align: 'left', letterSpacing: 0.02 * 20 * S })
  const dateFont = font(400, 12 * S, TEXT)
  ops.push({ kind: 'text', text: content.range, x: CARD.width - PAD, y: headMid + 0.36 * 12 * S, font: dateFont, color: 'muted', align: 'right', letterSpacing: 0 })

  // Java e programit dhe titulli.
  let top = PAD + markSize + 16 * S
  if (content.label) {
    const size = 16 * S
    const labelFont = font(700, size, DISPLAY)
    const spacing = 0.06 * size
    ops.push({ kind: 'text', text: fit(upper(content.label), INNER, labelFont, measure), x: PAD, y: top + 0.86 * size, font: labelFont, color: 'muted', align: 'left', letterSpacing: spacing })
    top += 1.2 * size
  }
  const titleWidth = Math.round(200 * S)
  let titleSize = 56 * S
  let lines = wrap(upper(content.title), titleWidth, font(800, titleSize, DISPLAY), measure)
  while (titleSize > 30 * S && (lines.length > 2 || lines.some((line) => measure(line, font(800, titleSize, DISPLAY)) > INNER))) {
    titleSize *= 0.9
    lines = wrap(upper(content.title), Math.min(INNER, titleWidth * 1.4), font(800, titleSize, DISPLAY), measure)
  }
  const titleFont = font(800, titleSize, DISPLAY)
  // Rreshti i dytë një madhësi poshtë të parit: pikat e Ë-së nuk prekin rreshtin sipër.
  lines.slice(0, 2).forEach((line, index) => {
    ops.push({ kind: 'text', text: line, x: PAD, y: top + 0.74 * titleSize + index * titleSize, font: titleFont, color: 'foreground', align: 'left', letterSpacing: 0 })
  })

  // Poshtë, nga fundi lart: rreshti i programit, tri numrat me vijën sipër, numri i madh.
  const footerSize = 12 * S
  const footerFont = font(400, footerSize, TEXT)
  const footerBaseline = CARD.height - PAD - 0.24 * footerSize
  if (content.footer) ops.push({ kind: 'text', text: fit(content.footer, INNER, footerFont, measure), x: PAD, y: footerBaseline, font: footerFont, color: 'muted', align: 'left', letterSpacing: 0 })
  const statsBottom = CARD.height - PAD - 1.2 * footerSize - 10 * S
  const valueSize = 26 * S
  const statLabelSize = 12 * S
  const statsTop = statsBottom - valueSize - 1.25 * statLabelSize
  const ruleY = statsTop - 12 * S
  ops.push({ kind: 'fill', x: PAD, y: ruleY, w: INNER, h: Math.max(2, Math.round(S)), color: 'border' })
  const gap = 8 * S
  const column = (INNER - 2 * gap) / 3
  content.stats.forEach((stat, index) => {
    const x = PAD + index * (column + gap)
    ops.push({ kind: 'text', text: stat.value, x, y: statsTop + 0.74 * valueSize, font: font(800, valueSize, DISPLAY), color: 'foreground', align: 'left', letterSpacing: 0 })
    const labelFont = font(400, statLabelSize, TEXT)
    ops.push({ kind: 'text', text: fit(stat.label, column, labelFont, measure), x, y: statsBottom - 0.24 * statLabelSize, font: labelFont, color: 'muted', align: 'left', letterSpacing: 0 })
  })

  const bigSize = 108 * S
  const bigFont = font(800, bigSize, DISPLAY)
  const bigBaseline = ruleY - 14 * S - 0.06 * bigSize
  const bigSpacing = -0.02 * bigSize
  ops.push({ kind: 'text', text: content.big, x: PAD, y: bigBaseline, font: bigFont, color: 'ember', align: 'left', letterSpacing: bigSpacing })
  // Emri pas numrit, në një ose dy rreshta që mbarojnë te vija bazë e numrit.
  const labelSize = 16 * S
  const labelFont = font(400, labelSize, TEXT)
  const labelX = PAD + measure(content.big, bigFont, bigSpacing) + gap
  const labelLines = wrap(content.bigLabel, Math.max(CARD.width - PAD - labelX, 120), labelFont, measure)
  labelLines.forEach((line, index) => {
    const fromBottom = labelLines.length - 1 - index
    ops.push({ kind: 'text', text: line, x: labelX, y: bigBaseline - 6 * S * 0.2 - fromBottom * 1.25 * labelSize, font: labelFont, color: 'muted', align: 'left', letterSpacing: 0 })
  })
  return ops
}
