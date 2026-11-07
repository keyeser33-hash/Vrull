import { createSyncScheduler } from './scheduler'
import type { SyncResult } from './sync'

const ok = (at = '2026-11-30T08:00:00.000Z'): SyncResult => ({ status: 'ok', at, pushed: 0, pulled: 0, rejected: 0 })

function setup(options: { online?: boolean } = {}) {
  let online = options.online ?? true
  const run = vi.fn(async () => ok())
  let writeListener: (() => void) | null = null
  const events = new EventTarget()
  const scheduler = createSyncScheduler({
    sync: { run },
    onLocalWrite: (listener) => {
      writeListener = listener
      return () => {
        writeListener = null
      }
    },
    isOnline: () => online,
    events,
    debounceMs: 2000,
    intervalMs: 300_000,
  })
  return {
    scheduler,
    run,
    events,
    write: () => writeListener?.(),
    setOnline: (value: boolean) => {
      online = value
    },
  }
}

describe('planifikuesi i sinkronizimit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sinkronizon në nisje', async () => {
    const { scheduler, run } = setup()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledOnce()
    scheduler.stop()
  })

  it('pas shkrimeve pret 2 s qetësi dhe sinkronizon një herë', async () => {
    const { scheduler, run, write } = setup()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    run.mockClear()

    write()
    await vi.advanceTimersByTimeAsync(1500)
    write()
    await vi.advanceTimersByTimeAsync(1500)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(600)
    expect(run).toHaveBeenCalledOnce()
    scheduler.stop()
  })

  it('pa internet nuk thërret serverin dhe e tregon në gjendje', async () => {
    const { scheduler, run } = setup({ online: false })
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).not.toHaveBeenCalled()
    expect(scheduler.getStatus()).toMatchObject({ syncing: false, last: { status: 'offline' } })
    scheduler.stop()
  })

  it('kur kthehet rrjeti sinkronizon menjëherë', async () => {
    const { scheduler, run, events, setOnline } = setup({ online: false })
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    setOnline(true)
    events.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledOnce()
    scheduler.stop()
  })

  it('sinkronizon edhe kur app-i kthehet në plan të parë dhe çdo 5 minuta', async () => {
    const { scheduler, run, events } = setup()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    run.mockClear()
    events.dispatchEvent(new Event('resume'))
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(300_000)
    expect(run).toHaveBeenCalledTimes(2)
    scheduler.stop()
  })

  it('njofton dëgjuesit për gjendjen gjatë dhe pas sinkronizimit', async () => {
    const { scheduler } = setup()
    const seen: boolean[] = []
    scheduler.subscribe(() => seen.push(scheduler.getStatus().syncing))
    await scheduler.syncNow()
    expect(seen).toEqual([true, false])
    expect(scheduler.getStatus().last).toEqual(ok())
  })

  it('pas ndalimit nuk sinkronizon më', async () => {
    const { scheduler, run, write } = setup()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    scheduler.stop()
    run.mockClear()
    write()
    await vi.advanceTimersByTimeAsync(400_000)
    expect(run).not.toHaveBeenCalled()
  })
})
