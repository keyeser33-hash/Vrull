import { createRestTimer, remainingSeconds } from './rest-timer'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

function setup() {
  let now = 1_000_000
  const storage = memoryStorage()
  const alarm = { schedule: vi.fn(), cancel: vi.fn() }
  const make = () => createRestTimer({ key: 'rest:s1', now: () => now, storage, alarm })
  return { make, alarm, tick: (ms: number) => (now += ms), now: () => now }
}

describe('timer-i i pushimit', () => {
  it('numëron poshtë nga sekondat e pushimit dhe planifikon alarmin në fund', () => {
    const { make, alarm, tick, now } = setup()
    const timer = make()
    timer.start(90, 'Pushimi mbaroi')
    expect(remainingSeconds(timer.get(), now())).toBe(90)
    expect(alarm.schedule).toHaveBeenCalledWith(new Date(now() + 90_000), 'Pushimi mbaroi')
    tick(30_500)
    expect(remainingSeconds(timer.get(), now())).toBe(60)
    tick(70_000)
    expect(remainingSeconds(timer.get(), now())).toBe(0)
  })

  it('+15 s dhe −15 s ndryshojnë fundin dhe totalin; alarmi lëviz me to', () => {
    const { make, alarm, now } = setup()
    const timer = make()
    timer.start(90, 'Pushimi mbaroi')
    timer.add(15)
    expect(timer.get()).toEqual({ endsAt: now() + 105_000, totalSeconds: 105 })
    expect(alarm.schedule).toHaveBeenLastCalledWith(new Date(now() + 105_000), 'Pushimi mbaroi')
    timer.add(-200)
    expect(remainingSeconds(timer.get(), now())).toBe(0)
  })

  it('"Kapërce" e ndal dhe anulon alarmin', () => {
    const { make, alarm } = setup()
    const timer = make()
    const listener = vi.fn()
    timer.subscribe(listener)
    timer.start(60, 'Pushimi mbaroi')
    timer.skip()
    expect(timer.get()).toBeNull()
    expect(alarm.cancel).toHaveBeenCalled()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('kur mbaron koha, pastrohet pa anuluar njoftimin që po vjen', () => {
    const { make, alarm } = setup()
    const timer = make()
    timer.start(60, 'Pushimi mbaroi')
    timer.finish()
    expect(timer.get()).toBeNull()
    expect(alarm.cancel).not.toHaveBeenCalled()
  })

  it('mbijeton rihapjen e app-it', () => {
    const { make, now } = setup()
    make().start(60, 'Pushimi mbaroi')
    expect(make().get()).toEqual({ endsAt: now() + 60_000, totalSeconds: 60 })
  })
})
