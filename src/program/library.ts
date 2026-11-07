import type { Equipment } from './types'

// Biblioteka e ushtrimeve (free-exercise-db, domain publik), për zëvendësimet dhe editorin.
// Ngarkohet vetëm kur hapet zgjedhja e ushtrimit, që nisja e app-it të mos e paguajë.
// Skedari ndërtohet me tools/exercise-library/build.mjs.

export interface LibraryExercise {
  id: string
  name: string
  equipment: Equipment
  /** Grupet e free-exercise-db (chest, lats...). */
  primary: string[]
  secondary: string[]
}

export async function loadLibrary(): Promise<LibraryExercise[]> {
  const data = await import('./library.json')
  return data.exercises as LibraryExercise[]
}

// Shtojca D.
const GROUP_KEYS: Record<string, string[]> = {
  chest: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor'],
  shoulders: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
  traps: ['trapezius'],
  lats: ['latissimus_dorsi'],
  'middle back': ['rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus'],
  'lower back': ['erector_spinae'],
  biceps: ['biceps_brachii', 'brachialis'],
  forearms: ['brachioradialis', 'forearm_flexors'],
  triceps: ['triceps_brachii'],
  abdominals: ['rectus_abdominis', 'external_oblique'],
  glutes: ['gluteus_maximus', 'gluteus_medius'],
  abductors: ['gluteus_medius', 'tensor_fasciae_latae'],
  adductors: ['adductor_magnus', 'adductor_longus'],
  quadriceps: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'],
  hamstrings: ['biceps_femoris', 'semitendinosus', 'semimembranosus'],
  calves: ['gastrocnemius', 'soleus'],
  neck: ['sternocleidomastoid'],
}

/** Çelësat e muskujve në model për grupet e free-exercise-db (Shtojca D). */
export function muscleKeys(groups: string[]): string[] {
  return [...new Set(groups.flatMap((group) => GROUP_KEYS[group] ?? []))]
}

/** Kërkimi sipas emrit: çdo fjalë e kërkesës duhet të jetë në emër; fillimi i emrit del i pari. */
export function searchLibrary(library: LibraryExercise[], query: string): LibraryExercise[] {
  const text = query.trim().toLowerCase()
  const words = text.split(/\s+/).filter(Boolean)
  const found = library.filter((exercise) => words.every((word) => exercise.name.toLowerCase().includes(word)))
  const starts = (exercise: LibraryExercise) => (exercise.name.toLowerCase().startsWith(text) ? 0 : 1)
  return found.sort((a, b) => starts(a) - starts(b))
}
