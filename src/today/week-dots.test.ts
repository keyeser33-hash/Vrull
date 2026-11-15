import type { IntakeDayView, IntakeGoal, TrainingDayState } from '@/progress/weekly-goals'
import { dayDots, type DotsInput } from './week-dots'

// Tri pikat nën çdo datë të rripit të javës (V57, SPEC §0.3f; rregullat e qëllimeve të V43): stërvitja vetëm në
// ditët e stërvitjes, ushqimi, uji; e mbushur kur dita e arriti, e zbrazët kur jo, asgjë për ditët që vijnë.

const MONDAY = '2026-11-09'
const date = (offset: number) => `2026-11-${String(9 + offset).padStart(2, '0')}`

const intake = (counted: boolean[], none = false): IntakeGoal => ({
  goal: 5,
  counted: counted.filter(Boolean).length,
  met: false,
  days: counted.map(
    (hit, index): IntakeDayView => ({ date: date(index), amount: hit ? 100 : 0, target: none ? null : 100, percent: none ? null : hit ? 100 : 0, state: none ? 'none' : hit ? 'counted' : 'missed' }),
  ),
})

function input(over: { training?: [TrainingDayState, boolean][]; food?: IntakeGoal | null; water?: IntakeGoal | null; foodToday?: string }): DotsInput {
  const training = over.training ?? [
    ['done', true],
    ['done', true],
    ['rest', false],
    ['planned', true],
    ['planned', true],
    ['rest', false],
    ['rest', false],
  ]
  return {
    foodToday: over.foodToday ?? date(2),
    training: { days: training.map(([state, isTraining], index) => ({ date: date(index), training: isTraining, state, sessionId: null, weekday: index + 1, day: 9 + index, today: false })) },
    food: over.food === undefined ? intake([true, true, true, false, false, false, false]) : over.food,
    water: over.water === undefined ? intake([true, false, true, false, false, false, false]) : over.water,
  }
}

describe('dayDots', () => {
  it('dita e kaluar e stërvitjes: stërvitja e bërë, ushqimi i arritur, uji jo', () => {
    expect(dayDots(input({}), date(1))).toEqual({ training: 'on', food: 'on', water: 'off' })
  })

  it('dita e pushimit: pa pikë stërvitjeje; ushqimi dhe uji sipas ditës', () => {
    expect(dayDots(input({}), date(2))).toEqual({ training: null, food: 'on', water: 'on' })
  })

  it('stërvitja e munguar e një dite të kaluar është e zbrazët', () => {
    const missed = input({ training: [['missed', true], ['done', true], ['rest', false], ['planned', true], ['planned', true], ['rest', false], ['rest', false]], foodToday: date(2) })
    expect(dayDots(missed, date(0))).toEqual({ training: 'off', food: 'on', water: 'on' })
  })

  it('dita rezervë e mbulon stërvitjen e munguar: pika e mbushur', () => {
    const spare = input({ training: [['spare', true], ['done', true], ['rest', false], ['planned', true], ['planned', true], ['rest', false], ['rest', false]] })
    expect(dayDots(spare, date(0))?.training).toBe('on')
  })

  it('sot: pikat e gjalla; e zbrazët deri sa dita të arrijë çdo qëllim', () => {
    // Sot (e mërkura) është pushim: ushqimi i arritur, uji jo ende.
    const today = input({ food: intake([true, true, true, false, false, false, false]), water: intake([true, true, false, false, false, false, false]) })
    expect(dayDots(today, date(2))).toEqual({ training: null, food: 'on', water: 'off' })
    // Sot ditë stërvitjeje pa seancë: pika e stërvitjes e zbrazët.
    const training = input({ foodToday: date(3) })
    expect(dayDots(training, date(3))).toEqual({ training: 'off', food: 'off', water: 'off' })
  })

  it('ditët që vijnë: asgjë', () => {
    expect(dayDots(input({}), date(3))).toBeNull()
    expect(dayDots(input({}), date(6))).toBeNull()
  })

  it('dita e ushqimit (V46): pas mesnate "sot" mbetet e djeshmja, dhe e sotmja kalendarike është ende e ardhme', () => {
    const lateNight = input({ foodToday: date(1) })
    expect(dayDots(lateNight, date(1))).not.toBeNull()
    expect(dayDots(lateNight, date(2))).toBeNull()
  })

  it('pa objektiva (pa peshë): pa pikë ushqimi dhe uji', () => {
    const none = input({ food: intake([false, false, false, false, false, false, false], true), water: null })
    expect(dayDots(none, date(1))).toEqual({ training: 'on', food: null, water: null })
  })

  it('një ditë jo stërvitjeje me seancë të bërë: pika e stërvitjes e mbushur', () => {
    const extra = input({ training: [['done', false], ['done', true], ['rest', false], ['planned', true], ['planned', true], ['rest', false], ['rest', false]] })
    expect(dayDots(extra, date(0))?.training).toBe('on')
  })

  it('një datë jashtë javës: null', () => {
    expect(dayDots(input({}), '2026-11-20')).toBeNull()
    expect(MONDAY).toBe(date(0))
  })
})
