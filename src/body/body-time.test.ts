import { shapeComparison, shapeScales } from './body-shape'
import { bodyTimeline, changeLevel, FORECAST, forecastPoint, latestUpTo, MUSCLE_ZONE, scalesAt, weeksBetween } from './body-time'

// Makina e kohës (V52, V2-E3-09): çdo datë me matje është një ndalesë, nga baza te matja e fundit;
// në fund, kur ka mjaft matje, një ndalesë parashikimi me interval. Shembulli vazhdon bordin
// "Matjet": Java 0 më 25 tetor, pastaj një matje çdo të diel.

const row = (date: string, values: Record<string, number>) => ({ date, values })
const java0 = row('2026-10-25', { weight_kg: 80, arm_right_cm: 34, chest_cm: 98, waist_cm: 84.5, thigh_right_cm: 56 })
const nov1 = row('2026-11-01', { arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84, thigh_right_cm: 56.3 })
const nov8 = row('2026-11-08', { chest_cm: 99.4 })
const START = '2026-10-25'

const zone = (timeline: NonNullable<ReturnType<typeof bodyTimeline>>, stop: number, id: string) => timeline.stops[stop].zones.find((entry) => entry.id === id)

describe('vija e kohës', () => {
  it('një ndalesë për çdo datë me matje, nga baza te matja e fundit', () => {
    const timeline = bodyTimeline([nov8, java0, nov1], START)!
    expect(timeline.stops.map((stop) => [stop.date, stop.kind])).toEqual([
      ['2026-10-25', 'measured'],
      ['2026-11-01', 'measured'],
      ['2026-11-08', 'measured'],
    ])
    expect(timeline.stops[0].zones.map((entry) => [entry.id, entry.value, entry.delta, entry.ratio])).toEqual([
      ['arm', 34, 0, 1],
      ['chest', 98, 0, 1],
      ['waist', 84.5, 0, 1],
      ['thigh', 56, 0, 1],
    ])
    expect(timeline.stops[1].zones.map((entry) => [entry.id, entry.value, entry.delta])).toEqual([
      ['arm', 34.4, 0.4],
      ['chest', 98.6, 0.6],
      ['waist', 84, -0.5],
      ['thigh', 56.3, 0.3],
    ])
  })

  it('një zonë e pamatur në një datë mban vlerën e fundit dhe thotë nga cila matje vjen', () => {
    const timeline = bodyTimeline([java0, nov1, nov8], START)!
    expect(zone(timeline, 2, 'chest')).toMatchObject({ value: 99.4, delta: 1.4, measuredOn: '2026-11-08' })
    expect(zone(timeline, 2, 'arm')).toMatchObject({ value: 34.4, delta: 0.4, measuredOn: '2026-11-01' })
  })

  it('ndalesa e fundit e matur përputhet me "Trupi sipas matjeve"', () => {
    const rows = [java0, nov1, nov8, row('2026-11-15', { arm_right_cm: 34.9, arm_left_cm: 34.1, waist_cm: 83.6 }), row('2026-11-22', { arm_left_cm: 34.5, neck_cm: 38 })]
    const comparison = shapeComparison(rows, START)!
    const timeline = bodyTimeline(rows, START)!
    const last = timeline.stops.filter((stop) => stop.kind === 'measured').at(-1)!
    expect(last.date).toBe(comparison.to)
    expect(timeline.stops[0].date).toBe(comparison.from)
    expect(last.zones.map((entry) => [entry.id, entry.value, entry.delta, entry.ratio])).toEqual(
      comparison.changes.map((change) => [change.id, change.to.value, change.delta, change.ratio]),
    )
    expect(scalesAt(timeline.stops, timeline.stops.indexOf(last))).toEqual(shapeScales(comparison))
  })

  it('baza: matja e fundit deri në nisjen e programit; matjet para saj nuk janë ndalesa', () => {
    const rows = [row('2026-10-10', { chest_cm: 96 }), row('2026-10-24', { chest_cm: 97.5 }), row('2026-10-28', { chest_cm: 98 }), row('2026-11-08', { chest_cm: 99 })]
    const timeline = bodyTimeline(rows, START)!
    expect(timeline.stops.map((stop) => stop.date)).toEqual(['2026-10-24', '2026-10-28', '2026-11-08'])
    expect(timeline.base).toEqual([{ id: 'chest', keys: ['chest_cm'], date: '2026-10-24', value: 97.5 }])
  })

  it('një zonë që nis më vonë hyn te ndalesa e matjes së saj të parë, pa ndryshim', () => {
    const rows = [java0, nov1, row('2026-11-08', { neck_cm: 38 }), row('2026-11-15', { neck_cm: 38.4 })]
    const timeline = bodyTimeline(rows, START)!
    expect(zone(timeline, 0, 'neck')).toBeUndefined()
    expect(zone(timeline, 1, 'neck')).toBeUndefined()
    expect(zone(timeline, 2, 'neck')).toMatchObject({ value: 38, delta: 0, ratio: 1, measuredOn: '2026-11-08' })
    expect(zone(timeline, 3, 'neck')).toMatchObject({ value: 38.4, delta: 0.4 })
  })

  it('te gjymtyrët merret mesatarja e anëve; ana që nis më vonë numërohet pa ndryshim deri atëherë', () => {
    const rows = [
      row('2026-10-25', { arm_right_cm: 34 }),
      row('2026-11-01', { arm_right_cm: 34.4, arm_left_cm: 33.6 }),
      row('2026-11-08', { arm_right_cm: 34.6, arm_left_cm: 34 }),
    ]
    const timeline = bodyTimeline(rows, START)!
    expect(timeline.base).toEqual([{ id: 'arm', keys: ['arm_right_cm', 'arm_left_cm'], date: '2026-10-25', value: 33.8 }])
    expect(zone(timeline, 0, 'arm')).toMatchObject({ value: 33.8, delta: 0 })
    expect(zone(timeline, 1, 'arm')).toMatchObject({ value: 34, delta: 0.2 })
    expect(zone(timeline, 2, 'arm')).toMatchObject({ value: 34.3, delta: 0.5 })
  })

  it('pa dy matje me data të ndryshme nuk ka vijë kohe', () => {
    expect(bodyTimeline([], START)).toBeNull()
    expect(bodyTimeline([java0], START)).toBeNull()
    expect(bodyTimeline([row('2026-10-25', { weight_kg: 80 }), row('2026-11-01', { weight_kg: 80.4 })], START)).toBeNull()
  })

  it('pa program, baza është matja e parë', () => {
    const timeline = bodyTimeline([java0, nov1], null)!
    expect(timeline.stops.map((stop) => stop.date)).toEqual(['2026-10-25', '2026-11-01'])
  })
})

describe('forma mes dy ndalesave', () => {
  const timeline = bodyTimeline([java0, nov1, nov8], START)!

  it('në një ndalesë: raporti i saj; në mes: përzierja e dy fqinjëve', () => {
    expect(scalesAt(timeline.stops, 0)).toEqual({ arm: 1, chest: 1, waist: 1, thigh: 1 })
    expect(scalesAt(timeline.stops, 1).chest).toBeCloseTo(98.6 / 98, 6)
    const half = scalesAt(timeline.stops, 1.5)
    expect(half.chest).toBeCloseTo((98.6 / 98 + 99.4 / 98) / 2, 6)
    expect(half.arm).toBeCloseTo(34.4 / 34, 6)
  })

  it('pozicioni jashtë vijës mbetet te skaji', () => {
    expect(scalesAt(timeline.stops, -3)).toEqual(scalesAt(timeline.stops, 0))
    expect(scalesAt(timeline.stops, 99)).toEqual(scalesAt(timeline.stops, 2))
  })

  it('theksimi shumëzon largësinë nga 1, edhe për zonat që tkurren', () => {
    const plain = scalesAt(timeline.stops, 2)
    const strong = scalesAt(timeline.stops, 2, 3)
    expect(strong.chest).toBeCloseTo(1 + (plain.chest! - 1) * 3, 6)
    expect(strong.waist).toBeCloseTo(1 + (plain.waist! - 1) * 3, 6)
    expect(strong.waist!).toBeLessThan(plain.waist!)
  })

  it('një zonë që mungon te njëra ndalesë përzihet me 1', () => {
    const rows = [java0, nov1, row('2026-11-08', { neck_cm: 38 }), row('2026-11-15', { neck_cm: 39.9 })]
    const stops = bodyTimeline(rows, START)!.stops
    expect(scalesAt(stops, 2.5).neck).toBeCloseTo((1 + 39.9 / 38) / 2, 6)
    expect(scalesAt(stops, 1.5).neck).toBe(1)
  })
})

describe('ngjyra e ndryshimit', () => {
  it('tri shkallë sipas përqindjes, në të dy drejtimet; pa ndryshim: asnjë', () => {
    expect(changeLevel(1)).toBe(0)
    expect(changeLevel(1.004)).toBe(1)
    expect(changeLevel(0.996)).toBe(1)
    expect(changeLevel(1.01)).toBe(2)
    expect(changeLevel(1.03)).toBe(2)
    expect(changeLevel(0.97)).toBe(2)
    expect(changeLevel(1.031)).toBe(3)
    expect(changeLevel(0.9)).toBe(3)
  })

  it('çdo muskul i zonave të matjeve di zonën e vet', () => {
    expect(MUSCLE_ZONE.biceps_brachii).toBe('arm')
    expect(MUSCLE_ZONE.rectus_abdominis).toBe('waist')
    expect(MUSCLE_ZONE.gastrocnemius).toBe('calf')
    expect(MUSCLE_ZONE.latissimus_dorsi).toBeUndefined()
  })
})

describe('parashikimi', () => {
  // Katër të diela rresht: krahu rritet 0,2 cm në javë, pa zhurmë.
  const weekly = (values: number[]) => values.map((value, index) => ({ date: ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29'][index], value }))

  it('vija e drejtë vazhdon; intervali nuk është kurrë më i ngushtë se gabimi i shiritit', () => {
    const result = forecastPoint(weekly([34, 34.2, 34.4, 34.6]), '2026-12-06')!
    expect(result.value).toBe(35.2)
    // n = 4, t(2) = 1,886, s = 0,3 cm (dyshemeja), x0 = 42, mesatarja 10,5, Sxx = 245.
    const half = 1.886 * FORECAST.tapeErrorCm * Math.sqrt(1 + 1 / 4 + (42 - 10.5) ** 2 / 245)
    expect(result.low).toBe(Math.round((35.2 - half) * 10) / 10)
    expect(result.high).toBe(Math.round((35.2 + half) * 10) / 10)
    expect(result.high - result.low).toBeGreaterThan(2 * FORECAST.tapeErrorCm)
  })

  it('matjet me zhurmë e zgjerojnë intervalin', () => {
    const clean = forecastPoint(weekly([34, 34.2, 34.4, 34.6, 34.8]), '2026-12-13')!
    const noisy = forecastPoint(weekly([34, 35.1, 33.9, 35.4, 34.8]), '2026-12-13')!
    expect(noisy.high - noisy.low).toBeGreaterThan(clean.high - clean.low)
  })

  it('më pak se 4 matje ose më pak se 3 javë: asnjë parashikim', () => {
    expect(forecastPoint(weekly([34, 34.2, 34.4]), '2026-12-06')).toBeNull()
    const dense = [
      { date: '2026-10-25', value: 34 },
      { date: '2026-10-27', value: 34.1 },
      { date: '2026-10-29', value: 34.2 },
      { date: '2026-11-01', value: 34.3 },
    ]
    expect(forecastPoint(dense, '2026-11-15')).toBeNull()
  })

  it('ndalesa e parashikimit: jo më larg se sa gjatë është matur, deri në 4 javë', () => {
    const rows = [34, 34.2, 34.4, 34.6].map((arm, index) => row(['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'][index], { arm_right_cm: arm, chest_cm: index < 2 ? 98 + index : undefined } as Record<string, number>))
    const timeline = bodyTimeline(rows, START)!
    const last = timeline.stops.at(-1)!
    // Matur 21 ditë: parashikimi 21 ditë pas matjes së fundit.
    expect(last).toMatchObject({ kind: 'forecast', date: '2026-12-06' })
    const arm = last.zones.find((entry) => entry.id === 'arm')!
    expect(arm.value).toBe(35.2)
    expect(arm.range![0]).toBeLessThan(35.2)
    expect(arm.range![1]).toBeGreaterThan(35.2)
    expect(arm.ratio).toBeCloseTo(35.2 / 34, 6)
    // Gjoksi ka vetëm dy matje: pa interval, mban vlerën e fundit.
    const chest = last.zones.find((entry) => entry.id === 'chest')!
    expect(chest.range).toBeUndefined()
    expect(chest.value).toBe(99)

    const longer = bodyTimeline([...rows, row('2026-11-22', { arm_right_cm: 34.8 }), row('2026-11-29', { arm_right_cm: 35 })], START)!
    expect(longer.stops.at(-1)).toMatchObject({ kind: 'forecast', date: '2026-12-27' })
  })

  it('pa asnjë zonë me mjaft matje, vija mbaron te matja e fundit', () => {
    const timeline = bodyTimeline([java0, nov1, nov8], START)!
    expect(timeline.stops.every((stop) => stop.kind === 'measured')).toBe(true)
  })
})

describe('ndihmësit e kohës', () => {
  it('fotoja ose matja më e fundit deri në një datë', () => {
    const days = [{ date: '2026-11-08' }, { date: '2026-10-25' }, { date: '2026-11-01' }]
    expect(latestUpTo(days, '2026-11-05')).toEqual({ date: '2026-11-01' })
    expect(latestUpTo(days, '2026-11-08')).toEqual({ date: '2026-11-08' })
    expect(latestUpTo(days, '2026-10-20')).toBeUndefined()
  })

  it('javët mes dy datave, të rrumbullakuara', () => {
    expect(weeksBetween('2026-10-25', '2026-10-25')).toBe(0)
    expect(weeksBetween('2026-10-25', '2026-11-01')).toBe(1)
    expect(weeksBetween('2026-10-25', '2026-11-11')).toBe(2)
    expect(weeksBetween('2026-10-24', '2026-12-06')).toBe(6)
  })
})
