import { SUPPLEMENTS } from '@/nutrition/supplements'
import { planReminders, type ReminderInput } from './plan'

const base = (overrides: Partial<ReminderInput> = {}): ReminderInput => ({
  from: new Date('2026-12-09T06:00:00'),
  days: 1,
  wakeTime: '07:00',
  sleepTime: '23:00',
  trainingTime: '18:00',
  trainingDays: [1, 2, 4, 5],
  toggles: { meals: true, supplements: true, training: true, measurements: true },
  measurementDay: 7,
  nextWorkoutLabel: 'Java 2 · Stërvitja 3',
  supplements: SUPPLEMENTS.map((supplement, index) => ({ ...supplement, id: `s${index}`, enabled: true })),
  dayTypes: {},
  ...overrides,
})

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const lines = (input: ReminderInput) => planReminders(input).map((item) => `${hhmm(item.at)} ${item.title}: ${item.body}`)

describe('rikujtuesit (§13)', () => {
  it('ditë pushimi: shtatë vaktet me artikujt e planit dhe suplementet', () => {
    expect(lines(base())).toEqual([
      '07:00 Mëngjesi 1: Pluhur proteine, pjepër · me pluhur proteine',
      '07:45 Mëngjesi 2: Vezë, e bardhë veze, vaj ulliri, djathë amerikan me pak yndyrë, tërshërë e gatuar',
      '10:30 Snack paradite: Gjizë me pak yndyrë, ananas, clif bar',
      '13:00 Dreka: Ton albacore në ujë, bukë integrale, majonezë light, mollë · me multivitaminë',
      '15:30 Snack pasdite: Pluhur proteine, gjalpë kikiriku, reçel, bukë integrale · me pluhur proteine',
      '18:30 Darka: Salmon, brokoli, sallatë jeshile e përzier, salcë me vaj ulliri dhe uthull',
      '22:30 Para gjumit: Pluhur proteine, gjalpë kikiriku · me pluhur proteine, zma',
    ])
  })

  it('ditë stërvitjeje: në mëngjes stërvitja e radhës; vaktet para dhe pas', () => {
    const items = lines(base({ from: new Date('2026-12-07T06:00:00') }))
    expect(items).toContain('07:30 Sot: Java 2 · Stërvitja 3: Stërvitja 18:00')
    expect(items.filter((item) => item.startsWith('17:45') || item.startsWith('19:30'))).toEqual([
      '17:45 Para stërvitjes: Mollë, pluhur proteine · me pluhur proteine, kreatinë, beta-alaninë, betainë, bcaa',
      '19:30 Pas stërvitjes: Karamele gummy · me kreatinë, beta-alaninë, betainë, bcaa, karnitinë, glutaminë, dekstrozë ose gummy',
    ])
  })

  it('pa rikujtues vaktesh: vetëm suplementet; ato që kanë kaluar nuk planifikohen', () => {
    const items = lines(base({ from: new Date('2026-12-09T13:10:00'), toggles: { meals: false, supplements: true, training: true, measurements: true } }))
    expect(items).toEqual(['15:30 Suplementet · Snack pasdite: Pluhur proteine', '22:30 Suplementet · Para gjumit: Pluhur proteine, ZMA'])
  })

  it('java: matja të dielën në zgjim, stërvitjet pas së parës pa emër, id të ndryshme', () => {
    const all = planReminders(base({ days: 7 }))
    const sunday = all.filter((item) => item.at.getDay() === 0 && item.kind === 'measurement')
    expect(sunday.map((item) => `${hhmm(item.at)} ${item.title}`)).toEqual(['07:00 Matja e javës'])
    expect(all.filter((item) => item.kind === 'training').map((item) => item.title)).toEqual(['Sot: Java 2 · Stërvitja 3', 'Sot ke stërvitje', 'Sot ke stërvitje', 'Sot ke stërvitje'])
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length)
    expect(all.every((item) => item.id >= 5000 && item.id < 5200)).toBe(true)
  })

  it('dita e ndryshuar me dorë ndjek llojin e ri; çdo gjë e fikur nuk planifikon asgjë', () => {
    expect(lines(base({ dayTypes: { '2026-12-09': 'training' } }))).toContain('07:30 Sot: Java 2 · Stërvitja 3: Stërvitja 18:00')
    expect(planReminders(base({ toggles: { meals: false, supplements: false, training: false, measurements: false }, days: 7 }))).toEqual([])
  })

  it('gjumi pas mesnate: vakti para gjumit del pas mesnate, në ditën e nesërme', () => {
    const [last] = planReminders(base({ sleepTime: '00:30' })).slice(-1)
    expect([last.title, last.at.getDate(), hhmm(last.at)]).toEqual(['Para gjumit', 10, '00:00'])
  })
})
