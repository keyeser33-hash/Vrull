// Logjika e funksionit program-import pa Deno dhe pa rrjet (V2-E1-11), që provat e Vitest ta lexojnë
// njësoj si funksioni: modeli dhe çmimet, muaji i kufirit, kërkesa te Claude API, leximi i përgjigjes
// me stream dhe kontrolli i draftit. Burimet (verifikuar më 08.11.2026):
// - PDF-ja si dokument base64, para tekstit; deri në 600 faqe dhe 128 MB për kërkesë te modelet me 1M
//   kontekst: https://platform.claude.com/docs/en/build-with-claude/pdf-support
// - Dalja e strukturuar me `output_config.format` (json_schema): pa fusha opsionale mbi 24 dhe pa tipe
//   të përziera mbi 16: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// - Modeli dhe çmimet: https://platform.claude.com/docs/en/about-claude/pricing
// - Stream-i (message_start me tokenat e hyrjes, message_delta me tokenat e daljes, kumulativë):
//   https://platform.claude.com/docs/en/build-with-claude/streaming
// Kufijtë dhe tipet që i lexon edhe app-i jetojnë te shared.ts, që skema dhe udhëzimet e modelit të mos
// hyjnë në app.
import { AI_MONTHLY_LIMIT_EUR, type Draft, type Language, MAX_PDF_BYTES } from './shared.ts'

export { AI_MONTHLY_LIMIT_EUR, MAX_PDF_BYTES }
export type { Draft, Language, Target } from './shared.ts'

/**
 * Claude Sonnet 5.5: lexon tabelat e një programi (fazat, javët, setet, përsëritjet, teknikat) mirë dhe
 * shpejt. Një PDF si Shortcut to Size (rreth 20 faqe: ~2 000 tokena tekst dhe deri në ~4 800 tokena
 * imazh për faqe, plus ~7 000 për listën e bibliotekës) jep rreth 100 000–150 000 tokena hyrje dhe
 * ~7 000 dalje: rreth $0,27–0,37, pra €0,24–0,33, afro 30 lexime në muaj brenda €10. Haiku 5.5 do të
 * kushtonte rreth 10 herë më pak, por gabimi në një tabelë javësh e prish programin; Opus 5.5 kushton
 * dyfish për të njëjtën detyrë leximi.
 */
export const MODEL = 'claude-sonnet-5-5'
export const API_VERSION = '2026-10-21'

/** Çmimet e Claude Sonnet 5.5 në USD për milion tokena (pricing, 08.11.2026). */
export const PRICE_USD_PER_MTOK = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 } as const

/**
 * Kursi i referencës i Bankës Qendrore Evropiane më 06.11.2026: 1 EUR = 1,1165 USD
 * (https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml). Përditësohet me dorë kur kursi
 * lëviz dukshëm; kostoja e ruajtur mban të dyja vlerat.
 */
export const USD_PER_EUR = 1.1165

/** Muaji i kufirit sipas orës së Tiranës: AI-ja rinis më 1 të muajit atje. */
export const LIMIT_TIME_ZONE = 'Europe/Tirane'

/** Dalja (mendimi dhe JSON-i); programi i Shortcut to Size zë rreth 7 000. */
export const MAX_TOKENS = 32_000
/**
 * `medium`: me `low` AI-ja e shkurtonte programin (prova me PDF-në e vërtetë të Shortcut to Size më
 * 08.11.2026: 4 nga 9 slotet e ditës së parë, 13 nga 66 ushtrime, 16 s, €0,12). Koha mbetet brenda
 * kufirit 150 s të planit falas.
 */
export const EFFORT = 'medium'
/** Edge Function-i në planin falas ka 150 s (wall clock dhe pritja e përgjigjes); 10 s mbeten për ruajtjen. */
export const AI_TIMEOUT_MS = 140_000
/**
 * Rezervimi para çdo thirrjeje (handler.ts): kostoja më e keqe e një thirrjeje, me rezervë. Një PDF 15 MB
 * me 100 faqe zë rreth 500 000 tokena hyrje ($1,00) dhe dalja deri në MAX_TOKENS ($0,32): rreth €1,20.
 */
export const AI_CALL_RESERVE_EUR = 2
const MAX_KNOWN = 3000

export type ImportError = 'ai_failed' | 'unreadable' | 'too_long' | 'no_programme'

// ——— Muaji dhe kostoja ———

/** "2026-11-01": dita e parë e muajit të `date` në Tiranë. */
export function monthStart(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LIMIT_TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-01`
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
}

export function costOf(usage: Usage): { usd: number; eur: number } {
  const usd =
    (usage.inputTokens * PRICE_USD_PER_MTOK.input +
      usage.outputTokens * PRICE_USD_PER_MTOK.output +
      usage.cacheWriteTokens * PRICE_USD_PER_MTOK.cacheWrite +
      usage.cacheReadTokens * PRICE_USD_PER_MTOK.cacheRead) /
    1_000_000
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000
  return { usd: round(usd), eur: round(usd / USD_PER_EUR) }
}

// ——— Skedari dhe kërkesa ———

/** Skedari nis me "%PDF-" (edhe kur emri ose lloji gënjejnë). */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-'
}

/** Base64 me copa, pa varësi (Deno dhe shfletuesi kanë `btoa`). */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  return btoa(binary)
}

/** Emrat e ushtrimeve që app-i njeh (biblioteka dhe ushtrimet e përdoruesit), pa përsëritje. */
export function parseKnown(raw: string | null): string[] {
  let value: unknown
  try {
    value = JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const names: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const name = entry.trim().slice(0, 120)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    names.push(name)
    if (names.length === MAX_KNOWN) break
  }
  return names
}

const EQUIPMENT = ['barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other']
/** Grupet e free-exercise-db (app-i i kthen në muskujt e modelit 3D, Shtojca D). */
const MUSCLE_GROUPS = [
  'chest',
  'shoulders',
  'traps',
  'lats',
  'middle back',
  'lower back',
  'biceps',
  'forearms',
  'triceps',
  'abdominals',
  'glutes',
  'abductors',
  'adductors',
  'quadriceps',
  'hamstrings',
  'calves',
  'neck',
]

type Schema = Record<string, unknown>
const integer = (description: string): Schema => ({ type: 'integer', description })
const string = (description: string): Schema => ({ type: 'string', description })
const boolean = (description: string): Schema => ({ type: 'boolean', description })
const object = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const array = (items: Schema, description: string): Schema => ({ type: 'array', items, description })

const TARGET = object({
  reps_min: integer('Lowest reps of the range; 0 when the PDF gives no reps or the exercise is held for time.'),
  reps_max: integer('Highest reps of the range; equal to reps_min for an exact number; 0 when open-ended ("8+", AMRAP).'),
  to_failure: boolean('True when the PDF says to keep going to failure past reps_max if possible.'),
  seconds: integer('Hold time in seconds for timed exercises (plank); 0 otherwise.'),
  rir_min: integer('Reps in reserve the PDF asks for (lower bound); -1 when the PDF does not say.'),
  rir_max: integer('Reps in reserve, upper bound; -1 when the PDF does not say.'),
  last_set: { type: 'string', enum: ['none', 'rest_pause', 'drop_set', 'to_failure'], description: 'Technique on the last set of the exercise.' },
})

/** Skema e daljes: programi siç e thotë PDF-ja, pa fusha opsionale dhe pa tipe të përziera. */
export const PROGRAM_SCHEMA: Schema = object({
  found: boolean('False when the PDF contains no weight-training programme.'),
  name: string('Programme name as in the PDF.'),
  pages: integer('Number of pages in the PDF.'),
  blocks: array(object({ name: string('Block or phase name.'), weeks: integer('Weeks in this block.') }), 'Blocks (phases) in order; a programme without phases is one block.'),
  plans: array(
    object({ weeks: array(TARGET, 'One target per week of the block, in order (week 1 first); a single entry when every week is the same.') }),
    'Distinct rep schemes, shared by exercises that follow the same scheme.',
  ),
  exercises: array(
    object({
      pdf_name: string('Exercise name exactly as written in the PDF.'),
      page: integer('1-based page where the exercise first appears.'),
      match: string('Exact name from the known exercise list when it is the same movement; empty string when none is.'),
      alternative: string('Another name from the known list that could also be meant; empty string when none.'),
      sure: boolean('True only when match (or, with an empty match, that the exercise is not in the list) is certain.'),
      equipment: { type: 'string', enum: EQUIPMENT },
      muscles: array({ type: 'string', enum: MUSCLE_GROUPS }, 'Primary muscle groups.'),
      timed: boolean('True when the exercise is held for time.'),
    }),
    'Every distinct exercise the programme uses, once each.',
  ),
  days: array(
    object({
      name: string('Training day name, usually its muscle groups.'),
      slots: array(
        object({
          exercise: integer('Index in exercises.'),
          sets: integer('Working sets.'),
          rest_seconds: integer('Rest between sets in seconds; 0 when the PDF does not say.'),
          plan: integer('Index in plans.'),
          blocks: array(
            object({
              block: integer('1-based block number.'),
              exercise: integer('Index in exercises used in this block; -1 when unchanged.'),
              sets: integer('Sets in this block; 0 when unchanged.'),
              plan: integer('Index in plans for this block; -1 when unchanged.'),
            }),
            'Differences in specific blocks.',
          ),
          weeks: array(
            object({
              block: integer('1-based block number; 0 for every block.'),
              week: integer('1-based week within the block.'),
              exercise: integer('Index in exercises used that week.'),
            }),
            'Exercises that rotate by week.',
          ),
        }),
        'Exercise positions of the day, in order.',
      ),
    }),
    'Training days that repeat every week, in order.',
  ),
})

/** Fushat opsionale dhe ato me tipe të përziera në skemë (kufijtë e daljes së strukturuar: 24 dhe 16). */
export function schemaComplexity(schema: Schema): { optional: number; unions: number } {
  let optional = 0
  let unions = 0
  const visit = (node: Schema) => {
    if (Array.isArray(node.type) || node.anyOf) unions += 1
    if (node.type === 'object') {
      const properties = node.properties as Record<string, Schema>
      const required = new Set(node.required as string[])
      for (const [key, child] of Object.entries(properties)) {
        if (!required.has(key)) optional += 1
        visit(child)
      }
    }
    if (node.type === 'array') visit(node.items as Schema)
  }
  visit(schema)
  return { optional, unions }
}

const SYSTEM = `You read weight-training programmes from PDF files for a gym app and return them in the given JSON schema.

How to fill it:
- found: false when the PDF has no weight-training programme (then return empty lists).
- blocks: the programme's phases in order with their number of weeks. An introductory or preparation week is its own block. A programme without phases is one block.
- days: the training days that repeat each week, in order. A slot is one exercise position of the day; list supersets and circuits as consecutive slots.
- plans: each distinct rep scheme once. weeks[i] is week i+1 of the block; give one entry when every week is the same. Use reps_min 0 when the PDF gives no reps. rir_min/rir_max are -1 unless the PDF asks for reps in reserve. last_set is the technique on the last set that week (none when the PDF says nothing).
- A slot's sets, rest and plan are its usual values. Put what changes in one block in "blocks" (1-based block number; -1 or 0 for what stays the same) and exercises that change by week in "weeks".
- Completeness: transcribe the whole programme. Every training day lists every exercise position the PDF gives for it (often 7 to 10, including calves and abs), and every exercise that changes by phase or week goes in "blocks" or "weeks". Never shorten, sample or merge positions; check each day and each phase table against the PDF before answering.
- exercises: each distinct exercise once, with its name exactly as written (keep typos), and the page where it first appears. For match, use the exact name from the known exercise list below when it is the same movement (same equipment and body position); otherwise an empty string. Set sure to false whenever you hesitate between names, the PDF wording is unclear, or the closest known name is a different variation. Never invent sets, reps or exercises that are not in the PDF. Never shorten the programme.`

/** Gjuha e emrave të blloqeve dhe ditëve; emrat e ushtrimeve mbeten si në PDF. */
const LANGUAGE_NAME: Record<Language, string> = { sq: 'Albanian', en: 'British English' }
export const isLanguage = (value: unknown): value is Language => value === 'sq' || value === 'en'

export function buildRequest({ pdfBase64, known, language }: { pdfBase64: string; known: string[]; language: Language }) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    stream: true,
    system: `${SYSTEM}\n\nKnown exercise list:\n${known.join('\n')}`,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdfBase64 } },
          {
            type: 'text' as const,
            text: `Read the training programme in this PDF. Write block and day names in ${LANGUAGE_NAME[language]}; keep exercise names as written in the PDF.`,
          },
        ],
      },
    ],
    output_config: { format: { type: 'json_schema', schema: PROGRAM_SCHEMA }, effort: EFFORT },
  }
}

// ——— Përgjigja me stream ———

export interface StreamState extends Usage {
  text: string
  stopReason: string | null
  error: string | null
}

/**
 * Lexon ngjarjet e stream-it (SSE) në copa të çfarëdoshme. Tokenat e daljes vijnë te message_delta;
 * kur stream-i ndërpritet para tij, vlerësohen nga teksti (rreth 3 shkronja për token), që kostoja e
 * një leximi të ndërprerë të mos humbasë.
 */
export function createStreamReader() {
  let buffer = ''
  let reportedOutput: number | null = null
  let streamedChars = 0
  const state: StreamState = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, text: '', stopReason: null, error: null }

  function usage(value: Record<string, unknown> | undefined) {
    if (!value) return
    if (typeof value.input_tokens === 'number') state.inputTokens = value.input_tokens
    if (typeof value.cache_creation_input_tokens === 'number') state.cacheWriteTokens = value.cache_creation_input_tokens
    if (typeof value.cache_read_input_tokens === 'number') state.cacheReadTokens = value.cache_read_input_tokens
  }

  function handle(event: Record<string, unknown>) {
    switch (event.type) {
      case 'message_start':
        usage((event.message as { usage?: Record<string, unknown> } | undefined)?.usage)
        break
      case 'content_block_delta': {
        const delta = event.delta as { type?: string; text?: string; thinking?: string }
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          state.text += delta.text
          streamedChars += delta.text.length
        } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
          streamedChars += delta.thinking.length
        }
        break
      }
      case 'message_delta': {
        const value = event.usage as Record<string, unknown> | undefined
        usage(value)
        if (typeof value?.output_tokens === 'number') reportedOutput = value.output_tokens
        const delta = event.delta as { stop_reason?: string | null }
        if (delta?.stop_reason) state.stopReason = delta.stop_reason
        break
      }
      case 'error':
        state.error = (event.error as { type?: string } | undefined)?.type ?? 'error'
        break
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        try {
          handle(JSON.parse(line.slice(5).trim()))
        } catch {
          // Një rresht i paplotë ose jo JSON nuk ndal leximin.
        }
      }
    },
    state(): StreamState {
      return { ...state, outputTokens: reportedOutput ?? Math.ceil(streamedChars / 3) }
    },
  }
}

// ——— Drafti ———

const within = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max

/** Treguesit brenda listave dhe çdo plan me të paktën një javë: app-i e kthen draftin pa e ruajtur gjysmë. */
export function checkDraft(draft: Draft): boolean {
  const exercises = draft.exercises.length
  const plans = draft.plans.length
  const blocks = draft.blocks.length
  if (!blocks || !plans || !exercises || !draft.days.length) return false
  if (draft.plans.some((plan) => plan.weeks.length === 0)) return false
  if (draft.blocks.some((block) => !within(block.weeks, 1, 52))) return false
  return draft.days.every(
    (day) =>
      day.slots.length > 0 &&
      day.slots.every(
        (slot) =>
          within(slot.exercise, 0, exercises - 1) &&
          within(slot.plan, 0, plans - 1) &&
          slot.blocks.every((change) => within(change.block, 1, blocks) && within(change.exercise, -1, exercises - 1) && within(change.plan, -1, plans - 1)) &&
          slot.weeks.every((change) => within(change.block, 0, blocks) && within(change.week, 1, 52) && within(change.exercise, 0, exercises - 1)),
      ),
  )
}

export type Outcome = { ok: true; draft: Draft; uncertain: number[] } | { ok: false; error: ImportError }

/** Përgjigja e plotë e AI-së: drafti dhe ushtrimet ku AI-ja nuk ishte e sigurt, ose arsyeja pse nuk u lexua. */
export function interpret(state: StreamState): Outcome {
  if (state.error) return { ok: false, error: 'ai_failed' }
  if (state.stopReason === 'refusal') return { ok: false, error: 'unreadable' }
  if (state.stopReason === 'max_tokens') return { ok: false, error: 'too_long' }
  let draft: Draft
  try {
    draft = JSON.parse(state.text) as Draft
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  if (!draft.found || !draft.days?.length) return { ok: false, error: 'no_programme' }
  if (!checkDraft(draft)) return { ok: false, error: 'unreadable' }
  return { ok: true, draft, uncertain: draft.exercises.flatMap((exercise, index) => (exercise.sure ? [] : [index])) }
}
