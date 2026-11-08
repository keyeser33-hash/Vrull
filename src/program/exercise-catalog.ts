import { GROUP_KEYS, type LibraryExercise, muscleKeys } from './library'
import { MUSCLE_GROUPS } from './muscles'
import type { Equipment } from './types'

// Biblioteka e ekranit (V2-E1-09, bordi "Biblioteka"): ushtrimet e free-exercise-db bashkë me ato që
// janë në telefon (Shortcut to Size, ato të shtuara nga biblioteka dhe ato që krijoi përdoruesi).
// Funksione të pastra; leximi i bazës është te data/exercises.ts.

/** Ushtrimi në telefon (tabela `exercises`), me çelësat e muskujve të Shtojcës D. */
export interface CatalogRow {
  id: string
  name: string
  libraryId: string | null
  equipment: Equipment
  primary: string[]
  secondary: string[]
}

export interface CatalogItem {
  /** Çelësi i rrugës: ID-ja në telefon kur ushtrimi është aty, përndryshe ID-ja e bibliotekës. */
  key: string
  exerciseId: string | null
  /** ID-ja te free-exercise-db (për foton), edhe kur ushtrimi në telefon e ka gjetur me emër. */
  libraryId: string | null
  name: string
  equipment: Equipment
  primary: string[]
  secondary: string[]
  /** I krijuar nga përdoruesi ("I yti"): as nga biblioteka, as nga një program i gatshëm. */
  own: boolean
}

/** Emri pa dallim shkronjash dhe hapësirash të tepërta: "Bench  press " = "bench press". */
export const normalName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

const byName = (a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

/**
 * Biblioteka dhe ushtrimet në telefon si një listë A–Z. Ushtrimi në telefon zë vendin e atij të
 * bibliotekës me të njëjtën ID ose me të njëjtin emër (historia mbetet bashkë, si te editori).
 * `programNames`: emrat e ushtrimeve të programeve të gatshme, që nuk janë "të tuat".
 */
export function buildCatalog(library: LibraryExercise[], rows: CatalogRow[], programNames: Set<string>): CatalogItem[] {
  const byId = new Map(library.map((entry) => [entry.id, entry]))
  const byLibraryName = new Map(library.map((entry) => [normalName(entry.name), entry]))
  const merged = new Set<string>()
  const items: CatalogItem[] = rows.map((row) => {
    const entry = (row.libraryId ? byId.get(row.libraryId) : undefined) ?? byLibraryName.get(normalName(row.name))
    if (entry) merged.add(entry.id)
    return {
      key: row.id,
      exerciseId: row.id,
      libraryId: entry?.id ?? row.libraryId,
      name: row.name,
      equipment: row.equipment,
      primary: row.primary,
      secondary: row.secondary,
      own: !row.libraryId && !entry && !programNames.has(normalName(row.name)),
    }
  })
  for (const entry of library) {
    if (merged.has(entry.id)) continue
    const primary = muscleKeys(entry.primary)
    items.push({
      key: entry.id,
      exerciseId: null,
      libraryId: entry.id,
      name: entry.name,
      equipment: entry.equipment,
      primary,
      secondary: muscleKeys(entry.secondary).filter((key) => !primary.includes(key)),
      own: false,
    })
  }
  return items.sort(byName)
}

/** Zonat e filtrit "Muskujt" te biblioteka, mbi grupet e ekranit (muscles.ts). */
export const LIBRARY_AREAS = [
  { id: 'chest', groups: ['gjoksi'] },
  { id: 'back', groups: ['shpina', 'mesi'] },
  { id: 'shoulders', groups: ['shpatullat', 'trapezi'] },
  { id: 'legs', groups: ['kuadricepsi', 'kofshet-e-pasme', 'vithet', 'aduktoret', 'pulpat'] },
  { id: 'arms', groups: ['bicepsi', 'tricepsi', 'parakrahet'] },
  { id: 'abs', groups: ['barku'] },
] as const

export type LibraryArea = (typeof LIBRARY_AREAS)[number]['id']

/** Filtri "Pajisja": shufra përfshin shufrën EZ. */
export const EQUIPMENT_FILTERS = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band', 'kettlebell', 'other'] as const
export type EquipmentFilter = (typeof EQUIPMENT_FILTERS)[number]

const EQUIPMENT_OF: Record<EquipmentFilter, Equipment[]> = {
  barbell: ['barbell', 'ez_bar'],
  dumbbell: ['dumbbell'],
  cable: ['cable'],
  machine: ['machine'],
  bodyweight: ['bodyweight'],
  band: ['band'],
  kettlebell: ['kettlebell'],
  other: ['other'],
}

export interface CatalogFilter {
  query?: string
  area?: LibraryArea | null
  equipment?: EquipmentFilter | null
}

/** Ushtrimet sipas kërkimit (çdo fjalë në emër), zonës (muskujt kryesorë) dhe pajisjes. */
export function filterCatalog(items: CatalogItem[], { query = '', area = null, equipment = null }: CatalogFilter): CatalogItem[] {
  const words = normalName(query).split(' ').filter(Boolean)
  const areaKeys = area ? new Set(keysOf([...(LIBRARY_AREAS.find((entry) => entry.id === area)?.groups ?? [])])) : null
  const kinds = equipment ? EQUIPMENT_OF[equipment] : null
  return items.filter((item) => {
    if (kinds && !kinds.includes(item.equipment)) return false
    if (areaKeys && !item.primary.some((key) => areaKeys.has(key))) return false
    const name = normalName(item.name)
    return words.every((word) => name.includes(word))
  })
}

/** Emrat që një ushtrim i ri nuk mund t'i marrë: çdo emër i bibliotekës dhe i telefonit. */
export function takenNames(library: Pick<LibraryExercise, 'name'>[], rows: Pick<CatalogRow, 'name'>[]): Set<string> {
  return new Set([...library, ...rows].map((entry) => normalName(entry.name)))
}

export function nameStatus(name: string, taken: Set<string>): 'empty' | 'taken' | 'new' {
  const normal = normalName(name)
  if (!normal) return 'empty'
  return taken.has(normal) ? 'taken' : 'new'
}

/** Grupet e ekranit (MUSCLE_GROUPS) që prekin çelësat, me radhën e grupeve. */
export function groupsOf(keys: string[]): string[] {
  return MUSCLE_GROUPS.filter((group) => group.keys.some((key) => keys.includes(key))).map((group) => group.id)
}

/** Çelësat e grupeve të zgjedhura, me radhën e grupeve dhe pa përsëritje. */
export function keysOf(groupIds: string[]): string[] {
  return [...new Set(MUSCLE_GROUPS.filter((group) => groupIds.includes(group.id)).flatMap((group) => group.keys))]
}

/** Grupet e free-exercise-db që çelësat i mbulojnë plotësisht (p.sh. për pushimin 60 s te barku). */
export function libraryGroupsOf(keys: string[]): string[] {
  return Object.entries(GROUP_KEYS)
    .filter(([, groupKeys]) => groupKeys.every((key) => keys.includes(key)))
    .map(([group]) => group)
}

/**
 * Sa i jep një set volumit javor të çdo grupi (SPEC §11): kryesori 1, ndihmësi 0,5, një herë për
 * grup; një grup që është edhe kryesor mbetet 1.
 */
export function volumeShare(primary: string[], secondary: string[]): { group: string; sets: number }[] {
  const helpers = secondary.filter((group) => !primary.includes(group))
  return [...primary.map((group) => ({ group, sets: 1 })), ...helpers.map((group) => ({ group, sets: 0.5 }))]
}
