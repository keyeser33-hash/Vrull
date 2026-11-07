// Fokusi i modelit 3D (SPEC §11): nga kutia e muskujve të zgjedhur, sa kthehet trupi dhe ku shkon
// kamera. Koordinatat në metra, Y lart, Z përpara; kamera shikon nga +Z.

/** Largësia e kamerës kur shihet i gjithë trupi, dhe sa afër lejohet zmadhimi. */
export const MAX_DISTANCE = 3.75
export const MIN_DISTANCE = 1.1
/** Lartësia e qendrës së trupit, ku shikon kamera pa fokus. */
export const BODY_CENTER = 0.86
const FIELD_OF_VIEW = (28 * Math.PI) / 180

/** Këndi i rrotullimit rreth Y që e sjell pikën (x, z) përballë kamerës (mbi boshtin +Z). */
export function facingAngle(point: { x: number; z: number }) {
  return Math.atan2(-point.x, point.z)
}

/** Kamera për një kuti: lartësia e qendrës dhe largësia që e nxë me pak hapësirë rreth saj. */
export function focusView(box: { min: number[]; max: number[] }) {
  const height = (box.min[1] + box.max[1]) / 2
  const size = Math.max(box.max[1] - box.min[1], box.max[0] - box.min[0], box.max[2] - box.min[2])
  const distance = (size * 1.6) / (2 * Math.tan(FIELD_OF_VIEW / 2))
  return { height, distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance)) }
}

/** Largësia pas një gjesti me dy gishta: `scale` > 1 afron. */
export function zoomed(distance: number, scale: number) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance / scale))
}
