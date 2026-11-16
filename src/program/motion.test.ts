import { describe, expect, it } from 'vitest'
import { cycleMs, DEFAULT_TEMPO, HOLD_MS, motionPosition, tempoOf, tempoParts, timeForPosition } from './motion'

// Lëvizja e ushtrimit (SPEC §0.3g): faza nga koha dhe tempo, pa UI. 0 = foto e fillimit, 1 = e fundit.

const t = { downS: 2, upS: 1 }

describe('tempoOf', () => {
  it('merr tempon e udhëzuesit; pa udhëzues ose me mbajtje, 2 dhe 1', () => {
    expect(tempoOf({ eccentricS: 3, concentricS: 2 })).toEqual({ downS: 3, upS: 2 })
    expect(tempoOf(null)).toEqual(DEFAULT_TEMPO)
    expect(DEFAULT_TEMPO).toEqual({ downS: 2, upS: 1 })
  })
})

describe('motionPosition', () => {
  it('nis te fillimi, arrin fundin pas fazës ekscentrike dhe mban pak', () => {
    expect(motionPosition(0, t)).toBe(0)
    expect(motionPosition(1000, t)).toBeCloseTo(0.5, 5)
    expect(motionPosition(2000, t)).toBeCloseTo(1, 5)
    expect(motionPosition(2000 + HOLD_MS / 2, t)).toBe(1)
  })
  it('kthehet te fillimi në kohën e fazës koncentrike', () => {
    const back = 2000 + HOLD_MS
    expect(motionPosition(back, t)).toBeCloseTo(1, 5)
    expect(motionPosition(back + 500, t)).toBeCloseTo(0.5, 5)
    expect(motionPosition(back + 1000, t)).toBeCloseTo(0, 5)
    expect(motionPosition(back + 1000 + HOLD_MS / 2, t)).toBe(0)
  })
  it('përsëritet çdo cikël dhe nuk del jashtë 0–1', () => {
    const cycle = cycleMs(t)
    expect(cycle).toBe(2000 + 1000 + 2 * HOLD_MS)
    expect(motionPosition(cycle + 1000, t)).toBeCloseTo(0.5, 5)
    for (let ms = -500; ms < 4 * cycle; ms += 37) {
      const p = motionPosition(ms, t)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })
  it('një tempo më e ngadaltë zgjat më shumë', () => {
    expect(motionPosition(1000, { downS: 4, upS: 1 })).toBeLessThan(0.2)
    expect(cycleMs({ downS: 4, upS: 1 })).toBe(5000 + 2 * HOLD_MS)
  })
})

describe('timeForPosition', () => {
  it('kthen kohën në fazën e parë ku foto është në atë pozicion (rinisja pas rrëshqitjes)', () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.8, 1]) expect(motionPosition(timeForPosition(p, t), t)).toBeCloseTo(p, 5)
  })
  it('kufizon pozicionin jashtë 0–1', () => {
    expect(timeForPosition(-1, t)).toBe(0)
    expect(timeForPosition(2, t)).toBeCloseTo(2000, 5)
  })
})

describe('tempoParts', () => {
  it('jep sekondat e tempos për tekstin "Poshtë 2 s · lart 1 s"', () => {
    expect(tempoParts({ eccentricS: 2, concentricS: 1 })).toEqual({ down: 2, up: 1 })
    expect(tempoParts(null)).toBeNull()
  })
})
