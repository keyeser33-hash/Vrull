import { i18nFor } from '@/i18n'
import { SUPPLEMENTS } from '@/nutrition/supplements'
import { planReminders, type ReminderInput } from './plan'

const sq = i18nFor('sq')
const en = i18nFor('en')

const base = (overrides: Partial<ReminderInput> = {}): ReminderInput => ({
  from: new Date('2026-12-09T06:00:00'),
  days: 1,
  wakeTime: '07:00',
  sleepTime: '23:00',
  trainingTime: '18:00',
  trainingDays: [1, 2, 4, 5],
  toggles: { meals: true, supplements: true, training: true, measurements: true },
  measurementDay: 7,
  nextWorkout: { blockName: 'Faza 1', blockWeeks: 4, week: 2, run: 1, dayNumber: 3 },
  supplements: SUPPLEMENTS.map((supplement, index) => ({ ...supplement, id: `s${index}`, enabled: true })),
  dayTypes: {},
  ...overrides,
})

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const lines = (input: ReminderInput, texts = sq) => planReminders(input, texts).map((item) => `${hhmm(item.at)} ${item.title}: ${item.body}`)

describe('rikujtuesit (§13)', () => {
  it('ditë pushimi: shtatë vaktet me artikujt e planit dhe suplementet', () => {
    expect(lines(base())).toEqual([
      '07:00 Mëngjesi 1: Pluhur proteine, pjepër · me pluhur proteine',
      '07:45 Mëngjesi 2: Vezë, e bardhë veze, vaj ulliri, djathë amerikan me pak yndyrë, tërshërë e gatuar',
      '10:30 Snack paradite: Gjizë me pak yndyrë, ananas, clif bar',
      '13:00 Dreka: Ton albacore në ujë, bukë integrale, majonezë light, mollë · me multivitaminë',
      '15:30 Snack pasdite: Pluhur proteine, gjalpë kikiriku, reçel, bukë integrale · me pluhur proteine',
      '18:30 Darka: Salmon, brokoli, sallatë jeshile e përzier, salcë me vaj ulliri dhe uthull',
      '22:30 Para gjumit: Pluhur proteine, gjalpë kikiriku · me pluhur proteine, ZMA',
    ])
  })

  it('ditë stërvitjeje: në mëngjes stërvitja e radhës; vaktet para dhe pas', () => {
    const items = lines(base({ from: new Date('2026-12-07T06:00:00') }))
    expect(items).toContain('07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00')
    expect(items.filter((item) => item.startsWith('17:45') || item.startsWith('19:30'))).toEqual([
      '17:45 Para stërvitjes: Mollë, pluhur proteine · me pluhur proteine, kreatinë, beta-alaninë, betainë, BCAA',
      '19:30 Pas stërvitjes: Karamele gummy · me kreatinë, beta-alaninë, betainë, BCAA, karnitinë, glutaminë, dekstrozë ose gummy',
    ])
  })

  it('në anglisht: vaktet, ushqimet, suplementet dhe stërvitja në gjuhën e app-it', () => {
    const items = lines(base({ from: new Date('2026-12-07T06:00:00'), days: 7 }), en)
    expect(items).toContain('07:30 Today: Phase 1 · Week 2 · Workout 3: Workout at 18:00')
    expect(items).toContain('07:00 Breakfast 1: Protein powder, cantaloupe · with protein powder')
    expect(items).toContain('19:30 Post-workout: Gummy sweets · with creatine, beta-alanine, betaine, BCAA, carnitine, glutamine, dextrose or gummies')
    expect(items).toContain('07:30 Workout today: Workout at 18:00')
    expect(items).toContain('07:00 Weekly measurement: Weight before breakfast, measurements and photos.')
    const supplementsOnly = lines(base({ from: new Date('2026-12-09T13:10:00'), toggles: { meals: false, supplements: true, training: true, measurements: true } }), en)
    expect(supplementsOnly).toEqual(['15:30 Supplements · Afternoon snack: Protein powder', '22:30 Supplements · Before bed: Protein powder, ZMA'])
  })

  it('pa rikujtues vaktesh: vetëm suplementet; ato që kanë kaluar nuk planifikohen', () => {
    const items = lines(base({ from: new Date('2026-12-09T13:10:00'), toggles: { meals: false, supplements: true, training: true, measurements: true } }))
    expect(items).toEqual(['15:30 Suplementet · Snack pasdite: Pluhur proteine', '22:30 Suplementet · Para gjumit: Pluhur proteine, ZMA'])
  })

  it('një suplement me emër tjetër mbetet siç është', () => {
    const supplements = [{ ...SUPPLEMENTS[9], name: 'Magnez', id: 'm', enabled: true }]
    const items = lines(base({ from: new Date('2026-12-09T13:10:00'), supplements, toggles: { meals: false, supplements: true, training: false, measurements: false } }), en)
    expect(items).toEqual(['22:30 Supplements · Before bed: Magnez'])
  })

  it('java: matja të dielën në zgjim, stërvitjet pas së parës pa emër, id të ndryshme', () => {
    const all = planReminders(base({ days: 7 }), sq)
    const sunday = all.filter((item) => item.at.getDay() === 0 && item.kind === 'measurement')
    expect(sunday.map((item) => `${hhmm(item.at)} ${item.title}`)).toEqual(['07:00 Matja e javës'])
    expect(all.filter((item) => item.kind === 'training').map((item) => item.title)).toEqual([
      'Sot: Faza 1 · Java 2 · Stërvitja 3',
      'Sot ke stërvitje',
      'Sot ke stërvitje',
      'Sot ke stërvitje',
    ])
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length)
    expect(all.every((item) => item.id >= 5000 && item.id < 5200)).toBe(true)
  })

  it('bllok me një javë: vetëm emri i bllokut; pa stërvitje të radhës, pa emër', () => {
    const week0 = { blockName: 'Java 0', blockWeeks: 1, week: 1, run: 1, dayNumber: 1 }
    expect(lines(base({ dayTypes: { '2026-12-09': 'training' }, nextWorkout: week0 }), en)).toContain('07:30 Today: Week 0 · Workout 1: Workout at 18:00')
    expect(lines(base({ dayTypes: { '2026-12-09': 'training' }, nextWorkout: null }))).toContain('07:30 Sot ke stërvitje: Stërvitja 18:00')
  })

  it('dita e ndryshuar me dorë ndjek llojin e ri; çdo gjë e fikur nuk planifikon asgjë', () => {
    expect(lines(base({ dayTypes: { '2026-12-09': 'training' } }))).toContain('07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00')
    expect(planReminders(base({ toggles: { meals: false, supplements: false, training: false, measurements: false }, days: 7 }), sq)).toEqual([])
  })

  it('gjumi pas mesnate: vakti para gjumit del pas mesnate, në ditën e nesërme', () => {
    const [last] = planReminders(base({ sleepTime: '00:30' }), sq).slice(-1)
    expect([last.title, last.at.getDate(), hhmm(last.at)]).toEqual(['Para gjumit', 10, '00:00'])
  })
})
