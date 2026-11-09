import { runLabel, type UsageStore } from './handler'
import { AI_CALL_RESERVE_EUR, AI_MONTHLY_LIMIT_EUR } from './logic'

// Rrjedha e një leximi me të rreme: kufiri, kostoja e vërtetë, refuzimi dhe afati.
const MONTH = '2026-11-01'
const WHEY = { is_label: true, name: 'Gold Standard 100% Whey', kind: 'protein', dose_amount: 1, dose_unit: 'scoop', serving_g: 30.4, kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 }
const ok = () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(WHEY) }], usage: { input_tokens: 1700, output_tokens: 120 } }), { status: 200 })

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

describe('leximi i etiketës', () => {
  it('fushat dhe kostoja e vërtetë në vend të rezervimit', async () => {
    const usage = memoryUsage()
    const reply = await runLabel({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => ok() })
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({ read: 8, total: 8, fields: { name: 'Gold Standard 100% Whey', proteinG: 24 }, usage: { inputTokens: 1700, outputTokens: 120 } })
    expect(usage.live().map((row) => row.eur)).toEqual([(1700 * 0.1 + 120 * 0.5) / 1e6 / 1.1165].map((eur) => Math.round(eur * 1e6) / 1e6))
  })

  it('kufiri i muajit: pa thirrje, rezervimi hiqet', async () => {
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR)
    let called = false
    const reply = await runLabel({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => ((called = true), ok()) })
    expect(reply).toMatchObject({ status: 429, body: { error: 'limit', month: { spentEur: AI_MONTHLY_LIMIT_EUR, limitEur: AI_MONTHLY_LIMIT_EUR } } })
    expect(called).toBe(false)
    expect(usage.live().map((row) => row.eur)).toEqual([AI_MONTHLY_LIMIT_EUR])
  })

  it('refuzimi para leximit dhe afati: pa kosto', async () => {
    const usage = memoryUsage()
    expect((await runLabel({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => new Response('{}', { status: 400 }) })).body).toMatchObject({ error: 'unreadable' })
    const slow = await runLabel({
      month: MONTH,
      request: {},
      usage: usage.store,
      timeoutMs: 10,
      callClaude: (_request, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    })
    expect(slow).toMatchObject({ status: 502, body: { error: 'timeout', costEur: 0 } })
    expect(usage.live()).toEqual([])
  })

  it('kërkesat paralele afër kufirit: rezervimet e njëra-tjetrës numërohen, kalon vetëm ajo që zë vend', async () => {
    // Vend për një rezervim, jo për dy.
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR - AI_CALL_RESERVE_EUR * 1.5)
    const replies = await Promise.all([1, 2, 3].map(() => runLabel({ month: MONTH, request: {}, usage: usage.store, callClaude: async () => ok() })))
    // Të shumtën një kalon; të tjerat refuzohen nga kufiri (429), jo nga një gabim tjetër. Rezervimet
    // njëkohësisht mund t'i refuzojnë të treja: kufiri nuk kalohet kurrë.
    expect(replies.filter((reply) => reply.status === 200).length).toBeLessThanOrEqual(1)
    expect(replies.every((reply) => reply.status === 200 || (reply.status === 429 && (reply.body as { error?: string }).error === 'limit'))).toBe(true)
    // Vetëm, e njëjta kërkesë zë vend.
    expect((await runLabel({ month: MONTH, request: {}, usage: memoryUsage(AI_MONTHLY_LIMIT_EUR - AI_CALL_RESERVE_EUR * 1.5).store, callClaude: async () => ok() })).status).toBe(200)
  })
})
