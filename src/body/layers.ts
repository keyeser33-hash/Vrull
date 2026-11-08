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

/**
 * Zgjedhjet e ekranit "Shtresat" (bordi "Trupi · Shtresat"), me radhën e bordit: një për çdo muskul
 * të thellë, përveç romboidëve, që shihen bashkë nën trapez. `id` është edhe çelësi i teksteve.
 */
export interface DeepEntry {
  id: string
  keys: string[]
  side: 'front' | 'back'
  covers: string[]
}

const ENTRY_KEYS: [string, string[]][] = [
  ['pectoralis_minor', ['pectoralis_minor']],
  ['rhomboids', ['rhomboid_major', 'rhomboid_minor']],
  ['brachialis', ['brachialis']],
  ['soleus', ['soleus']],
  ['infraspinatus', ['infraspinatus']],
  ['teres_major', ['teres_major']],
  ['erector_spinae', ['erector_spinae']],
  ['gluteus_medius', ['gluteus_medius']],
  ['semimembranosus', ['semimembranosus']],
]

export const DEEP_ENTRIES: DeepEntry[] = ENTRY_KEYS.map(([id, keys]) => {
  const muscles = DEEP_MUSCLES.filter((muscle) => keys.includes(muscle.key))
  return { id, keys, side: muscles[0].side, covers: [...new Set(muscles.flatMap((muscle) => muscle.covers))] }
})

export const deepEntry = (id: string) => DEEP_ENTRIES.find((entry) => entry.id === id)

/**
 * Ku punon një muskul i thellë te programi yt: emrat e ushtrimeve ku një nga çelësat është kryesor,
 * pastaj ato ku është vetëm ndihmës, me radhën e programit dhe pa përsëritje.
 */
export function programRoles(keys: string[], exercises: { name: string; primary: string[]; secondary: string[] }[]) {
  const primary: string[] = []
  const secondary: string[] = []
  for (const exercise of exercises) {
    if (primary.includes(exercise.name) || secondary.includes(exercise.name)) continue
    if (exercise.primary.some((key) => keys.includes(key))) primary.push(exercise.name)
    else if (exercise.secondary.some((key) => keys.includes(key))) secondary.push(exercise.name)
  }
  return { primary, secondary }
}
