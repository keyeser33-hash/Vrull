import { type Draft, IMPORT_ERRORS, type ImportErrorCode, type Language } from '../../supabase/functions/program-import/shared'
import { type LibraryExercise, muscleKeys } from '@/program/library'
import { type Choice, choiceKey, type ImportedProgram, type OwnExercise } from '@/program/pdf-import'
import type { Equipment, Tracking } from '@/program/types'
import { insertProgramParts } from './program-editor'
import type { LocalStore } from './store'

// Importi nga PDF (V2-E1-11) te baza lokale: ushtrimet që njeh app-i për AI-në, përgjigjet e funksionit
// program-import me fjalë, dhe drafti i programit që hapet te ndërtuesi. Drafti krijohet vetëm me
// "Krijo programin": një import i anuluar nuk lë asnjë program pas (vetëm koston e leximit, në server).

export interface MonthSpend {
  month: string
  spentEur: number
  limitEur: number
}

/** Gabimet e funksionit (`IMPORT_ERRORS`), plus "pa internet" që e vendos app-i vetë. */
export type ReadError = 'offline' | ImportErrorCode

export interface ReadSuccess {
  ok: true
  draft: Draft
  uncertain: number[]
  usage: { inputTokens: number; outputTokens: number; costEur: number; ms: number }
  month: MonthSpend
}

export type ReadResult = ReadSuccess | { ok: false; error: ReadError; month?: MonthSpend; costEur?: number }

/** Leximi i PDF-së përmes funksionit program-import (app-data.ts e lidh me Supabase). */
export interface ImportRemote {
  read(input: { file: Blob; fileName: string; known: string[]; language: Language }): Promise<ReadResult>
}

const ERRORS = new Set<ReadError>(IMPORT_ERRORS)

const isMonth = (value: unknown): value is MonthSpend =>
  typeof value === 'object' && value !== null && typeof (value as MonthSpend).spentEur === 'number' && typeof (value as MonthSpend).limitEur === 'number'

/** Përgjigja e funksionit (statusi null: pa lidhje) si rezultat me fjalë për ekranin. */
export function readResultFrom(status: number | null, body: unknown): ReadResult {
  if (status === null) return { ok: false, error: 'offline' }
  const value = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (status === 200) {
    const draft = value.draft as Draft | undefined
    const usage = value.usage as ReadSuccess['usage'] | undefined
    if (draft && Array.isArray(draft.days) && Array.isArray(draft.exercises) && Array.isArray(value.uncertain) && usage && isMonth(value.month)) {
      return { ok: true, draft, uncertain: value.uncertain as number[], usage, month: value.month }
    }
    return { ok: false, error: 'ai_failed' }
  }
  const error = ERRORS.has(value.error as ReadError) ? (value.error as ReadError) : status === 401 ? 'unauthorized' : 'ai_failed'
  return {
    ok: false,
    error,
    ...(isMonth(value.month) ? { month: value.month } : {}),
    ...(typeof value.costEur === 'number' ? { costEur: value.costEur } : {}),
  }
}

/** Ushtrimet e përdoruesit (kandidatët e parë) dhe emrat që i jepen AI-së: të tijat, pastaj biblioteka. */
export async function knownExercises(store: LocalStore, library: LibraryExercise[]): Promise<{ own: OwnExercise[]; names: string[] }> {
  const own: OwnExercise[] = (await store.all('exercises')).map((row) => ({
    id: row.id,
    name: String(row.name),
    libraryId: (row.library_id as string | null) ?? null,
    tracking: row.tracking as Tracking,
    equipment: row.equipment as Equipment,
  }))
  const seen = new Set<string>()
  const names: string[] = []
  for (const name of [...own.map((exercise) => exercise.name), ...library.map((exercise) => exercise.name)]) {
    const key = name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return { own, names }
}

/**
 * Rreshti i ushtrimit për një zgjedhje: i përdoruesit; ai i bibliotekës (me të njëjtën ID ose emër,
 * përndryshe i ri me muskujt e bibliotekës); ose një ushtrim i ri me pajisjen dhe muskujt që dha AI-ja.
 */
async function exerciseRow(store: LocalStore, choice: Choice, tracking: Tracking, cache: Map<string, string>): Promise<string> {
  const key = choiceKey(choice)
  const cached = cache.get(key)
  if (cached) return cached
  let id: string
  if (choice.kind === 'own') {
    id = choice.id
  } else {
    const rows = await store.all('exercises')
    const name = choice.kind === 'library' ? choice.exercise.name : choice.name
    const existing =
      (choice.kind === 'library' ? rows.find((row) => row.library_id === choice.exercise.id) : undefined) ??
      rows.find((row) => String(row.name).toLowerCase() === name.toLowerCase())
    if (existing) {
      id = existing.id
    } else if (choice.kind === 'library') {
      const primary = muscleKeys(choice.exercise.primary)
      id = (
        await store.put('exercises', {
          library_id: choice.exercise.id,
          name: choice.exercise.name,
          equipment: choice.exercise.equipment,
          tracking,
          primary_muscles: primary,
          secondary_muscles: muscleKeys(choice.exercise.secondary).filter((muscle) => !primary.includes(muscle)),
        })
      ).id
    } else {
      id = (
        await store.put('exercises', {
          library_id: null,
          name: choice.name.slice(0, 120),
          equipment: choice.equipment,
          tracking,
          primary_muscles: muscleKeys(choice.muscles),
          secondary_muscles: [],
        })
      ).id
    }
  }
  cache.set(key, id)
  return id
}

/**
 * "Krijo programin": programi i importuar si draft i ndërtuesit (V2-E1-10), pa shabllon dhe pa progres
 * të zgjuar (PDF-ja thotë si rritet pesha; përdoruesi e ndez te struktura kur do).
 */
export async function saveImportedDraft(store: LocalStore, imported: ImportedProgram): Promise<string> {
  const cache = new Map<string, string>()
  const exerciseIds = new Map<string, string>()
  for (const [id, exercise] of Object.entries(imported.exercises)) {
    exerciseIds.set(id, await exerciseRow(store, exercise.choice, exercise.tracking, cache))
  }
  const program = await store.put('programs', { name: imported.name.slice(0, 120) || 'PDF', source: 'custom', template: null, draft: true, progression: null })
  await insertProgramParts(store, program.id, imported.program, exerciseIds)
  return program.id
}
