// Kostoja dhe kufiri i AI-së, të përbashkëta për çdo funksion me AI (V25, V42; SPEC §9 "Kufiri i AI-së").
// Pa Deno dhe pa Supabase, që Vitest t'i provojë: index.ts i çdo funksioni i lidh me bazën.
//
// Rregulli (MESIMET, "Rishikimi i kodit"): kufiri që mbron para rezervon para se të nisë punën. Rezervimi
// (kostoja më e keqe e një thirrjeje) shkruhet te ai_usage; shuma e muajit pa rezervimin e vet, plus
// rezervimi, nuk kalon kufirin. Pas thirrjes rezervimi merr koston e vërtetë, ose hiqet kur AI-ja nuk punoi.

export const USD_PER_EUR = 1.1165
export const LIMIT_TIME_ZONE = 'Europe/Tirane'
/** Kufiri për person në muaj (V25), deri te kufiri i Adminit për çdo person (V42, E2-17). */
export const AI_MONTHLY_LIMIT_EUR = 10

/** Kufiri i personit nga rreshtat e ai_limits (V42); pa rresht ose me vlerë të gabuar, 10 €. */
export function limitFrom(rows: readonly { monthly_eur: number | string | null }[] | null | undefined): number {
  const raw = rows?.[0]?.monthly_eur
  const value = raw === null || raw === undefined || raw === '' ? Number.NaN : Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : AI_MONTHLY_LIMIT_EUR
}

/** Dollarë për milion tokena. */
export interface ModelPrice {
  input: number
  output: number
  /** Shkrimi i cache-it me 5 minuta: 1,25 × hyrja. */
  cacheWrite: number
  /** Leximi i cache-it: 0,1 × hyrja te Haiku 5.5, 0,05 × te Sonnet 5.5. */
  cacheRead: number
}

/**
 * Çmimet nga platform.claude.com (prompt caching, lexuar më 09.11.2026). Haiku 5.5: deri në 100 000 tokena
 * në kërkesë; funksionet tona dërgojnë shumë më pak.
 */
export const PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
}

export interface Tokens {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
}

export interface Cost {
  usd: number
  eur: number
}

export interface MonthInfo {
  month: string
  spentEur: number
  limitEur: number
}

export function monthStart(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LIMIT_TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-01`
}

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0)

/** Tokenat nga `usage` e përgjigjes së Messages API; ato që mungojnë janë 0. */
export function tokensOf(body: unknown): Tokens {
  const usage = (body as { usage?: Record<string, unknown> } | null)?.usage ?? {}
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cacheWriteTokens: count(usage.cache_creation_input_tokens),
    cacheReadTokens: count(usage.cache_read_input_tokens),
  }
}

const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000

export function costOf(model: string, tokens: Tokens): Cost {
  const price = PRICES[model]
  if (!price) throw new Error(`Çmimi i modelit mungon: ${model}`)
  const usd =
    (tokens.inputTokens * price.input + tokens.outputTokens * price.output + tokens.cacheWriteTokens * price.cacheWrite + tokens.cacheReadTokens * price.cacheRead) /
    1_000_000
  return { usd: round6(usd), eur: round6(usd / USD_PER_EUR) }
}

/** Rreshtat e ai_usage të një përdoruesi (index.ts i lidh me çelësin sekret). */
export interface UsageStore {
  reserve(month: string, eur: number): Promise<string>
  spent(month: string, except: string): Promise<number>
  settle(id: string, usage: { inputTokens: number; outputTokens: number; usd: number; eur: number }): Promise<void>
  cancel(id: string): Promise<void>
}

/** refused: API-ja e refuzoi kërkesën (400); ai_failed: gabim tjetër ose pa lidhje; timeout: afati. */
export type CallFailure = 'refused' | 'ai_failed' | 'timeout'

export type BudgetOutcome =
  | { kind: 'limit'; month: MonthInfo }
  | { kind: 'store_failed' }
  | { kind: 'done'; failure: CallFailure | null; status: number; body: unknown; tokens: Tokens; cost: Cost; month: MonthInfo; ms: number }

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Një thirrje te AI-ja brenda kufirit të muajit: rezervimi, kontrolli me rezervimet e kërkesave paralele,
 * thirrja me afat, pastaj kostoja e vërtetë (me cache-in) ose heqja e rezervimit kur nuk u harxhua asgjë.
 */
export async function withBudget({
  month,
  model,
  limitEur,
  reserveEur,
  usage,
  call,
  timeoutMs = 60_000,
  tag,
  log = console.error,
}: {
  month: string
  model: string
  limitEur: number
  reserveEur: number
  usage: UsageStore
  call: (signal: AbortSignal) => Promise<Response>
  timeoutMs?: number
  /** Emri i funksionit te log-u. */
  tag: string
  log?: (message: string) => void
}): Promise<BudgetOutcome> {
  let reservation: string
  try {
    reservation = await usage.reserve(month, reserveEur)
  } catch {
    return { kind: 'store_failed' }
  }
  const release = () => usage.cancel(reservation).catch(() => log(`${tag}: rezervimi nuk u hoq`))
  let spentBefore: number
  try {
    spentBefore = await usage.spent(month, reservation)
  } catch {
    await release()
    return { kind: 'store_failed' }
  }
  const monthInfo = (spent: number): MonthInfo => ({ month, spentEur: round2(spent), limitEur })
  if (spentBefore + reserveEur > limitEur) {
    await release()
    return { kind: 'limit', month: monthInfo(spentBefore) }
  }

  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let body: unknown = null
  let status = 0
  let failure: CallFailure | null = null
  try {
    const response = await call(controller.signal)
    status = response.status
    if (!response.ok) {
      log(`${tag}: Claude API ${response.status}`)
      failure = response.status === 400 ? 'refused' : 'ai_failed'
    } else {
      body = await response.json()
    }
  } catch {
    failure = controller.signal.aborted ? 'timeout' : 'ai_failed'
  } finally {
    clearTimeout(timer)
  }
  const ms = Date.now() - started

  const tokens = tokensOf(body)
  const cost = costOf(model, tokens)
  const spentTokens = tokens.inputTokens + tokens.outputTokens + tokens.cacheWriteTokens + tokens.cacheReadTokens
  if (spentTokens > 0) {
    await usage
      .settle(reservation, { inputTokens: tokens.inputTokens + tokens.cacheWriteTokens + tokens.cacheReadTokens, outputTokens: tokens.outputTokens, usd: cost.usd, eur: cost.eur })
      .catch(() => log(`${tag}: kostoja nuk u ruajt; rezervimi mbetet`))
  } else {
    await release()
  }
  return { kind: 'done', failure, status, body, tokens, cost, month: monthInfo(spentBefore + cost.eur), ms }
}
