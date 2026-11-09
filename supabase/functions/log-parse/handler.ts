// Rrjedha e një mesazhi të kutisë pa Deno dhe pa Supabase (V40, V2-E2-13): kufiri dhe kostoja me
// `withBudget` (_shared/ai.ts), pastaj drafti.
import { AI_MONTHLY_LIMIT_EUR, type UsageStore, withBudget } from '../_shared/ai.ts'
import { AI_CALL_RESERVE_EUR, AI_TIMEOUT_MS, buildRequest, interpret, MODEL } from './logic.ts'
import type { ParseRequest } from './shared.ts'

export type { UsageStore }

export interface Reply {
  status: number
  body: Record<string, unknown>
}

export async function runParse({
  month,
  request,
  usage,
  callClaude,
  limitEur = AI_MONTHLY_LIMIT_EUR,
  timeoutMs = AI_TIMEOUT_MS,
  log = console.error,
}: {
  month: string
  request: ParseRequest
  usage: UsageStore
  callClaude: (request: unknown, signal: AbortSignal) => Promise<Response>
  limitEur?: number
  timeoutMs?: number
  log?: (message: string) => void
}): Promise<Reply> {
  const body = buildRequest(request)
  const outcome = await withBudget({
    month,
    model: MODEL,
    limitEur,
    reserveEur: AI_CALL_RESERVE_EUR,
    usage,
    call: (signal) => callClaude(body, signal),
    timeoutMs,
    tag: 'log-parse',
    log,
  })
  if (outcome.kind === 'store_failed') return { status: 502, body: { error: 'ai_failed' } }
  if (outcome.kind === 'limit') return { status: 429, body: { error: 'limit', month: outcome.month } }
  const { failure, tokens, cost, month: spent, ms } = outcome
  if (failure) return { status: 502, body: { error: failure === 'refused' ? 'ai_failed' : failure, month: spent, costEur: cost.eur } }
  const result = interpret(outcome.body, request.context)
  if (!result.ok) return { status: 502, body: { error: result.error, month: spent, costEur: cost.eur } }
  return { status: 200, body: { draft: result.draft, usage: { ...tokens, costEur: cost.eur, ms }, month: spent } }
}
