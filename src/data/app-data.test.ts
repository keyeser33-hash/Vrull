import { renderHook } from '@testing-library/react'

// Planifikuesi i sinkronizimit te app-i (app-data.ts): një shkrim në një tabelë e nis sinkronizimin 2 s
// më vonë; një vlerë vetëm e telefonit (`writeDevice`, p.sh. "Seanca e parë më e lehtë") s'ka çfarë të
// dërgojë dhe nuk e nis. Moduli i vërtetë, me hyrjen e imituar dhe `sync.run` të zëvendësuar: asnjë
// kërkesë rrjeti.

const USER = '11111111-1111-4111-8111-111111111111'
const SIGNED_IN = vi.hoisted(() => ({ status: 'signed_in', userId: '11111111-1111-4111-8111-111111111111' }))

vi.mock('./auth', () => ({
  createAuth: () => ({
    getState: () => SIGNED_IN,
    subscribe: () => () => {},
    start: async () => {},
  }),
}))

const awards = vi.hoisted(() => ({ award: vi.fn(async () => [] as string[]) }))
vi.mock('./achievements', async (importOriginal) => ({ ...(await importOriginal<typeof import('./achievements')>()), awardAchievements: awards.award }))

afterEach(() => {
  vi.useRealTimers()
})

it('shkrimi në tabelë nis sinkronizimin; vlera e telefonit jo', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  const { scheduler, store, sync } = await import('./app-data')
  const run = vi.spyOn(sync, 'run').mockResolvedValue({ status: 'ok', at: new Date().toISOString(), pushed: 0, pulled: 0, rejected: 0 })
  // Vetëm orët e planifikuesit: IndexedDB në memorie ecën me `setImmediate`.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  scheduler.start()
  try {
    // Sinkronizimi i nisjes.
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(1)

    await store.writeDevice('lighter-first-session', { date: '2026-11-09', on: false })
    await vi.advanceTimersByTimeAsync(2500)
    expect(run).toHaveBeenCalledTimes(1)

    await store.put('body_measurements', { date: '2026-11-09', weight_kg: 80 })
    await vi.advanceTimersByTimeAsync(1999)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
    expect(fetchSpy).not.toHaveBeenCalled()
  } finally {
    scheduler.stop()
  }
})

it('arritjet në hapje presin marrjen e parë të tabelës së tyre, pastaj jepen një herë (SPEC §0.3c)', async () => {
  const { db, scheduler, sync, useDataUpgrades } = await import('./app-data')
  const { tablePulledKey } = await import('./sync')
  vi.spyOn(sync, 'run').mockResolvedValue({ status: 'ok', at: new Date().toISOString(), pushed: 0, pulled: 0, rejected: 0 })
  await db._meta.delete(tablePulledKey('achievements'))
  awards.award.mockClear()
  const { unmount } = renderHook(() => useDataUpgrades(true))
  await scheduler.syncNow()
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(awards.award).not.toHaveBeenCalled()
  // Sinkronizimi e mori tabelën: dhënia ndodh pas tij, një herë.
  await db._meta.put({ key: tablePulledKey('achievements'), value: USER })
  await scheduler.syncNow()
  await vi.waitFor(() => expect(awards.award).toHaveBeenCalledTimes(1))
  await scheduler.syncNow()
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(awards.award).toHaveBeenCalledTimes(1)
  unmount()
})
