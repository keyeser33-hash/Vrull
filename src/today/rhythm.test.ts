import { mealSchedule } from '@/nutrition/schedule'
import { canMoveMeal, clockText, MIN_GAP_MINUTES, moveMeals, nearestPoint, type RhythmMeal, rhythmOf, untilParts } from './rhythm'

// Ritmi i ditës (V57, SPEC §0.3f): pozicionet e pikave nga zgjimi te gjumi, vakti i radhës, pika më e afërt
// me gishtin dhe lëvizja e një vakti që vjen (V35). Pa UI, pa bazë, me orë të fiksuar.

const time = (text: string) => {
  const [hours, minutes] = text.split(':').map(Number)
  return hours * 60 + minutes
}

/** Orari i bordit "Sot · Ritmi": zgjimi 07:00, gjumi 23:30, stërvitja 21:00; vaktet e ngrënë deri te `eaten`. */
function board({ now, eaten = [], training = '21:00', plan }: { now: string; eaten?: string[]; training?: string | null; plan?: Parameters<typeof mealSchedule>[0]['plan'] }) {
  const schedule = mealSchedule({ wakeTime: '07:00', sleepTime: '23:30', trainingTime: training, workoutMinutes: 65, plan })
  const meals: RhythmMeal[] = schedule.map((entry) => ({ meal: entry.meal, time: entry.time, minutes: entry.minutes, eaten: eaten.includes(entry.meal), kcal: 300, proteinG: 20 }))
  return rhythmOf({
    wakeTime: '07:00',
    sleepTime: '23:30',
    meals,
    workout: training ? { time: training, done: false } : null,
    nowMinutes: time(now),
  })
}

const FIVE = ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm']

describe('rhythmOf', () => {
  it('vija nga zgjimi te gjumi: pikat sipas orës, stërvitja mes tyre, pjesa e rrugës nga 0 në 1', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    expect(rhythm.points.map((point) => `${point.time} ${point.id}`)).toEqual([
      '07:00 breakfast_1',
      '07:45 breakfast_2',
      '10:30 snack_am',
      '13:00 lunch',
      '15:30 snack_pm',
      '18:30 dinner',
      '20:45 pre_workout',
      '21:00 workout',
      '22:20 post_workout',
      '23:00 bedtime',
    ])
    const [first] = rhythm.points
    const last = rhythm.points[rhythm.points.length - 1]
    expect(first.fraction).toBeCloseTo(0, 5)
    expect(last.fraction).toBeCloseTo((23 * 60 - 7 * 60) / (16.5 * 60), 5)
    expect(rhythm.nowFraction).toBeCloseTo((17.5 * 60 - 7 * 60) / (16.5 * 60), 5)
    expect(rhythm.nowTime).toBe('17:30')
  })

  it('e kaluara dhe e ardhmja: të ngrënat janë të mbushura, vaktet pa regjistrim pas "Tani" janë të ardhme', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    const byId = Object.fromEntries(rhythm.points.map((point) => [point.id, point]))
    expect(byId.lunch).toMatchObject({ done: true, past: true })
    expect(byId.dinner).toMatchObject({ done: false, past: false })
    expect(byId.workout).toMatchObject({ kind: 'workout', done: false, past: false })
  })

  it('vakti i radhës: i pari pa regjistrim që nuk ka kaluar më shumë se 1 orë; "pas" në minuta', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    expect(rhythm.next).toMatchObject({ id: 'dinner', time: '18:30' })
    expect(rhythm.nextInMinutes).toBe(60)
    // Një vakt pa regjistrim që e kaloi ora me 30 min mbetet i radhës ("pas" negativ nuk del: 0).
    const late = board({ now: '13:30', eaten: ['breakfast_1', 'breakfast_2', 'snack_am'] })
    expect(late.next).toMatchObject({ id: 'lunch' })
    expect(late.nextInMinutes).toBe(0)
    // Pas më shumë se 1 ore pa regjistrim, vakti kalon te "i harruar" dhe radha vazhdon.
    const missed = board({ now: '14:10', eaten: ['breakfast_1', 'breakfast_2', 'snack_am'] })
    expect(missed.next).toMatchObject({ id: 'snack_pm' })
    expect(missed.nextInMinutes).toBe(80)
  })

  it('numëron vaktet e ngrënë nga të gjitha: "5 nga 9"; stërvitja nuk është vakt', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    expect(rhythm.eatenMeals).toBe(5)
    expect(rhythm.totalMeals).toBe(9)
  })

  it('para zgjimit "Tani" qëndron në fillim, pas gjumit në fund; pas mesnate orët vazhdojnë', () => {
    expect(board({ now: '05:40' }).nowFraction).toBe(0)
    expect(board({ now: '23:50' }).nowFraction).toBe(1)
    // 00:15 e ditës së ushqimit (V46) vjen si 1455 minuta: mbi 23:30.
    const after = rhythmOf({ wakeTime: '07:00', sleepTime: '23:30', meals: [], workout: null, nowMinutes: 1455 })
    expect(after.nowFraction).toBe(1)
    expect(after.nowTime).toBe('00:15')
  })

  it('gjumi pas mesnate: vija zgjat deri 01:00 dhe vakti para gjumit 00:30 është brenda saj', () => {
    const schedule = mealSchedule({ wakeTime: '08:20', sleepTime: '01:00', trainingTime: null })
    const meals = schedule.map((entry): RhythmMeal => ({ meal: entry.meal, time: entry.time, minutes: entry.minutes, eaten: false, kcal: 0, proteinG: 0 }))
    const rhythm = rhythmOf({ wakeTime: '08:20', sleepTime: '01:00', meals, workout: null, nowMinutes: time('12:00') })
    const bedtime = rhythm.points.find((point) => point.id === 'bedtime')!
    expect(bedtime.time).toBe('00:30')
    expect(bedtime.fraction).toBeGreaterThan(0.9)
    expect(bedtime.fraction).toBeLessThan(1)
  })

  it('pa stërvitje sot: asnjë pikë stërvitjeje; stërvitja e bërë del e mbushur', () => {
    expect(board({ now: '12:00', training: null }).points.some((point) => point.kind === 'workout')).toBe(false)
    const done = rhythmOf({ wakeTime: '07:00', sleepTime: '23:30', meals: [], workout: { time: '17:15', done: true }, nowMinutes: time('19:00') })
    expect(done.points).toEqual([expect.objectContaining({ id: 'workout', done: true, past: true })])
  })
})

describe('nearestPoint', () => {
  const rhythm = board({ now: '17:30', eaten: FIVE })

  it('kthen pikën më të afërt me gishtin, nga e majta te e djathta', () => {
    expect(nearestPoint(rhythm.points, 0)?.id).toBe('breakfast_1')
    expect(nearestPoint(rhythm.points, 1)?.id).toBe('bedtime')
    const lunch = rhythm.points.find((point) => point.id === 'lunch')!
    expect(nearestPoint(rhythm.points, lunch.fraction + 0.01)?.id).toBe('lunch')
    expect(nearestPoint(rhythm.points, lunch.fraction - 0.01)?.id).toBe('lunch')
  })

  it('në mes të dy pikave fiton ajo para; pa pika, null', () => {
    const [a, b] = rhythm.points
    expect(nearestPoint(rhythm.points, (a.fraction + b.fraction) / 2)?.id).toBe(a.id)
    expect(nearestPoint([], 0.5)).toBeNull()
  })
})

describe('canMoveMeal', () => {
  const rhythm = board({ now: '17:30', eaten: FIVE })
  const can = (id: string) => canMoveMeal(rhythm.points.find((point) => point.id === id)!, rhythm.nowMinutes)

  it('lëviz vetëm një vakt që vjen: jo të ngrënat, jo stërvitja, jo vaktet para dhe pas saj, jo vakti para gjumit', () => {
    expect(can('dinner')).toBe(true)
    expect(can('lunch')).toBe(false)
    expect(can('workout')).toBe(false)
    expect(can('pre_workout')).toBe(false)
    expect(can('post_workout')).toBe(false)
    expect(can('bedtime')).toBe(false)
  })

  it('një vakt pa regjistrim që e kaloi ora brenda 1 ore ende lëviz; pas saj jo', () => {
    const near = board({ now: '13:30', eaten: ['breakfast_1', 'breakfast_2', 'snack_am'] })
    expect(canMoveMeal(near.points.find((point) => point.id === 'lunch')!, near.nowMinutes)).toBe(true)
    const far = board({ now: '14:10', eaten: ['breakfast_1', 'breakfast_2', 'snack_am'] })
    expect(canMoveMeal(far.points.find((point) => point.id === 'lunch')!, far.nowMinutes)).toBe(false)
  })
})

describe('moveMeals (V35)', () => {
  it('bordi "Leviz": darka 18:30 → 19:15; vaktet para dhe pas stërvitjes dhe para gjumit nuk lëvizin', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    const move = moveMeals(rhythm.points, 'dinner', time('19:15'), rhythm.nowMinutes)!
    expect(move).toMatchObject({ meal: 'dinner', minutes: time('19:15'), delta: 45, clamped: false, shifts: [] })
  })

  it('vaktet që vijnë pas tij lëvizin bashkë me të, me të njëjtën diferencë', () => {
    // Mëngjesi 1 (07:00) → 07:30 zhvendos mëngjesin 2 dhe snack-un e paraditës, por jo të ngrënat.
    const rhythm = board({ now: '06:40' })
    const move = moveMeals(rhythm.points, 'breakfast_1', time('07:30'), rhythm.nowMinutes)!
    expect(move.minutes).toBe(time('07:30'))
    expect(move.shifts).toEqual([
      { meal: 'breakfast_2', from: time('07:45'), to: time('08:15') },
      { meal: 'snack_am', from: time('10:30'), to: time('11:00') },
      { meal: 'lunch', from: time('13:00'), to: time('13:30') },
      { meal: 'snack_pm', from: time('15:30'), to: time('16:00') },
      { meal: 'dinner', from: time('18:30'), to: time('19:00') },
    ])
  })

  it('ora rrumbullakoset në 5 minuta', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    expect(moveMeals(rhythm.points, 'dinner', time('19:12'), rhythm.nowMinutes)?.minutes).toBe(time('19:10'))
    expect(moveMeals(rhythm.points, 'dinner', time('19:13'), rhythm.nowMinutes)?.minutes).toBe(time('19:15'))
  })

  it('nuk futet në të kaluarën: jo para "Tani"', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    const move = moveMeals(rhythm.points, 'dinner', time('16:00'), rhythm.nowMinutes)!
    expect(move.minutes).toBe(time('17:30'))
    expect(move.clamped).toBe(true)
  })

  it('nuk e kalon vaktin pas të cilit vjen një pikë e fiksuar: darka mbetet para vaktit para stërvitjes me një hendek', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    const move = moveMeals(rhythm.points, 'dinner', time('21:30'), rhythm.nowMinutes)!
    expect(move.minutes).toBe(time('20:45') - MIN_GAP_MINUTES)
    expect(move.clamped).toBe(true)
  })

  it('nuk e kalon vaktin e ngrënë para tij: mbetet pas tij me një hendek', () => {
    const rhythm = board({ now: '13:20', eaten: ['breakfast_1', 'breakfast_2', 'snack_am', 'lunch'] })
    const move = moveMeals(rhythm.points, 'snack_pm', time('12:00'), rhythm.nowMinutes)!
    expect(move.minutes).toBe(time('13:20'))
  })

  it('vaktet pas tij nuk e kalojnë pikën e fiksuar: diferenca kufizohet nga vakti i fundit që lëviz', () => {
    const rhythm = board({ now: '06:40' })
    // Snack-u i pasdites (15:30) tërheq darkën (18:30); darka mban 10 min para vaktit para stërvitjes (20:45).
    const move = moveMeals(rhythm.points, 'snack_pm', time('18:00'), rhythm.nowMinutes)!
    expect(move.shifts).toEqual([{ meal: 'dinner', from: time('18:30'), to: time('20:35') }])
    expect(move.minutes).toBe(time('17:35'))
    expect(move.clamped).toBe(true)
  })

  it('pa ndryshim (e njëjta orë) kthen diferencën 0; vakti që nuk lëviz kthen null', () => {
    const rhythm = board({ now: '17:30', eaten: FIVE })
    expect(moveMeals(rhythm.points, 'dinner', time('18:30'), rhythm.nowMinutes)).toMatchObject({ delta: 0, shifts: [] })
    expect(moveMeals(rhythm.points, 'lunch', time('14:00'), rhythm.nowMinutes)).toBeNull()
    expect(moveMeals(rhythm.points, 'bedtime', time('23:15'), rhythm.nowMinutes)).toBeNull()
  })

  it('pas mesnate: darka e lëvizur pas 00:00 mbetet në të njëjtën ditë ushqimi (minuta mbi 1440)', () => {
    const schedule = mealSchedule({ wakeTime: '08:20', sleepTime: '03:00', trainingTime: null })
    const meals = schedule.map((entry): RhythmMeal => ({ meal: entry.meal, time: entry.time, minutes: entry.minutes, eaten: false, kcal: 0, proteinG: 0 }))
    const rhythm = rhythmOf({ wakeTime: '08:20', sleepTime: '03:00', meals, workout: null, nowMinutes: time('19:00') })
    const dinner = rhythm.points.find((point) => point.id === 'dinner')!
    const move = moveMeals(rhythm.points, 'dinner', dinner.minutes + 300, rhythm.nowMinutes)!
    expect(move.minutes).toBe(dinner.minutes + 300)
    expect(clockText(move.minutes)).toBe('00:50')
  })
})

describe('clockText dhe untilParts', () => {
  it('ora e ditës nga minutat, edhe mbi 24 orë', () => {
    expect(clockText(time('07:05'))).toBe('07:05')
    expect(clockText(1455)).toBe('00:15')
  })

  it('"pas" ndahet në orë dhe minuta: 5 min, 1 orë, 1 orë 30 min', () => {
    expect(untilParts(5)).toEqual({ hours: 0, minutes: 5 })
    expect(untilParts(60)).toEqual({ hours: 1, minutes: 0 })
    expect(untilParts(90)).toEqual({ hours: 1, minutes: 30 })
    expect(untilParts(0)).toEqual({ hours: 0, minutes: 0 })
    // Rrumbullakohet te minuta e plotë.
    expect(untilParts(59.6)).toEqual({ hours: 1, minutes: 0 })
  })
})
