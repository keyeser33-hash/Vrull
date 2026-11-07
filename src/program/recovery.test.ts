import { MUSCLE_GROUPS } from './muscles'
import { recoveryFor, recoveryStatus } from './recovery'

const NOW = new Date('2026-12-14T18:00:00.000Z')
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString()

describe('gjendja e rikuperimit (§11)', () => {
  it('< 48 orë "I lodhur", 48–72 "Pothuajse gati", > 72 "Gati"', () => {
    expect(recoveryStatus(47.9)).toBe('i_lodhur')
    expect(recoveryStatus(48)).toBe('pothuajse_gati')
    expect(recoveryStatus(72)).toBe('pothuajse_gati')
    expect(recoveryStatus(72.1)).toBe('gati')
    expect(recoveryStatus(null)).toBe('gati')
  })

  it('grupet e muskujve kryesorë të sotëm, me radhën e tyre te stërvitja, nga seanca e fundit ku ishin kryesorë', () => {
    const today = ['pectoralis_major_sternocostal', 'pectoralis_major_clavicular', 'triceps_brachii', 'gastrocnemius', 'soleus']
    // Jo me radhë kohe; pectoralis_minor nuk punohet sot si kryesor, ndaj nuk e ndryshon Gjoksin.
    const sessions = [
      { endedAt: hoursAgo(96), primaryKeys: ['soleus', 'deltoid_lateral'] },
      { endedAt: hoursAgo(168), primaryKeys: ['pectoralis_major_sternocostal', 'triceps_brachii', 'gastrocnemius', 'soleus'] },
      { endedAt: hoursAgo(30), primaryKeys: ['latissimus_dorsi', 'biceps_brachii', 'pectoralis_minor'] },
    ]
    expect(
      recoveryFor(MUSCLE_GROUPS, today, sessions, NOW).map(({ group, hours, status }) => [group.name, hours, status]),
    ).toEqual([
      ['Gjoksi', 168, 'gati'],
      ['Tricepsi', 168, 'gati'],
      ['Pulpat', 96, 'gati'],
    ])
  })

  it('pa asnjë seancë: "Gati", pa orë', () => {
    expect(recoveryFor(MUSCLE_GROUPS, ['trapezius'], [], NOW)).toEqual([
      { group: MUSCLE_GROUPS.find((group) => group.id === 'trapezi'), hours: null, status: 'gati' },
    ])
  })
})
