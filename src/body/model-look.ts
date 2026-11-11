import type { Rgb } from './model-math'

// Drita dhe shkëlqimi i modelit 3D (SPEC §11, V53; bordet "Trupi 3D · drita dhe kamera"). Vlerat janë
// ato të konceptit të miratuar; skena (components/body/body-scene.ts) vetëm i zbaton. Gjithçka me
// teknika të lehta për telefonin: pa post-procesim dhe pa hije të llogaritura.

export interface ModelLook {
  /** Tema e çelët (Ditë): karta `surface` është e ndritshme. */
  light: boolean
  /** Drita e përgjithshme, drita kryesore nga përpara dhe dritat e konturit nga pas. */
  hemisphere: number
  key: number
  rim: number
  roughness: number
  /** Sa ndriçon nga brenda një muskul me shkëlqim të plotë. */
  emissive: number
  /** Kontura e ndritshme te skajet: e muskujve me shkëlqim (me ngjyrën e tyre) dhe e të tjerëve (e bardhë). */
  fresnel: number
  fresnelBase: number
  /** Aureola rreth siluetës së muskujve me shkëlqim: fortësia, gjerësia dhe sa shtyhet pas tyre (m, te trupi i plotë). */
  aura: number
  auraWidth: number
  auraPush: number
  /** Lëkura si xham: sa duket silueta te skajet. */
  skin: number
  /** Dyshemeja: pellg drite në temat e errëta, hije në Ditë. */
  ground: number
}

const DARK: ModelLook = {
  light: false,
  hemisphere: 0.85,
  key: 2.1,
  rim: 2.6,
  roughness: 0.5,
  emissive: 0.36,
  fresnel: 0.95,
  fresnelBase: 0.1,
  aura: 0.9,
  auraWidth: 0.028,
  auraPush: 0.035,
  skin: 0.55,
  ground: 0.13,
}

// Ditë: mbi kartën e bardhë drita e shtuar nuk duket dhe e zbardh trupin. Kontura vjen nga hijet,
// aureola është ngjyrë e tejdukshme (jo dritë e shtuar) dhe dyshemeja është hije.
const LIGHT: ModelLook = { ...DARK, light: true, hemisphere: 1.25, key: 1.9, rim: 0.5, emissive: 0.1, fresnel: 0, fresnelBase: 0, aura: 0.34, auraWidth: 0.024, skin: 0.4, ground: 0.2 }

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Pamja e modelit sipas kartës ku rri (`surface` e temës): e errët ose Ditë. */
export function lookOf(surface: Rgb): ModelLook {
  return luminance(surface) > 0.5 ? LIGHT : DARK
}

/** Nga cili shkëlqim e sipër muskuli merr aureolë: "Nën 10" (0,12) jo, "Pothuajse gati" (0,4) po. */
export const AURA_FROM = 0.2

/** Shkëlqimi i një muskuli gjatë fokusit: vetëm i zgjedhuri ndriçon. `focused` null: pa fokus. */
export function focusGlow(glow: number | undefined, focused: boolean | null) {
  return focused === false ? 0 : (glow ?? 0)
}

/** Sa ndriçohet drejt së bardhës muskuli në fokus: një muskul që ndriçon vetë nuk zbardhet. */
export function focusLift(glow: number) {
  return 0.35 * (1 - Math.min(1, Math.max(0, glow)))
}
