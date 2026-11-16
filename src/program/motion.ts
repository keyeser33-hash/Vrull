// Lëvizja e ushtrimit si logjikë (SPEC §0.3g): dy fotot, fillimi (0) dhe fundi (1), ndërrohen sipas
// tempos. Faza e parë (poshtë, ekscentrike) shkon nga fillimi te fundi, e dyta (lart, koncentrike)
// kthehet; mes tyre mbetet një mbajtje e shkurtër, si te bordi "Lëvizja e ushtrimit". Pa UI dhe pa orë:
// koha vjen nga ai që e thërret, që provat ta fiksojnë.

export interface Tempo {
  /** Sekondat e fazës "poshtë" (ekscentrike): nga foto e fillimit te e fundit. */
  downS: number
  /** Sekondat e fazës "lart" (koncentrike): kthimi te fillimi. */
  upS: number
}

/** Tempo kur ushtrimi s'ka udhëzues ose mbahet pa lëvizje (V63, vendimi A). */
export const DEFAULT_TEMPO: Tempo = { downS: 2, upS: 1 }
export const HOLD_MS = 300

/** Tempo e udhëzuesit (`null` për mbajtjet) si tempo e lëvizjes; parazgjedhja 2 dhe 1. */
export function tempoOf(guide: { eccentricS: number; concentricS: number } | null | undefined): Tempo {
  return guide ? { downS: guide.eccentricS, upS: guide.concentricS } : DEFAULT_TEMPO
}

/** Sekondat për tekstin e tempos; null kur udhëzuesi nuk ka tempo (mbajtje). */
export function tempoParts(guide: { eccentricS: number; concentricS: number } | null | undefined): { down: number; up: number } | null {
  return guide ? { down: guide.eccentricS, up: guide.concentricS } : null
}

export const cycleMs = (tempo: Tempo) => (tempo.downS + tempo.upS) * 1000 + 2 * HOLD_MS

const ease = (u: number) => (1 - Math.cos(Math.PI * u)) / 2

/** Pozicioni 0–1 (0 foto e fillimit, 1 e fundit) pas `elapsedMs` nga fillimi i ciklit. */
export function motionPosition(elapsedMs: number, tempo: Tempo): number {
  const cycle = cycleMs(tempo)
  const at = ((elapsedMs % cycle) + cycle) % cycle
  const down = tempo.downS * 1000
  const up = tempo.upS * 1000
  if (at < down) return ease(at / down)
  if (at < down + HOLD_MS) return 1
  if (at < down + HOLD_MS + up) return 1 - ease((at - down - HOLD_MS) / up)
  return 0
}

/** Koha në fazën e parë ku foto është te `position`: që lëvizja të vazhdojë nga aty pas rrëshqitjes. */
export function timeForPosition(position: number, tempo: Tempo): number {
  const p = Math.min(1, Math.max(0, position))
  return (Math.acos(1 - 2 * p) / Math.PI) * tempo.downS * 1000
}
