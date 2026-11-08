import { MUSCLE_GROUPS } from '@/program/muscles'
import { facesBack, fitView, focusShade, focusView, MAX_DISTANCE, MIN_DISTANCE, sideOf, zoomed } from './model-focus'

describe('fokusi i modelit 3D', () => {
  it('ana nga duket çdo muskul vjen nga figura 2D: bicepsi përpara edhe pse në model rri pak mbrapa', () => {
    for (const key of MUSCLE_GROUPS.flatMap((group) => group.keys)) expect(['front', 'back', 'both'], key).toContain(sideOf(key))
    expect(sideOf('biceps_brachii')).toBe('front')
    expect(sideOf('deltoid_anterior')).toBe('front')
    expect(sideOf('latissimus_dorsi')).toBe('back')
    expect(sideOf('deltoid_lateral')).toBe('both')
  })

  it('modeli kthehet mbrapa vetëm kur shumica e muskujve duken mbrapa; barazimi mbetet përpara', () => {
    expect(facesBack(['biceps_brachii', 'brachialis'])).toBe(false)
    expect(facesBack(['deltoid_anterior', 'deltoid_lateral'])).toBe(false)
    expect(facesBack(['biceps_femoris', 'semitendinosus', 'semimembranosus', 'gluteus_maximus'])).toBe(true)
    expect(facesBack(['latissimus_dorsi', 'biceps_brachii'])).toBe(false)
    expect(facesBack([])).toBe(false)
  })

  it('gjatë fokusit: muskuli i zgjedhur ndriçohet, të tjerët zbehen; pa fokus asgjë', () => {
    expect(focusShade(null)).toEqual({ dim: 0, lift: 0 })
    expect(focusShade(true).lift).toBeGreaterThan(0)
    expect(focusShade(true).dim).toBe(0)
    expect(focusShade(false).dim).toBeGreaterThan(0)
    expect(focusShade(false).lift).toBe(0)
  })

  it('largësia e kamerës e nxë muskulin, brenda kufijve; lartësia ndjek qendrën e tij', () => {
    const chest = focusView({ min: [-0.18, 1.25, 0.02], max: [0.18, 1.45, 0.12] })
    expect(chest.height).toBeCloseTo(1.35)
    expect(chest.distance).toBeGreaterThanOrEqual(MIN_DISTANCE)
    expect(chest.distance).toBeLessThan(2)
    const legs = focusView({ min: [-0.2, 0.05, -0.1], max: [0.2, 0.9, 0.1] })
    expect(legs.distance).toBeGreaterThan(chest.distance)
    expect(legs.distance).toBeLessThanOrEqual(MAX_DISTANCE)
  })

  it('zmadhimi me dy gishta mbetet brenda kufijve', () => {
    expect(zoomed(3, 2)).toBeCloseTo(1.5)
    expect(zoomed(1.5, 4)).toBe(MIN_DISTANCE)
    expect(zoomed(3.5, 0.2)).toBe(MAX_DISTANCE)
  })

  it('pamja e plotë për një imazh: kutia nxihet në lartësi dhe në gjerësi, sipas formës së imazhit', () => {
    const body = { min: [-0.333, 0, -0.146], max: [0.333, 1.719, 0.146] }
    const tall = fitView(body, 118 / 300)
    expect(tall.height).toBeCloseTo(0.86, 2)
    const fov = (28 * Math.PI) / 180
    // Gjysma e lartësisë dhe e gjerësisë që sheh kamera në largësinë e qendrës.
    const halfHeight = tall.distance * Math.tan(fov / 2)
    expect(halfHeight).toBeGreaterThanOrEqual(1.719 / 2)
    expect(halfHeight * (118 / 300)).toBeGreaterThanOrEqual(0.333)
    // Imazh i ngushtë: gjerësia vendos largësinë; imazh i gjerë: lartësia.
    expect(fitView(body, 0.2).distance).toBeGreaterThan(tall.distance)
    expect(fitView(body, 1).distance).toBeLessThanOrEqual(tall.distance)
  })
})
