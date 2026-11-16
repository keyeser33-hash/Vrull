import { shiftDate } from '@/lib/calendar'
import {
  ACHIEVEMENT_KEYS,
  type AchievementInput,
  type AchievementKey,
  type AchievementProgramme,
  type AchievementSession,
  achievementStates,
  type AchievementState,
  isNewAchievement,
  nearestAchievement,
  orderAchievements,
} from './achievements'
import type { IntakeDay } from './weekly-goals'

// Arritjet (V43, SPEC §0.3c), pa bazë: ditët e stërvitjes e hënë, e martë, e enjte, e premte, si te
// përdoruesi; java e parë nis të hënën 2 nëntor 2026. Programi si Shortcut to Size: Java 0 (1 javë),
// Faza 1–3 (4 javë secila), 4 ditë; seancat ndjekin treguesin me radhë.

const W1 = '2026-11-02'
const W2 = '2026-11-09'
const W3 = '2026-11-16'
const W4 = '2026-11-23'
const DAYS = ['d1', 'd2', 'd3', 'd4']
const STS: AchievementProgramme = {
  id: 'sts',
  blocks: [
    { id: 'j0', position: 0, weeks: 1 },
    { id: 'f1', position: 1, weeks: 4 },
    { id: 'f2', position: 2, weeks: 4 },
    { id: 'f3', position: 3, weeks: 4 },
  ],
  dayIds: DAYS,
}

/** Stërvitjet e programit me radhë (blloku, java, dita), si i jep treguesi. */
function workouts(programme: AchievementProgramme) {
  return [...programme.blocks]
    .sort((a, b) => a.position - b.position)
    .flatMap((block) => Array.from({ length: block.weeks }, (_, week) => programme.dayIds.map((dayId) => ({ blockId: block.id, week: week + 1, dayId }))).flat())
}

/** Ditët e stërvitjes nga e hëna e dhënë: e hëna, e marta, e enjtja, e premtja, javë pas jave. */
function trainingDates(monday: string, count: number) {
  return Array.from({ length: count }, (_, index) => shiftDate(monday, Math.floor(index / 4) * 7 + [0, 1, 3, 4][index % 4]))
}

let counter = 0
/** Seancat e mbyllura në datat e dhëna, me stërvitjet e programit nga `from` (indeksi i stërvitjes). */
function follow(dates: string[], options: { from?: number; programme?: AchievementProgramme; statuses?: Record<number, AchievementSession['status']>; run?: number } = {}): AchievementSession[] {
  const programme = options.programme ?? STS
  const list = workouts(programme)
  return dates.map((date, index) => {
    const workout = list[(options.from ?? 0) + index]
    return {
      id: `s${++counter}`,
      date,
      startedAt: `${date}T19:00:00.000Z`,
      endedAt: `${date}T20:00:00.000Z`,
      status: options.statuses?.[index] ?? 'completed',
      programId: programme.id,
      run: options.run ?? 1,
      blockId: workout.blockId,
      week: workout.week,
      dayId: workout.dayId,
    }
  })
}

function input(sessions: AchievementSession[], extra: Partial<AchievementInput> = {}): AchievementInput {
  return {
    today: '2026-12-10',
    days: { trainingDays: [1, 2, 4, 5], startedOn: W1, sessionDates: sessions.map((entry) => entry.date), dayTypes: {} },
    pointer: { run: 1, blockId: 'f1' },
    sessions,
    records: [],
    programmes: [STS],
    activeProgrammeId: 'sts',
    food: [],
    water: [],
    quizWeeks: [],
    quizOpenMonday: null,
    ...extra,
  }
}

const state = (states: AchievementState[], key: AchievementKey) => states.find((entry) => entry.key === key)!

/** Ditët e javës me shumën e dhënë kundrejt objektivit 100 (ushqimi: 60% mjafton). */
const intake = (monday: string, amounts: number[]): IntakeDay[] => amounts.map((amount, index) => ({ date: shiftDate(monday, index), amount, target: 100 }))

describe('arritjet pa histori', () => {
  it('njëmbëdhjetë arritjet, asnjë e fituar, me objektivat e progresit', () => {
    const states = achievementStates(input([]))
    expect(states.map((entry) => entry.key)).toEqual([...ACHIEVEMENT_KEYS])
    expect(ACHIEVEMENT_KEYS).toHaveLength(11)
    for (const key of ACHIEVEMENT_KEYS) expect(key).toMatch(/^[a-z0-9_]{1,40}$/)
    expect(states.every((entry) => entry.met === null)).toBe(true)
    expect(Object.fromEntries(states.map((entry) => [entry.key, [entry.progress.current, entry.progress.target]]))).toEqual({
      first_session: [0, 1],
      first_record: [0, 1],
      full_week: [0, 3],
      streak_4: [0, 4],
      records_10: [0, 10],
      phase_1: [0, 16],
      sessions_25: [0, 25],
      food_7: [0, 7],
      water_7: [0, 7],
      programme: [0, 13],
      quiz_4: [0, 4],
    })
  })

  it('pa program: faza dhe programi pa objektiv', () => {
    const states = achievementStates(input([], { programmes: [], activeProgrammeId: null, pointer: null }))
    expect(state(states, 'phase_1').progress).toEqual({ current: 0, target: 0 })
    expect(state(states, 'programme').progress).toEqual({ current: 0, target: 0 })
  })
})

describe('kuizi 4 javë (§0.3e)', () => {
  const week = (monday: string, doneOn: string | null, available = true) => ({ monday, doneOn, available })

  it('data është dita kur u mbyll kuizi i katërt rresht, pa seancë', () => {
    const quizWeeks = [week(W1, '2026-11-08'), week(W2, null, false), week(W3, '2026-11-23'), week(W4, '2026-11-29'), week('2026-11-30', '2026-12-06')]
    expect(state(achievementStates(input([], { quizWeeks })), 'quiz_4')).toEqual({ key: 'quiz_4', met: { date: '2026-12-06', sessionId: null }, progress: { current: 4, target: 4 } })
  })

  it('pa 4 rresht: progresi është vargu i tanishëm, me javën e hapur pa kuiz ende', () => {
    const quizWeeks = [week(W1, '2026-11-08'), week(W2, '2026-11-16'), week(W3, null)]
    expect(state(achievementStates(input([], { quizWeeks, quizOpenMonday: W3 })), 'quiz_4')).toEqual({ key: 'quiz_4', met: null, progress: { current: 2, target: 4 } })
  })
})

describe('seancat', () => {
  it('seanca e parë: e para e mbyllur; e kapërcyera dhe e hapura nuk numërohen', () => {
    const sessions = follow(['2026-11-02', '2026-11-03', '2026-11-05'], { statuses: { 0: 'skipped', 1: 'in_progress' } })
    const first = state(achievementStates(input(sessions)), 'first_session')
    expect(first.met).toEqual({ date: '2026-11-05', sessionId: sessions[2].id })
    expect(first.progress).toEqual({ current: 1, target: 1 })
  })

  it('25 seanca: data e seancës së 25-të të mbyllur, pa të kapërcyerat', () => {
    const dates = trainingDates(W1, 27)
    const sessions = follow(dates, { statuses: { 3: 'skipped', 10: 'skipped' } })
    const reached = state(achievementStates(input(sessions)), 'sessions_25')
    expect(reached.met).toEqual({ date: dates[26], sessionId: sessions[26].id })
    const before = state(achievementStates(input(sessions.slice(0, 26))), 'sessions_25')
    expect(before.met).toBeNull()
    expect(before.progress).toEqual({ current: 24, target: 25 })
  })
})

describe('rekordet', () => {
  it('rekordi i parë dhe 10 rekorde sipas radhës së seancave; rekordet e seancave jo të mbyllura nuk numërohen', () => {
    const dates = trainingDates(W1, 8)
    const sessions = follow(dates, { statuses: { 1: 'skipped' } })
    // Rekordet (`sessionRecords`): asnjë te seanca e parë (pa e1RM të mëparshme), një te e kapërcyera.
    const records = [sessions[1], sessions[2], sessions[3], sessions[3], sessions[4], sessions[5], sessions[5], sessions[5], sessions[6], sessions[7], sessions[7]].map((entry) => ({
      sessionId: entry.id,
    }))
    const states = achievementStates(input(sessions, { records }))
    expect(state(states, 'first_record').met).toEqual({ date: dates[2], sessionId: sessions[2].id })
    expect(state(states, 'records_10').met).toEqual({ date: dates[7], sessionId: sessions[7].id })
    const fewer = achievementStates(input(sessions, { records: records.slice(0, 9) }))
    expect(state(fewer, 'records_10')).toMatchObject({ met: null, progress: { current: 8, target: 10 } })
  })
})

describe('vargu 4 javë', () => {
  it('4 javë rresht me 4 nga 4: fitohet me seancën e katërt të javës së katërt', () => {
    const dates = trainingDates(W1, 16)
    const sessions = follow(dates)
    const streak = state(achievementStates(input(sessions)), 'streak_4')
    expect(streak.met).toEqual({ date: '2026-11-27', sessionId: sessions[15].id })
    expect(streak.progress).toEqual({ current: 4, target: 4 })
    expect(streak.weeks?.map((week) => [week.monday, week.done, week.target, week.spare])).toEqual([
      [W1, 4, 4, false],
      [W2, 4, 4, false],
      [W3, 4, 4, false],
      [W4, 4, 4, false],
    ])
  })

  it('java e katërt me ditën rezervë: fitohet të dielën kur java mbyllet', () => {
    const dates = trainingDates(W1, 15)
    const sessions = follow(dates)
    const open = state(achievementStates(input(sessions, { today: '2026-11-29' })), 'streak_4')
    expect(open).toMatchObject({ met: null, progress: { current: 3, target: 4 } })
    expect(open.weeks?.map((week) => week.monday)).toEqual([W1, W2, W3])
    const closed = state(achievementStates(input(sessions, { today: '2026-11-30' })), 'streak_4')
    expect(closed.met).toEqual({ date: '2026-11-29', sessionId: null })
    expect(closed.weeks?.at(-1)).toMatchObject({ monday: W4, done: 3, target: 4, spare: true })
  })

  it('një javë pa qëllimin e rinis vargun; progresi është vargu i tanishëm', () => {
    // Java 2 vetëm 2 nga 4 (dita rezervë nuk mbulon dy), pastaj javët 3 dhe 4 të plota.
    const dates = [...trainingDates(W1, 4), ...trainingDates(W2, 2), ...trainingDates(W3, 8)]
    const streak = state(achievementStates(input(follow(dates), { today: '2026-12-01' })), 'streak_4')
    expect(streak.met).toBeNull()
    expect(streak.progress).toEqual({ current: 2, target: 4 })
    expect(streak.weeks?.map((week) => week.monday)).toEqual([W3, W4])
  })
})

describe('java e plotë', () => {
  const sessions = () => follow(trainingDates(W1, 4))

  it('të tre qëllimet: data kur u arrit i fundit prej tyre', () => {
    // Ushqimi arrin 5 ditë të shtunën (7 nëntor), uji të premten; stërvitja e katërt është të premten.
    const food = intake(W1, [60, 60, 0, 60, 70, 65, 0])
    const water = intake(W1, [100, 100, 100, 100, 100, 0, 0])
    const list = sessions()
    const week = state(achievementStates(input(list, { food, water })), 'full_week')
    expect(week.met).toEqual({ date: '2026-11-07', sessionId: null })
    expect(week.progress).toEqual({ current: 3, target: 3 })
    // Kur stërvitja është e fundit, arritja i përket seancës.
    const early = state(achievementStates(input(list, { food: intake(W1, [60, 60, 60, 60, 60, 0, 0]), water })), 'full_week')
    expect(early.met).toEqual({ date: '2026-11-06', sessionId: list[3].id })
  })

  it('pa objektiva ushqimi (pa profil) nuk është e plotë; progresi është java më e mirë', () => {
    const water = intake(W1, [100, 100, 100, 100, 100, 0, 0])
    const food = intake(W1, [60, 60, 60, 60, 60, 60, 60]).map((day) => ({ ...day, target: null }))
    const week = state(achievementStates(input(sessions(), { food, water })), 'full_week')
    expect(week).toMatchObject({ met: null, progress: { current: 2, target: 3 } })
  })

  it('seanca e kapërcyer nuk e plotëson stërvitjen', () => {
    const list = follow(trainingDates(W1, 4), { statuses: { 2: 'skipped' } })
    const food = intake(W1, [60, 60, 60, 60, 60, 60, 60])
    const water = intake(W1, [100, 100, 100, 100, 100, 100, 100])
    // Java ende e hapur: 3 nga 4, pa ditë rezervë.
    const week = state(achievementStates(input(list, { food, water, today: '2026-11-07' })), 'full_week')
    expect(week).toMatchObject({ met: null, progress: { current: 2, target: 3 } })
  })
})

describe('ushqimi dhe uji 7 nga 7', () => {
  it('ushqimi: java me 7 ditë mbi 60% fitohet të dielën; ndryshe më e mira deri tani', () => {
    const food = [...intake(W1, [60, 60, 60, 0, 60, 60, 60]), ...intake(W2, [60, 60, 60, 60, 60, 60, 60])]
    const states = achievementStates(input([], { food }))
    expect(state(states, 'food_7').met).toEqual({ date: '2026-11-15', sessionId: null })
    const best = achievementStates(input([], { food: food.slice(0, 7) }))
    expect(state(best, 'food_7')).toMatchObject({ met: null, progress: { current: 6, target: 7 } })
  })

  it('uji kërkon gjithë objektivin e ditës', () => {
    const water = intake(W3, [100, 100, 100, 99, 100, 100, 100])
    const states = achievementStates(input([], { water }))
    expect(state(states, 'water_7')).toMatchObject({ met: null, progress: { current: 6, target: 7 } })
    const full = achievementStates(input([], { water: intake(W3, [100, 100, 100, 100, 120, 100, 100]) }))
    expect(state(full, 'water_7').met).toEqual({ date: '2026-11-22', sessionId: null })
  })
})

describe('faza 1 dhe programi', () => {
  it('Faza 1 e plotë: të 16 stërvitjet e bllokut pas Javës 0', () => {
    const dates = trainingDates(W1, 20)
    const sessions = follow(dates)
    const phase = state(achievementStates(input(sessions)), 'phase_1')
    expect(phase.met).toEqual({ date: dates[19], sessionId: sessions[19].id })
    const before = state(achievementStates(input(sessions.slice(0, 16))), 'phase_1')
    expect(before).toMatchObject({ met: null, progress: { current: 12, target: 16 } })
  })

  it('një stërvitje e kapërcyer e fazës mbetet pa u numëruar, edhe kur treguesi kalon', () => {
    const sessions = follow(trainingDates(W1, 20), { statuses: { 9: 'skipped' } })
    const phase = state(achievementStates(input(sessions)), 'phase_1')
    expect(phase).toMatchObject({ met: null, progress: { current: 15, target: 16 } })
    // Stërvitjet që përsëriten në xhiron e dytë numërohen një herë.
    const repeated = follow(trainingDates('2027-02-01', 3), { from: 4, run: 2 })
    expect(state(achievementStates(input([...sessions, ...repeated])), 'phase_1').progress).toEqual({ current: 15, target: 16 })
    // Xhiroja e dytë e bën stërvitjen që mungonte: faza plotësohet atëherë.
    const again = follow(['2027-03-01'], { from: 9, run: 2 })
    const later = state(achievementStates(input([...sessions, ...again])), 'phase_1')
    expect(later.met).toEqual({ date: '2027-03-01', sessionId: again[0].id })
  })

  it('program pa Javë 0: faza është blloku i parë', () => {
    const own: AchievementProgramme = {
      id: 'own',
      blocks: [
        { id: 'a', position: 0, weeks: 2 },
        { id: 'b', position: 1, weeks: 2 },
      ],
      dayIds: ['x', 'y', 'z'],
    }
    const sessions = follow(trainingDates(W1, 6), { programme: own })
    const states = achievementStates(input(sessions, { programmes: [own], activeProgrammeId: 'own' }))
    expect(state(states, 'phase_1').met).toEqual({ date: sessions[5].date, sessionId: sessions[5].id })
    expect(state(states, 'programme').progress).toEqual({ current: 2, target: 4 })
  })

  it('programi i plotë: çdo javë me të gjitha stërvitjet; progresi në javë', () => {
    const dates = trainingDates(W1, 52)
    const sessions = follow(dates)
    const done = state(achievementStates(input(sessions, { today: '2027-02-01' })), 'programme')
    expect(done.met).toEqual({ date: dates[51], sessionId: sessions[51].id })
    expect(done.progress).toEqual({ current: 13, target: 13 })
    const partial = state(achievementStates(input(sessions.slice(0, 17))), 'programme')
    expect(partial).toMatchObject({ met: null, progress: { current: 4, target: 13 } })
  })

  it('progresi ndjek programin aktiv; arritja vlen nga cilido program', () => {
    const own: AchievementProgramme = { id: 'own', blocks: [{ id: 'a', position: 0, weeks: 1 }], dayIds: ['x'] }
    const sessions = follow(['2026-11-02'], { programme: own })
    const states = achievementStates(input(sessions, { programmes: [STS, own], activeProgrammeId: 'sts' }))
    expect(state(states, 'programme').met).toEqual({ date: '2026-11-02', sessionId: sessions[0].id })
    expect(state(states, 'phase_1').met).toEqual({ date: '2026-11-02', sessionId: sessions[0].id })
    const other = achievementStates(input([], { programmes: [STS, own], activeProgrammeId: 'sts' }))
    expect(state(other, 'programme').progress).toEqual({ current: 0, target: 13 })
  })
})

describe('radha, "E re" dhe më e afërta', () => {
  const progress = (key: AchievementKey, current: number, target: number): { key: AchievementKey; earnedOn: string | null; progress: { current: number; target: number } } => ({
    key,
    earnedOn: null,
    progress: { current, target },
  })

  it('të fituarat sipas datës, më e reja e para; pastaj të tjerat me radhën e rregullave', () => {
    const list = ACHIEVEMENT_KEYS.map((key) => progress(key, 0, 1))
    list[0].earnedOn = '2026-10-26'
    list[1].earnedOn = '2026-11-03'
    list[2].earnedOn = '2026-11-22'
    expect(orderAchievements(list).map((entry) => entry.key)).toEqual([
      'full_week',
      'first_record',
      'first_session',
      'streak_4',
      'records_10',
      'phase_1',
      'sessions_25',
      'food_7',
      'water_7',
      'programme',
      'quiz_4',
    ])
  })

  it('"E re": e fituar në 7 ditët e fundit', () => {
    expect(isNewAchievement('2026-11-16', '2026-11-22')).toBe(true)
    expect(isNewAchievement('2026-11-15', '2026-11-22')).toBe(false)
    expect(isNewAchievement(null, '2026-11-22')).toBe(false)
  })

  it('më e afërta: pjesa më e madhe e objektivit nga të pafituarat, pa atë që është hapur', () => {
    const list = [progress('streak_4', 3, 4), progress('phase_1', 15, 16), progress('sessions_25', 16, 25), progress('programme', 0, 0)]
    expect(nearestAchievement(list)?.key).toBe('phase_1')
    expect(nearestAchievement(list, ['phase_1'])?.key).toBe('streak_4')
    expect(nearestAchievement([{ ...progress('phase_1', 16, 16), earnedOn: '2026-11-22' }])).toBeNull()
    // Pa progres askund: e para me radhë.
    expect(nearestAchievement([progress('records_10', 0, 10), progress('first_session', 0, 1)])?.key).toBe('first_session')
  })
})
