import { describe, expect, it } from 'vitest'
import { adjustedTargets, calculateTargets, MIN_CARBS_G, navyBodyFat, type ProfileInput, withAdjustment } from './calculator'

// Kalkulatori i objektivave (SPEC Shtojca C, V32, V2-E2-02).
const owner: ProfileInput = {
  sex: 'male',
  birthYear: null,
  heightCm: 185,
  weightKg: 88,
  activity: 'sedentary',
  sessionsPerWeek: 4,
  goal: 'gain',
  today: '2026-11-08',
}

describe('calculateTargets', () => {
  it('jep shembullin e Shtojcës C për përdoruesin', () => {
    const result = calculateTargets(owner)
    expect(result.formula).toBe('mifflin')
    expect(result.age).toBe(30)
    expect(result.rest).toEqual({ kcal: 2630, proteinG: 176, carbsG: 304, fatG: 79 })
    expect(result.training).toEqual({ kcal: 2930, proteinG: 176, carbsG: 379, fatG: 79 })
  })

  it('i jep rreshtat e "Si u llogarit" që mblidhen saktë', () => {
    expect(calculateTargets(owner).breakdown).toEqual({
      bmr: 1890,
      maintenanceRest: 2460,
      adjustment: 170,
      rest: 2630,
      trainingExtra: 300,
      training: 2930,
    })
  })

  it('aktiviteti ndryshon mirëmbajtjen', () => {
    const light = calculateTargets({ ...owner, activity: 'light' })
    expect(light.rest.kcal).toBe(2820)
    expect(light.training.kcal).toBe(3120)
    expect(calculateTargets({ ...owner, activity: 'standing' }).rest.kcal).toBeGreaterThan(light.rest.kcal)
    expect(calculateTargets({ ...owner, activity: 'physical' }).rest.kcal).toBeGreaterThan(
      calculateTargets({ ...owner, activity: 'standing' }).rest.kcal,
    )
  })

  it('mosha vjen nga viti i lindjes, 30 kur mungon', () => {
    const born1990 = calculateTargets({ ...owner, birthYear: 1990 })
    expect(born1990.age).toBe(36)
    expect(born1990.bmrKcal).toBeCloseTo(calculateTargets(owner).bmrKcal - 30, 5)
  })

  it('gruaja ka −161 te Mifflin-St Jeor', () => {
    const woman = calculateTargets({ ...owner, sex: 'female', heightCm: 165, weightKg: 60 })
    expect(woman.bmrKcal).toBeCloseTo(600 + 1031.25 - 150 - 161, 5)
  })

  it('me yndyrën përdor Cunningham nga masa pa yndyrë', () => {
    const lean = calculateTargets({ ...owner, bodyFatPct: 20 })
    expect(lean.formula).toBe('cunningham')
    expect(lean.bmrKcal).toBeCloseTo(500 + 22 * 70.4, 5)
    expect(lean.rest.kcal).toBe(2840)
    expect(lean.training.kcal).toBe(3140)
  })

  it('mirëmbajtja e njohur zëvendëson vlerësimin', () => {
    const known = calculateTargets({ ...owner, knownMaintenanceKcal: 2900 })
    expect(known.formula).toBe('known')
    expect(known.breakdown.maintenanceRest).toBe(2900)
    expect(known.rest.kcal).toBe(3080)
    expect(known.training.kcal).toBe(3380)
  })

  it('mirëmbajtja nuk ka tepricë', () => {
    const maintain = calculateTargets({ ...owner, goal: 'maintain' })
    expect(maintain.adjustmentKcal).toBe(0)
    expect(maintain.rest.kcal).toBe(2460)
  })

  it('humbja: −0,5% në javë dhe 2,2 g/kg proteinë si parazgjedhje', () => {
    const lose = calculateTargets({ ...owner, goal: 'lose' })
    expect(lose.ratePctPerWeek).toBe(0.5)
    expect(lose.adjustmentKcal).toBeCloseTo(-484, 5)
    expect(lose.rest.kcal).toBe(1970)
    expect(lose.rest.proteinG).toBe(194)
  })

  it('ritmi, proteina dhe yndyra mbahen brenda kufijve', () => {
    const fast = calculateTargets({ ...owner, ratePctPerWeek: 1, proteinGPerKg: 3, fatGPerKg: 0.2 })
    expect(fast.ratePctPerWeek).toBe(0.5)
    expect(fast.proteinGPerKg).toBe(2.4)
    expect(fast.fatGPerKg).toBe(0.6)
    expect(calculateTargets({ ...owner, goal: 'lose', ratePctPerWeek: 2 }).ratePctPerWeek).toBe(1)
    expect(calculateTargets({ ...owner, goal: 'gain', ratePctPerWeek: 0.01 }).ratePctPerWeek).toBe(0.1)
  })

  it('yndyra nuk bie nën 20% të kalorive', () => {
    const result = calculateTargets({ ...owner, fatGPerKg: 0.6 })
    expect(result.training.fatG * 9).toBeGreaterThanOrEqual(result.training.kcal * 0.2 - 9)
    expect(result.rest.fatG).toBe(result.training.fatG)
  })

  it('kaloritë nuk bien nën kufirin e gjinisë dhe nën BMR-në', () => {
    const small = calculateTargets({
      ...owner,
      sex: 'female',
      heightCm: 150,
      weightKg: 45,
      activity: 'sedentary',
      goal: 'lose',
      ratePctPerWeek: 1,
    })
    expect(small.rest.kcal).toBeGreaterThanOrEqual(1200)
    expect(small.rest.kcal).toBeGreaterThanOrEqual(Math.round(small.bmrKcal / 10) * 10)
    expect(small.limits).toContain('kcal_floor')
  })

  it('karbohidratet nuk bien nën 50 g', () => {
    const result = calculateTargets({
      ...owner,
      goal: 'lose',
      ratePctPerWeek: 1,
      proteinGPerKg: 2.4,
      fatGPerKg: 1.2,
      activity: 'sedentary',
      weightKg: 140,
      heightCm: 160,
    })
    expect(result.rest.carbsG).toBeGreaterThanOrEqual(50)
    expect(result.limits).toContain('carbs_floor')
    expect(result.rest.kcal).toBe(Math.round((result.rest.proteinG * 4 + result.rest.fatG * 9 + result.rest.carbsG * 4) / 10) * 10)
  })

  it('mesatarja javore ndjek seancat në javë', () => {
    const result = calculateTargets(owner)
    expect(result.averageKcal).toBeCloseTo((2630 * 3 + 2930 * 4) / 7, 5)
    expect(calculateTargets({ ...owner, sessionsPerWeek: 0 }).averageKcal).toBe(2630)
  })
})

describe('korrigjimi javor (V33)', () => {
  const day = { kcal: 2630, proteinG: 176, carbsG: 300, fatG: 79 }

  it('kaloritë shkojnë te karbohidratet, kcal ÷ 4', () => {
    expect(withAdjustment(day, 90)).toEqual({ kcal: 2720, proteinG: 176, carbsG: 323, fatG: 79 })
    expect(withAdjustment(day, -150)).toEqual({ kcal: 2480, proteinG: 176, carbsG: 263, fatG: 79 })
    expect(withAdjustment(day, 0)).toBe(day)
  })

  it('karbohidratet nuk bien nën 50 g: kaloritë ulen vetëm deri atje', () => {
    const low = { ...day, kcal: 1800, carbsG: 70 }
    expect(withAdjustment(low, -150)).toEqual({ kcal: 1720, proteinG: 176, carbsG: MIN_CARBS_G, fatG: 79 })
  })

  it('zbërthimi ndjek ditët e korrigjuara', () => {
    const result = calculateTargets(owner)
    const adjusted = adjustedTargets(result, 90)
    expect([adjusted.rest.kcal, adjusted.training.kcal]).toEqual([result.rest.kcal + 90, result.training.kcal + 90])
    expect([adjusted.breakdown.rest, adjusted.breakdown.training]).toEqual([result.breakdown.rest + 90, result.breakdown.training + 90])
  })
})

describe('navyBodyFat', () => {
  it('burrat: nga qafa dhe beli', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 185, neckCm: 40, waistCm: 85 })).toBeCloseTo(
      86.01 * Math.log10(45) - 70.041 * Math.log10(185) + 36.76,
      5,
    )
  })

  it('gratë: edhe ijet', () => {
    expect(navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 32, waistCm: 72, hipCm: 98 })).toBeCloseTo(
      163.205 * Math.log10(72 + 98 - 32) - 97.684 * Math.log10(165) - 78.387,
      5,
    )
  })

  it('kthen null kur matjet nuk kanë kuptim', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 185, neckCm: 45, waistCm: 40 })).toBeNull()
    expect(navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 32, waistCm: 72 })).toBeNull()
    expect(navyBodyFat({ sex: 'male', heightCm: 185, neckCm: 30, waistCm: 200 })).toBeNull()
  })
})
