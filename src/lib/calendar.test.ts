import { localDate, localDay, shiftDate, weekRange } from './calendar'

// Datat e telefonit: `logged_at` ruhet në UTC (toISOString), java dhe dita lexohen në orën lokale.
describe('kalendari lokal', () => {
  beforeAll(() => {
    vi.stubEnv('TZ', 'Europe/Tirane')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('një çast UTC lexohet në ditën lokale: e hëna 00:30 në Tiranë mbetet e hënë', () => {
    const mondayNight = new Date(2026, 11, 7, 0, 30)
    expect(mondayNight.toISOString()).toBe('2026-12-06T23:30:00.000Z')
    expect(localDay(mondayNight.toISOString())).toBe('2026-12-07')
    expect(localDate(mondayNight)).toBe('2026-12-07')
  })

  it('dita para dhe pas, edhe mbi ndërrimin e orës verore dhe të muajit', () => {
    expect(shiftDate('2026-03-29', -1)).toBe('2026-03-28')
    expect(shiftDate('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftDate('2026-12-01', -1)).toBe('2026-11-30')
    expect(shiftDate('2026-11-17', -7)).toBe('2026-11-10')
  })

  it('java kalendarike nga e hëna, dhe java e kaluar me offset -1', () => {
    expect(weekRange(new Date(2026, 11, 9, 12))).toEqual(['2026-12-07', '2026-12-14'])
    expect(weekRange(new Date(2026, 11, 13, 23, 59))).toEqual(['2026-12-07', '2026-12-14'])
    expect(weekRange(new Date(2026, 11, 7, 0, 0))).toEqual(['2026-12-07', '2026-12-14'])
    expect(weekRange(new Date(2026, 11, 9), -1)).toEqual(['2026-11-30', '2026-12-07'])
    // Ndërrimi i orës (29.03.2026): java mbetet shtatë ditë.
    expect(weekRange(new Date(2026, 2, 31))).toEqual(['2026-03-30', '2026-04-06'])
    expect(weekRange(new Date(2026, 2, 29, 12))).toEqual(['2026-03-23', '2026-03-30'])
  })
})
