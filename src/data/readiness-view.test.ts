import { createDatabase } from './db'
import { saveDailyState, setFollowDayState, skipCheckIn } from './daily-state'
import { checkInContext, readinessView, trainedGroups } from './readiness-view'
import { createLocalStore } from './store'
import type { TodayView } from './today'

// Gatishmëria e sotme (V50, SPEC §0.3d): rikuperimi dhe grupet e stërvitjes hyjnë vetëm kur sot ka stërvitje, në çastin
// e check-in-it; pas tij gatishmëria llogaritet vetëm nga rreshti.
const DAY = '2026-11-19'
const CHEST_DAY = ['pectoralis_major_sternocostal', 'triceps_brachii', 'gastrocnemius']
const STATE = { mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['gjoksi'] } as const
const view = (mode: TodayView['mode']) =>
  ({ date: DAY, mode, workout: { recovery: 'gati', primary: CHEST_DAY } }) as unknown as TodayView

const storeFor = () => createLocalStore(createDatabase(`ready-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date(`${DAY}T07:40:00`) })

describe('gatishmëria e sotme', () => {
  it('grupet e stërvitjes nga muskujt kryesorë', () => {
    expect(trainedGroups(CHEST_DAY)).toEqual(['gjoksi', 'tricepsi', 'pulpat'])
    expect(trainedGroups([])).toEqual([])
  })

  it('shembulli i SPEC-ut: 54%, e ulët, në ditën e gjoksit', async () => {
    const store = storeFor()
    const context = checkInContext(view('train'), STATE)
    expect(context).toEqual({ recovery: 'gati', soreTrained: true })
    await saveDailyState(store, DAY, { ...STATE, soreGroups: ['gjoksi'] }, context)
    const value = (await readinessView(store, DAY)).readiness
    expect(value).toMatchObject({ percent: 54, level: 'low' })
    expect(value?.parts.map((part) => part.key)).toContain('recovery')
  })

  it('pa stërvitje sot: pa rikuperim dhe pa zbritjen e dhimbjes së grupit', async () => {
    const store = storeFor()
    const context = checkInContext(view('rest'), STATE)
    expect(context).toEqual({ recovery: null, soreTrained: false })
    await saveDailyState(store, DAY, { ...STATE, soreGroups: ['gjoksi'] }, context)
    expect((await readinessView(store, DAY)).readiness?.parts.map((part) => part.key)).not.toContain('recovery')
  })

  it('dhimbje në një grup që nuk stërvitet sot nuk zbret pikët', () => {
    expect(checkInContext(view('train'), { soreness: 2, soreGroups: ['shpina'] })).toEqual({ recovery: 'gati', soreTrained: false })
    expect(checkInContext(view('session'), { soreness: 0, soreGroups: [] })).toEqual({ recovery: 'gati', soreTrained: false })
  })

  it('përqindja vjen vetëm nga rreshti: stërvitja e shtyrë ose e mbyllur nuk e ndryshon', async () => {
    const store = storeFor()
    await saveDailyState(store, DAY, { ...STATE, soreGroups: ['gjoksi'] }, checkInContext(view('train'), STATE))
    const before = (await readinessView(store, DAY)).readiness?.percent
    expect(before).toBe(54)
    // Rreshti mban rikuperimin; pamja e Sot ndryshon, rreshti jo.
    expect((await readinessView(store)).readiness?.percent).toBe(before)
  })

  it('pamja e ditës ndjek gatishmërinë dhe çelësin e Pamjes', async () => {
    const store = storeFor()
    expect(await readinessView(store, DAY)).toMatchObject({ state: null, readiness: null, skipped: false, follow: true, mode: 'normal' })
    await skipCheckIn(store, DAY)
    expect((await readinessView(store, DAY)).skipped).toBe(true)
    await saveDailyState(store, DAY, { ...STATE, soreGroups: ['gjoksi'] }, checkInContext(view('train'), STATE))
    expect((await readinessView(store, DAY)).mode).toBe('tired')
    await setFollowDayState(store, false)
    expect((await readinessView(store, DAY)).mode).toBe('normal')
  })
})
