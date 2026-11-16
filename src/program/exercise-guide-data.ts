import type { ExerciseGuide, GuideFile } from './exercise-guides'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'

// Udhëzuesit e ushtrimeve të paketuar në app (SPEC §0.3g): skedarët te `guides/`, një për grup. Çelësi
// `exercise` është emri te Shortcut to Size ose ID-ja e free-exercise-db. Ushtrimi pa udhëzues (13 të
// Shortcut to Size dhe biblioteka deri te vala e tyre) kthen null.

const FILES = import.meta.glob<GuideFile>('./guides/*.json', { eager: true, import: 'default' })
const GUIDES = new Map<string, ExerciseGuide>(Object.values(FILES).flatMap((file) => file.guides.map((guide) => [guide.exercise, guide] as const)))
const NAME_OF_LIBRARY_ID = new Map(SHORTCUT_TO_SIZE.exercises.flatMap((exercise) => (exercise.libraryId ? [[exercise.libraryId, exercise.id] as const] : [])))

export interface GuideKey {
  libraryId: string | null
  name: string
}

/** Udhëzuesi i ushtrimit sipas emrit te Shortcut to Size ose ID-së së bibliotekës; null kur nuk ka. */
export function guideFor({ libraryId, name }: GuideKey): ExerciseGuide | null {
  const byName = GUIDES.get(name)
  if (byName || !libraryId) return byName ?? null
  return GUIDES.get(libraryId) ?? GUIDES.get(NAME_OF_LIBRARY_ID.get(libraryId) ?? '') ?? null
}
