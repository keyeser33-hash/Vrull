import { checkInSkipped, readDailyState } from './daily-state'
import { readCheckInDraft, saveCheckInAnswers } from './checkin-draft'

// Gjendja e ditës e plotësuar pjesërisht (V57): skica në telefon, rreshti vetëm kur janë të katërta.

const USER = '11111111-1111-4111-8111-111111111111'
const DAY = '2026-11-08'
const none = () => ({ recovery: null, soreTrained: false })

async function freshStore() {
  const { createDatabase } = await import('./db')
  const { createLocalStore } = await import('./store')
  return createLocalStore(createDatabase(`draft-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date(2026, 10, 8, 10, 0) })
}

describe('skica e gjendjes së ditës', () => {
  it('përgjigjet e pjesshme ruhen në telefon dhe nuk shkruajnë rresht', async () => {
    const store = await freshStore()
    expect(await saveCheckInAnswers(store, DAY, { mood: 4 }, none)).toBeNull()
    expect(await readCheckInDraft(store, DAY)).toEqual({ mood: 4 })
    expect(await readDailyState(store, DAY)).toBeNull()
    expect(await checkInSkipped(store, DAY)).toBe(false)
  })

  it('një ditë tjetër fillon bosh', async () => {
    const store = await freshStore()
    await saveCheckInAnswers(store, DAY, { mood: 4 }, none)
    expect(await readCheckInDraft(store, '2026-11-09')).toEqual({})
  })

  it('me të katërta shkruhet rreshti me gatishmërinë dhe skica pastrohet', async () => {
    const store = await freshStore()
    const state = await saveCheckInAnswers(store, DAY, { mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 0 }, none)
    expect(state).toMatchObject({ mood: 3, energy: 2, sleepMinutes: 360, soreness: 0 })
    expect((await readDailyState(store, DAY))?.readiness).toBe(state?.readiness)
    expect(await readCheckInDraft(store, DAY)).toEqual({})
  })
})
