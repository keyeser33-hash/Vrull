import { createDatabase } from './db'
import { saveDailyState, setFollowDayState, skipCheckIn } from './daily-state'
import { readinessFor, readinessView, trainedGroups } from './readiness-view'
import { createLocalStore } from './store'
import type { TodayView } from './today'

// Gatishmëria e sotme (V50, SPEC §0.3d): rikuperimi dhe grupet e stërvitjes hyjnë vetëm kur sot ka stërvitje.
const DAY = '2026-11-19'
const CHEST_DAY = ['pectoralis_major_sternocostal', 'triceps_brachii', 'gastrocnemius']
const STATE = { date: DAY, mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['gjoksi'], choice: null } as const
const view = (mode: TodayView['mode']) =>
  ({ date: DAY, mode, workout: { recovery: 'gati', primary: CHEST_DAY } }) as unknown as TodayView

describe('gatishmëria e sotme', () => {
  it('grupet e stërvitjes nga muskujt kryesorë', () => {
    expect(trainedGroups(CHEST_DAY)).toEqual(['gjoksi', 'tricepsi', 'pulpat'])
    expect(trainedGroups([])).toEqual([])
  })

  it('shembulli i SPEC-ut: 54%, e ulët, në ditën e gjoksit', () => {
    const value = readinessFor(view('train'), { ...STATE, soreGroups: ['gjoksi'] })
    expect(value).toMatchObject({ percent: 54, level: 'low' })
    expect(value?.parts.map((part) => part.key)).toContain('recovery')
  })

  it('pa stërvitje sot: pa rikuperim dhe pa zbritjen e dhimbjes së grupit', () => {
    const value = readinessFor(view('rest'), { ...STATE, soreGroups: ['gjoksi'] })
    expect(value?.parts.map((part) => part.key)).not.toContain('recovery')
    expect(readinessFor(view('rest'), null)).toBeNull()
  })

  it('pamja e ditës ndjek gatishmërinë dhe çelësin e Pamjes', async () => {
    const store = createLocalStore(createDatabase(`ready-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date(`${DAY}T07:40:00`) })
    expect(await readinessView(store, view('train'))).toMatchObject({ state: null, readiness: null, training: true, skipped: false, follow: true, mode: 'normal' })
    await skipCheckIn(store, DAY)
    expect((await readinessView(store, view('train'))).skipped).toBe(true)
    await saveDailyState(store, DAY, { ...STATE, soreGroups: ['gjoksi'] })
    expect((await readinessView(store, view('train'))).mode).toBe('tired')
    await setFollowDayState(store, false)
    expect((await readinessView(store, view('train'))).mode).toBe('normal')
  })
})
