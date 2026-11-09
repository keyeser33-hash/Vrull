import { weeklyCheck, type WeeklyCheckInput, trendWeight } from './weekly-check'

// Kontrolli javor (V33, V2-E2-04): java e rishikuar 9–15 nëntor 2026, pesha 88 kg, shtim 0,25% në
// javë (synimi +0,22 kg, teprica e planit 176 kcal), objektivat mesatare 2 801 kcal (2 930 × 4 + 2 630 × 3).
const WEEK = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
const TRAINING = new Set(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'])

function input(overrides: { kcal?: (number | null)[]; weights?: { date: string; kg: number }[] } = {}): WeeklyCheckInput {
  const kcal = overrides.kcal ?? [2800, 2800, 2800, 2800, 2800, 2800, null]
  return {
    weekStart: WEEK[0],
    goal: 'gain',
    weights: overrides.weights ?? [
      { date: '2026-11-04', kg: 88 },
      { date: '2026-11-08', kg: 88 },
      { date: '2026-11-15', kg: 88 },
    ],
    days: WEEK.map((date, index) => ({ date, kcal: kcal[index] ?? 0, targetKcal: TRAINING.has(date) ? 2930 : 2630 })),
    averageTargetKcal: (2930 * 4 + 2630 * 3) / 7,
    plannedAdjustmentKcal: 176,
    plannedChangeKg: 0.22,
  }
}

describe('pesha trend', () => {
  it('mesatarja e peshave të 7 ditëve deri te data', () => {
    const weights = [
      { date: '2026-11-01', kg: 90 },
      { date: '2026-11-10', kg: 88 },
      { date: '2026-11-14', kg: 88.6 },
    ]
    expect(trendWeight(weights, '2026-11-15')).toBeCloseTo(88.3)
    expect(trendWeight(weights, '2026-11-09')).toBeNull()
  })
})

describe('kontrolli javor', () => {
  it('pesha nuk lëvizi me 2 800 kcal: shto 90 kcal (bordi)', () => {
    expect(weeklyCheck(input())).toMatchObject({ kind: 'proposal', changeKg: 0, loggedDays: 6, averageKcal: 2800, maintenanceKcal: 2800, kcal: 90, trendKg: 88 })
  })

  it('shtim i ngadaltë: +kcal', () => {
    const result = weeklyCheck(input({ weights: [{ date: '2026-11-08', kg: 88 }, { date: '2026-11-15', kg: 88.05 }] }))
    expect(result).toMatchObject({ kind: 'proposal', changeKg: 0.05 })
    expect(result.kind === 'proposal' && result.kcal).toBe(70)
  })

  it('shtim i shpejtë: −kcal, të shumtën 150', () => {
    const result = weeklyCheck(input({ kcal: [2900, 2900, 2900, 2900, 2900, 2900, 2900], weights: [{ date: '2026-11-08', kg: 88 }, { date: '2026-11-15', kg: 89 }] }))
    // Mirëmbajtja 2 900 − 1 × 800 = 2 100; e planit 2 625; gjysma e diferencës −262 → −150.
    expect(result).toMatchObject({ kind: 'proposal', maintenanceKcal: 2100, kcal: -150 })
  })

  it('në ritëm: pa korrigjim', () => {
    const average = (2930 * 4 + 2630 * 3) / 7
    const result = weeklyCheck(input({ kcal: Array(7).fill(average), weights: [{ date: '2026-11-08', kg: 88 }, { date: '2026-11-15', kg: 88.22 }] }))
    expect(result).toMatchObject({ kind: 'proposal', kcal: 0 })
  })

  it('ditët me më pak se gjysmën e objektivit nuk numërohen', () => {
    const result = weeklyCheck(input({ kcal: [2800, 2800, 2800, 900, 600, 0, 0] }))
    expect(result).toEqual({ kind: 'insufficient', loggedDays: 3, weighIns: 1 })
  })

  it('pa peshim këtë javë: pa propozim', () => {
    expect(weeklyCheck(input({ weights: [{ date: '2026-11-08', kg: 88 }] }))).toEqual({ kind: 'insufficient', loggedDays: 6, weighIns: 0 })
  })

  it('pa peshë para javës: pesha e parë e javës është pika e nisjes', () => {
    const result = weeklyCheck(input({ weights: [{ date: '2026-11-09', kg: 88 }, { date: '2026-11-15', kg: 88.2 }] }))
    expect(result).toMatchObject({ kind: 'proposal', previousTrendKg: 88, trendKg: 88.1 })
  })

  it('humbja përdor 7 700 kcal për kg', () => {
    const result = weeklyCheck({
      ...input({ kcal: Array(7).fill(2200), weights: [{ date: '2026-11-08', kg: 88 }, { date: '2026-11-15', kg: 87.9 }] }),
      goal: 'lose',
      averageTargetKcal: 2200,
      plannedAdjustmentKcal: -484,
      plannedChangeKg: -0.44,
    })
    // Mirëmbajtja 2 200 + 0,1 × 1 100 = 2 310; e planit 2 684; gjysma e diferencës −187 → −150.
    expect(result).toMatchObject({ kind: 'proposal', maintenanceKcal: 2310, kcal: -150 })
  })
})
