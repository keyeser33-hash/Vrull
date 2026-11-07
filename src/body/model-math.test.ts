import { blendOver, hexToRgb, nearestAngle, shadeRgb } from './model-math'
import { focusShade } from './model-focus'

describe('ngjyrat dhe rrotullimi i modelit 3D', () => {
  it('lexon tokenat hex me 6 dhe 3 shifra; çdo formë tjetër nuk lexohet', () => {
    expect(hexToRgb('#F1A335')).toEqual([241 / 255, 163 / 255, 53 / 255])
    expect(hexToRgb('#000')).toEqual([0, 0, 0])
    expect(hexToRgb(' #fafafa ')).toEqual([250 / 255, 250 / 255, 250 / 255])
    expect(hexToRgb('oklch(0.7 0.1 60)')).toBeNull()
    expect(hexToRgb('')).toBeNull()
  })

  it('opaciteti përzihet mbi panel si te figura 2D: 0 jep panelin, 1 ngjyrën', () => {
    const panel: [number, number, number] = [0.1, 0.1, 0.1]
    const brand: [number, number, number] = [0.9, 0.6, 0.2]
    expect(blendOver(panel, brand, 0)).toEqual(panel)
    expect(blendOver(panel, brand, 1)).toEqual(brand)
    const half = blendOver(panel, brand, 0.5)
    expect(half[0]).toBeCloseTo(0.5)
    expect(half[1]).toBeCloseTo(0.35)
    expect(half[2]).toBeCloseTo(0.15)
  })

  it('kthimi përpara ose mbrapa merr rrugën më të shkurtër nga rrotullimi i tanishëm', () => {
    expect(nearestAngle(Math.PI, 0)).toBeCloseTo(Math.PI)
    // Pas dy rrotullimeve të plota me gisht, "mbrapa" nuk i zhbën ato.
    expect(nearestAngle(Math.PI, 4 * Math.PI + 0.3)).toBeCloseTo(5 * Math.PI)
    expect(nearestAngle(0, -2 * Math.PI - 0.2)).toBeCloseTo(-2 * Math.PI)
    expect(Math.abs(nearestAngle(0, 7) - 7)).toBeLessThanOrEqual(Math.PI)
  })

  it('një muskul gri i fokusuar del më i ndritshëm se një muskul amber i zbehur (OLED)', () => {
    const panel = hexToRgb('#0B0B0B')!
    const muted = hexToRgb('#A3A3A3')!
    const brand = hexToRgb('#F1A335')!
    const foreground = hexToRgb('#F5F5F5')!
    const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
    const focusedGrey = shadeRgb({ panel, color: muted, foreground }, 0.2, focusShade(true))
    const dimmedAmber = shadeRgb({ panel, color: brand, foreground }, 1, focusShade(false))
    expect(luminance(focusedGrey)).toBeGreaterThan(luminance(dimmedAmber))
    shadeRgb({ panel, color: brand, foreground }, 1, focusShade(null)).forEach((value, index) => expect(value).toBeCloseTo(brand[index]))
  })
})
