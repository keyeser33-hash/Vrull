// Logjika pa UI e modelit 3D të trupit (SPEC §11): ngjyrat nga tokenat dhe rrotullimi.

export type Rgb = [number, number, number]

/** Ngjyra e një muskuli: token-i i temës dhe sa mbulon ai sfondin e panelit (0–1), si klasa `fill-…/NN` e figurës 2D. */
export interface Tone {
  token: string
  alpha: number
  /** Sa ndriçon muskuli te modeli 3D (0–1, V53): drita nga brenda, kontura dhe aureola. Pa të, asgjë. */
  glow?: number
}

/** Vlera hex e një tokeni (6 ose 3 shifra) → sRGB 0–1; çdo formë tjetër → null. */
export function hexToRgb(value: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1]
  return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16) / 255) as Rgb
}

/** Ngjyra me opacitet mbi panel, e përzier në sRGB si në CSS, që modeli të përputhet me figurën dhe legjendën. */
export function blendOver(panel: Rgb, color: Rgb, alpha: number): Rgb {
  return panel.map((value, index) => value + (color[index] - value) * alpha) as Rgb
}

/** Këndi `angle` (0 përpara, π mbrapa) më i afërt me `current`, që kthimi të mos zhbëjë rrotullimet me gisht. */
export function nearestAngle(angle: number, current: number) {
  return angle + Math.round((current - angle) / (2 * Math.PI)) * 2 * Math.PI
}

/**
 * Ngjyra përfundimtare e një muskuli: toni mbi panel, pastaj ndriçimi drejt tekstit të panelit
 * (muskuli i fokusuar) ose zbehja drejt panelit (të tjerët gjatë fokusit).
 */
export function shadeRgb(palette: { panel: Rgb; color: Rgb; foreground: Rgb }, alpha: number, shade: { dim: number; lift: number }): Rgb {
  const toned = blendOver(palette.panel, palette.color, alpha)
  return blendOver(blendOver(toned, palette.foreground, shade.lift), palette.panel, shade.dim)
}
