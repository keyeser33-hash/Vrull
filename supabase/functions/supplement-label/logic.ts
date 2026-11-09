// Leximi i etiketës së një suplementi me AI (V39, V2-E2-10), pa Deno dhe pa Supabase: kërkesa te Claude
// me foton dhe skemën e daljes, kostoja nga tokenat dhe interpretimi i përgjigjes. index.ts e lidh me
// Deno.serve; provat: logic.test.ts dhe handler.test.ts.
//
// Modeli, çmimet, kursi dhe muaji janë të njëjtë me program-import (provë te logic.test.ts): kufiri i AI-së
// është një për të gjitha veçoritë.
import type { LabelFields, LabelKind, LabelUnit } from './shared.ts'

export type { LabelErrorCode, LabelFields } from './shared.ts'
export { MAX_IMAGE_BYTES } from './shared.ts'

/** Si te program-import: Sonnet 5.5 e lexon etiketën saktë; një foto 1 568 px zë rreth 1 600 tokena. */
export const MODEL = 'claude-sonnet-5-5'
export const API_VERSION = '2026-10-21'
export const PRICE_USD_PER_MTOK = { input: 2, output: 10 } as const
export const USD_PER_EUR = 1.1165
export const LIMIT_TIME_ZONE = 'Europe/Tirane'
/** Kufiri për person në muaj (V25), si te program-import/shared.ts. */
export const AI_MONTHLY_LIMIT_EUR = 10
/** Dalja: një JSON i vogël dhe pak mendim. */
export const MAX_TOKENS = 2_000
export const EFFORT = 'low'
export const AI_TIMEOUT_MS = 60_000
/** Kostoja më e keqe e një leximi: ~5 000 tokena hyrje dhe 2 000 dalje, rreth $0,03; me rezervë. */
export const AI_CALL_RESERVE_EUR = 0.1

export function monthStart(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LIMIT_TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-01`
}

export function costOf(usage: { inputTokens: number; outputTokens: number }): { usd: number; eur: number } {
  const usd = (usage.inputTokens * PRICE_USD_PER_MTOK.input + usage.outputTokens * PRICE_USD_PER_MTOK.output) / 1_000_000
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000
  return { usd: round(usd), eur: round(usd / USD_PER_EUR) }
}

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp'

/** Lloji i fotos nga fillimi i skedarit (JPEG, PNG, WebP), jo nga emri; null për çdo gjë tjetër. */
export function imageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  return btoa(binary)
}

const KINDS: LabelKind[] = ['protein', 'creatine', 'capsule', 'other']
const UNITS: LabelUnit[] = ['scoop', 'g', 'mg', 'capsule', 'tablet', 'dose']

type Schema = Record<string, unknown>
const number = (description: string): Schema => ({ type: 'number', description })
const object = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

/** Skema e daljes: çdo fushë gjithnjë e pranishme; -1 ose "" kur etiketa nuk e thotë. */
export const LABEL_SCHEMA: Schema = object({
  is_label: { type: 'boolean', description: 'True when the photo shows a supplement package or its label; false otherwise.' },
  name: { type: 'string', description: 'Product name as printed, brand first when visible (e.g. "Gold Standard 100% Whey"); "" when not readable.' },
  kind: { type: 'string', enum: [...KINDS, 'unknown'], description: 'protein: protein powder; creatine: creatine; capsule: capsules or tablets; other: anything else.' },
  dose_amount: number('Amount of one serving in dose_unit (1 for one scoop); -1 when not printed.'),
  dose_unit: { type: 'string', enum: [...UNITS, 'unknown'], description: 'Unit of one serving: scoop for powders measured by scoop.' },
  serving_g: number('Grams of one serving or scoop ("Serving size 30.4 g"); -1 when not printed.'),
  kcal: number('Energy per serving in kcal (convert kJ with ÷ 4.184 only when kcal is missing); -1 when not printed.'),
  protein_g: number('Protein per serving in grams; -1 when not printed.'),
  carbs_g: number('Total carbohydrate per serving in grams; -1 when not printed.'),
  fat_g: number('Total fat per serving in grams; -1 when not printed.'),
})

const SYSTEM = `You read the label of a dietary supplement from a phone photo and return its fields as JSON.
Read only what is printed. Use the per-serving column (one scoop), not per 100 g, unless only per 100 g is printed and the serving size in grams is printed too: then scale to one serving.
Never guess a value that is not visible: use -1 for numbers, "" for the name, "unknown" for kind or unit.`

export function buildRequest({ imageBase64, mediaType }: { imageBase64: string; mediaType: ImageType }) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: imageBase64 } },
          { type: 'text' as const, text: 'Read this supplement label.' },
        ],
      },
    ],
    output_config: { format: { type: 'json_schema', schema: LABEL_SCHEMA }, effort: EFFORT },
  }
}

export type Outcome = { ok: true; fields: LabelFields; read: number; total: number } | { ok: false; error: 'unreadable' | 'not_label' }

const value = (raw: unknown, max: number): number | null => {
  const number = typeof raw === 'number' ? raw : Number.NaN
  return Number.isFinite(number) && number >= 0 && number <= max ? Math.round(number * 10) / 10 : null
}

/** Përgjigja e API-së (pa stream) si fusha; `read` nga `total` fushat që i duhen këtij lloji. */
export function interpret(body: unknown): Outcome {
  const content = (body as { content?: { type: string; text?: string }[] } | null)?.content ?? []
  const text = content.find((block) => block.type === 'text')?.text ?? ''
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  if (raw.is_label !== true) return { ok: false, error: 'not_label' }
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 120) : null
  const kind = KINDS.includes(raw.kind as LabelKind) ? (raw.kind as LabelKind) : null
  const doseUnit = UNITS.includes(raw.dose_unit as LabelUnit) ? (raw.dose_unit as LabelUnit) : null
  const fields: LabelFields = {
    name,
    kind,
    doseAmount: value(raw.dose_amount, 10_000),
    doseUnit,
    scoopG: value(raw.serving_g, 200),
    kcal: value(raw.kcal, 2000),
    proteinG: value(raw.protein_g, 200),
    carbsG: value(raw.carbs_g, 200),
    fatG: value(raw.fat_g, 200),
  }
  // Emri, lloji dhe doza; për pluhurat e proteinës edhe luga dhe katër makrot.
  const needed: (keyof LabelFields)[] = kind === 'protein' ? ['name', 'kind', 'doseAmount', 'scoopG', 'kcal', 'proteinG', 'carbsG', 'fatG'] : ['name', 'kind', 'doseAmount']
  const read = needed.filter((key) => fields[key] !== null).length
  if (read === 0) return { ok: false, error: 'unreadable' }
  return { ok: true, fields, read, total: needed.length }
}
