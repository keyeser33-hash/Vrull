import { AI_MONTHLY_LIMIT_EUR, costOf, limitFrom, limitReached, monthStart, tokensOf, withBudget, type UsageStore } from './ai'

// Kostoja dhe kufiri i përbashkët i AI-së (V42): tokenat me cache-in, rezervimi para punës, kërkesat paralele.
const MONTH = '2026-11-01'
const HAIKU = 'claude-haiku-5-5'
const reply = (usage: Record<string, number>) => new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], usage }), { status: 200 })

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

const run = (usage: UsageStore, call: () => Promise<Response>, extra: Partial<Parameters<typeof withBudget>[0]> = {}) =>
  withBudget({ month: MONTH, model: HAIKU, limitEur: AI_MONTHLY_LIMIT_EUR, reserveEur: 0.01, usage, call: () => call(), tag: 'prova', ...extra })

describe('kostoja', () => {
  it('Haiku 5.5: hyrja, dalja, shkrimi dhe leximi i cache-it me çmimet e veta', () => {
    const tokens = { inputTokens: 300, outputTokens: 400, cacheWriteTokens: 2_000, cacheReadTokens: 0 }
    // 300 × 0,10 + 400 × 0,50 + 2 000 × 0,125 = 480 $ për milion
    expect(costOf(HAIKU, tokens).usd).toBeCloseTo(480 / 1e6, 9)
    // I njëjti mesazh me cache-in e lexuar: 300 × 0,10 + 400 × 0,50 + 2 000 × 0,01 = 250
    expect(costOf(HAIKU, { ...tokens, cacheWriteTokens: 0, cacheReadTokens: 2_000 }).usd).toBeCloseTo(250 / 1e6, 9)
    expect(costOf(HAIKU, tokens).eur).toBeCloseTo(480 / 1e6 / 1.1165, 6)
  })

  it('Sonnet 5.5 dhe modeli i panjohur', () => {
    expect(costOf('claude-sonnet-5-5', { inputTokens: 1_000, outputTokens: 1_000, cacheWriteTokens: 0, cacheReadTokens: 1_000 }).usd).toBeCloseTo(12.1 / 1e3, 9)
    expect(() => costOf('claude-x', { inputTokens: 1, outputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0 })).toThrow()
  })

  it('tokenat nga përgjigja, me cache-in; mungesa = 0', () => {
    expect(tokensOf({ usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } })).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cacheWriteTokens: 30,
      cacheReadTokens: 40,
    })
    expect(tokensOf(null)).toEqual({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 })
  })

  it('muaji sipas orës së Tiranës', () => {
    expect(monthStart(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01')
    expect(monthStart(new Date('2026-11-30T22:30:00Z'))).toBe('2026-11-01')
  })
})

describe('kufiri', () => {
  it('kostoja e vërtetë në vend të rezervimit, me cache-in', async () => {
    const usage = memoryUsage()
    const outcome = await run(usage.store, async () => reply({ input_tokens: 300, output_tokens: 400, cache_creation_input_tokens: 2_000 }))
    expect(outcome).toMatchObject({ kind: 'done', failure: null, tokens: { cacheWriteTokens: 2_000 } })
    expect(usage.live().map((row) => row.eur)).toEqual([Math.round((480 / 1e6 / 1.1165) * 1e6) / 1e6])
  })

  it('te kufiri: pa thirrje, rezervimi hiqet', async () => {
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR)
    let called = false
    const outcome = await run(usage.store, async () => ((called = true), reply({ input_tokens: 1, output_tokens: 1 })))
    expect(outcome).toEqual({ kind: 'limit', month: { month: MONTH, spentEur: AI_MONTHLY_LIMIT_EUR, limitEur: AI_MONTHLY_LIMIT_EUR } })
    expect(called).toBe(false)
    expect(usage.live().map((row) => row.eur)).toEqual([AI_MONTHLY_LIMIT_EUR])
  })

  it('"u arrit" kur nuk mbetet as për thirrjen më të vogël; numrat me presje nuk e kalojnë kufirin', async () => {
    expect([limitReached(9.98, 10), limitReached(9.99, 10), limitReached(9.995, 10), limitReached(10, 10)]).toEqual([false, false, true, true])
    expect(limitReached(0.1 + 0.2, 0.31)).toBe(false)
    // withBudget me rezervimin 0,01 € refuzon pikërisht kur limitReached thotë "u arrit".
    for (const spent of [9.98, 9.99, 9.995]) {
      const outcome = await run(memoryUsage(spent).store, async () => reply({ input_tokens: 1, output_tokens: 1 }))
      expect(outcome.kind === 'limit').toBe(limitReached(spent, AI_MONTHLY_LIMIT_EUR))
    }
  })

  it('kufiri i personit vjen nga thirrësi', async () => {
    const outcome = await run(memoryUsage(12).store, async () => reply({ input_tokens: 1, output_tokens: 1 }), { limitEur: 40 })
    expect(outcome).toMatchObject({ kind: 'done', month: { limitEur: 40 } })
  })

  it('refuzimi 400 dhe afati: pa kosto', async () => {
    const usage = memoryUsage()
    expect(await run(usage.store, async () => new Response('{}', { status: 400 }))).toMatchObject({ kind: 'done', failure: 'refused' })
    const slow = await run(usage.store, () => new Promise<Response>(() => {}), {
      timeoutMs: 10,
      call: (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    })
    expect(slow).toMatchObject({ kind: 'done', failure: 'timeout', cost: { eur: 0 } })
    expect(usage.live()).toEqual([])
  })

  it('rezervimi dështon: pa thirrje', async () => {
    const usage = memoryUsage()
    usage.store.reserve = async () => Promise.reject(new Error('baza'))
    let called = false
    expect(await run(usage.store, async () => ((called = true), reply({})))).toEqual({ kind: 'store_failed' })
    expect(called).toBe(false)
  })

  it('dy kërkesa paralele me vend për një: rezervimi i tjetrës numërohet', async () => {
    const outcomes = await Promise.all([1, 2].map(() => run(memoryUsage(AI_MONTHLY_LIMIT_EUR - 0.015).store, async () => reply({ input_tokens: 1, output_tokens: 1 }))))
    // Secila me bazën e vet: vendi mjafton për të dyja.
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['done', 'done'])
    const shared = memoryUsage(AI_MONTHLY_LIMIT_EUR - 0.015)
    const both = await Promise.all([1, 2].map(() => run(shared.store, async () => reply({ input_tokens: 1, output_tokens: 1 }))))
    expect(both.filter((outcome) => outcome.kind === 'done').length).toBeLessThanOrEqual(1)
  })

  it('50 kërkesa paralele afër kufirit nuk e kalojnë kurrë', async () => {
    // Vend për një rezervim, jo për dy.
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR - 0.015)
    const outcomes = await Promise.all(Array.from({ length: 50 }, () => run(usage.store, async () => reply({ input_tokens: 1_000, output_tokens: 500 }))))
    expect(outcomes.filter((outcome) => outcome.kind === 'done').length).toBeLessThanOrEqual(1)
    expect(outcomes.every((outcome) => outcome.kind === 'done' || outcome.kind === 'limit')).toBe(true)
    expect(usage.live().reduce((sum, row) => sum + row.eur, 0)).toBeLessThanOrEqual(AI_MONTHLY_LIMIT_EUR)
  })
})

describe('kufiri i personit', () => {
  it('nga ai_limits; pa rresht 10 €', () => {
    expect(limitFrom([{ monthly_eur: '40.00' }])).toBe(40)
    expect(limitFrom([{ monthly_eur: 0 }])).toBe(0)
    expect(limitFrom([])).toBe(10)
    expect(limitFrom(null)).toBe(10)
    expect(limitFrom([{ monthly_eur: null }])).toBe(10)
  })
})
