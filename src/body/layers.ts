// Shtresat e modelit 3D (SPEC §11, TH-19): muskujt e thellë dhe ata që i mbulojnë. Harta vjen nga
// matja te modeli (tools/anatomy/layers.test.mjs): nga ana e treguar, mbulesat fshehin pjesën më të
// madhe të muskulit të thellë, dhe kur bëhen të tejdukshme, ai duket.

export interface DeepMuscle {
  key: string
  /** Ana nga e cila shihet muskuli kur mbulesat zhduken. */
  side: 'front' | 'back'
  covers: string[]
}

export const DEEP_MUSCLES: DeepMuscle[] = [
  { key: 'pectoralis_minor', side: 'front', covers: ['pectoralis_major_sternocostal', 'pectoralis_major_clavicular'] },
  { key: 'brachialis', side: 'front', covers: ['biceps_brachii'] },
  { key: 'rhomboid_major', side: 'back', covers: ['trapezius'] },
  { key: 'rhomboid_minor', side: 'back', covers: ['trapezius'] },
  { key: 'infraspinatus', side: 'back', covers: ['deltoid_posterior', 'trapezius'] },
  { key: 'teres_major', side: 'back', covers: ['deltoid_posterior', 'latissimus_dorsi'] },
  { key: 'erector_spinae', side: 'back', covers: ['latissimus_dorsi', 'trapezius'] },
  { key: 'gluteus_medius', side: 'back', covers: ['gluteus_maximus'] },
  { key: 'semimembranosus', side: 'back', covers: ['semitendinosus'] },
  { key: 'soleus', side: 'back', covers: ['gastrocnemius'] },
]

const COVERS = new Map(DEEP_MUSCLES.map((muscle) => [muscle.key, muscle.covers]))
const ALL_COVERS = [...new Set(DEEP_MUSCLES.flatMap((muscle) => muscle.covers))]

/**
 * Muskujt që bëhen të tejdukshëm (dhe nuk kapin prekjen). Me `deep`, të gjitha mbulesat. Pa të,
 * vetëm mbulesat e një muskuli të thellë të fokusuar, që nuk janë vetë në fokus: fokusi te soleusi
 * e zbulon atë, fokusi te Pulpat (gastroknemiusi me soleusin) jo.
 */
export function ghostKeys(deep: boolean, focus: string[] | null): Set<string> {
  if (deep) return new Set(ALL_COVERS)
  const ghosts = new Set<string>()
  for (const key of focus ?? []) for (const cover of COVERS.get(key) ?? []) if (!focus!.includes(cover)) ghosts.add(cover)
  return ghosts
}
