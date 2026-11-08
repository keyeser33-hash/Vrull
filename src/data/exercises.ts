import {
  buildCatalog,
  type CatalogItem,
  type CatalogRow,
  keysOf,
  libraryGroupsOf,
  nameStatus,
  normalName,
  takenNames,
} from '@/program/exercise-catalog'
import { type LibraryExercise, loadLibrary } from '@/program/library'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { Equipment, Tracking } from '@/program/types'
import type { LocalStore } from './store'
import { activeProgram, exerciseFromLibrary } from './training'

// Biblioteka, faqja e ushtrimit dhe "Krijo ushtrim" mbi bazën lokale (V2-E1-09). Biblioteka e
// free-exercise-db ngarkohet vetëm kur hapet një nga këto ekrane (library.json, ~100 kB).

/** Emrat e ushtrimeve të programeve të gatshme: nuk janë "të tuat" edhe pa ID në bibliotekë. */
const PROGRAM_NAMES = new Set(SHORTCUT_TO_SIZE.exercises.map((exercise) => normalName(exercise.name)))

async function catalogRows(store: LocalStore): Promise<CatalogRow[]> {
  return (await store.all('exercises')).map((row) => ({
    id: row.id,
    name: String(row.name),
    libraryId: (row.library_id as string | null | undefined) ?? null,
    equipment: row.equipment as Equipment,
    primary: (row.primary_muscles as string[] | undefined) ?? [],
    secondary: (row.secondary_muscles as string[] | undefined) ?? [],
  }))
}

export interface ExerciseCatalog {
  items: CatalogItem[]
  /** Sa ushtrime ka biblioteka e free-exercise-db (pa ato të telefonit). */
  libraryCount: number
  /** Emrat që një ushtrim i ri nuk mund t'i marrë. */
  taken: Set<string>
}

export async function exerciseCatalog(store: LocalStore): Promise<ExerciseCatalog> {
  const [library, rows] = await Promise.all([loadLibrary(), catalogRows(store)])
  return { items: buildCatalog(library, rows, PROGRAM_NAMES), libraryCount: library.length, taken: takenNames(library, rows) }
}

/**
 * Zgjedhja e ushtrimit te editori dhe te seanca (LibraryPicker): biblioteka plus ushtrimet që krijoi
 * përdoruesi. Ushtrimi i përdoruesit gjendet nga editori me emër (exerciseFromLibrary), që është unik.
 */
export async function exerciseChoices(store: LocalStore): Promise<LibraryExercise[]> {
  const [library, { items }] = await Promise.all([loadLibrary(), exerciseCatalog(store)])
  const own: LibraryExercise[] = items
    .filter((item) => item.own)
    .map((item) => ({
      id: item.key,
      name: item.name,
      equipment: item.equipment,
      primary: libraryGroupsOf(item.primary),
      secondary: libraryGroupsOf(item.secondary),
    }))
  return [...own, ...library]
}

export interface ExerciseDetail extends CatalogItem {
  tracking: Tracking
  videoUrl: string | null
  /** Setet e ushtrimit te programi aktiv ("4 sete te Shortcut to Size"), kur është aty. */
  programSets: { programName: string; sets: number } | null
}

/** Ushtrimi sipas ID-së në telefon ose ID-së së bibliotekës; null kur nuk gjendet. */
export async function exerciseDetail(store: LocalStore, key: string): Promise<ExerciseDetail | null> {
  const { items } = await exerciseCatalog(store)
  const item =
    items.find((candidate) => candidate.key === key) ??
    items.find((candidate) => candidate.exerciseId !== null && candidate.libraryId === key) ??
    null
  if (!item) return null
  const row = item.exerciseId ? await store.get('exercises', item.exerciseId) : undefined
  const tracking = (row?.tracking as Tracking | undefined) ?? (item.equipment === 'bodyweight' ? 'bodyweight_reps' : 'weight_reps')
  let programSets: ExerciseDetail['programSets'] = null
  if (item.exerciseId) {
    const program = await activeProgram(store)
    const sets = program?.engine.slots.filter((slot) => slot.exerciseId === item.exerciseId).map((slot) => slot.sets) ?? []
    if (program && sets.length) programSets = { programName: String(program.row.name), sets: Math.max(...sets) }
  }
  return { ...item, tracking, videoUrl: (row?.video_url as string | null | undefined) ?? null, programSets }
}

/** Rreshti në telefon i ushtrimit (p.sh. për t'i shtuar videon); ushtrimi i bibliotekës e merr një herë. */
export async function exerciseRowFor(store: LocalStore, item: Pick<CatalogItem, 'exerciseId' | 'libraryId'>): Promise<string> {
  if (item.exerciseId) return item.exerciseId
  const entry = (await loadLibrary()).find((candidate) => candidate.id === item.libraryId)
  if (!entry) throw new Error('Ushtrimi nuk është në bibliotekë.')
  return exerciseFromLibrary(store, entry)
}

export interface NewExercise {
  name: string
  equipment: Equipment
  tracking: Tracking
  /** Grupet e ekranit (muscles.ts): kryesorët numërohen 1 set, ndihmësit 0,5. */
  primaryGroups: string[]
  secondaryGroups: string[]
  videoUrl: string | null
}

/**
 * "Krijo ushtrim": ushtrimi i përdoruesit, me çelësat e grupeve të zgjedhura (si ushtrimet e
 * bibliotekës që dinë vetëm grupin). Emri është unik kundrejt bibliotekës dhe telefonit.
 */
export async function createExercise(store: LocalStore, input: NewExercise): Promise<string> {
  const { taken } = await exerciseCatalog(store)
  const status = nameStatus(input.name, taken)
  if (status !== 'new') throw new Error(`Emri: ${status}`)
  if (input.primaryGroups.length === 0) throw new Error('Mungon muskuli primary')
  const primary = keysOf(input.primaryGroups)
  const row = await store.put('exercises', {
    name: input.name.trim().replace(/\s+/g, ' '),
    library_id: null,
    equipment: input.equipment,
    tracking: input.tracking,
    primary_muscles: primary,
    secondary_muscles: keysOf(input.secondaryGroups).filter((key) => !primary.includes(key)),
    video_url: input.videoUrl,
  })
  return row.id
}
