import { shiftDate } from '@/lib/calendar'
import type { MissedInput } from '@/program/missed-day'
import {
  completeWeek,
  foodGoal,
  type GoalSession,
  lighterWeight,
  mondayOf,
  streakAt,
  type TrainingInput,
  trainingDays,
  trainingLedger,
  waterGoal,
  weekCardMonday,
  weekDates,
  weekRecords,
  weekWeight,
  welcomeBackDays,
} from './weekly-goals'

// Qëllimet e javës (V43, SPEC §0.3c): ditët e stërvitjes e hënë, e martë, e enjte, e premte, si te
// përdoruesi. E hëna 2 nëntor 2026 nis javën e parë; blloqet janë çelësa ("P1", "P2").

let counter = 0
const session = (date: string, block: string | null = 'P1', status: GoalSession['status'] = 'completed'): GoalSession => ({
  id: `s${++counter}`,
  date,
  at: `${date}T20:00:00.000Z`,
  status,
  block,
})

/** Seancat e mbyllura të një jave në ditët e dhëna (0 = e hëna). */
const week = (monday: string, offsets: number[], block = 'P1') => offsets.map((offset) => session(shiftDate(monday, offset), block))

function input(sessions: GoalSession[], days: Partial<MissedInput> = {}, pointerBlock: string | null = 'P1'): TrainingInput {
  return {
    days: { trainingDays: [1, 2, 4, 5], startedOn: '2026-11-02', sessionDates: sessions.map((entry) => entry.date), dayTypes: {}, ...days },
    sessions,
    pointerBlock,
  }
}

const W1 = '2026-11-02'
const W2 = '2026-11-09'
const W3 = '2026-11-16'
const W4 = '2026-11-23'

describe('java kalendarike', () => {
  it('e hëna e javës dhe shtatë datat e saj', () => {
    expect(mondayOf('2026-11-08')).toBe(W1)
    expect(mondayOf(W2)).toBe(W2)
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
    expect(weekDates(W1)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
  })
})

describe('qëllimi i stërvitjes dhe dita rezervë', () => {
  it('java e plotë: 4 nga 4, pa ditën rezervë', () => {
    const { weeks } = trainingLedger(input(week(W1, [0, 1, 3, 4])), W2)
    expect(weeks[0]).toMatchObject({ monday: W1, target: 4, done: 4, closed: true, met: true, spare: null, block: 'P1' })
    expect(weeks[0].trainingDates).toEqual(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'])
  })

  it('3 nga 4 me ditën rezervë të lirë: qëllimi arrihet, dita rezervë mbulon të premten', () => {
    const ledger = trainingLedger(input(week(W1, [0, 1, 3])), W2)
    expect(ledger.weeks[0]).toMatchObject({ target: 4, done: 3, met: true, spare: { block: 'P1', date: '2026-11-06' } })
    expect([...ledger.spareUsed]).toEqual([['P1', W1]])
  })

  it('3 nga 4 kur blloku e ka përdorur ditën rezervë: qëllimi nuk arrihet', () => {
    const { weeks } = trainingLedger(input([...week(W1, [0, 1, 3]), ...week(W2, [0, 3, 4])]), W3)
    expect(weeks[0]).toMatchObject({ met: true, spare: { block: 'P1' } })
    expect(weeks[1]).toMatchObject({ done: 3, met: false, spare: null })
  })

  it('2 nga 4: dita rezervë nuk mbulon dy stërvitje dhe mbetet e lirë për më vonë', () => {
    const ledger = trainingLedger(input([...week(W1, [0, 1]), ...week(W2, [0, 1, 3])]), W3)
    expect(ledger.weeks[0]).toMatchObject({ done: 2, met: false, spare: null })
    expect(ledger.weeks[1]).toMatchObject({ done: 3, met: true, spare: { block: 'P1', date: '2026-11-13' } })
  })

  it('një për bllok: blloku i ri ka të vetën, por jo dy herë', () => {
    const sessions = [...week(W1, [0, 1, 3], 'P1'), ...week(W2, [0, 1, 3], 'P2'), ...week(W3, [0, 1, 3], 'P2')]
    const { weeks } = trainingLedger(input(sessions, {}, 'P2'), W4)
    expect(weeks.map((entry) => [entry.block, entry.met, entry.spare?.block ?? null])).toEqual([
      ['P1', true, 'P1'],
      ['P2', true, 'P2'],
      ['P2', false, null],
      // Java e tanishme, ende pa seancë: blloku i treguesit.
      ['P2', false, null],
    ])
  })

  it('blloku i javës është ai i seancës së fundit të saj', () => {
    // Faza 1 mbaron të martën, Faza 2 nis të enjten: java i përket Fazës 2, që ka ende ditën e vet.
    const sessions = [...week(W1, [0, 1, 3], 'P1'), session('2026-11-09', 'P1'), session('2026-11-10', 'P1'), session('2026-11-12', 'P2')]
    const { weeks } = trainingLedger(input(sessions), W3)
    expect(weeks[1]).toMatchObject({ block: 'P2', done: 3, met: true, spare: { block: 'P2' } })
  })

  it('java pa seancë merr bllokun e seancës pas saj; pa të, atë të treguesit', () => {
    // Java 2 ka vetëm të martën ditë stërvitjeje (të tjerat pushim me dorë) dhe asnjë seancë.
    const rest = { '2026-11-09': 'rest', '2026-11-12': 'rest', '2026-11-13': 'rest' } as const
    const later = trainingLedger(input([...week(W1, [0, 1, 3, 4]), ...week(W3, [0, 1, 3, 4], 'P2')], { dayTypes: rest }), W4)
    expect(later.weeks[1]).toMatchObject({ target: 1, done: 0, block: 'P2', met: true, spare: { block: 'P2', date: '2026-11-10' } })
    const none = trainingLedger(input(week(W1, [0, 1, 3, 4]), { dayTypes: rest }, 'P3'), W3)
    expect(none.weeks[1]).toMatchObject({ block: 'P3', spare: { block: 'P3' } })
  })

  it('java e tanishme mbetet e hapur: pa ditë rezervë para se të mbyllet', () => {
    const sessions = [...week(W1, [0, 1, 3, 4]), ...week(W2, [0, 1, 3])]
    const open = trainingLedger(input(sessions), '2026-11-14')
    expect(open.weeks.at(-1)).toMatchObject({ monday: W2, closed: false, done: 3, met: false, spare: null })
    expect(open.spareUsed.size).toBe(0)
    // E hëna pas saj java mbyllet dhe dita rezervë e mbulon.
    expect(trainingLedger(input(sessions), W3).weeks[1]).toMatchObject({ closed: true, met: true, spare: { date: '2026-11-13' } })
  })

  it('ditët me dorë: dita e humbur e bërë stërvitje të nesërmen nuk e rrit objektivin; pushimi me dorë e ul', () => {
    // E marta e humbur, e mërkura "Po, sot": pesë ditë stërvitjeje, por objektivi mbetet 4 nga 4.
    const moved = [session('2026-11-02'), session('2026-11-04'), session('2026-11-05'), session('2026-11-06')]
    const ledger = trainingLedger(input(moved, { dayTypes: { '2026-11-04': 'training' } }), W2)
    expect(ledger.weeks[0]).toMatchObject({ target: 4, done: 4, met: true, spare: null })
    expect(ledger.weeks[0].trainingDates).toContain('2026-11-04')
    const resting = trainingLedger(input(week(W1, [0, 1, 3]), { dayTypes: { '2026-11-06': 'rest' } }), W2)
    expect(resting.weeks[0]).toMatchObject({ target: 3, done: 3, met: true, spare: null })
  })

  it('java e parë numëron ditët nga fillimi; seancat e kapërcyera nuk numërohen', () => {
    const sessions = [session('2026-11-05'), session('2026-11-06', 'P1', 'skipped')]
    const { weeks } = trainingLedger(input(sessions, { startedOn: '2026-11-05' }), W2)
    expect(weeks[0]).toMatchObject({ target: 2, done: 1, met: true, spare: { date: '2026-11-06' } })
  })

  it('vargu: javët e mbyllura rresht, plus e tanishmja kur arrin qëllimin para të dielës', () => {
    const history = [...week(W1, [0, 1, 3, 4]), ...week(W2, [0, 1, 3]), ...week(W3, [0, 1, 3, 4]), ...week(W4, [0, 1])]
    const wednesday = trainingLedger(input(history), '2026-11-25')
    expect(streakAt(wednesday.weeks, W4)).toBe(3)
    const friday = trainingLedger(input([...history, ...week(W4, [3, 4])]), '2026-11-27')
    expect(streakAt(friday.weeks, W4)).toBe(4)
    // Vargu i një jave të kaluar: deri te ajo javë.
    expect(streakAt(friday.weeks, W2)).toBe(2)
  })

  it('vargu ndërpritet nga një javë pa qëllimin; një javë pa ditë stërvitjeje nuk e ndërpret', () => {
    const broken = trainingLedger(input([...week(W1, [0, 1, 3, 4]), ...week(W2, [0, 1]), ...week(W3, [0, 1, 3, 4])]), '2026-11-24')
    expect(streakAt(broken.weeks, W4)).toBe(1)
    const holiday = { '2026-11-09': 'rest', '2026-11-10': 'rest', '2026-11-12': 'rest', '2026-11-13': 'rest' } as const
    const kept = trainingLedger(input([...week(W1, [0, 1, 3, 4]), ...week(W3, [0, 1, 3, 4])], { dayTypes: holiday }), '2026-11-24')
    expect(kept.weeks[1]).toMatchObject({ target: 0, met: null })
    expect(streakAt(kept.weeks, W4)).toBe(2)
  })

  it('pa seanca dhe pa fillim: vetëm java e tanishme', () => {
    const { weeks } = trainingLedger(input([], { startedOn: null }, null), '2026-11-11')
    expect(weeks).toHaveLength(1)
    expect(weeks[0]).toMatchObject({ monday: W2, target: 4, done: 0, block: null, met: false })
    expect(streakAt(weeks, W2)).toBe(0)
  })
})

describe('ditët e stërvitjes së javës', () => {
  it('java e mbyllur me ditën rezervë: e bërë, pushim, rezervë', () => {
    const data = input(week(W1, [0, 1, 3]))
    const [first] = trainingLedger(data, W2).weeks
    expect(trainingDays(data, first, { foodToday: W2, programmeOpen: true }).map((day) => [day.date, day.training, day.state])).toEqual([
      ['2026-11-02', true, 'done'],
      ['2026-11-03', true, 'done'],
      ['2026-11-04', false, 'rest'],
      ['2026-11-05', true, 'done'],
      ['2026-11-06', true, 'spare'],
      ['2026-11-07', false, 'rest'],
      ['2026-11-08', false, 'rest'],
    ])
  })

  it('java e tanishme: e humbur sipas ditës së ushqimit, e kapërcyer, e planifikuar', () => {
    const sessions = [session('2026-11-09', 'P1', 'skipped'), session('2026-11-12')]
    const data = input(sessions)
    const current = trainingLedger(data, '2026-11-14').weeks.at(-1)!
    const states = (foodToday: string, programmeOpen = true) => trainingDays(data, current, { foodToday, programmeOpen }).map((day) => day.state)
    expect(states('2026-11-14')).toEqual(['skipped', 'missed', 'rest', 'done', 'missed', 'rest', 'rest'])
    // E shtuna 01:00: dita e ushqimit është ende e premtja, që nuk ka mbaruar.
    expect(states('2026-11-13')).toEqual(['skipped', 'missed', 'rest', 'done', 'planned', 'rest', 'rest'])
    // Pa program me stërvitje nuk ka ditë të humbura.
    expect(states('2026-11-14', false)).toEqual(['skipped', 'rest', 'rest', 'done', 'rest', 'rest', 'rest'])
    expect(trainingDays(data, current, { foodToday: '2026-11-14', programmeOpen: true })[3].sessionId).toBe(sessions[1].id)
  })
})

describe('ushqimi dhe uji: 5 ditë nga 7', () => {
  const days = (amounts: number[], target: number | null = 3000) => weekDates(W2).map((date, index) => ({ date, amount: amounts[index] ?? 0, target }))

  it('ushqimi: dita numërohet nga 60% e objektivit të saj; sot pjesërisht, nesër pret', () => {
    const goal = foodGoal(days([1800, 1799, 3200, 0, 1620, 0, 0]), '2026-11-13')!
    expect(goal).toMatchObject({ goal: 5, counted: 2, met: false })
    expect(goal.days.map((day) => [day.state, day.percent])).toEqual([
      ['counted', 60],
      ['missed', 60],
      ['counted', 107],
      ['missed', 0],
      ['partial', 54],
      ['upcoming', 0],
      ['upcoming', 0],
    ])
    expect(foodGoal(days([2000, 2000, 2000, 2000, 2000, 0, 0]), '2026-11-15')).toMatchObject({ counted: 5, met: true })
  })

  it('objektivi i çdo dite vlen për të: dita pa objektiv nuk numërohet', () => {
    const mixed = weekDates(W2).map((date, index) => ({ date, amount: 2000, target: index < 2 ? null : index % 2 ? 2720 : 3020 }))
    const goal = foodGoal(mixed, '2026-11-16')!
    expect(goal.counted).toBe(5)
    expect(goal.days.slice(0, 2).map((day) => day.state)).toEqual(['none', 'none'])
  })

  it('uji: dita numërohet kur arrin objektivin', () => {
    const goal = waterGoal(days([3500, 3250, 3750, 0, 0, 0, 0], 3500), '2026-11-11')!
    expect(goal).toMatchObject({ counted: 2, met: false })
    expect(goal.days.slice(0, 4).map((day) => day.state)).toEqual(['counted', 'missed', 'counted', 'upcoming'])
  })

  it('java pa objektiva nuk ka qëllimet e ushqimit dhe ujit', () => {
    expect(foodGoal(days([2000, 2000], null), '2026-11-11')).toBeNull()
    expect(waterGoal(days([2000, 2000], null), '2026-11-11')).toBeNull()
  })

  it('java e plotë: të tre qëllimet', () => {
    const food = foodGoal(days([2000, 2000, 2000, 2000, 2000]), '2026-11-16')
    const water = waterGoal(days([3500, 3500, 3500, 3500, 3500], 3500), '2026-11-16')
    expect(completeWeek(true, food, water)).toBe(true)
    expect(completeWeek(false, food, water)).toBe(false)
    expect(completeWeek(null, food, water)).toBe(false)
    expect(completeWeek(true, null, water)).toBe(false)
    expect(completeWeek(true, food, waterGoal(days([3500, 3500], 3500), '2026-11-16'))).toBe(false)
  })
})

describe('mirë se u ktheve', () => {
  it('7 ditë ose më shumë nga seanca e fundit e mbyllur; 6 jo; pa seancë jo', () => {
    expect(welcomeBackDays('2026-11-27', '2026-12-07')).toBe(10)
    expect(welcomeBackDays('2026-11-30', '2026-12-07')).toBe(7)
    expect(welcomeBackDays('2026-12-01', '2026-12-07')).toBeNull()
    expect(welcomeBackDays(null, '2026-12-07')).toBeNull()
  })

  it('seanca e parë më e lehtë: 90% e peshës së javës, poshtë sipas hapit të pajisjes', () => {
    expect(lighterWeight(62.5, 2.5)).toBe(55)
    expect(lighterWeight(22.5, 2)).toBe(20)
    expect(lighterWeight(40, 5)).toBe(35)
    expect(lighterWeight(100, 2.5)).toBe(90)
    // Kur 90% bie nën një hap, pesha mbetet.
    expect(lighterWeight(2, 2.5)).toBe(2)
  })
})

describe('përmbledhja e javës', () => {
  it('karta "Java jote" te Sot: nga e diela 20:00 deri në fund të së hënës', () => {
    expect(weekCardMonday(new Date(2026, 10, 22, 19, 59))).toBeNull()
    expect(weekCardMonday(new Date(2026, 10, 22, 20, 0))).toBe(W3)
    expect(weekCardMonday(new Date(2026, 10, 23, 0, 30))).toBe(W3)
    expect(weekCardMonday(new Date(2026, 10, 23, 23, 59))).toBe(W3)
    expect(weekCardMonday(new Date(2026, 10, 24, 0, 0))).toBeNull()
  })

  it('rekordet: numri i të gjithave dhe tri më të mëdhatë, një për ushtrim kundrejt më të mirit para javës', () => {
    const records = [
      { exerciseId: 'squat', e1rmKg: 100, previousBestKg: 98.7 },
      { exerciseId: 'bench', e1rmKg: 88.7, previousBestKg: 87.5 },
      { exerciseId: 'squat', e1rmKg: 101.3, previousBestKg: 100 },
      { exerciseId: 'press', e1rmKg: 29.3, previousBestKg: 27.3 },
      { exerciseId: 'curl', e1rmKg: 30, previousBestKg: 29.5 },
    ]
    const summary = weekRecords(records)
    expect(summary.count).toBe(5)
    expect(summary.top.map((record) => [record.exerciseId, record.e1rmKg, Math.round(record.gainKg * 10) / 10])).toEqual([
      ['squat', 101.3, 2.6],
      ['press', 29.3, 2],
      ['bench', 88.7, 1.2],
    ])
    expect(weekRecords([])).toEqual({ count: 0, top: [] })
  })

  it('pesha: mesatarja 7-ditore e së dielës dhe ndryshimi kundrejt së dielës para', () => {
    const weights = [
      { date: '2026-11-03', kg: 88 },
      { date: '2026-11-07', kg: 88.2 },
      { date: '2026-11-10', kg: 88.4 },
      { date: '2026-11-14', kg: 88.8 },
    ]
    expect(weekWeight(weights, '2026-11-15')).toEqual({ averageKg: 88.6, changeKg: 0.5 })
    expect(weekWeight(weights.slice(2), '2026-11-15')).toEqual({ averageKg: 88.6, changeKg: null })
    expect(weekWeight([], '2026-11-15')).toEqual({ averageKg: null, changeKg: null })
  })
})
