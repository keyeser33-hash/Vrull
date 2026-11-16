// Rrjedha e një shpjegimi pa Deno dhe pa Supabase (V56): kufiri dhe kostoja me `withBudget` (_shared/ai.ts),
// pastaj paragrafët.
import { AI_MONTHLY_LIMIT_EUR, type UsageStore, withBudget } from '../_shared/ai.ts'
import { AI_CALL_RESERVE_EUR, AI_TIMEOUT_MS, buildRequest, type ExplainRequest, interpret, MODEL } from './logic.ts'

export type { UsageStore }

export interface Reply {
  status: number
  body: Record<string, unknown>
}

export async function runExplain({
  month,
  request,
  usage,
  callClaude,
  limitEur = AI_MONTHLY_LIMIT_EUR,
  timeoutMs = AI_TIMEOUT_MS,
  log = console.error,
}: {
  month: string
  request: ExplainRequest
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
    tag: 'exercise-explain',
    log,
  })
  if (outcome.kind === 'store_failed') return { status: 502, body: { error: 'ai_failed' } }
  if (outcome.kind === 'limit') return { status: 429, body: { error: 'limit', month: outcome.month } }
  const { failure, tokens, cost, month: spent, ms } = outcome
  if (failure) return { status: 502, body: { error: failure === 'refused' ? 'ai_failed' : failure, month: spent, costEur: cost.eur } }
  const result = interpret(outcome.body)
  if (!result.ok) return { status: 502, body: { error: result.error, month: spent, costEur: cost.eur } }
  return { status: 200, body: { paragraphs: result.paragraphs, usage: { ...tokens, costEur: cost.eur, ms }, month: spent } }
}
