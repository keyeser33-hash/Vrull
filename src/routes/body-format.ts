import type { Tone } from '@/body/model-math'
import { targetText } from '@/body/body-map'
import type { RecoveryStatus } from '@/program/recovery'
import type { BodyGroup } from '@/data/body'
import { decimal } from './training-format'

// Tekstet dhe ngjyrat e Trupit (SPEC §11). Figura 2D përdor klasat `fill-…`; modeli 3D të njëjtin
// token me të njëjtin opacitet (`tone`), që të dy pamjet të lexohen njësoj me legjendën.

export const RECOVERY: Record<RecoveryStatus, { label: string; range: string; fill: string; swatch: string; tone: Tone }> = {
  i_lodhur: { label: 'I lodhur', range: 'nën 48 orë', fill: 'fill-brand', swatch: 'bg-brand', tone: { token: '--brand', alpha: 1 } },
  pothuajse_gati: { label: 'Pothuajse gati', range: '48–72 orë', fill: 'fill-brand/45', swatch: 'bg-brand/45', tone: { token: '--brand', alpha: 0.45 } },
  // "Gati" mbetet i qetë, që të dallohen muskujt që duan pushim.
  gati: {
    label: 'Gati',
    range: 'mbi 72 orë',
    fill: 'fill-panel-muted-foreground/35',
    swatch: 'bg-panel-muted-foreground/35',
    tone: { token: '--panel-muted-foreground', alpha: 0.35 },
  },
}

export const RECOVERY_ORDER: RecoveryStatus[] = ['i_lodhur', 'pothuajse_gati', 'gati']

export const LEVEL_FILL = [null, 'fill-brand/30', 'fill-brand/60', 'fill-brand'] as const
export const LEVEL_SWATCH = ['bg-panel-border', 'bg-brand/30', 'bg-brand/60', 'bg-brand'] as const
export const LEVEL_TONE: (Tone | null)[] = [null, { token: '--brand', alpha: 0.3 }, { token: '--brand', alpha: 0.6 }, { token: '--brand', alpha: 1 }]

/** Setet e javës: 0,5 sete, 1 set, 12 sete; zero është "Pa sete". */
export const setsText = (load: number) => (load === 0 ? 'Pa sete' : load === 1 ? '1 set' : `${decimal(load)} sete`)

export const sinceText = (hours: number | null) => {
  if (hours === null) return 'Pa stërvitje të regjistruar'
  if (hours < 24) return `Stërvitja e fundit para ${Math.max(1, hours)} orësh`
  const days = Math.round(hours / 24)
  return `Stërvitja e fundit para ${days === 1 ? '1 dite' : `${days} ditësh`}`
}

export type BodyMode = 'rikuperimi' | 'volumi'

type ModeEntry = Pick<BodyGroup, 'recovery' | 'level' | 'load' | 'hours'>

/**
 * Si shfaqet një grup në pamjen e zgjedhur: klasa e figurës 2D, toni i modelit 3D, vlera me fjalë
 * (figura, modeli) dhe rreshti i listës (`value` me `detail`).
 */
export function modeStyle(mode: BodyMode, entry: ModeEntry) {
  if (mode === 'volumi') {
    const detail = targetText(entry.load)
    const text = entry.level === 0 ? setsText(0) : `${setsText(entry.load)} · ${detail.toLowerCase()}`
    return { fill: LEVEL_FILL[entry.level], tone: LEVEL_TONE[entry.level], text, value: setsText(entry.load), detail }
  }
  const style = RECOVERY[entry.recovery]
  return { fill: style.fill, tone: style.tone, text: style.label, value: style.label, detail: sinceText(entry.hours) }
}

/**
 * Teksti i çipit kur prekët një muskul në modelin 3D. Te volumi, një grup me disa pjesë tregon sa
 * sete mori pjesa e prekur nga totali i grupit (objektivi është për grupin, te lista). Kur grupi ka
 * edhe sete nga biblioteka, që nuk ndahen sipas pjesëve, çipi tregon vlerën e grupit.
 */
export function focusDetail(mode: BodyMode, entry: ModeEntry & Pick<BodyGroup, 'parts' | 'unsplit'>, key: string, name: string) {
  const part = entry.parts.find((item) => item.key === key)
  const split = mode === 'volumi' && entry.load > 0 && entry.unsplit === 0 && entry.parts.length > 1
  if (split && part) return `${name} · ${decimal(part.load)} nga ${setsText(entry.load)}`
  return `${name} · ${modeStyle(mode, entry).text}`
}
