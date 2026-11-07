import { change, METRICS, movingAverage, parseMetric } from './metrics'

const points = (values: [string, number][]) => values.map(([date, value]) => ({ date, value }))

describe('matjet', () => {
  it('pesha, yndyra dhe 14 perimetrat e §8', () => {
    expect(METRICS.map((metric) => metric.label)).toEqual([
      'Pesha',
      'Yndyra',
      'Qafa',
      'Shpatullat',
      'Gjoksi',
      'Beli',
      'Vithet',
      'Krahu majtas',
      'Krahu djathtas',
      'Parakrahu majtas',
      'Parakrahu djathtas',
      'Kofsha majtas',
      'Kofsha djathtas',
      'Pulpa majtas',
      'Pulpa djathtas',
    ])
  })

  it('vlera me presje, brenda kufijve të bazës; bosh do të thotë pa vlerë', () => {
    const weight = METRICS[0]
    expect(parseMetric(weight, '80,4')).toEqual({ ok: true, value: 80.4 })
    expect(parseMetric(weight, '')).toEqual({ ok: true, value: null })
    expect(parseMetric(weight, '15')).toEqual({ ok: false, error: 'Pesha duhet të jetë nga 20 deri në 400 kg.' })
    expect(parseMetric(METRICS[1], '1')).toEqual({ ok: false, error: 'Yndyra duhet të jetë nga 2 deri në 70 %.' })
    expect(parseMetric(METRICS[5], 'abc')).toEqual({ ok: false, error: 'Beli duhet të jetë nga 10 deri në 250 cm.' })
  })

  it('mesatarja 7-ditore: vlerat e 7 ditëve deri në atë datë', () => {
    expect(
      movingAverage(
        points([
          ['2026-12-01', 80],
          ['2026-12-03', 81],
          ['2026-12-07', 82],
          ['2026-12-08', 84],
        ]),
      ),
    ).toEqual(
      points([
        ['2026-12-01', 80],
        ['2026-12-03', 80.5],
        ['2026-12-07', 81],
        ['2026-12-08', 82.33],
      ]),
    )
  })

  it('ndryshimi në 4 javë: mesatarja e fundit kundrejt mesatares 28 ditë më parë', () => {
    const averages = points([
      ['2026-11-01', 82],
      ['2026-11-10', 81.5],
      ['2026-12-08', 80],
    ])
    expect(change(averages, 28)).toEqual({ from: { date: '2026-11-10', value: 81.5 }, delta: -1.5 })
    expect(change(points([['2026-12-08', 80]]), 28)).toBeNull()
    expect(change(points([['2026-12-01', 81], ['2026-12-08', 80]]), 28)).toEqual({ from: { date: '2026-12-01', value: 81 }, delta: -1 })
  })
})
