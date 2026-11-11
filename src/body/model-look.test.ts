import { hexToRgb } from './model-math'
import { AURA_FROM, focusGlow, focusLift, lookOf } from './model-look'

describe('drita dhe shkëlqimi i modelit 3D', () => {
  const oled = hexToRgb('#121214')!
  const night = hexToRgb('#1C1C1F')!
  const day = hexToRgb('#FFFFFF')!

  it('temat e errëta: drita kryesore, dy drita konturi, shkëlqim si dritë e shtuar', () => {
    for (const surface of [oled, night]) {
      const look = lookOf(surface)
      expect(look.light).toBe(false)
      expect(look.rim).toBeGreaterThan(look.key)
      expect(look.fresnel).toBeGreaterThan(0)
      expect(look.emissive).toBeGreaterThan(0)
      expect(look.aura).toBeGreaterThan(0)
    }
  })

  it('Ditë: pa dritë të shtuar mbi kartën e bardhë; kontura nga hijet, aureola si ngjyrë e tejdukshme', () => {
    const look = lookOf(day)
    const dark = lookOf(oled)
    expect(look.light).toBe(true)
    expect(look.fresnel).toBe(0)
    expect(look.fresnelBase).toBe(0)
    expect(look.rim).toBeLessThan(dark.rim)
    expect(look.emissive).toBeLessThan(dark.emissive)
    expect(look.aura).toBeGreaterThan(0)
    expect(look.aura).toBeLessThan(dark.aura)
    // Materiali mbetet i njëjtë në çdo temë.
    expect(look.roughness).toBe(dark.roughness)
  })

  it('gjatë fokusit ndriçon vetëm muskuli i zgjedhur; aureolën e merr vetëm shkëlqimi që duket', () => {
    expect(focusGlow(1, null)).toBe(1)
    expect(focusGlow(0.4, true)).toBe(0.4)
    expect(focusGlow(1, false)).toBe(0)
    expect(focusGlow(undefined, null)).toBe(0)
    expect(AURA_FROM).toBeGreaterThan(0.12)
    expect(AURA_FROM).toBeLessThanOrEqual(0.4)
  })

  it('muskuli në fokus që ndriçon vetë nuk zbardhet; një muskul gri në fokus ndriçohet si më parë', () => {
    expect(focusLift(1)).toBe(0)
    expect(focusLift(0)).toBeCloseTo(0.35)
    expect(focusLift(0.4)).toBeGreaterThan(0)
    expect(focusLift(0.4)).toBeLessThan(0.35)
  })
})
