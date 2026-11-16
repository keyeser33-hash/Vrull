import { exerciseFacts, foodFacts, RECOVERY_FACTS } from './facts'
import { foodCandidates, pickFact, restCandidates, type SeenFact, todayCandidates } from './pick'

// "A e dije?" (SPEC §0.3e, V56, V57): një fakt në ditë ushqimi në secilin vend; te Sot faktet e ushtrimeve të stërvitjes
// së sotme, në ditë pushimi rikuperimi; te pushimi ushtrimi aktual; pas ushqimit ushqimi i regjistruar. Një fakt nuk
// përsëritet në një vend derisa të jenë parë të gjithë faktet e tij.

const bench = exerciseFacts('Bench Press')
const ids = (list: readonly { id: string }[]) => list.map((fact) => fact.id)
const seen = (factId: string, date: string, place: SeenFact['place'] = 'today'): SeenFact => ({ factId, date, place })

describe('kandidatët sipas vendit', () => {
  it('Sot me stërvitje: faktet e ushtrimeve me radhën e stërvitjes, pa dyfishim', () => {
    const list = todayCandidates(['Incline Bench Press', 'Bench Press', 'Incline Cable Flye', 'Bench Press'])
    expect(ids(list)).toEqual([...ids(exerciseFacts('Incline Bench Press')), ...ids(bench)])
  })

  it('Sot në ditë pushimi (pa ushtrime): faktet e rikuperimit', () => {
    expect(ids(todayCandidates(null))).toEqual(ids(RECOVERY_FACTS))
    expect(ids(todayCandidates([]))).toEqual(ids(RECOVERY_FACTS))
  })

  it('Sot me ushtrime pa asnjë fakt: rikuperimi, që rrethi të mos mbetet bosh', () => {
    expect(ids(todayCandidates(['Incline Cable Flye']))).toEqual(ids(RECOVERY_FACTS))
  })

  it('pushimi: vetëm faktet e ushtrimit aktual; ushtrim pa fakte, asgjë', () => {
    expect(ids(restCandidates('Bench Press'))).toEqual(ids(bench))
    expect(restCandidates('Incline Cable Flye')).toEqual([])
  })

  it('ushqimi: faktet e ushqimeve të regjistruara, i fundit i pari; ushqimet pa fakte nuk numërohen', () => {
    expect(ids(foodCandidates(['protein', 'apple', 'oatmeal', 'protein']))).toEqual([...ids(foodFacts('protein')), 'oatmeal-1'])
    expect(foodCandidates(['apple'])).toEqual([])
  })
})

describe('pickFact', () => {
  it('pa kandidatë: asgjë', () => {
    expect(pickFact([], [])).toBeNull()
  })

  it('herën e parë: i pari me radhë', () => {
    expect(pickFact(bench, [])?.id).toBe(bench[0].id)
  })

  it('nuk përsëritet derisa të shihen të gjithë; pastaj nis nga ai i parë më herët', () => {
    const [a, b] = bench
    expect(pickFact(bench, [seen(a.id, '2026-11-02')])?.id).toBe(b.id)
    // Të dy u panë: rinis cikli nga ai që u pa më herët.
    expect(pickFact(bench, [seen(b.id, '2026-11-02'), seen(a.id, '2026-11-09')])?.id).toBe(b.id)
    expect(pickFact(bench, [seen(a.id, '2026-11-02'), seen(b.id, '2026-11-09')])?.id).toBe(a.id)
  })

  it('kandidatët e rinj (ushtrim tjetër) dalin para atyre që u panë', () => {
    const candidates = todayCandidates(['Bench Press', 'Incline Bench Press'])
    const history = bench.map((fact, index) => seen(fact.id, `2026-11-0${index + 2}`))
    expect(pickFact(candidates, history)?.id).toBe(exerciseFacts('Incline Bench Press')[0].id)
  })

  it('numëron vetëm historinë që i jepet (vendi i vet): fakti i parë te pushimi nuk e ndal te Sot', () => {
    const history = [seen(bench[0].id, '2026-11-09', 'rest')]
    expect(pickFact(bench, history.filter((entry) => entry.place === 'today'))?.id).toBe(bench[0].id)
  })
})
