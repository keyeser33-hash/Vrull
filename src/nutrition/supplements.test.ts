import { mealSchedule } from './schedule'
import { SUPPLEMENTS, supplementPlan } from './supplements'

const plan = (trainingTime: string | null, disabled: string[] = []) =>
  supplementPlan(
    SUPPLEMENTS.map((supplement, index) => ({ id: `s${index}`, ...supplement, enabled: !disabled.includes(supplement.name) })),
    mealSchedule({ wakeTime: '07:00', sleepTime: '23:00', trainingTime }),
  ).map((item) => `${item.time} ${item.name}`)

describe('suplementet sipas orarit (§10)', () => {
  it('ditë pushimi: proteina në tre vakte, multivitamina në drekë, ZMA para gjumit', () => {
    expect(plan(null)).toEqual(['07:00 Pluhur proteine', '13:00 Multivitaminë', '15:30 Pluhur proteine', '22:30 Pluhur proteine', '22:30 ZMA'])
  })

  it('ditë stërvitjeje: shake-u para dhe pas stërvitjes me suplementet e tij', () => {
    const items = plan('18:00')
    expect(items.filter((item) => item.startsWith('17:45'))).toEqual([
      '17:45 Pluhur proteine',
      '17:45 Kreatinë',
      '17:45 Beta-alaninë',
      '17:45 Betainë',
      '17:45 BCAA',
    ])
    expect(items.filter((item) => item.startsWith('19:15'))).toEqual([
      '19:15 Kreatinë',
      '19:15 Beta-alaninë',
      '19:15 Betainë',
      '19:15 BCAA',
      '19:15 Karnitinë',
      '19:15 Glutaminë',
      '19:15 Dekstrozë ose gummy',
    ])
  })

  it('suplementi i çaktivizuar nuk del', () => {
    expect(plan(null, ['ZMA', 'Pluhur proteine'])).toEqual(['13:00 Multivitaminë'])
  })

  it('çdo suplement ka çelësin, dozën dhe evidencën; emrat dhe çelësat janë të vetëm', () => {
    expect(SUPPLEMENTS.map((supplement) => `${supplement.key} ${supplement.name}: ${supplement.doseText} · ${supplement.evidence}`)).toContain('creatine Kreatinë: 1,5–5 g · strong')
    expect(SUPPLEMENTS).toHaveLength(10)
    expect(new Set(SUPPLEMENTS.map((supplement) => supplement.key)).size).toBe(10)
    expect(new Set(SUPPLEMENTS.map((supplement) => supplement.name)).size).toBe(10)
  })
})
