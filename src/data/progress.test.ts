import { createDatabase } from './db'
import { measurementsOn, metricHistory, progressView, saveMeasurement } from './progress'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'
const setup = () => createLocalStore(createDatabase(`progress-${crypto.randomUUID()}`), { userId: () => USER })

describe('matjet e progresit', () => {
  it('matja e një dite ruhet në një rresht; fushat e tjera mbeten; null e heq vlerën', async () => {
    const store = setup()
    await saveMeasurement(store, '2026-12-08', { weight_kg: 80.4, waist_cm: 84 })
    await saveMeasurement(store, '2026-12-08', { arm_left_cm: 38.5, waist_cm: null })
    expect(await store.where('body_measurements', 'date', '2026-12-08')).toHaveLength(1)
    expect(await measurementsOn(store, '2026-12-08')).toMatchObject({ weight_kg: 80.4, arm_left_cm: 38.5, waist_cm: null })
  })

  it('pamja: pesha me mesataren 7-ditore dhe ndryshimin në 4 javë; perimetrat me vlerën e fundit', async () => {
    const store = setup()
    for (const [date, weight] of [['2026-11-01', 82], ['2026-11-03', 82.4], ['2026-12-01', 80.2], ['2026-12-05', 80.6], ['2026-12-08', 80]] as const) {
      await saveMeasurement(store, date, { weight_kg: weight })
    }
    await saveMeasurement(store, '2026-11-03', { waist_cm: 86 })
    await saveMeasurement(store, '2026-12-08', { waist_cm: 84.5 })
    const view = await progressView(store)
    expect(view.weight.latest).toEqual({ date: '2026-12-08', value: 80.3 })
    expect(view.weight.change).toEqual({ from: { date: '2026-11-03', value: 82.2 }, delta: -1.9 })
    expect(view.weight.points).toHaveLength(5)
    const waist = view.metrics.find((entry) => entry.metric.key === 'waist_cm')!
    expect(waist).toMatchObject({ latest: { date: '2026-12-08', value: 84.5 }, change: { delta: -1.5 } })
    expect(view.metrics.find((entry) => entry.metric.key === 'neck_cm')).toMatchObject({ latest: null, change: null })
    expect((await metricHistory(store, 'waist_cm')).map((point) => point.value)).toEqual([86, 84.5])
  })
})
