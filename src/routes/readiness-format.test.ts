import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { averagePercent, chipsOf, dayBars, groupsOf, lastDays, profileSleepMinutes, SORE_CHIPS, stepSleep } from './readiness-format'

describe('çipat e grupeve me dhimbje', () => {
  it('çdo grup i muskujve bie te një çip, përveç qafës, dhe asnjë id nuk është e panjohur', () => {
    const ids = new Set(MUSCLE_GROUPS.map((group) => group.id))
    const chipped: string[] = SORE_CHIPS.flatMap((chip) => [...chip.groups])
    expect(chipped.every((id) => ids.has(id))).toBe(true)
    expect(new Set(chipped).size).toBe(chipped.length)
    expect([...ids].filter((id) => !chipped.includes(id))).toEqual(['qafa'])
  })

  it('ruan id-të e grupeve sipas çipave', () => {
    expect(groupsOf(['gjoksi'])).toEqual(['gjoksi'])
    expect(groupsOf(['krahet', 'shpina'])).toEqual(['shpina', 'mesi', 'trapezi', 'bicepsi', 'tricepsi', 'parakrahet'])
    expect(groupsOf(['kembet'])).toEqual(['kuadricepsi', 'kofshet-e-pasme', 'pulpat', 'vithet', 'aduktoret'])
    expect(groupsOf([])).toEqual([])
  })

  it('çipat e ndezur nga grupet e ruajtura', () => {
    expect(chipsOf(['gjoksi', 'bicepsi', 'tricepsi', 'parakrahet'])).toEqual(['gjoksi', 'krahet'])
    expect(chipsOf(['trapezi'])).toEqual(['shpina'])
    expect(chipsOf([])).toEqual([])
  })
})

describe('gjumi', () => {
  it('vlera e parë nga ora e gjumit dhe e zgjimit, mbi mesnatën, në hapa 30 min', () => {
    expect(profileSleepMinutes('01:10', '07:10')).toBe(360)
    expect(profileSleepMinutes('23:00', '07:00')).toBe(480)
    expect(profileSleepMinutes('23:10', '07:00')).toBe(480)
    expect(profileSleepMinutes('07:00', '07:00')).toBe(0)
  })

  it('hapi −0,5 / +0,5 mbetet brenda 0–14 orë', () => {
    expect(stepSleep(360, 1)).toBe(390)
    expect(stepSleep(0, -1)).toBe(0)
    expect(stepSleep(840, 1)).toBe(840)
  })
})

describe('14 ditët', () => {
  it('nga më e vjetra te sot, edhe mbi kufirin e muajit', () => {
    const days = lastDays('2026-11-09')
    expect(days).toHaveLength(14)
    expect(days[0]).toBe('2026-10-27')
    expect(days[13]).toBe('2026-11-09')
  })

  it('sot ka vlerën e tanishme, jo të ruajtur; dita pa check-in mbetet bosh; mesatarja anashkalon boshet', () => {
    const stored = new Map([
      ['2026-11-09', { readiness: 10 }],
      ['2026-11-08', { readiness: 70 }],
      ['2026-11-07', { readiness: null }],
    ])
    const bars = dayBars('2026-11-09', stored, 54)
    expect(bars.at(-1)).toEqual({ date: '2026-11-09', percent: 54, today: true })
    expect(bars.at(-2)?.percent).toBe(70)
    expect(bars.at(-3)?.percent).toBeNull()
    expect(averagePercent(bars)).toBe(62)
    expect(averagePercent(dayBars('2026-11-09', new Map(), null))).toBeNull()
  })
})
