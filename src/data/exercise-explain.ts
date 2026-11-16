import { EXPLAIN_ERRORS, type ExplainErrorCode, type ExplainLanguage, type ExplainMonth, type ExplainRequest, GUIDE_SECTIONS } from '../../supabase/functions/exercise-explain/shared'
import type { ExerciseGuide } from '@/program/exercise-guides'
import { aiMonth } from './ai-usage'
import type { LocalStore } from './store'

// "Shpjegoje më shumë" te faqja e ushtrimit (V56, SPEC §0.3e) në telefon: kërkesa te funksioni
// `exercise-explain` (udhëzuesi i paketuar si kontekst, asnjë tekst personal), gjendjet "pa internet" dhe
// "kufiri u arrit", dhe teksti i ruajtur në telefon për ushtrimin dhe gjuhën, që hapja e dytë të mos kushtojë
// as të kërkojë rrjetin. Ruhet vetëm në telefon (`writeDevice`), pa sinkronizim: është i rigjenerueshëm.

/** Gabimet e funksionit, plus "pa internet" që e vendos app-i vetë. */
export type ExplainError = 'offline' | ExplainErrorCode

export type ExplainResult = { ok: true; paragraphs: string[]; costEur: number } | { ok: false; error: ExplainError; month?: ExplainMonth }

/** Thirrja te funksioni (app-data.ts e lidh me Supabase). */
export interface ExplainRemote {
  explain(request: ExplainRequest): Promise<ExplainResult>
}

const ERRORS = new Set<ExplainError>(EXPLAIN_ERRORS)
const isMonth = (value: unknown): value is ExplainMonth => typeof value === 'object' && value !== null && typeof (value as ExplainMonth).spentEur === 'number' && typeof (value as ExplainMonth).limitEur === 'number'

/** Përgjigja e funksionit (statusi null: pa lidhje) si rezultat. */
export function explainResultFrom(status: number | null, body: unknown): ExplainResult {
  if (status === null) return { ok: false, error: 'offline' }
  const value = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (status === 200) {
    const paragraphs = Array.isArray(value.paragraphs) ? value.paragraphs.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
    const usage = value.usage as { costEur?: unknown } | undefined
    if (paragraphs.length === 0) return { ok: false, error: 'ai_failed' }
    return { ok: true, paragraphs, costEur: typeof usage?.costEur === 'number' ? usage.costEur : 0 }
  }
  const error = ERRORS.has(value.error as ExplainError) ? (value.error as ExplainError) : status === 401 ? 'unauthorized' : 'ai_failed'
  return { ok: false, error, ...(isMonth(value.month) ? { month: value.month } : {}) }
}

export interface ExplainSubject {
  /** Çelësi i ushtrimit (ID-ja e bibliotekës ose e telefonit): ku ruhet shpjegimi. */
  key: string
  name: string
  equipment: string | null
  primary: string[]
  secondary: string[]
  guide: ExerciseGuide | null
}

/** Kërkesa për funksionin: emri, muskujt dhe udhëzuesi në gjuhën e kërkuar; asgjë personale. */
export function explainRequest(subject: ExplainSubject, language: ExplainLanguage): ExplainRequest {
  const { guide } = subject
  const section = (key: (typeof GUIDE_SECTIONS)[number]): string[] => {
    if (!guide) return []
    if (key === 'tips') return guide.tips.map((tip) => `${tip.who}: ${tip.text[language]}`)
    return guide[key].items.map((item) => item[language])
  }
  const sections = Object.fromEntries(GUIDE_SECTIONS.map((key) => [key, section(key)] as const).filter(([, items]) => items.length > 0))
  return {
    language,
    exercise: { name: subject.name, primary: subject.primary, secondary: subject.secondary, equipment: subject.equipment },
    guide: guide ? sections : null,
  }
}

/** FNV-1a 32 bit: shenja e shkurtër e kërkesës, që një udhëzues i ndryshuar të kërkojë shpjegim të ri. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Ku ruhet shpjegimi: ushtrimi, gjuha dhe shenja e kërkesës. Kur udhëzuesi i paketuar ndryshon (një fakt i
 * korrigjuar, udhëzuesi që vjen me një valë të re), shenja ndryshon dhe hapja e radhës kërkon shpjegim të ri.
 */
export const explanationKey = (subject: ExplainSubject, language: ExplainLanguage) =>
  `explain:${language}:${subject.key}:${fingerprint(JSON.stringify(explainRequest(subject, language)))}`

/** Shpjegimi i ruajtur për ushtrimin, gjuhën dhe udhëzuesin e tanishëm; null kur s'ka. */
export async function savedExplanation(store: LocalStore, subject: ExplainSubject, language: ExplainLanguage): Promise<string[] | null> {
  const value = await store.readDevice(explanationKey(subject, language))
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string') ? (value as string[]) : null
}

export type ExplainBlock = 'offline' | 'limit'

/** Pse butoni nuk punon tani (pa shpjegim të ruajtur): pa internet, ose kufiri i muajit u arrit. */
export async function explainBlock(store: LocalStore, online: boolean): Promise<ExplainBlock | null> {
  if (!online) return 'offline'
  return (await aiMonth(store)).reached ? 'limit' : null
}

/**
 * Shpjegimi i një ushtrimi: i ruajtur në telefon pa thirrje; përndryshe pa internet ose pas kufirit nuk
 * thirret asgjë (kufiri i serverit mbetet i vetmi që vendos), dhe një përgjigje e mirë ruhet për herën tjetër.
 */
export async function explainExercise(
  store: LocalStore,
  remote: ExplainRemote,
  subject: ExplainSubject,
  language: ExplainLanguage,
  online: boolean,
): Promise<ExplainResult> {
  const saved = await savedExplanation(store, subject, language)
  if (saved) return { ok: true, paragraphs: saved, costEur: 0 }
  const block = await explainBlock(store, online)
  if (block) return { ok: false, error: block }
  const result = await remote.explain(explainRequest(subject, language))
  if (result.ok) await store.writeDevice(explanationKey(subject, language), result.paragraphs)
  return result
}
