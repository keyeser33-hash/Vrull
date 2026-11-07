import type { Tone } from '@/body/model-math'
import type { RecoveryStatus } from '@/program/recovery'
import { kg } from './training-format'

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

export const setsText = (load: number) => (load === 1 ? '1 set' : `${kg(load)} sete`)

export const sinceText = (hours: number | null) => {
  if (hours === null) return 'Pa stërvitje të regjistruar'
  if (hours < 24) return `Stërvitja e fundit para ${Math.max(1, hours)} orësh`
  const days = Math.round(hours / 24)
  return `Stërvitja e fundit para ${days === 1 ? '1 dite' : `${days} ditësh`}`
}

export type BodyMode = 'rikuperimi' | 'volumi'

/** Si shfaqet një grup në pamjen e zgjedhur: klasa e figurës 2D, toni i modelit 3D dhe vlera me fjalë. */
export function modeStyle(mode: BodyMode, entry: { recovery: RecoveryStatus; level: 0 | 1 | 2 | 3; load: number }) {
  if (mode === 'volumi') return { fill: LEVEL_FILL[entry.level], tone: LEVEL_TONE[entry.level], text: setsText(entry.load) }
  const style = RECOVERY[entry.recovery]
  return { fill: style.fill, tone: style.tone, text: style.label }
}
