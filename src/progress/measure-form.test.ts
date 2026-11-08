import { isDayBefore, previousValues, stepValue, weightAverageBefore } from './measure-form'

// "Shto matjen" (bordi "Trupi · Shto matjen", V2-E1-14): vlerat e mëparshme për çdo matje, mesatarja
// 7-ditore e peshës para datës dhe hapat ±0,1 brenda kufijve të bazës.

const rows = [
  { date: '2026-10-25', values: { weight_kg: 80, arm_right_cm: 34, chest_cm: 98 } },
  { date: '2026-11-01', values: { weight_kg: 79.6, arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84 } },
  { date: '2026-11-06', values: { weight_kg: 79.8 } },
  { date: '2026-11-07', values: { weight_kg: 80, arm_right_cm: null } },
  { date: '2026-11-08', values: { weight_kg: 80.4 } },
]

describe('forma e matjes', () => {
  it('vlera e mëparshme e çdo matjeje: e fundit para datës, jo ajo e vetë datës', () => {
    const previous = previousValues(rows, '2026-11-08')
    expect(previous.weight_kg).toEqual({ date: '2026-11-07', value: 80 })
    expect(previous.arm_right_cm).toEqual({ date: '2026-11-01', value: 34.4 })
    expect(previous.waist_cm).toEqual({ date: '2026-11-01', value: 84 })
    expect(previous.neck_cm).toBeUndefined()
    expect(previousValues(rows, '2026-10-25')).toEqual({})
  })

  it('mesatarja 7-ditore e peshës para datës (një shifër pas presjes)', () => {
    // 7 ditët deri më 7 nëntor (1–7 nëntor): 79,6, 79,8 dhe 80; pesha e 8 nëntorit nuk hyn.
    expect(weightAverageBefore(rows, '2026-11-08')).toBe(79.8)
    // Deri më 1 nëntor: 25 tetor del nga dritarja.
    expect(weightAverageBefore(rows, '2026-11-02')).toBe(79.6)
    expect(weightAverageBefore(rows, '2026-10-25')).toBeNull()
  })

  it('dita para: "Dje"', () => {
    expect(isDayBefore('2026-11-07', '2026-11-08')).toBe(true)
    expect(isDayBefore('2026-10-31', '2026-11-01')).toBe(true)
    expect(isDayBefore('2026-11-06', '2026-11-08')).toBe(false)
  })

  it('hapat ±0,1 nga vlera e shkruar, ose nga e mëparshmja kur fusha është bosh; brenda kufijve', () => {
    const waist = { min: 10, max: 250 }
    expect(stepValue(waist, 84, null, -1)).toBe(83.9)
    expect(stepValue(waist, 83.9, null, -1)).toBe(83.8)
    expect(stepValue(waist, null, 84, 1)).toBe(84.1)
    expect(stepValue(waist, null, null, 1)).toBeNull()
    expect(stepValue(waist, 250, null, 1)).toBe(250)
    expect(stepValue({ min: 20, max: 400 }, 20, null, -1)).toBe(20)
  })
})
