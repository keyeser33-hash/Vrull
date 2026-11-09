// Rrjedha e një leximi të etiketës pa Deno dhe pa Supabase (V39, V2-E2-10), si program-import/handler.ts:
// rezervimi i kostos më të keqe, kufiri i muajit me kërkesat paralele, thirrja te Claude (pa stream: një
// JSON i vogël), kostoja e vërtetë në vend të rezervimit, dhe fushat e lexuara.
import { AI_CALL_RESERVE_EUR, AI_MONTHLY_LIMIT_EUR, AI_TIMEOUT_MS, costOf, interpret } from './logic.ts'

export interface UsageStore {
  reserve(month: string, eur: number): Promise<string>
  spent(month: string, except: string): Promise<number>
  settle(id: string, usage: { inputTokens: number; outputTokens: number; usd: number; eur: number }): Promise<void>
  cancel(id: string): Promise<void>
}

export interface Reply {
  status: number
  body: Record<string, unknown>
}

const round2 = (value: number) => Math.round(value * 100) / 100

export async function runLabel({
  month,
  request,
  usage,
  callClaude,
  timeoutMs = AI_TIMEOUT_MS,
  log = console.error,
}: {
  month: string
  request: unknown
  usage: UsageStore
  callClaude: (request: unknown, signal: AbortSignal) => Promise<Response>
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
  const release = () => usage.cancel(reservation).catch(() => log('supplement-label: rezervimi nuk u hoq'))
  try {
    spentBefore = await usage.spent(month, reservation)
  } catch {
    await release()
    return { status: 502, body: { error: 'ai_failed' } }
  }
  const monthInfo = (spent: number) => ({ month, spentEur: round2(spent), limitEur: AI_MONTHLY_LIMIT_EUR })
  if (spentBefore >= AI_MONTHLY_LIMIT_EUR) {
    await release()
    return { status: 429, body: { error: 'limit', month: monthInfo(spentBefore) } }
  }

  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let body: unknown = null
  let failure: 'timeout' | 'ai_failed' | 'unreadable' | null = null
  try {
    const response = await callClaude(request, controller.signal)
    if (!response.ok) {
      log(`supplement-label: Claude API ${response.status}`)
      failure = response.status === 400 ? 'unreadable' : 'ai_failed'
    } else {
      body = await response.json()
    }
  } catch {
    failure = controller.signal.aborted ? 'timeout' : 'ai_failed'
  } finally {
    clearTimeout(timer)
  }
  const ms = Date.now() - started

  const reported = (body as { usage?: { input_tokens?: number; output_tokens?: number } } | null)?.usage
  const tokens = { inputTokens: Number(reported?.input_tokens ?? 0), outputTokens: Number(reported?.output_tokens ?? 0) }
  const cost = costOf(tokens)
  if (tokens.inputTokens > 0 || tokens.outputTokens > 0) {
    await usage.settle(reservation, { ...tokens, usd: cost.usd, eur: cost.eur }).catch(() => log('supplement-label: kostoja nuk u ruajt; rezervimi mbetet'))
  } else {
    await release()
  }
  const spent = monthInfo(spentBefore + cost.eur)
  if (failure) return { status: 502, body: { error: failure, month: spent, costEur: cost.eur } }
  const outcome = interpret(body)
  if (!outcome.ok) return { status: 422, body: { error: outcome.error, month: spent, costEur: cost.eur } }
  return {
    status: 200,
    body: { fields: outcome.fields, read: outcome.read, total: outcome.total, usage: { ...tokens, costEur: cost.eur, ms }, month: spent },
  }
}
