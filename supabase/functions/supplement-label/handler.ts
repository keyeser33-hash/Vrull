// Rrjedha e një leximi të etiketës pa Deno dhe pa Supabase (V39, V2-E2-10): kufiri dhe kostoja me
// `withBudget` (_shared/ai.ts), pastaj fushat e lexuara.
import { type UsageStore, withBudget } from '../_shared/ai.ts'
import { AI_CALL_RESERVE_EUR, AI_MONTHLY_LIMIT_EUR, AI_TIMEOUT_MS, interpret, MODEL } from './logic.ts'

export type { UsageStore }

export interface Reply {
  status: number
  body: Record<string, unknown>
}

export async function runLabel({
  month,
  request,
  usage,
  callClaude,
  limitEur = AI_MONTHLY_LIMIT_EUR,
  timeoutMs = AI_TIMEOUT_MS,
  log = console.error,
}: {
  month: string
  request: unknown
  usage: UsageStore
  callClaude: (request: unknown, signal: AbortSignal) => Promise<Response>
  limitEur?: number
  timeoutMs?: number
  log?: (message: string) => void
}): Promise<Reply> {
  const outcome = await withBudget({
    month,
    model: MODEL,
    limitEur,
    reserveEur: AI_CALL_RESERVE_EUR,
    usage,
    call: (signal) => callClaude(request, signal),
    timeoutMs,
    tag: 'supplement-label',
    log,
  })
  if (outcome.kind === 'store_failed') return { status: 502, body: { error: 'ai_failed' } }
  if (outcome.kind === 'limit') return { status: 429, body: { error: 'limit', month: outcome.month } }
  const { failure, tokens, cost, month: spent, ms } = outcome
  if (failure) return { status: 502, body: { error: failure === 'refused' ? 'unreadable' : failure, month: spent, costEur: cost.eur } }
  const result = interpret(outcome.body)
  if (!result.ok) return { status: 422, body: { error: result.error, month: spent, costEur: cost.eur } }
  return {
    status: 200,
    body: {
      fields: result.fields,
      read: result.read,
      total: result.total,
      usage: { inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens, costEur: cost.eur, ms },
      month: spent,
    },
  }
}
