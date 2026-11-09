import { describe, expect, it } from 'vitest'
import type { Target } from '@/program/types'
import { type CheckIn, readiness } from './readiness'
import { lightenPlan, lightenWeights, lighterCost, readinessReasons } from './lighter-session'

const reps = (rir?: { min: number; max: number }): Target => ({ kind: 'reps', min: 8, max: 10, beyond: false, ...(rir ? { rir } : {}) })
const slot = (sets: number, target: Target = reps()) => ({ sets, target })

describe('lightenPlan', () => {
  it('nga ushtrimi i 3-të një set më pak, jo nën 1', () => {
    expect(lightenPlan([slot(4), slot(3), slot(3), slot(1), slot(5)]).map((item) => item.sets)).toEqual([4, 3, 2, 1, 4])
  })

  it('me RIR: RIR +1 për çdo ushtrim, deri në 4; pa RIR receta mbetet', () => {
    const result = lightenPlan([slot(3, reps({ min: 1, max: 2 })), slot(3, reps({ min: 3, max: 4 })), slot(3, reps({ min: 4, max: 4 })), slot(3)])
    expect(result.map((item) => (item.target.kind === 'reps' ? item.target.rir : null))).toEqual([{ min: 2, max: 3 }, { min: 4, max: 4 }, { min: 4, max: 4 }, undefined])
    expect(result[3].target).toEqual(reps())
  })

  it('nuk e ndryshon hyrjen', () => {
    const input = [slot(3, reps({ min: 1, max: 2 })), slot(3), slot(3)]
    lightenPlan(input)
    expect(input.map((item) => item.sets)).toEqual([3, 3, 3])
    expect(input[0].target).toEqual(reps({ min: 1, max: 2 }))
  })
})

describe('lightenWeights', () => {
  const row = (weightKg: number | null, target: Target = reps(), stepKg = 2.5) => ({ sets: 3, target, weightKg, stepKg })

  it('pa RIR: pesha x 0,9 poshtë sipas hapit të pajisjes (25 → 22,5; 62,5 → 55)', () => {
    expect(lightenWeights([row(25), row(62.5), row(20, reps(), 2)], { keepWeight: false })).toEqual([22.5, 55, 18])
  })

  it('me RIR pesha mbetet', () => {
    expect(lightenWeights([row(60, reps({ min: 1, max: 2 }))], { keepWeight: false })).toEqual([60])
  })

  it('me "Mirë se u ktheve" pesha nuk ulet përsëri (pa ulje të dyfishtë)', () => {
    expect(lightenWeights([row(22.5), row(55)], { keepWeight: true })).toEqual([22.5, 55])
  })

  it('pa peshë mbetet pa peshë', () => {
    expect(lightenWeights([row(null)], { keepWeight: false })).toEqual([null])
  })
})

describe('lighterCost', () => {
  const trackings = { a: 'weight_reps', b: 'weight_reps', c: 'weight_reps', plank: 'timed', dips: 'bodyweight_reps' } as const
  const planned = (exerciseId: string, target: Target = reps()) => ({ exerciseId, target })

  it('javë pa RIR: −1 set dhe pesha', () => {
    expect(lighterCost([planned('a'), planned('b'), planned('c')], trackings, { keepWeight: false })).toEqual({ sets: true, effect: 'weight' })
  })

  it('javë me RIR: −1 set dhe RIR +1', () => {
    const rir = reps({ min: 1, max: 2 })
    expect(lighterCost([planned('a', rir), planned('b', rir), planned('c', rir)], trackings, { keepWeight: false })).toEqual({ sets: true, effect: 'rir' })
  })

  it('javë e përzier ose me "Mirë se u ktheve"', () => {
    const rir = reps({ min: 1, max: 2 })
    expect(lighterCost([planned('a', rir), planned('b'), planned('c')], trackings, { keepWeight: false }).effect).toBe('both')
    expect(lighterCost([planned('a'), planned('b'), planned('c')], trackings, { keepWeight: true }).effect).toBeNull()
    expect(lighterCost([planned('a', rir), planned('b'), planned('c')], trackings, { keepWeight: true }).effect).toBe('rir')
  })

  it('me më pak se tre ushtrime nuk ka set më pak; ushtrimet pa peshë nuk numërohen', () => {
    expect(lighterCost([planned('a'), planned('b')], trackings, { keepWeight: false }).sets).toBe(false)
    expect(lighterCost([planned('plank', { kind: 'timed', seconds: 30 }), planned('dips')], trackings, { keepWeight: false }).effect).toBeNull()
  })
})

describe('readinessReasons', () => {
  const checkIn = (patch: Partial<CheckIn>): CheckIn => ({ mood: 3, energy: 3, sleepMinutes: 450, sleepQuality: 4, soreness: 0, soreGroups: [], ...patch })
  const reasons = (patch: Partial<CheckIn>, trained = ['gjoksi'], recovery: 'gati' | 'i_lodhur' | 'pothuajse_gati' = 'gati') => {
    const value = checkIn(patch)
    return readinessReasons({ checkIn: value, readiness: readiness({ checkIn: value, recovery, trainedGroups: trained }), recovery: { group: 'gjoksi', status: recovery }, trainedGroups: trained })
  }

  it('gjumi i shkurtër dhe dhimbjet te gjoksi (bordi)', () => {
    expect(reasons({ sleepMinutes: 330, sleepQuality: 3, energy: 4, mood: 4, soreness: 3, soreGroups: ['gjoksi'] })).toEqual([{ key: 'sleepShort' }, { key: 'soreGroups', groups: ['gjoksi'] }])
  })

  it('thotë gjumin e shkurtër dhe të dobët kur janë të dyja, dhe vetëm të dobët kur orët janë mjaft', () => {
    expect(reasons({ sleepMinutes: 300, sleepQuality: 1, energy: 5, mood: 5 })[0]).toEqual({ key: 'sleepBoth' })
    expect(reasons({ sleepMinutes: 480, sleepQuality: 1, energy: 5, mood: 5, soreness: 4, soreGroups: ['shpina'] }, ['gjoksi']).map((reason) => reason.key)).toContain('sleepPoor')
  })

  it('dhimbjet: grupet që stërviten sot, përndryshe të gjitha; më shumë se dy numërohen', () => {
    const base = { sleepMinutes: 480, sleepQuality: 5, energy: 5, mood: 5, soreness: 4 } as const
    expect(reasons({ ...base, soreGroups: ['shpina', 'gjoksi'] }, ['gjoksi']).find((reason) => reason.key === 'soreGroups')).toEqual({ key: 'soreGroups', groups: ['gjoksi'] })
    expect(reasons({ ...base, soreGroups: ['shpina', 'bicepsi'] }, ['gjoksi']).find((reason) => reason.key === 'soreGroups')?.groups).toEqual(['shpina', 'bicepsi'])
    expect(reasons({ ...base, soreGroups: ['shpina', 'bicepsi', 'barku'] }, ['gjoksi']).find((reason) => reason.key === 'soreMany')).toEqual({ key: 'soreMany', count: 3 })
    expect(reasons({ ...base, soreGroups: [] }).find((reason) => reason.key === 'sore')).toEqual({ key: 'sore' })
  })

  it('rikuperimi i lodhur dhe energjia e ulët; thuhen sipas radhës së pjesëve', () => {
    const result = reasons({ energy: 1, sleepMinutes: 480, sleepQuality: 5, mood: 5 }, ['gjoksi'], 'i_lodhur')
    expect(result.map((reason) => reason.key)).toEqual(['energyLow', 'recoveryPoor'])
    expect(result[1].groups).toEqual(['gjoksi'])
  })
})
