import { AI_MONTHLY_LIMIT_EUR, type UsageStore } from '../_shared/ai'
import { runParse } from './handler'
import type { ParseRequest } from './shared'

// Rrjedha e një mesazhi me të rreme: drafti me koston, kufiri, refuzimi dhe afati.
const MONTH = '2026-11-01'
const REQUEST: ParseRequest = {
  text: 'Mora edhe kreatinën',
  date: '2026-11-18',
  time: '22:40',
  context: { language: 'sq', meals: [], foods: [], supplements: [{ ref: 's2', name: 'Kreatinë', dose: '5 g' }] },
  history: [],
}
const DRAFT = { foods: [], water: [], supplements: [{ ref: 's2', amount: 1, meal: '', time: '', day: 'today' }], not_understood: [] }
const ok = (text = JSON.stringify(DRAFT)) =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 40, output_tokens: 90, cache_read_input_tokens: 1_800 } }), { status: 200 })

function memoryUsage(spentEur = 0) {
  const rows = new Map<string, { eur: number; deleted: boolean }>()
  if (spentEur) rows.set('earlier', { eur: spentEur, deleted: false })
  let next = 0
  const store: UsageStore = {
    reserve: async (_month, eur) => {
      const id = `r${++next}`
      rows.set(id, { eur, deleted: false })
      return id
    },
    spent: async (_month, except) => [...rows].filter(([id, row]) => id !== except && !row.deleted).reduce((sum, [, row]) => sum + row.eur, 0),
    settle: async (id, usage) => void rows.set(id, { eur: usage.eur, deleted: false }),
    cancel: async (id) => void (rows.get(id)!.deleted = true),
  }
  return { store, live: () => [...rows.values()].filter((row) => !row.deleted) }
}

describe('mesazhi i kutisë', () => {
  it('drafti, kostoja me cache-in e lexuar dhe muaji', async () => {
    const usage = memoryUsage()
    let sent: unknown
    const reply = await runParse({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async (request) => ((sent = request), ok()) })
    expect(reply.status).toBe(200)
    expect(reply.body.draft).toEqual({ foods: [], water: [], supplements: [{ ref: 's2', amount: 1, meal: null, time: null, day: 0 }], notUnderstood: [] })
    // 40 × 0,10 + 90 × 0,50 + 1 800 × 0,01 = 67 $ për milion
    const eur = Math.round((67 / 1e6 / 1.1165) * 1e6) / 1e6
    expect(reply.body).toMatchObject({ usage: { inputTokens: 40, outputTokens: 90, cacheReadTokens: 1_800, costEur: eur }, month: { month: MONTH, limitEur: AI_MONTHLY_LIMIT_EUR } })
    expect(usage.live().map((row) => row.eur)).toEqual([eur])
    expect((sent as { model: string }).model).toBe('claude-haiku-5-5')
  })

  it('kufiri i muajit: 429 pa thirrje', async () => {
    let called = false
    const reply = await runParse({ month: MONTH, request: REQUEST, usage: memoryUsage(AI_MONTHLY_LIMIT_EUR).store, callClaude: async () => ((called = true), ok()) })
    expect(reply).toMatchObject({ status: 429, body: { error: 'limit' } })
    expect(called).toBe(false)
  })

  it('përgjigja që nuk lexohet numërohet, por kthehet si gabim', async () => {
    const usage = memoryUsage()
    const reply = await runParse({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async () => ok('jo json') })
    expect(reply).toMatchObject({ status: 502, body: { error: 'unreadable' } })
    expect(usage.live()).toHaveLength(1)
  })

  it('afati dhe gabimi i API-së: pa kosto', async () => {
    const usage = memoryUsage()
    const slow = await runParse({
      month: MONTH,
      request: REQUEST,
      usage: usage.store,
      timeoutMs: 10,
      callClaude: (_request, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    })
    expect(slow).toMatchObject({ status: 502, body: { error: 'timeout', costEur: 0 } })
    expect((await runParse({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async () => new Response('{}', { status: 529 }) })).body).toMatchObject({ error: 'ai_failed' })
    expect(usage.live()).toEqual([])
  })

  it('50 mesazhe paralele te kufiri: asnjë nuk e kalon', async () => {
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR - 0.015)
    const replies = await Promise.all(Array.from({ length: 50 }, () => runParse({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async () => ok() })))
    expect(replies.filter((reply) => reply.status === 200).length).toBeLessThanOrEqual(1)
    expect(replies.every((reply) => reply.status === 200 || reply.status === 429)).toBe(true)
    expect(usage.live().reduce((sum, row) => sum + row.eur, 0)).toBeLessThanOrEqual(AI_MONTHLY_LIMIT_EUR)
  })
})
