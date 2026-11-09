import { describe, expect, it } from 'vitest'
import { dayMode, lighterSlots, readiness, readinessLevel, sleepScore, type CheckIn, type Readiness } from './readiness'

type Scale = 1 | 2 | 3 | 4 | 5
type Soreness = 0 | 1 | 2 | 3 | 4

const base: CheckIn = { mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['gjoksi'] }

describe('sleepScore', () => {
  it('ndjek pikat e orëve me vijë të drejtë', () => {
    // me cilësi 5 (100) pjesa e orëve del nga (rezultati - 30) / 0,7
    const hoursPart = (minutes: number) => (sleepScore(minutes, 5) - 30) / 0.7
    expect(hoursPart(0)).toBeCloseTo(20)
    expect(hoursPart(240)).toBeCloseTo(20)
    expect(hoursPart(300)).toBeCloseTo(40)
    expect(hoursPart(360)).toBeCloseTo(65)
    expect(hoursPart(420)).toBeCloseTo(85)
    expect(hoursPart(480)).toBeCloseTo(100)
    expect(hoursPart(840)).toBeCloseTo(100)
    expect(hoursPart(330)).toBeCloseTo(52.5)
    expect(hoursPart(450)).toBeCloseTo(92.5)
  })

  it('peshon cilësinë 30%', () => {
    expect(sleepScore(360, 3)).toBeCloseTo(60.5)
    expect(sleepScore(480, 1)).toBeCloseTo(70)
    expect(sleepScore(240, 1)).toBeCloseTo(14)
  })
})

describe('readinessLevel', () => {
  it('kufijtë 60 dhe 85', () => {
    expect(readinessLevel(0)).toBe('low')
    expect(readinessLevel(59)).toBe('low')
    expect(readinessLevel(60)).toBe('normal')
    expect(readinessLevel(84)).toBe('normal')
    expect(readinessLevel(85)).toBe('high')
    expect(readinessLevel(100)).toBe('high')
  })
})

describe('readiness', () => {
  it('shembulli i SPEC-ut jep 54, e ulët', () => {
    const result = readiness({ checkIn: base, recovery: 'gati', trainedGroups: ['gjoksi'] })
    expect(result.percent).toBe(54)
    expect(result.level).toBe('low')
  })

  it('pesë pjesët me pikat dhe peshat', () => {
    const { parts } = readiness({ checkIn: base, recovery: 'gati', trainedGroups: ['gjoksi'] })
    const byKey = Object.fromEntries(parts.map((part) => [part.key, part]))
    expect(parts.map((part) => part.key)).toEqual(['sleep', 'energy', 'recovery', 'soreness', 'mood'])
    expect(byKey.sleep.weight).toBe(0.3)
    expect(byKey.sleep.score).toBeCloseTo(60.5)
    expect(byKey.energy).toEqual({ key: 'energy', score: 25, weight: 0.25 })
    expect(byKey.recovery).toEqual({ key: 'recovery', score: 100, weight: 0.2 })
    expect(byKey.soreness).toEqual({ key: 'soreness', score: 30, weight: 0.15 })
    expect(byKey.mood).toEqual({ key: 'mood', score: 50, weight: 0.1 })
    expect(parts.reduce((sum, part) => sum + part.weight, 0)).toBeCloseTo(1)
  })

  it('shkallët 1-5 bëhen 0, 25, 50, 75, 100', () => {
    const score = (energy: Scale) =>
      readiness({ checkIn: { ...base, energy }, recovery: 'gati', trainedGroups: [] }).parts.find((part) => part.key === 'energy')?.score
    expect(([1, 2, 3, 4, 5] as Scale[]).map(score)).toEqual([0, 25, 50, 75, 100])
  })

  it('dhimbjet: 100 - 25 * shkalla, 20 më pak kur grupi stërvitet sot, jo nën 0', () => {
    const soreness = (level: Soreness, trainedGroups: string[]) =>
      readiness({ checkIn: { ...base, soreness: level, soreGroups: level ? ['gjoksi'] : [] }, recovery: 'gati', trainedGroups }).parts.find(
        (part) => part.key === 'soreness',
      )?.score
    expect(([0, 1, 2, 3, 4] as Soreness[]).map((level) => soreness(level, ['shpina']))).toEqual([100, 75, 50, 25, 0])
    expect(soreness(1, ['gjoksi'])).toBe(55)
    expect(soreness(4, ['gjoksi'])).toBe(0)
    expect(soreness(0, ['gjoksi'])).toBe(100)
  })

  it('rikuperimi: Gati 100, Pothuajse gati 70, I lodhur 40', () => {
    const recovery = (status: 'gati' | 'pothuajse_gati' | 'i_lodhur') =>
      readiness({ checkIn: base, recovery: status, trainedGroups: [] }).parts.find((part) => part.key === 'recovery')?.score
    expect([recovery('gati'), recovery('pothuajse_gati'), recovery('i_lodhur')]).toEqual([100, 70, 40])
  })

  it('pa stërvitje sot pesha e rikuperimit ndahet proporcionalisht', () => {
    const result = readiness({ checkIn: base, recovery: null, trainedGroups: [] })
    expect(result.parts.map((part) => part.key)).toEqual(['sleep', 'energy', 'soreness', 'mood'])
    const weights = Object.fromEntries(result.parts.map((part) => [part.key, part.weight]))
    expect(weights.sleep).toBeCloseTo(0.3 / 0.8)
    expect(weights.energy).toBeCloseTo(0.25 / 0.8)
    expect(weights.soreness).toBeCloseTo(0.15 / 0.8)
    expect(weights.mood).toBeCloseTo(0.1 / 0.8)
    expect(result.parts.reduce((sum, part) => sum + part.weight, 0)).toBeCloseTo(1)
    // (18,15 + 6,25 + 7,5 + 5) / 0,8 = 46,125
    expect(result.percent).toBe(46)
  })

  it('kufijtë: gjithçka në maksimum jep 100, në minimum afër 0', () => {
    const best: CheckIn = { mood: 5, energy: 5, sleepMinutes: 540, sleepQuality: 5, soreness: 0, soreGroups: [] }
    const worst: CheckIn = { mood: 1, energy: 1, sleepMinutes: 120, sleepQuality: 1, soreness: 4, soreGroups: ['gjoksi'] }
    expect(readiness({ checkIn: best, recovery: 'gati', trainedGroups: ['gjoksi'] }).percent).toBe(100)
    const low = readiness({ checkIn: worst, recovery: 'i_lodhur', trainedGroups: ['gjoksi'] })
    // 0,3 * 14 + 0,2 * 40 = 12,2
    expect(low.percent).toBe(12)
    expect(low.level).toBe('low')
  })
})

describe('lighterSlots', () => {
  const slot = (sets: number, rir: number | null, weightKg: number | null, stepKg?: number) => ({ sets, rir, weightKg, stepKg })

  it('një set më pak nga ushtrimi i 3-të, jo nën 1', () => {
    const result = lighterSlots([slot(4, 2, 50), slot(3, 2, 50), slot(3, 2, 50), slot(1, 2, 50), slot(5, 2, 50)], { keepWeight: false })
    expect(result.map((item) => item.sets)).toEqual([4, 3, 2, 1, 4])
  })

  it('me RIR: RIR +1 deri në 4, pesha mbetet', () => {
    const result = lighterSlots([slot(3, 1, 60), slot(3, 3, 60), slot(3, 4, 60)], { keepWeight: false })
    expect(result.map((item) => item.rir)).toEqual([2, 4, 4])
    expect(result.map((item) => item.weightKg)).toEqual([60, 60, 60])
  })

  it('pa RIR: pesha x 0,9 poshtë sipas hapit', () => {
    const [a, b, c] = lighterSlots([slot(3, null, 62.5, 2.5), slot(3, null, 20, 2), slot(3, null, 0.5, 2.5)], { keepWeight: false })
    expect(a.weightKg).toBe(55) // 56,25 -> 55
    expect(a.rir).toBeNull()
    expect(b.weightKg).toBe(18)
    expect(c.weightKg).toBe(0.5) // nën një hap mbetet pesha
  })

  it('hapi parazgjedhur 2,5 kur ushtrimi nuk e ka', () => {
    expect(lighterSlots([slot(3, null, 100)], { keepWeight: false })[0].weightKg).toBe(90)
  })

  it('pesha null mbetet null', () => {
    expect(lighterSlots([slot(3, null, null)], { keepWeight: false })[0].weightKg).toBeNull()
  })

  it('"Mirë se u ktheve" e ka ulur peshën: nuk ulet dy herë, setet dhe RIR ndryshojnë', () => {
    const result = lighterSlots([slot(3, null, 90, 2.5), slot(3, null, 90, 2.5), slot(3, null, 90, 2.5), slot(3, 1, 90, 2.5)], { keepWeight: true })
    expect(result.map((item) => item.weightKg)).toEqual([90, 90, 90, 90])
    expect(result.map((item) => item.sets)).toEqual([3, 3, 2, 2])
    expect(result[3].rir).toBe(2)
  })

  it('nuk ndryshon hyrjen dhe ruan fushat e tjera', () => {
    const input = [{ ...slot(3, null, 100), id: 'x' }]
    const result = lighterSlots(input, { keepWeight: false })
    expect(input[0].weightKg).toBe(100)
    expect(result[0].id).toBe('x')
  })
})

describe('dayMode', () => {
  const at = (percent: number): Readiness => ({ percent, level: readinessLevel(percent), parts: [] })

  it('lodhur nën 60, energjik nga 85, ndryshe normal', () => {
    expect(dayMode(at(59), true)).toBe('tired')
    expect(dayMode(at(60), true)).toBe('normal')
    expect(dayMode(at(84), true)).toBe('normal')
    expect(dayMode(at(85), true)).toBe('energetic')
  })

  it('normal pa gatishmëri ose me çelësin e fikur', () => {
    expect(dayMode(null, true)).toBe('normal')
    expect(dayMode(at(10), false)).toBe('normal')
    expect(dayMode(at(95), false)).toBe('normal')
  })
})
