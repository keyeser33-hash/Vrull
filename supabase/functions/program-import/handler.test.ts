import fixture from '../../../src/program/pdf-import.fixture.json'
import { runImport, type UsageStore } from './handler'
import { AI_CALL_RESERVE_EUR, AI_MONTHLY_LIMIT_EUR, costOf, MODEL } from './logic'

// Rrjedha e importit me të rreme (rishikimi i E1): kufiri i muajit me kërkesa paralele, kostoja e një
// stream-i të ndërprerë dhe refuzimi para leximit.

const MONTH = '2026-11-01'
const sse = (events: object[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
const start = { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [], model: MODEL, usage: { input_tokens: 150_000, output_tokens: 1 } } }
const text = (piece: string) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })
const done = [{ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 6_000 } }, { type: 'message_stop' }]

/** Përgjigja me stream; `breakAfter` e ndërpret me gabim rrjeti pas kaq copash. */
function streamResponse(chunks: string[], { breakAfter, delayMs = 0, signal }: { breakAfter?: number; delayMs?: number; signal?: AbortSignal } = {}) {
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
      // Si fetch: afati e ndërpret leximin e trupit.
      if (signal?.aborted) return controller.error(new DOMException('aborted', 'AbortError'))
      if (breakAfter !== undefined && index === breakAfter) return controller.error(new TypeError('network'))
      if (index === chunks.length) return controller.close()
      controller.enqueue(new TextEncoder().encode(chunks[index++]))
    },
  })
  return new Response(body, { status: 200 })
}

const complete = () => [sse([start, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }]), sse([text(JSON.stringify(fixture))]), sse(done)]

/** Rreshtat e ai_usage në memorie; çdo thirrje kalon një radhë mikro-detyrash, si një bazë në rrjet. */
function memoryUsage(spentEur = 0) {
  const rows = new Map<string, { eur: number; tokens: number; deleted: boolean }>()
  if (spentEur) rows.set('earlier', { eur: spentEur, tokens: 1, deleted: false })
  let next = 0
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
  const store: UsageStore = {
    async reserve(_month, eur) {
      await tick()
      const id = `r${++next}`
      rows.set(id, { eur, tokens: 0, deleted: false })
      return id
    },
    async spent(_month, except) {
      await tick()
      return [...rows].filter(([id, row]) => id !== except && !row.deleted).reduce((sum, [, row]) => sum + row.eur, 0)
    },
    async settle(id, usage) {
      await tick()
      rows.set(id, { eur: usage.eur, tokens: usage.inputTokens + usage.outputTokens, deleted: false })
    },
    async cancel(id) {
      await tick()
      rows.get(id)!.deleted = true
    },
  }
  const live = () => [...rows.values()].filter((row) => !row.deleted)
  return { store, rows, live, total: () => live().reduce((sum, row) => sum + row.eur, 0) }
}

describe('importi i programit: kufiri dhe kostoja', () => {
  it('kufiri i arritur: 429 pa thirrje te AI-ja, rezervimi hiqet', async () => {
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR)
    const callClaude = vi.fn()
    const reply = await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude })
    expect(reply).toEqual({ status: 429, body: { error: 'limit', month: { month: MONTH, spentEur: 10, limitEur: 10 } } })
    expect(callClaude).not.toHaveBeenCalled()
    expect(usage.live()).toHaveLength(1)
  })

  it('50 kërkesa paralele nuk e kapërcejnë kufirin më shumë se me një thirrje', async () => {
    // Rishikimi i E1: kufiri kontrollohej para thirrjes dhe kostoja shkruhej pas saj (deri në 140 s), ndaj
    // 50 kërkesa njëkohësisht kalonin të gjitha.
    const usage = memoryUsage()
    const callClaude = vi.fn(async () => streamResponse(complete(), { delayMs: 5 }))
    const replies = await Promise.all(Array.from({ length: 50 }, () => runImport({ month: MONTH, request: {}, usage: usage.store, callClaude })))
    const perCall = costOf({ inputTokens: 150_000, outputTokens: 6_000, cacheWriteTokens: 0, cacheReadTokens: 0 }).eur
    expect(callClaude.mock.calls.length).toBeLessThanOrEqual(AI_MONTHLY_LIMIT_EUR / AI_CALL_RESERVE_EUR)
    expect(usage.total()).toBeLessThanOrEqual(AI_MONTHLY_LIMIT_EUR + perCall)
    expect(replies.filter((reply) => reply.status === 429)).toHaveLength(50 - callClaude.mock.calls.length)
    // Asnjë rezervim nuk mbetet pas thirrjeve: rreshtat e gjallë janë kostot e vërteta.
    expect(usage.live().every((row) => row.tokens > 0)).toBe(true)
  })

  it('njëra pas tjetrës: thirrjet vazhdojnë deri te kufiri, si më parë', async () => {
    const usage = memoryUsage(9.9)
    const callClaude = vi.fn(async () => streamResponse(complete()))
    expect((await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude })).status).toBe(200)
    expect((await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude })).status).toBe(429)
  })

  it('stream-i i ndërprerë nga rrjeti: kostoja ruhet me tokenat e numëruar, gabimi ai_failed', async () => {
    // Rishikimi i E1 (SPEC: kostoja ruhet edhe kur leximi dështon pasi AI-ja ka punuar).
    const usage = memoryUsage()
    const callClaude = vi.fn(async () => streamResponse([sse([start]), sse([text('x'.repeat(9_000))]), sse(done)], { breakAfter: 2 }))
    const reply = await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude })
    const cost = costOf({ inputTokens: 150_000, outputTokens: 3_000, cacheWriteTokens: 0, cacheReadTokens: 0 })
    expect(reply).toEqual({ status: 502, body: { error: 'ai_failed', month: { month: MONTH, spentEur: Math.round(cost.eur * 100) / 100, limitEur: 10 }, costEur: cost.eur } })
    expect(usage.live()).toEqual([{ eur: cost.eur, tokens: 153_000, deleted: false }])
  })

  it('afati: kostoja ruhet, gabimi timeout', async () => {
    const usage = memoryUsage()
    const callClaude = vi.fn(async (_request: unknown, signal: AbortSignal) => streamResponse([sse([start]), sse([text('x'.repeat(300))]), sse(done)], { delayMs: 40, signal }))
    const reply = await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude, timeoutMs: 60 })
    expect(reply.status).toBe(502)
    expect(reply.body.error).toBe('timeout')
    expect(usage.live()).toEqual([expect.objectContaining({ tokens: expect.any(Number) })])
    expect(usage.live()[0].eur).toBeGreaterThan(0)
  })

  it('refuzimi para leximit dhe rrjeti para përgjigjes: pa kosto, rezervimi hiqet', async () => {
    for (const [status, error, code] of [
      [400, 'unreadable', 502],
      [413, 'too_large', 400],
      [529, 'ai_failed', 502],
    ] as const) {
      const usage = memoryUsage()
      const reply = await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => new Response('{}', { status }), log: () => {} })
      expect(reply).toEqual({ status: code, body: { error, month: { month: MONTH, spentEur: 0, limitEur: 10 } } })
      expect(usage.live()).toEqual([])
    }
    const usage = memoryUsage()
    const reply = await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => Promise.reject(new TypeError('network')) })
    expect(reply.body.error).toBe('ai_failed')
    expect(usage.live()).toEqual([])
  })

  it('leximi i plotë: drafti dhe kostoja e vërtetë në vend të rezervimit', async () => {
    const usage = memoryUsage()
    const reply = await runImport({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => streamResponse(complete()) })
    const cost = costOf({ inputTokens: 150_000, outputTokens: 6_000, cacheWriteTokens: 0, cacheReadTokens: 0 })
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({ usage: { inputTokens: 150_000, outputTokens: 6_000, costEur: cost.eur }, month: { spentEur: Math.round(cost.eur * 100) / 100 } })
    expect(usage.live()).toEqual([{ eur: cost.eur, tokens: 156_000, deleted: false }])
  })
})
