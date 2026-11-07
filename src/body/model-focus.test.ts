import { facingAngle, focusView, MAX_DISTANCE, MIN_DISTANCE, zoomed } from './model-focus'

describe('fokusi i modelit 3D', () => {
  it('kthen trupin që pika e fokusit të dalë përballë kamerës', () => {
    // Gjoksi përpara: pa kthim. Shpina mbrapa: gjysmë rrotullimi. Krahu i djathtë anash: çerek.
    expect(facingAngle({ x: 0, z: 0.1 })).toBeCloseTo(0)
    expect(Math.abs(facingAngle({ x: 0, z: -0.1 }))).toBeCloseTo(Math.PI)
    expect(facingAngle({ x: -0.2, z: 0 })).toBeCloseTo(Math.PI / 2)
    // Pas rrotullimit me këtë kënd, pika bie mbi boshtin +Z.
    const point = { x: 0.15, z: -0.05 }
    const angle = facingAngle(point)
    expect(point.x * Math.cos(angle) + point.z * Math.sin(angle)).toBeCloseTo(0)
    expect(-point.x * Math.sin(angle) + point.z * Math.cos(angle)).toBeGreaterThan(0)
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
})
