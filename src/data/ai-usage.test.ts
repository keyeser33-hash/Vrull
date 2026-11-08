import { aiMonth, monthKey } from './ai-usage'
import { createDatabase } from './db'
import { createLocalStore } from './store'
import { CLEAN } from './tables'

// Përdorimi i AI-së këtë muaj (V2-E1-11): rreshtat vijnë nga serveri me sinkronizimin; telefoni vetëm i lexon.

const USER = '11111111-1111-4111-8111-111111111111'

function setup(now = new Date(2026, 10, 8, 10, 0)) {
  const db = createDatabase(`ai-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => USER, now: () => now })
  /** Një rresht siç vjen nga serveri (i sinkronizuar, pa ndryshime që presin). */
  const pulled = (month: string, feature: string, cost: number) =>
    db.ai_usage.put({
      id: crypto.randomUUID(),
      user_id: USER,
      created_at: '2026-11-08T09:00:00Z',
      updated_at: '2026-11-08T09:00:00Z',
      deleted_at: null,
      server_updated_at: '2026-11-08T09:00:00Z',
      month,
      feature,
      model: 'claude-sonnet-5-5',
      input_tokens: 120000,
      output_tokens: 6000,
      cost_usd: cost * 1.1165,
      cost_eur: cost,
      _dirty: CLEAN,
    })
  return { store, pulled }
}

describe('përdorimi i AI-së', () => {
  it('muaji i telefonit, si dita e parë', () => {
    expect(monthKey(new Date(2026, 10, 30, 23, 59))).toBe('2026-11-01')
    expect(monthKey(new Date(2027, 0, 1))).toBe('2027-01-01')
  })

  it('shuma e këtij muaji sipas përdorimit, me sa mbetet deri më 1 dhjetor', async () => {
    const { store, pulled } = setup()
    await pulled('2026-11-01', 'program_pdf', 0.27)
    await pulled('2026-11-01', 'program_pdf', 0.31)
    await pulled('2026-10-01', 'program_pdf', 4)
    const month = await aiMonth(store)
    expect(month).toMatchObject({ month: '2026-11-01', spentEur: 0.58, limitEur: 10, remainingEur: 9.42, reached: false, byFeature: { program_pdf: 0.58 } })
    expect(month.resetsOn).toEqual(new Date(2026, 11, 1))
  })

  it('pa asnjë përdorim: zero nga €10', async () => {
    const { store } = setup()
    expect(await aiMonth(store)).toMatchObject({ spentEur: 0, remainingEur: 10, reached: false, byFeature: {} })
  })

  it('te €10 kufiri është arritur dhe nuk mbetet asgjë', async () => {
    const { store, pulled } = setup(new Date(2026, 11, 20))
    await pulled('2026-12-01', 'program_pdf', 9.8)
    await pulled('2026-12-01', 'program_pdf', 0.31)
    expect(await aiMonth(store)).toMatchObject({ spentEur: 10.11, remainingEur: 0, reached: true })
    expect((await aiMonth(store)).resetsOn).toEqual(new Date(2027, 0, 1))
  })
})
