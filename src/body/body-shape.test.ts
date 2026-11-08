import { baselineKind, limbCenters, morphPositions, SHAPE_MEASURES, shapeComparison, shapeScales, sideBox } from './body-shape'

// Trupi sipas matjeve (V12, V2-E1-14): krahasimi i perimetrave nga Java 0 te matja e fundit dhe
// shkalla që modeli 3D merr për çdo zonë. Shembulli i bordit "Matjet": Java 0 më 25 tetor, matja e
// fundit më 1 nëntor; krahu 34,0 → 34,4, gjoksi 98,0 → 98,6, beli 84,5 → 84,0, kofsha 56,0 → 56,3.

const java0 = {
  date: '2026-10-25',
  values: { weight_kg: 80, arm_right_cm: 34, chest_cm: 98, waist_cm: 84.5, thigh_right_cm: 56 },
}
const nov1 = {
  date: '2026-11-01',
  values: { weight_kg: 80.2, arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84, thigh_right_cm: 56.3 },
}

describe('krahasimi i perimetrave', () => {
  it('bordi: katër perimetrat nga Java 0 te matja e fundit, me radhën krahu, gjoksi, beli, kofsha', () => {
    const result = shapeComparison([nov1, java0], '2026-10-25')!
    expect(result.from).toBe('2026-10-25')
    expect(result.to).toBe('2026-11-01')
    expect(result.changes.map((change) => [change.id, change.from.value, change.to.value, change.delta])).toEqual([
      ['arm', 34, 34.4, 0.4],
      ['chest', 98, 98.6, 0.6],
      ['waist', 84.5, 84, -0.5],
      ['thigh', 56, 56.3, 0.3],
    ])
    expect(result.changes[0].keys).toEqual(['arm_right_cm'])
    expect(result.changes[2].ratio).toBeCloseTo(84 / 84.5, 6)
  })

  it('pesha dhe yndyra nuk janë perimetra', () => {
    const result = shapeComparison([java0, nov1], '2026-10-25')!
    expect(result.changes.map((change) => change.id)).not.toContain('weight')
    expect(SHAPE_MEASURES.flatMap((measure) => measure.keys)).not.toContain('weight_kg')
    expect(SHAPE_MEASURES.flatMap((measure) => measure.keys)).not.toContain('body_fat_pct')
  })

  it('baza: vlera e fundit deri në nisjen e programit; pa të, e para pas saj', () => {
    const before = { date: '2026-10-20', values: { chest_cm: 97 } }
    const onStart = { date: '2026-10-24', values: { chest_cm: 97.5 } }
    const later = { date: '2026-10-28', values: { chest_cm: 98, waist_cm: 84.5 } }
    const latest = { date: '2026-11-08', values: { chest_cm: 99, waist_cm: 84 } }
    const result = shapeComparison([before, onStart, later, latest], '2026-10-25')!
    const chest = result.changes.find((change) => change.id === 'chest')!
    expect(chest.from).toEqual({ date: '2026-10-24', value: 97.5 })
    // Beli u mat vetëm pas nisjes: baza është matja e parë e tij.
    const waist = result.changes.find((change) => change.id === 'waist')!
    expect(waist.from).toEqual({ date: '2026-10-28', value: 84.5 })
    expect(result.from).toBe('2026-10-24')
    expect(result.to).toBe('2026-11-08')
  })

  it('pa program: baza është matja e parë', () => {
    const result = shapeComparison([java0, nov1], null)!
    expect(result.changes.find((change) => change.id === 'chest')!.from.date).toBe('2026-10-25')
  })

  it('një perimetër me një matje të vetme nuk ka ndryshim; pa asnjë ndryshim kthen null', () => {
    expect(shapeComparison([java0], '2026-10-25')).toBeNull()
    expect(shapeComparison([], null)).toBeNull()
    const result = shapeComparison([java0, { date: '2026-11-01', values: { chest_cm: 98.6 } }], '2026-10-25')!
    expect(result.changes.map((change) => change.id)).toEqual(['chest'])
  })

  it('dy anët: mesatarja e anëve të matura në të dyja skajet', () => {
    const start = { date: '2026-10-25', values: { arm_right_cm: 34, arm_left_cm: 33.6 } }
    // Krahu majtas nuk u mat më: krahasimi mbetet te ana e djathtë.
    const end = { date: '2026-11-01', values: { arm_right_cm: 34.4 } }
    expect(shapeComparison([start, end], '2026-10-25')!.changes[0]).toMatchObject({ id: 'arm', keys: ['arm_right_cm'], delta: 0.4 })
    const both = { date: '2026-11-08', values: { arm_right_cm: 34.6, arm_left_cm: 34.1 } }
    const result = shapeComparison([start, end, both], '2026-10-25')!.changes[0]
    expect(result.keys).toEqual(['arm_right_cm', 'arm_left_cm'])
    expect(result.from.value).toBe(33.8)
    expect(result.to.value).toBe(34.4)
    expect(result.delta).toBe(0.6)
  })

  it('shkalla e modelit: raporti i çdo zone; Java 0 është 1', () => {
    const result = shapeComparison([java0, nov1], '2026-10-25')!
    const scales = shapeScales(result)
    expect(scales.chest).toBeCloseTo(98.6 / 98, 6)
    expect(scales.waist).toBeCloseTo(84 / 84.5, 6)
    expect(scales.neck).toBeUndefined()
    expect(shapeScales(null)).toEqual({})
  })

  it('emri i bazës: blloku i parë kur bie në javën e nisjes, përndryshe "matja e parë"', () => {
    expect(baselineKind('2026-10-25', '2026-10-25')).toBe('start')
    expect(baselineKind('2026-10-31', '2026-10-25')).toBe('start')
    expect(baselineKind('2026-11-01', '2026-10-25')).toBe('first')
    expect(baselineKind('2026-10-20', '2026-10-25')).toBe('start')
    expect(baselineKind('2026-10-25', null)).toBe('first')
  })
})

describe('forma e modelit', () => {
  // Dy kulme majtas (x < 0) dhe dy djathtas, në metra: x, y, z.
  const limb = new Float32Array([-0.2, 1.2, 0, -0.24, 1.3, -0.04, 0.2, 1.2, 0, 0.24, 1.3, -0.04])

  it('kutia e një ane', () => {
    const left = sideBox([limb], 'left')!
    expect([...left.min, ...left.max].map((value) => Math.round(value * 100) / 100)).toEqual([-0.24, 1.2, -0.04, -0.2, 1.3, 0])
    expect(sideBox([limb], 'right')!.max[0]).toBeCloseTo(0.24, 6)
    expect(sideBox([new Float32Array([0.1, 1, 0])], 'left')).toBeNull()
  })

  it('qendrat e gjymtyrës: mesi i kutisë së secilës anë në x dhe z', () => {
    const centers = limbCenters([limb])
    expect(centers.left[0]).toBeCloseTo(-0.22, 6)
    expect(centers.left[1]).toBeCloseTo(-0.02, 6)
    expect(centers.right[0]).toBeCloseTo(0.22, 6)
  })

  it('perimetri rritet: kulmet largohen nga boshti në x dhe z, lartësia mbetet', () => {
    const grown = morphPositions(limb, 1.1, limbCenters([limb]))
    // Kulmi i parë: 0,02 m larg qendrës në x dhe z → 0,022.
    expect(grown[0]).toBeCloseTo(-0.22 + 0.022, 6)
    expect(grown[1]).toBeCloseTo(1.2, 6)
    expect(grown[2]).toBeCloseTo(-0.02 + 0.022, 6)
    expect(grown[6]).toBeCloseTo(0.22 - 0.022, 6)
    // Burimi nuk ndryshon: forma rillogaritet gjithnjë nga modeli origjinal.
    expect(limb[0]).toBeCloseTo(-0.2, 6)
  })

  it('trungu: një bosht i vetëm në mes të trupit', () => {
    const chest = new Float32Array([0.1, 1.3, 0.1, -0.1, 1.3, 0.1])
    const smaller = morphPositions(chest, 0.9, [0, 0])
    expect([...smaller].map((value) => Math.round(value * 1000) / 1000)).toEqual([0.09, 1.3, 0.09, -0.09, 1.3, 0.09])
    expect(morphPositions(chest, 1, [0, 0])).toEqual(chest)
  })
})
