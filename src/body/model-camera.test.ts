import { BODY_CENTER, MAX_DISTANCE, MIN_DISTANCE } from './model-focus'
import { angleAt, angleView, auraFade, auraScale, FOCUS_ANGLE, focusAngle, fullView, isFreeView, leaderEnd, MAX_ELEVATION, MIN_ELEVATION, pinched, tilted, VIEW_ANGLES } from './model-camera'

const degrees = (value: number) => (value * Math.PI) / 180

describe('kamera e lirë e modelit 3D', () => {
  it('shina ka katër kënde, me radhën e bordit: Para, 3/4, Anash, Mbrapa', () => {
    expect(VIEW_ANGLES.map((angle) => angle.id)).toEqual(['front', 'threeQuarter', 'side', 'back'])
    expect(angleView('front', 0)).toEqual({ rotation: 0, elevation: 0 })
    expect(angleView('back', 0).rotation).toBeCloseTo(Math.PI)
    // 3/4: trupi kthehet 35° dhe kamera ngrihet pak, si te bordi.
    expect(Math.abs(angleView('threeQuarter', 0).rotation)).toBeCloseTo(degrees(35))
    expect(angleView('threeQuarter', 0).elevation).toBeCloseTo(degrees(8))
    expect(Math.abs(angleView('side', 0).rotation)).toBeCloseTo(Math.PI / 2)
  })

  it('një kënd i shinës merr rrugën më të shkurtër nga rrotullimi i tanishëm', () => {
    // Pas dy rrotullimeve të plota me gisht, "Para" nuk i zhbën ato.
    expect(angleView('front', 4 * Math.PI + 0.3).rotation).toBeCloseTo(4 * Math.PI)
    expect(angleView('back', -0.2).rotation).toBeCloseTo(-Math.PI)
    for (const angle of VIEW_ANGLES) expect(Math.abs(angleView(angle.id, 7).rotation - 7)).toBeLessThanOrEqual(Math.PI + 1e-9)
  })

  it('shina tregon këndin vetëm kur pamja është tek ai; mes dy këndeve asnjë', () => {
    expect(angleAt(0, 0)).toBe('front')
    expect(angleAt(2 * Math.PI, 0)).toBe('front')
    expect(angleAt(-Math.PI, 0)).toBe('back')
    expect(angleAt(3 * Math.PI, 0)).toBe('back')
    for (const angle of VIEW_ANGLES) expect(angleAt(angle.rotation - 4 * Math.PI, angle.elevation)).toBe(angle.id)
    // Pak gradë larg (fundi i një animacioni) ende lexohet; 16° e fokusit jo.
    expect(angleAt(degrees(3), 0)).toBe('front')
    expect(angleAt(degrees(16), 0)).toBeNull()
    expect(angleAt(degrees(60), 0)).toBeNull()
    // I njëjti rrotullim me kamerën e ngritur nuk është më këndi i shinës.
    expect(angleAt(0, degrees(20))).toBeNull()
    expect(angleAt(VIEW_ANGLES[1].rotation, 0)).toBeNull()
  })

  it('anim i kamerës mbetet mes kufijve: pak nga poshtë, jo mbi kokë', () => {
    expect(tilted(0, degrees(20))).toBeCloseTo(degrees(20))
    expect(tilted(degrees(50), degrees(40))).toBe(MAX_ELEVATION)
    expect(tilted(0, -degrees(80))).toBe(MIN_ELEVATION)
    expect(MAX_ELEVATION).toBeLessThan(Math.PI / 2)
    expect(MIN_ELEVATION).toBeLessThan(0)
  })

  it('dy gishta: afrimi mban nën gishta pikën e trupit ku nisi gjesti', () => {
    const start = { height: BODY_CENTER, distance: MAX_DISTANCE }
    // Gishtat 100 px mbi mesin e pamjes (te gjoksi), pamja 372 px e lartë, afrim ×2.
    const zoom = pinched(start, 2, -100, -100, 372)
    expect(zoom.distance).toBeCloseTo(MAX_DISTANCE / 2)
    // Kamera ngjitet drejt gjoksit: pika nën gishta nuk lëviz.
    const perPixel = (distance: number) => (2 * Math.tan(degrees(14)) * distance) / 372
    const under = (view: { height: number; distance: number }) => view.height + 100 * perPixel(view.distance)
    expect(under(zoom)).toBeCloseTo(under(start))
    expect(zoom.height).toBeGreaterThan(BODY_CENTER)
  })

  it('dy gishta që zvarriten poshtë e zbresin trupin; pa afrim trupi i plotë mbetet në mes', () => {
    const near = { height: 1.2, distance: 1.6 }
    const down = pinched(near, 1, 0, 40, 372)
    expect(down.distance).toBeCloseTo(1.6)
    expect(down.height).toBeGreaterThan(1.2)
    // Te largësia e plotë nuk ka zhvendosje: trupi nuk del nga karta.
    expect(pinched({ height: BODY_CENTER, distance: MAX_DISTANCE }, 1, 0, 120, 372)).toEqual({ height: BODY_CENTER, distance: MAX_DISTANCE })
    // Largimi deri në fund e kthen trupin në mes.
    expect(pinched(near, 0.1, 0, 0, 372)).toEqual({ height: BODY_CENTER, distance: MAX_DISTANCE })
  })

  it('zhvendosja nuk e nxjerr trupin nga pamja, dhe një gjest nuk e hedh kamerën nga vendi ku e la fokusi', () => {
    const far = pinched({ height: 1.2, distance: MIN_DISTANCE }, 1, 0, 100_000, 372)
    expect(far.height).toBeLessThanOrEqual(2 * BODY_CENTER + 1e-9)
    expect(pinched({ height: 1.2, distance: MIN_DISTANCE }, 1, 0, -100_000, 372).height).toBeGreaterThanOrEqual(0)
    // Fokusi te kofshët rri te largësia e plotë me kamerën poshtë mesit: gjesti nis prej aty, pa kërcim.
    const legs = { height: 0.5, distance: MAX_DISTANCE }
    expect(pinched(legs, 1, 0, 0, 372)).toEqual(legs)
  })

  it('"Pamja e plotë" del kur trupi nuk shihet i plotë dhe drejt: afrim, zhvendosje ose anim', () => {
    const full = { rotation: 0, elevation: 0, height: BODY_CENTER, distance: MAX_DISTANCE }
    expect(isFreeView(full)).toBe(false)
    // Vetëm i rrotulluar, trupi shihet i plotë: shina mjafton.
    expect(isFreeView({ ...full, rotation: 1 })).toBe(false)
    // 3/4 e shinës e ka kamerën pak të ngritur: është kënd i shinës, jo pamje e lirë.
    expect(isFreeView({ ...full, ...angleView('threeQuarter', 0) })).toBe(false)
    expect(isFreeView({ ...full, distance: 2 })).toBe(true)
    expect(isFreeView({ ...full, height: 1.2 })).toBe(true)
    expect(isFreeView({ ...full, elevation: degrees(20) })).toBe(true)
    expect(fullView(4 * Math.PI + 1)).toEqual({ rotation: 4 * Math.PI, elevation: 0, height: BODY_CENTER, distance: MAX_DISTANCE })
  })

  it('fokusi e kthen trupin pak anash nga ana ku duket muskuli, me kamerën pak të ngritur', () => {
    expect(focusAngle(false, 0).rotation).toBeCloseTo(-FOCUS_ANGLE.rotation)
    expect(focusAngle(true, 0).rotation).toBeCloseTo(Math.PI - FOCUS_ANGLE.rotation)
    expect(focusAngle(false, 0).elevation).toBe(FOCUS_ANGLE.elevation)
    expect(Math.abs(focusAngle(true, 9).rotation - 9)).toBeLessThanOrEqual(Math.PI)
    // Nuk ngatërrohet me një kënd të shinës: shina mbetet pa zgjedhje gjatë fokusit.
    expect(angleAt(focusAngle(false, 0).rotation, focusAngle(false, 0).elevation)).toBeNull()
  })

  it('aureola dobësohet dhe ngushtohet kur kamera afrohet, që të mos mbulojë muskujt fqinjë', () => {
    expect(auraFade(MAX_DISTANCE)).toBe(1)
    expect(auraFade(MAX_DISTANCE / 2)).toBeCloseTo(0.125)
    expect(auraFade(MIN_DISTANCE)).toBeGreaterThan(0)
    expect(auraFade(MIN_DISTANCE)).toBeLessThan(0.1)
    expect(auraFade(0)).toBeGreaterThan(0)
    expect(auraScale(MAX_DISTANCE)).toBe(1)
    expect(auraScale(MAX_DISTANCE / 2)).toBeCloseTo(0.5)
  })

  it('vija e kartës bie mbi kartë: drejt poshtë kur muskuli është mbi të, përndryshe te cepi më i afërt', () => {
    expect(leaderEnd(118, 8, 240)).toBe(118)
    expect(leaderEnd(300, 8, 240)).toBe(220)
    expect(leaderEnd(2, 8, 240)).toBe(28)
  })
})
