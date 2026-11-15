import { i18nFor } from '@/i18n'
import { SUPPLEMENTS } from '@/nutrition/supplements'
import { planReminders, type ReminderInput, reminderRoute, staleKeys } from './plan'

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
      '10:30 Snack paradite: Gjizë me pak yndyrë, ananas, Clif Bar',
      '13:00 Dreka: Ton albacore në ujë, bukë integrale, majonezë light, mollë · me multivitaminë',
      '15:30 Snack pasdite: Pluhur proteine, gjalpë kikiriku, reçel, bukë integrale · me pluhur proteine',
      '18:30 Darka: Salmon, brokoli, sallatë jeshile e përzier, salcë me vaj ulliri dhe uthull',
      '22:30 Para gjumit: Pluhur proteine, gjalpë kikiriku · me pluhur proteine, ZMA',
    ])
  })

  it('ditë stërvitjeje: në mëngjes stërvitja e radhës; vaktet para dhe pas', () => {
    const items = lines(base({ from: new Date('2026-12-07T06:00:00') }))
    expect(items).toContain('07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00')
    expect(items.filter((item) => item.startsWith('17:45') || item.startsWith('19:15'))).toEqual([
      '17:45 Para stërvitjes: Mollë, pluhur proteine · me pluhur proteine, kreatinë, beta-alaninë, betainë, BCAA',
      '19:15 Pas stërvitjes: Karamele gummy · me kreatinë, beta-alaninë, betainë, BCAA, karnitinë, glutaminë, dekstrozë ose gummy',
    ])
  })

  it('rikujtuesi i stërvitjes shton "Si ndihesh?" vetëm kur dita s\'ka check-in (V50)', () => {
    const monday = base({ from: new Date('2026-12-07T06:00:00') })
    const workout = (input: ReminderInput, texts = sq) => lines(input, texts).filter((item) => item.startsWith('07:30'))
    expect(workout({ ...monday, checkedIn: [] })).toEqual(['07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00. Si ndihesh?'])
    expect(workout({ ...monday, checkedIn: ['2026-12-07'] })).toEqual(['07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00'])
    expect(workout({ ...monday, checkedIn: ['2026-12-06'] })).toEqual(['07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00. Si ndihesh?'])
    // Pa listën (thirrës të vjetër) teksti mbetet si më parë.
    expect(workout(monday)).toEqual(['07:30 Sot: Faza 1 · Java 2 · Stërvitja 3: Stërvitja 18:00'])
    expect(workout({ ...monday, checkedIn: [] }, en)).toEqual(['07:30 Today: Phase 1 · Week 2 · Workout 3: Workout at 18:00. How are you feeling?'])
    // Ditë pushimi: asnjë rikujtues stërvitjeje, pra asnjë pyetje.
    expect(lines(base({ checkedIn: [] })).some((item) => item.includes('Si ndihesh?'))).toBe(false)
  })

  it('në anglisht: vaktet, ushqimet, suplementet dhe stërvitja në gjuhën e app-it', () => {
    const items = lines(base({ from: new Date('2026-12-07T06:00:00'), days: 7 }), en)
    expect(items).toContain('07:30 Today: Phase 1 · Week 2 · Workout 3: Workout at 18:00')
    expect(items).toContain('07:00 Breakfast 1: Protein powder, cantaloupe · with protein powder')
    expect(items).toContain('19:15 Post-workout: Gummy sweets · with creatine, beta-alanine, betaine, BCAA, carnitine, glutamine, dextrose or gummies')
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
    expect(planReminders(base({ toggles: { meals: false, supplements: false, training: false, measurements: false, week: false }, days: 7 }), sq)).toEqual([])
  })

  it('gjumi pas mesnate: vakti para gjumit del pas mesnate, në ditën e nesërme', () => {
    const [last] = planReminders(base({ sleepTime: '00:30' }), sq).slice(-1)
    expect([last.title, last.at.getDate(), hhmm(last.at)]).toEqual(['Para gjumit', 10, '00:00'])
  })
  it('planifikimi pas mesnate nuk e humb vaktin para gjumit të ditës që mbaron', () => {
    const items = planReminders(base({ from: new Date('2026-12-10T00:10:00'), wakeTime: '08:20', sleepTime: '01:00' }), sq)
    expect(items[0]).toMatchObject({ title: 'Para gjumit', at: new Date('2026-12-10T00:30:00') })
    expect(items.filter((item) => item.kind === 'training' || item.kind === 'measurement').every((item) => item.at.getDate() === 10)).toBe(true)
  })
  // V46: vaktet pas mesnate bien të nesërmen kalendarike, edhe kur gjumi është pas orës 04:00.
  it('gjumi pas mesnate: vakti para gjumit të nesërmen në orën e duhur', () => {
    const late = planReminders(base({ wakeTime: '08:20', sleepTime: '01:00' }), sq).filter((item) => item.kind === 'meal')
    expect(late.at(-1)).toMatchObject({ title: 'Para gjumit', at: new Date('2026-12-10T00:30:00') })
    const night = planReminders(base({ wakeTime: '12:00', sleepTime: '05:00' }), sq).filter((item) => item.kind === 'meal')
    expect(night.at(-1)).toMatchObject({ title: 'Para gjumit', at: new Date('2026-12-10T04:30:00') })
  })
})

describe('dita e humbur (V38)', () => {
  // E marta 8 dhjetor është ditë stërvitjeje; e mërkura 9 është pushim.
  const missed = (overrides: Partial<ReminderInput> = {}) => lines(base({ startedOn: '2026-12-01', sessionDates: ['2026-12-07'], ...overrides })).filter((item) => item.includes('Dje') || item.includes('yesterday'))

  it('e mërkurë pas një të marte pa seancë: njoftimi i mëngjesit me stërvitjen e radhës', () => {
    expect(missed()).toEqual(['07:30 Dje nuk u stërvite: Stërvitja 3 sot? Hap app-in për ta sjellë.'])
    expect(lines(base({ startedOn: '2026-12-01', sessionDates: [] }), en)).toContain('07:30 You didn’t train yesterday: Workout 3 today? Open the app to bring it over.')
  })

  it('pa njoftim kur dje kishte seancë, kur sot u zgjodh, para fillimit, ose pa program me stërvitje', () => {
    expect(missed({ nextWorkout: null })).toEqual([])
    expect(missed({ sessionDates: ['2026-12-08'] })).toEqual([])
    expect(missed({ dayTypes: { '2026-12-09': 'rest' } })).toEqual([])
    expect(missed({ startedOn: '2026-12-09' })).toEqual([])
    expect(lines(base({ sessionDates: [] })).some((item) => item.includes('Dje'))).toBe(false)
  })

  it('e marta që vjen: njoftimi i së mërkurës planifikohet dhe ikën kur e marta ka seancë', () => {
    const from = new Date('2026-12-08T06:00:00')
    expect(missed({ from, days: 2 })).toEqual(['07:30 Dje nuk u stërvite: Stërvitja 3 sot? Hap app-in për ta sjellë.'])
    expect(missed({ from, days: 2, sessionDates: ['2026-12-07', '2026-12-08'] })).toEqual([])
    // Pas disa ditësh stërvitjeje, stërvitja e radhës nuk dihet: pa numër.
    expect(missed({ from: new Date('2026-12-07T06:00:00'), days: 7 })).toEqual([
      '07:30 Dje nuk u stërvite: Stërvitja 3 sot? Hap app-in për ta sjellë.',
      '07:30 Dje nuk u stërvite: E bën sot stërvitjen e radhës? Hap app-in për ta sjellë.',
    ])
  })
})

describe('rikujtuesit e zgjuar (V37)', () => {
  const smart = (overrides: Partial<NonNullable<ReminderInput['smart']>> = {}): NonNullable<ReminderInput['smart']> => ({
    maxDaily: 4,
    logged: { meals: [], supplements: [], water: {} },
    quiet: null,
    muted: {},
    waterTargets: {},
    plan: {},
    ...overrides,
  })
  const MONDAY = new Date('2026-12-07T06:00:00')
  const kinds = (items: ReturnType<typeof planReminders>, kind: string) => items.filter((item) => item.kind === kind)
  const food = (items: ReturnType<typeof planReminders>) => items.filter((item) => item.kind === 'meal' || item.kind === 'supplements').map((item) => `${hhmm(item.at)} ${item.title}`)

  it('kufiri: ditë stërvitjeje me nëntë vakte, katër njoftime sipas përparësisë; stërvitja nuk numërohet', () => {
    const items = planReminders(base({ from: MONDAY, smart: smart() }), sq)
    expect(food(items)).toEqual(['13:00 Dreka', '17:45 Para stërvitjes', '19:15 Pas stërvitjes', '22:30 Para gjumit'])
    expect(kinds(items, 'training')).toHaveLength(1)
  })

  it('e diela 20:00 (V43): "Java jote është gati" një herë në javë, jashtë kufirit ditor, me orët e qeta; prekja hap përmbledhjen', () => {
    const items = planReminders(base({ from: MONDAY, days: 7, smart: smart() }), sq)
    expect(kinds(items, 'week')).toEqual([
      expect.objectContaining({ title: 'Java jote është gati', body: 'Qëllimet, rekordet dhe java tjetër.', key: 'week|2026-12-07|', data: { date: '2026-12-07' }, at: new Date('2026-12-13T20:00:00') }),
    ])
    expect(kinds(items, 'week')[0].actions).toBeUndefined()
    // E diela është pushim me shtatë vakte: kufiri mbetet katër vakte, njoftimi i javës vjen veç tyre.
    expect(items.filter((item) => (item.kind === 'meal' || item.kind === 'supplements') && item.at.getDate() === 13)).toHaveLength(4)
    const quiet = planReminders(base({ from: MONDAY, days: 7, smart: smart({ quiet: { from: '19:30', to: '21:00' } }) }), sq)
    expect(kinds(quiet, 'week').map((item) => item.at)).toEqual([new Date('2026-12-13T21:00:00')])
    expect(kinds(planReminders(base({ from: MONDAY, days: 7, toggles: { meals: true, supplements: true, training: true, measurements: true, week: false } }), sq), 'week')).toEqual([])
    // Pas 20:00 të së dielës nuk vjen më; java tjetër është jashtë 7 ditëve.
    expect(kinds(planReminders(base({ from: new Date('2026-12-13T20:30:00'), days: 7 }), sq), 'week')).toEqual([])
    expect(kinds(planReminders(base({ from: MONDAY, days: 7 }), en), 'week')[0]).toMatchObject({ title: 'Your week is ready', body: 'Your goals, records and next week.' })
    expect(reminderRoute('week|2026-12-07|')).toBe('/progresi/java/2026-12-07')
    expect(reminderRoute('meal|2026-12-07|lunch')).toBeNull()
    expect(reminderRoute(null)).toBeNull()
  })

  it('vakti i regjistruar nuk vjen, suplementet e tij vijnë më vete; kur janë marrë edhe ato, vjen i radhës', () => {
    const logged = { meals: ['2026-12-07|lunch'], supplements: [], water: {} }
    expect(food(planReminders(base({ from: MONDAY, smart: smart({ logged }) }), sq))).toEqual([
      '13:00 Suplementet · Dreka',
      '17:45 Para stërvitjes',
      '19:15 Pas stërvitjes',
      '22:30 Para gjumit',
    ])
    const lunchSupplements = SUPPLEMENTS.flatMap((supplement, index) => (supplement.timing.includes('lunch') ? [`2026-12-07|lunch|s${index}`] : []))
    const both = { ...logged, supplements: lunchSupplements }
    expect(food(planReminders(base({ from: MONDAY, smart: smart({ logged: both }) }), sq))).toEqual([
      '17:45 Para stërvitjes',
      '19:15 Pas stërvitjes',
      '20:15 Darka',
      '22:30 Para gjumit',
    ])
  })

  it('butonat, çelësi dhe teksti pas veprimit; trupi nga Plani im', () => {
    const plan = { rest: { lunch: { items: [{ name: 'Gjoks pule', sourceId: null }, { name: 'Bukë integrale', sourceId: 'jim:wheat_bread' }], kcal: 404, proteinG: 25.4 } } }
    const lunch = planReminders(base({ smart: smart({ plan }) }), sq).find((item) => item.title === 'Dreka')!
    expect(lunch).toMatchObject({
      kind: 'meal',
      body: 'Gjoks pule, bukë integrale · me multivitaminë',
      key: 'meal|2026-12-09|lunch',
      actions: [
        { id: 'ate', title: 'Hëngra si në plan' },
        { id: 'snooze', title: 'Shty 30 min' },
      ],
      data: { date: '2026-12-09', meal: 'lunch' },
      done: { ate: { title: 'Dreka u regjistrua', body: '404 kcal · 25 g proteina, si në plan' } },
    })
    expect(lunch.data?.supplementIds).toHaveLength(1)
    const en_ = planReminders(base({ smart: smart({ plan }) }), en).find((item) => item.title === 'Lunch')!
    expect(en_.actions?.map((action) => action.title)).toEqual(['Ate as planned', 'Snooze 30 min'])
  })

  it('uji: një rikujtues kur je prapa ritmit të ditës', () => {
    const drunk = (ml: number, time = '09:00') => ({ '2026-12-09': [{ ml, at: new Date(`2026-12-09T${time}:00`).getTime() }] })
    const at = (waterMl: number) =>
      kinds(planReminders(base({ from: new Date('2026-12-09T13:10:00'), smart: smart({ waterTargets: { '2026-12-09': 3000 }, logged: { meals: [], supplements: [], water: drunk(waterMl) } }) }), sq), 'water')
    expect(at(500).map((item) => `${hhmm(item.at)} ${item.title}: ${item.body}`)).toEqual(['15:00 Uji: 0,5 nga 3,0 L: Për këtë orë je pak prapa. Një gotë tani?'])
    expect(at(500)[0]).toMatchObject({ actions: [{ id: 'drank', title: 'Piva një gotë' }], data: { date: '2026-12-09', ml: 250 }, done: { drank: { title: 'U shtua një gotë', body: '0,75 nga 3,0 L' } } })
    expect(at(1500).map((item) => hhmm(item.at))).toEqual(['19:00'])
    expect(at(2500)).toEqual([])
  })

  it('uji: një herë në ditë; pas pikës së parë ku ishe prapa, as e dyta nuk vjen', () => {
    const drunk = (entries: [number, string][]) => ({ '2026-12-09': entries.map(([ml, time]) => ({ ml, at: new Date(`2026-12-09T${time}:00`).getTime() })) })
    const at16 = (entries: [number, string][]) =>
      kinds(planReminders(base({ from: new Date('2026-12-09T16:00:00'), smart: smart({ waterTargets: { '2026-12-09': 3000 }, logged: { meals: [], supplements: [], water: drunk(entries) } }) }), sq), 'water')
    // Te 15:00 ishe prapa (0,5 L): rikujtuesi i ditës erdhi atëherë, 19:00 nuk vjen.
    expect(at16([[500, '09:00']])).toEqual([])
    expect(at16([[500, '09:00'], [500, '15:30']])).toEqual([])
    // Te 15:00 ishe në ritëm; te 19:00 je prapa: ky është i vetmi i ditës.
    expect(at16([[1400, '14:00']]).map((item) => hhmm(item.at))).toEqual(['19:00'])
  })

  it('orët e qeta: rikujtuesi bie në fund të intervalit; i heshturi nuk vjen', () => {
    const lunch = planReminders(base({ smart: smart({ quiet: { from: '12:30', to: '14:00' } }) }), sq).find((item) => item.title === 'Dreka')!
    expect(hhmm(lunch.at)).toBe('14:00')
    const muted = planReminders(base({ smart: smart({ muted: { meal: true } }) }), sq)
    expect(kinds(muted, 'meal')).toEqual([])
    expect(kinds(muted, 'supplements').length).toBeGreaterThan(0)
    expect(planReminders(base({ smart: smart({ muted: { meal: true, supplements: true } }) }), sq).filter((item) => item.kind !== 'measurement')).toEqual([])
  })

  it('dita e humbur: "Po, sot" dhe "Jo, të enjten" te njoftimi', () => {
    const items = planReminders(base({ startedOn: '2026-12-01', sessionDates: ['2026-12-07'], nextWorkout: { blockName: 'Faza 1', blockWeeks: 4, week: 2, run: 1, dayNumber: 3, dayName: 'Shpinë, biceps, bark' }, smart: smart() }), sq)
    expect(kinds(items, 'missed')[0]).toMatchObject({
      title: 'Dje nuk u stërvite',
      body: 'Stërvitja 3, shpinë, biceps, bark, sot në 18:00?',
      actions: [
        { id: 'yes', title: 'Po, sot' },
        { id: 'no', title: 'Jo, të enjten' },
      ],
      data: { date: '2026-12-09' },
      done: { yes: { title: 'Sot është ditë stërvitjeje' }, no: { title: 'Sot mbetet ditë pushimi', body: 'Stërvitja e radhës: e enjte.' } },
    })
  })

  it('njoftimet e regjistruara ndërkohë hiqen nga paneli, ato që vijnë jo', () => {
    const logged = { meals: ['2026-12-09|lunch'], supplements: ['2026-12-09|bedtime|s9'], water: { '2026-12-09': [{ ml: 1500, at: new Date('2026-12-09T11:00:00').getTime() }], '2026-12-10': [] } }
    const input = smart({ logged, waterTargets: { '2026-12-09': 3000 } })
    const reminders = planReminders(base({ from: new Date('2026-12-09T13:10:00'), smart: input }), sq)
    expect(staleKeys(input, reminders).sort()).toEqual(['meal|2026-12-09|lunch', 'supplements|2026-12-09|bedtime'].sort())
  })
})
