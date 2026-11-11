import { BODY_CENTER, FIELD_OF_VIEW_DEGREES, MAX_DISTANCE, MIN_DISTANCE, zoomed } from './model-focus'
import { nearestAngle } from './model-math'

// Kamera e lirë e modelit 3D (SPEC §11, V53; bordet "Trupi 3D · drita dhe kamera"): këndet e shinës,
// anim lart-poshtë, zhvendosja me dy gishta, "Pamja e plotë" dhe aureola sipas largësisë. Pa three.js.
// Trupi rrotullohet rreth boshtit të vet (`rotation`, 0 = përpara, π = mbrapa) dhe kamera ngrihet
// (`elevation`, 0 = në lartësinë e trupit); këndet në radianë.

const radians = (degrees: number) => (degrees * Math.PI) / 180
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export type ViewAngle = 'front' | 'threeQuarter' | 'side' | 'back'

/** Këndet e shinës, me radhën e bordit "Katër këndet e shinës". */
export const VIEW_ANGLES: { id: ViewAngle; rotation: number; elevation: number }[] = [
  { id: 'front', rotation: 0, elevation: 0 },
  { id: 'threeQuarter', rotation: -radians(35), elevation: radians(8) },
  { id: 'side', rotation: -Math.PI / 2, elevation: 0 },
  { id: 'back', rotation: Math.PI, elevation: 0 },
]

/** Sa afër një këndi të shinës lexohet pamja si ai kënd: fundi i një animacioni po, 16° e fokusit jo. */
const ROTATION_TOLERANCE = radians(6)
const ELEVATION_TOLERANCE = radians(4)

/** Kamera sheh pak nga poshtë (dyshemeja nuk kthehet përmbys) dhe jo mbi kokë. */
export const MIN_ELEVATION = -radians(10)
export const MAX_ELEVATION = radians(60)

/** Fokusi: trupi kthehet pak anash dhe kamera ngrihet pak, si te bordi "Muskuli i prekur". */
export const FOCUS_ANGLE = { rotation: radians(16), elevation: radians(5) }

/** Ku shkon pamja për një kënd të shinës, me rrugën më të shkurtër nga rrotullimi i tanishëm. */
export function angleView(id: ViewAngle, currentRotation: number) {
  const angle = VIEW_ANGLES.find((item) => item.id === id)!
  return { rotation: nearestAngle(angle.rotation, currentRotation), elevation: angle.elevation }
}

/** Këndi i shinës ku është pamja tani; null mes dy këndeve ose me kamerën e animuar ndryshe. */
export function angleAt(rotation: number, elevation: number): ViewAngle | null {
  const match = VIEW_ANGLES.find(
    (angle) => Math.abs(nearestAngle(angle.rotation, rotation) - rotation) <= ROTATION_TOLERANCE && Math.abs(angle.elevation - elevation) <= ELEVATION_TOLERANCE,
  )
  return match?.id ?? null
}

/** Anim i kamerës pas një zvarritjeje lart-poshtë, brenda kufijve. */
export function tilted(elevation: number, delta: number) {
  return clamp(elevation + delta, MIN_ELEVATION, MAX_ELEVATION)
}

/** Sa metra të trupit mbulon një piksel i pamjes, në largësinë e kamerës. */
const perPixel = (distance: number, viewport: number) => (2 * Math.tan(radians(FIELD_OF_VIEW_DEGREES) / 2) * distance) / viewport

/** Sa larg mesit të trupit mund të shikojë kamera: asgjë te largësia e plotë, deri te koka dhe këmbët kur është afër. */
const panRange = (distance: number) => (BODY_CENTER * (1 - distance / MAX_DISTANCE)) / (1 - MIN_DISTANCE / MAX_DISTANCE)

/**
 * Pamja pas një gjesti me dy gishta: `scale` > 1 afron, dhe pika e trupit që ishte nën gishta kur nisi
 * gjesti mbetet nën ta (afrimi shkon te vendi që tregon dora, zvarritja e zhvendos trupin lart-poshtë).
 * `midStart` dhe `midNow` janë mesi i dy gishtave në px nga mesi i pamjes (poshtë pozitiv), `viewport`
 * lartësia e pamjes në px. Kur kamera largohet deri në fund, trupi kthehet në mes; një gjest që nis
 * nga një fokus jashtë kufijve (kofshët te largësia e plotë) nuk e hedh kamerën.
 */
export function pinched(start: { height: number; distance: number }, scale: number, midStart: number, midNow: number, viewport: number) {
  const distance = zoomed(start.distance, scale)
  const anchor = start.height - midStart * perPixel(start.distance, viewport)
  const height = anchor + midNow * perPixel(distance, viewport)
  const before = panRange(start.distance)
  const excess = start.height - clamp(start.height, BODY_CENTER - before, BODY_CENTER + before)
  const range = panRange(distance)
  return { height: clamp(height, BODY_CENTER - range + Math.min(0, excess), BODY_CENTER + range + Math.max(0, excess)), distance }
}

export interface CameraView {
  rotation: number
  elevation: number
  height: number
  distance: number
}

/** Trupi i plotë, përpara, me rrugën më të shkurtër nga rrotullimi i tanishëm ("Pamja e plotë"). */
export function fullView(currentRotation: number): CameraView {
  return { rotation: nearestAngle(0, currentRotation), elevation: 0, height: BODY_CENTER, distance: MAX_DISTANCE }
}

/**
 * A është larguar pamja nga trupi i plotë dhe i drejtë: afrim, zhvendosje, ose kamera e animuar jashtë
 * një këndi të shinës. Vetëm rrotullimi nuk mjafton: trupi shihet i plotë dhe shina e kthen.
 */
export function isFreeView(view: CameraView) {
  const zoomedIn = view.distance < MAX_DISTANCE - 0.05
  const moved = Math.abs(view.height - BODY_CENTER) > 0.02
  const tiltedAway = Math.abs(view.elevation) > ELEVATION_TOLERANCE && angleAt(view.rotation, view.elevation) === null
  return zoomedIn || moved || tiltedAway
}

/** Këndi i fokusit: nga ana ku duket muskuli (përpara ose mbrapa), pak anash dhe pak nga lart. */
export function focusAngle(back: boolean, currentRotation: number) {
  return { rotation: nearestAngle((back ? Math.PI : 0) - FOCUS_ANGLE.rotation, currentRotation), elevation: FOCUS_ANGLE.elevation }
}

/** Fortësia e aureolës sipas largësisë: e plotë te trupi i plotë, pothuajse asgjë nga afër. */
export function auraFade(distance: number) {
  return clamp((distance / MAX_DISTANCE) ** 3, 0.05, 1)
}

/** Gjerësia e aureolës ndjek largësinë, që në ekran të mbetet po aq e hollë. */
export function auraScale(distance: number) {
  return distance / MAX_DISTANCE
}

/** Ku bie vija e muskulit mbi kartë (px): drejt poshtë kur muskuli është mbi të, përndryshe te cepi më i afërt. */
export function leaderEnd(x: number, cardLeft: number, cardRight: number, inset = 20) {
  return clamp(x, cardLeft + inset, cardRight - inset)
}
