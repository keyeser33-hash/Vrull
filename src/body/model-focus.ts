import { BACK, FRONT } from './figure-regions'

// Fokusi i modelit 3D (SPEC §11): nga cila anë shihen muskujt e zgjedhur, si theksohen, dhe ku
// shkon kamera. Koordinatat në metra, Y lart, Z përpara; kamera shikon nga +Z.

/** Largësia e kamerës kur shihet i gjithë trupi, dhe sa afër lejohet zmadhimi. */
export const MAX_DISTANCE = 3.75
export const MIN_DISTANCE = 1.1
/** Lartësia e qendrës së trupit, ku shikon kamera pa fokus. */
export const BODY_CENTER = 0.86
/** Fusha vertikale e kamerës, në gradë. */
export const FIELD_OF_VIEW_DEGREES = 28
const FIELD_OF_VIEW = (FIELD_OF_VIEW_DEGREES * Math.PI) / 180

const FRONT_KEYS = new Set(FRONT.flatMap((region) => region.keys))
const BACK_KEYS = new Set(BACK.flatMap((region) => region.keys))

/**
 * Nga cila anë duket një muskul, si te figura 2D. Gjeometria nuk mjafton: te modeli krahët varen pak
 * pas mesit të trupit, ndaj bicepsi dhe deltoidi i përparmë do të dukeshin "mbrapa".
 */
export function sideOf(key: string): 'front' | 'back' | 'both' {
  const front = FRONT_KEYS.has(key)
  const back = BACK_KEYS.has(key)
  return front && back ? 'both' : back ? 'back' : 'front'
}

/** A duhet kthyer modeli mbrapa që këta muskuj të duken: shumica mbrapa; barazimi mbetet përpara. */
export function facesBack(keys: string[]) {
  const sides = keys.map(sideOf)
  return sides.filter((side) => side === 'back').length > sides.filter((side) => side === 'front').length
}

/** Gjatë fokusit, i zgjedhuri ndriçohet (edhe kur s'ka ngjyrë) dhe të tjerët zbehen drejt panelit. */
export function focusShade(focused: boolean | null) {
  if (focused === null) return { dim: 0, lift: 0 }
  return focused ? { dim: 0, lift: 0.35 } : { dim: 0.6, lift: 0 }
}

/** Kamera për një kuti: lartësia e qendrës dhe largësia që e nxë me pak hapësirë rreth saj. */
export function focusView(box: { min: number[]; max: number[] }) {
  const height = (box.min[1] + box.max[1]) / 2
  const size = Math.max(box.max[1] - box.min[1], box.max[0] - box.min[0], box.max[2] - box.min[2])
  const distance = (size * 1.6) / (2 * Math.tan(FIELD_OF_VIEW / 2))
  return { height, distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance)) }
}

/**
 * Kamera për një imazh të palëvizshëm (`aspect` = gjerësia / lartësia): kutia e plotë hyn në
 * lartësi dhe në gjerësi, me pak hapësirë rreth saj. Pa kufijtë e zmadhimit me gisht.
 */
export function fitView(box: { min: number[]; max: number[] }, aspect: number, margin = 1.04) {
  const height = (box.min[1] + box.max[1]) / 2
  const tan = Math.tan(FIELD_OF_VIEW / 2)
  const byHeight = ((box.max[1] - box.min[1]) / 2 / tan) * margin
  const byWidth = ((box.max[0] - box.min[0]) / 2 / (tan * aspect)) * margin
  return { height, distance: Math.max(byHeight, byWidth) }
}

/** Largësia pas një gjesti me dy gishta: `scale` > 1 afron. */
export function zoomed(distance: number, scale: number) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance / scale))
}
