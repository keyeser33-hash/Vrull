import type { DayMode } from '@/readiness/readiness'

// Pamja e ditës (V20, V50, V2-E3-07; DESIGN.md › Gjendja e ditës): korniza e vendos te `<html>` si
// `data-day="tired" | "energetic"`; `normal` nuk lë asgjë. `globals.css` ia jep rërën tokenave të prushit në
// `tired`, dhe faqet e historikut i rikthejnë (`data-day-keep`). Lëvizjet dhe festimet pyesin `isTiredDay()`.

export const DAY_ATTRIBUTE = 'data-day'
/** Shenja e nënpemës që mban prushin edhe në ditë të lodhur (historiku). */
export const KEEP_EMBER_ATTRIBUTE = 'data-day-keep'

/** Lëvizjet e ditës së lodhur: 360 ms, ease-out, pa kërcim (DESIGN.md › Lëvizja). */
export const TIRED_MOTION = { ms: 360, easing: 'ease-out' } as const

/** Faqet e historikut (Progresi › Historiku) nuk ndërrojnë ngjyrë me pamjen e ditës. */
export function keepsEmber(pathname: string): boolean {
  return pathname === '/progresi/historiku' || pathname.startsWith('/progresi/historiku/')
}

export function setDayAttribute(mode: DayMode, root: HTMLElement = document.documentElement): void {
  if (mode === 'normal') root.removeAttribute(DAY_ATTRIBUTE)
  else root.setAttribute(DAY_ATTRIBUTE, mode)
}

export function isTiredDay(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute(DAY_ATTRIBUTE) === 'tired'
}
