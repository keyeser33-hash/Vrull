// Rrjedha e një importi pa Deno dhe pa Supabase (V2-E1-11; rishikimi i E1): kufiri i muajit me rezervim,
// thirrja te Claude, kostoja. index.ts e lidh me Deno.serve, bazën dhe fetch; handler.test.ts e provon me
// të rreme (kërkesa paralele, stream-i i ndërprerë, refuzimi para leximit).
//
// Kufiri dhe kërkesat paralele: çdo thirrje shkruan së pari një rezervim (kostoja më e keqe e një thirrjeje),
// pastaj mbledh kostot e tjera të muajit, edhe rezervimet e thirrjeve që janë ende në punë. Kërkesa që
// shkroi rezervimin e fundit i sheh të gjitha të tjerat, ndaj kërkesat që kalojnë e kapërcejnë kufirin të
// shumtën me një thirrje, si thirrjet njëra pas tjetrës. Pas thirrjes rezervimi merr koston e vërtetë, ose
// hiqet kur AI-ja nuk harxhoi asgjë.
import { limitReached } from '../_shared/ai.ts'
import {
  AI_CALL_RESERVE_EUR,
  AI_MONTHLY_LIMIT_EUR,
  AI_TIMEOUT_MS,
  costOf,
  createStreamReader,
  interpret,
  type StreamState,
} from './logic.ts'

/** Rreshtat e `ai_usage` të përdoruesit (index.ts: me çelësin sekret, vetëm për përdoruesin e hyrë). */
export interface UsageStore {
  /** Rezervon koston më të keqe të një thirrjeje para se ajo të nisë; kthen id-në e rreshtit. */
  reserve(month: string, eur: number): Promise<string>
  /** Kostot e muajit në euro, me rezervimet e thirrjeve të tjera, pa rreshtin `except`. */
  spent(month: string, except: string): Promise<number>
  /** Kostoja e vërtetë te rreshti i rezervimit. */
  settle(id: string, usage: { inputTokens: number; outputTokens: number; usd: number; eur: number }): Promise<void>
  /** Heq rezervimin: AI-ja nuk harxhoi asgjë. */
  cancel(id: string): Promise<void>
}

export interface Reply {
  status: number
  body: Record<string, unknown>
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Lexon përgjigjen me stream deri në fund. Tokenat e numëruar mbeten edhe kur stream-i ndërpritet, nga
 * afati (`timedOut`) ose nga një gabim rrjeti (`interrupted`): AI-ja ka punuar dhe kostoja ruhet.
 */
async function readStream(response: Response, signal: AbortSignal): Promise<{ state: StreamState; timedOut: boolean; interrupted: boolean }> {
  const reader = createStreamReader()
  const decoder = new TextDecoder()
  const body = response.body!.getReader()
  try {
    while (true) {
      const { done, value } = await body.read()
      if (done) break
      reader.push(decoder.decode(value, { stream: true }))
    }
    return { state: reader.state(), timedOut: false, interrupted: false }
  } catch {
    return { state: reader.state(), timedOut: signal.aborted, interrupted: !signal.aborted }
  }
}

export async function runImport({
  month,
  request,
  usage,
  callClaude,
  limitEur = AI_MONTHLY_LIMIT_EUR,
  timeoutMs = AI_TIMEOUT_MS,
  log = console.error,
}: {
  month: string
  /** Trupi i kërkesës te Claude API (buildRequest). */
  request: unknown
  usage: UsageStore
  callClaude: (request: unknown, signal: AbortSignal) => Promise<Response>
  /** Kufiri i personit (ai_limits, V42); pa të, 10 €. */
  limitEur?: number
  timeoutMs?: number
  log?: (message: string) => void
}): Promise<Reply> {
  let reservation: string
  let spentBefore: number
  try {
    reservation = await usage.reserve(month, AI_CALL_RESERVE_EUR)
  } catch {
    return { status: 502, body: { error: 'ai_failed' } }
  }
  const release = () => usage.cancel(reservation).catch(() => log('program-import: rezervimi nuk u hoq'))
  try {
    spentBefore = await usage.spent(month, reservation)
  } catch {
    await release()
    return { status: 502, body: { error: 'ai_failed' } }
  }
  const monthInfo = (spent: number) => ({ month, spentEur: round2(spent), limitEur })
  // Rezervimi i PDF-së (2 €) mbron nga thirrjet paralele; kufiri "u arrit" sipas rregullit të përbashkët
  // (_shared/ai.ts), që një lexim të mos refuzohet kur mbeten 1,50 € dhe kostoja e zakonshme është 0,30 €.
  if (limitReached(spentBefore, limitEur)) {
    await release()
    return { status: 429, body: { error: 'limit', month: monthInfo(spentBefore) } }
  }

  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let state: StreamState | null = null
  let timedOut = false
  let interrupted = false
  let refused: { error: string; status: number } | null = null
  try {
    const response = await callClaude(request, controller.signal)
    if (!response.ok || !response.body) {
      // Kërkesa u refuzua para leximit (p.sh. PDF me fjalëkalim, mbingarkesë): AI-ja nuk harxhoi tokena.
      log(`program-import: Claude API ${response.status}`)
      const error = response.status === 413 ? 'too_large' : response.status === 400 ? 'unreadable' : 'ai_failed'
      refused = { error, status: error === 'too_large' ? 400 : 502 }
    } else {
      ;({ state, timedOut, interrupted } = await readStream(response, controller.signal))
    }
  } catch {
    // Pa përgjigje fare: afati, ose rrjeti para se API-ja të nisë.
    timedOut = controller.signal.aborted
    interrupted = !controller.signal.aborted
  } finally {
    clearTimeout(timer)
  }
  const ms = Date.now() - started

  // Kostoja nga tokenat e kthyer (edhe të një stream-i të ndërprerë) zë vendin e rezervimit.
  const cost = state ? costOf(state) : { usd: 0, eur: 0 }
  if (state && (state.inputTokens > 0 || state.outputTokens > 0)) {
    await usage
      .settle(reservation, { inputTokens: state.inputTokens, outputTokens: state.outputTokens, usd: cost.usd, eur: cost.eur })
      .catch(() => log('program-import: kostoja nuk u ruajt; rezervimi mbetet'))
  } else {
    await release()
  }

  if (refused) return { status: refused.status, body: { error: refused.error, month: monthInfo(spentBefore) } }
  const spent = monthInfo(spentBefore + cost.eur)
  if (timedOut) return { status: 502, body: { error: 'timeout', month: spent, costEur: cost.eur } }
  if (interrupted || !state) return { status: 502, body: { error: 'ai_failed', month: spent, costEur: cost.eur } }
  const outcome = interpret(state)
  if (!outcome.ok) return { status: 502, body: { error: outcome.error, month: spent, costEur: cost.eur } }
  return {
    status: 200,
    body: {
      draft: outcome.draft,
      uncertain: outcome.uncertain,
      usage: { inputTokens: state.inputTokens, outputTokens: state.outputTokens, costEur: cost.eur, ms },
      month: spent,
    },
  }
}
