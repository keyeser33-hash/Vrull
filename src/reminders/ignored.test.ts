import { ignoredStreaks, type ReminderLogEntry } from './ignored'

// Heshtja vetë (V37): një lloj që injorohet 3 ditë rresht. Sot e hënë 14 dhjetor 2026.
const TODAY = '2026-12-14'
const shown = (kind: ReminderLogEntry['kind'], date: string, acted = false, meal = 'lunch'): ReminderLogEntry => ({ key: `${kind}|${date}|${meal}`, kind, date, acted })

describe('rikujtuesit e injoruar', () => {
  it('tri ditë rresht pa prekje dhe pa regjistrim: 3', () => {
    const log = ['2026-12-11', '2026-12-12', '2026-12-13'].map((date) => shown('meal', date))
    expect(ignoredStreaks(log, () => false, TODAY)).toEqual({ meal: 3, supplements: 0, water: 0 })
  })

  it('një prekje ose një regjistrim e ndërpret; dita pa njoftim gjithashtu', () => {
    const log = ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13'].map((date) => shown('meal', date, date === '2026-12-11'))
    expect(ignoredStreaks(log, () => false, TODAY).meal).toBe(2)
    expect(ignoredStreaks(log, (entry) => entry.date === '2026-12-13', TODAY).meal).toBe(0)
    expect(ignoredStreaks([shown('meal', '2026-12-13'), shown('meal', '2026-12-11')], () => false, TODAY).meal).toBe(1)
  })

  it('dita e sotme nuk numërohet; "Ndize përsëri" fillon nga e para', () => {
    const log = ['2026-12-11', '2026-12-12', '2026-12-13', TODAY].map((date) => shown('water', date))
    expect(ignoredStreaks(log, () => false, TODAY).water).toBe(3)
    expect(ignoredStreaks(log, () => false, TODAY, { water: '2026-12-13' }).water).toBe(1)
  })
})
