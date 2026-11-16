// "Shpjegoje më shumë" (V56, SPEC §0.3e), pa Deno dhe pa Supabase: kontrolli i kërkesës së telefonit, kërkesa
// te Claude me udhëzuesin ekzistues si kontekst dhe skemën e daljes, dhe shpjegimi i pastër. index.ts e lidh
// me Deno.serve; provat: handler.test.ts.
//
// Asnjë tekst personal nuk shkon këtu: vetëm ushtrimi (emri, muskujt, udhëzuesi i paketuar me app-in) dhe
// gjuha. Modeli shpjegon çfarë thotë udhëzuesi; nuk shton burime, studime, emra ose numra që s'janë aty.
import {
  type ExplainLanguage,
  type ExplainRequest,
  GUIDE_SECTIONS,
  type GuideSectionKey,
  LANGUAGES,
  MAX_GUIDE,
  MAX_ITEM,
  MAX_MUSCLES,
  MAX_NAME,
  MAX_PARAGRAPHS,
  MAX_SECTION_ITEMS,
  MIN_PARAGRAPHS,
} from './shared.ts'

export type { ExplainRequest } from './shared.ts'

/** Haiku 5.5, si te funksionet e tjera me AI (log-parse, supplement-label). */
export const MODEL = 'claude-haiku-5-5'
export const API_VERSION = '2026-10-21'
/** Gjashtë paragrafë deri në 1 000 shkronja në shqip zënë rreth 2 000 tokena; me rezervë që JSON-i të mos pritet. */
export const MAX_TOKENS = 3_000
export const EFFORT = 'low'
export const AI_TIMEOUT_MS = 30_000
/** Kostoja më e keqe: ~3 000 tokena hyrje dhe 3 000 dalje, rreth $0,002; me rezervë, si kutia. */
export const AI_CALL_RESERVE_EUR = 0.01
/** Një paragraf nuk kalon këtë gjatësi (rreth 150 fjalë). */
export const MAX_PARAGRAPH = 1_000

const LANGUAGE_NAME: Record<ExplainLanguage, string> = { sq: 'Albanian', en: 'British English' }

export const INSTRUCTIONS = `You explain one gym exercise in more depth for a beginner who already has a short guide in the app.

- Write ${MIN_PARAGRAPHS} to ${MAX_PARAGRAPHS} short paragraphs: why the exercise works, how it should feel, and the mistakes a beginner makes. Plain words, no headings, no lists, no markdown.
- Rely only on the guide and the muscles you are given. Do not invent studies, sources, authors, organisations, numbers, percentages, tempos or weights that are not in the guide. Never write a citation or a link.
- If the guide is missing, stay general and short, and say nothing that depends on a source.
- Do not give medical advice or diagnose pain. When the guide has a safety section, repeat its advice instead of adding your own.
- Do not repeat the guide line by line: connect its points and say why they matter.
- Write in the language the user message names. Keep the exercise name in English.
- No exclamation marks, no emoji.`

type Schema = Record<string, unknown>

/** Skema e daljes: vetëm paragrafët. */
export const EXPLAIN_SCHEMA: Schema = {
  type: 'object',
  properties: {
    paragraphs: {
      type: 'array',
      items: { type: 'string', description: 'One paragraph of the explanation.' },
    },
  },
  required: ['paragraphs'],
  additionalProperties: false,
}

const clean = (value: string, max: number) => value.replace(/\s+/g, ' ').trim().slice(0, max)
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown, max: number, itemMax: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => clean(item, itemMax))
    .filter(Boolean)
    .slice(0, max)

export type RequestCheck = { ok: true; request: ExplainRequest } | { ok: false; error: 'bad_request' | 'too_long' }

/** Kërkesa e telefonit, e kontrolluar dhe e pastruar para se të shkojë te modeli. */
export function parseRequest(raw: unknown): RequestCheck {
  if (!isObject(raw) || !isObject(raw.exercise)) return { ok: false, error: 'bad_request' }
  const language = (LANGUAGES as readonly unknown[]).includes(raw.language) ? (raw.language as ExplainLanguage) : null
  const name = typeof raw.exercise.name === 'string' ? clean(raw.exercise.name, MAX_NAME + 1) : ''
  if (!language || !name) return { ok: false, error: 'bad_request' }
  if (name.length > MAX_NAME) return { ok: false, error: 'too_long' }

  let guide: ExplainRequest['guide'] = null
  if (isObject(raw.guide)) {
    const sections: Partial<Record<GuideSectionKey, string[]>> = {}
    let size = 0
    for (const key of GUIDE_SECTIONS) {
      const items = strings(raw.guide[key], MAX_SECTION_ITEMS, MAX_ITEM)
      if (items.length === 0) continue
      size += items.join('').length
      sections[key] = items
    }
    if (size > MAX_GUIDE) return { ok: false, error: 'too_long' }
    if (size > 0) guide = sections
  }
  const equipment = typeof raw.exercise.equipment === 'string' ? clean(raw.exercise.equipment, 40) : ''
  return {
    ok: true,
    request: {
      language,
      exercise: {
        name,
        primary: strings(raw.exercise.primary, MAX_MUSCLES, 60),
        secondary: strings(raw.exercise.secondary, MAX_MUSCLES, 60),
        equipment: equipment || null,
      },
      guide,
    },
  }
}

function userText(request: ExplainRequest): string {
  const { exercise, guide } = request
  const lines = [`Language: ${LANGUAGE_NAME[request.language]}.`, `Exercise: ${exercise.name}.`]
  if (exercise.equipment) lines.push(`Equipment: ${exercise.equipment}.`)
  if (exercise.primary.length) lines.push(`Main muscles: ${exercise.primary.join(', ')}.`)
  if (exercise.secondary.length) lines.push(`Helping muscles: ${exercise.secondary.join(', ')}.`)
  if (!guide) lines.push('Guide: none.')
  else
    for (const key of GUIDE_SECTIONS) {
      const items = guide[key]
      if (items?.length) lines.push(`Guide, ${key}:`, ...items.map((item) => `- ${item}`))
    }
  return lines.join('\n')
}

export function buildRequest(request: ExplainRequest) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text' as const, text: INSTRUCTIONS }],
    messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: userText(request) }] }],
    output_config: { format: { type: 'json_schema', schema: EXPLAIN_SCHEMA }, effort: EFFORT },
  }
}

export type Outcome = { ok: true; paragraphs: string[] } | { ok: false; error: 'unreadable' }

/** Paragrafët nga përgjigja; më pak se tre (ose bosh) është "unreadable", më shumë se gjashtë priten. */
export function interpret(body: unknown): Outcome {
  const content = (body as { content?: { type: string; text?: string }[] } | null)?.content ?? []
  const answer = content.find((block) => block.type === 'text')?.text ?? ''
  let raw: unknown
  try {
    raw = JSON.parse(answer)
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  if (!isObject(raw)) return { ok: false, error: 'unreadable' }
  const paragraphs = strings(raw.paragraphs, MAX_PARAGRAPHS, MAX_PARAGRAPH)
  if (paragraphs.length < MIN_PARAGRAPHS) return { ok: false, error: 'unreadable' }
  return { ok: true, paragraphs }
}
