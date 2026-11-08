import { upcomingDates, workoutMinutes } from './week-plan'

// Java e programit në kalendar (bordi "Programi"): sa zgjat një stërvitje dhe kur bie secila nga
// stërvitjet që vijnë, sipas ditëve të stërvitjes. Radha ecën sipas stërvitjeve, jo sipas kalendarit
// (Q3): datat janë vetëm parashikim.

const day = (iso: string) => new Date(`${iso}T09:00:00`)
const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

describe('kohëzgjatja e stërvitjes', () => {
  it('Stërvitja 1 e Javës 2: 30 sete, pushimi 90 s dhe 60 s te pulpat, del ~65 min', () => {
    const slots = [
      ...Array.from({ length: 7 }, (_, index) => ({ sets: index === 0 ? 4 : 3, restSeconds: 90 })),
      { sets: 4, restSeconds: 60 },
      { sets: 4, restSeconds: 60 },
    ]
    expect(slots.reduce((total, slot) => total + slot.sets, 0)).toBe(30)
    expect(workoutMinutes(slots)).toBe(65)
  })

  it('rrumbullakohet te 5 minutat, të paktën 5', () => {
    expect(workoutMinutes([{ sets: 1, restSeconds: 0 }])).toBe(5)
    expect(workoutMinutes([])).toBe(0)
    expect(workoutMinutes([{ sets: 10, restSeconds: 90 }])).toBe(25)
  })
})

describe('datat e stërvitjeve që vijnë', () => {
  // Të dhënat e mostrës: ditët e stërvitjes e diel, e hënë, e martë, e enjte; sot e diel 8 nëntor.
  const trainingDays = [7, 1, 2, 4]

  it('stërvitja e radhës bie sot kur sot është ditë stërvitjeje, pastaj ditët e stërvitjes me radhë', () => {
    const dates = upcomingDates({ count: 5, trainingDays, today: day('2026-11-08'), trainedToday: false })
    expect(dates.map(isoDay)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-15'])
  })

  it('pas një stërvitjeje sot, e radha shkon te dita tjetër e stërvitjes', () => {
    const dates = upcomingDates({ count: 2, trainingDays, today: day('2026-11-08'), trainedToday: true })
    expect(dates.map(isoDay)).toEqual(['2026-11-09', '2026-11-10'])
  })

  it('në një ditë pushimi, e radha bie në ditën e parë të stërvitjes që vjen', () => {
    const dates = upcomingDates({ count: 2, trainingDays, today: day('2026-11-11'), trainedToday: false })
    expect(dates.map(isoDay)).toEqual(['2026-11-12', '2026-11-15'])
  })

  it('pa ditë stërvitjeje nuk ka data', () => {
    expect(upcomingDates({ count: 3, trainingDays: [], today: day('2026-11-08'), trainedToday: false })).toEqual([])
  })
})
