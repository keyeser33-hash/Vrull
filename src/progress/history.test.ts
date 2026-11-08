import type { HistorySet } from '@/program/loads'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { Target, Technique } from '@/program/types'
import {
  byProgramWeek,
  dayTheme,
  durationMinutes,
  monthMarks,
  previewEdit,
  recordsAtTheTime,
  sessionRecords,
  sessionVolume,
  targetSummary,
} from './history'

// Historiku (V2-E1-15): rekordet në kohën kur u bënë, rillogaritja pas ndryshimit të një seti,
// volumi i seancës, java e programit dhe kalendari i muajit. Shembujt vijnë nga të dhënat e
// bordeve: Bench Press Java 0 50 × 14 (RIR 2) → 76,7; Java 1 60 × 13 → 86,0 (+9,3); Java 2
// 62,5 × 12 → 87,5 (+1,5).

const BENCH = 'bench'
let counter = 0
function set(values: Partial<HistorySet> & { sessionId: string; loggedAt: string }): HistorySet {
  counter += 1
  return {
    id: `set-${counter}`,
    exerciseId: BENCH,
    run: 1,
    blockPosition: 1,
    blockName: 'Faza 1',
    blockWeeks: 4,
    week: 1,
    setNumber: 1,
    weightKg: 60,
    reps: 10,
    rir: null,
    isWarmup: false,
    ...values,
  }
}

const weekZero = (exerciseId = BENCH) =>
  [1, 2, 3].map((setNumber) =>
    set({ exerciseId, sessionId: 'j0', blockPosition: 0, blockName: 'Java 0', blockWeeks: 1, setNumber, weightKg: 50, reps: 14, rir: 2, loggedAt: `2026-10-25T16:2${setNumber}:00.000Z` }),
  )
const weekOne = () =>
  [13, 12, 11, 10].map((reps, index) => set({ sessionId: 'j1', setNumber: index + 1, weightKg: 60, reps, loggedAt: `2026-11-01T16:2${index}:00.000Z` }))
const weekTwo = () =>
  [12, 10, 9, 9].map((reps, index) => set({ sessionId: 'j2', week: 2, setNumber: index + 1, weightKg: 62.5, reps, loggedAt: `2026-11-08T16:2${index}:00.000Z` }))

const round1 = (value: number | undefined) => (value === undefined ? undefined : Math.round(value * 10) / 10)

describe('rekordet në kohën kur u bënë', () => {
  it('seti i parë i ushtrimit dhe setet e barabarta nuk janë rekord; Java 1 dhe Java 2 po', () => {
    const j0 = weekZero()
    const j1 = weekOne()
    const j2 = weekTwo()
    const records = recordsAtTheTime([...j2, ...j0, ...j1])
    expect(j0.map((entry) => records.has(entry.id))).toEqual([false, false, false])
    expect(j1.map((entry) => records.has(entry.id))).toEqual([true, false, false, false])
    expect(round1(records.get(j1[0].id)?.e1rmKg)).toBe(86)
    expect(round1(records.get(j1[0].id)?.gainKg)).toBe(9.3)
    expect(j2.map((entry) => records.has(entry.id))).toEqual([true, false, false, false])
    expect(round1(records.get(j2[0].id)?.gainKg)).toBe(1.5)
  })

  it('një set i mëvonshëm nuk e heq rekordin e një seti të mëparshëm', () => {
    const j1 = weekOne()
    const later = set({ sessionId: 'j2', weightKg: 80, reps: 10, loggedAt: '2026-11-08T16:00:00.000Z' })
    const records = recordsAtTheTime([...weekZero(), ...j1, later])
    expect(records.has(j1[0].id)).toBe(true)
    expect(records.has(later.id)).toBe(true)
  })

  it('setet e ngrohjes nuk numërohen as si rekord, as si më i miri i mëparshëm', () => {
    const warmup = set({ sessionId: 'j1', weightKg: 100, reps: 10, isWarmup: true, loggedAt: '2026-11-01T16:00:00.000Z' })
    const j1 = weekOne()
    const records = recordsAtTheTime([...weekZero(), warmup, ...j1])
    expect(records.has(warmup.id)).toBe(false)
    expect(records.has(j1[0].id)).toBe(true)
  })

  it('ushtrimet e tjera nuk ndikojnë', () => {
    const other = set({ exerciseId: 'squat', sessionId: 'j0', weightKg: 140, reps: 10, loggedAt: '2026-10-25T16:00:00.000Z' })
    const j1 = weekOne()
    expect(recordsAtTheTime([other, ...weekZero(), ...j1]).has(j1[0].id)).toBe(true)
  })
})

describe('ndryshimi i një seti rillogarit rekordet', () => {
  it('pesha më e ulët te seti i rekordit e heq rekordin dhe seti tjetër e merr', () => {
    const j1 = weekOne()
    const history = [...weekZero(), ...j1]
    const edited = history.map((entry) => (entry.id === j1[0].id ? { ...entry, weightKg: 50 } : entry))
    const records = recordsAtTheTime(edited)
    expect(records.has(j1[0].id)).toBe(false)
    // 60 × 12 = 84,0 kalon 76,7 të Javës 0.
    expect(records.has(j1[1].id)).toBe(true)
    expect(round1(records.get(j1[1].id)?.e1rmKg)).toBe(84)
  })

  it('një set i mëparshëm i rritur heq rekordet që vijnë pas tij', () => {
    const j0 = weekZero()
    const j1 = weekOne()
    const edited = [...j0, ...j1].map((entry) => (entry.id === j0[1].id ? { ...entry, weightKg: 60 } : entry))
    const records = recordsAtTheTime(edited)
    // 60 × 14 me RIR 2 = 92,0: tani seti 2 i Javës 0 është rekord dhe 86,0 i Javës 1 jo më.
    expect(records.has(j0[1].id)).toBe(true)
    expect(j1.some((entry) => records.has(entry.id))).toBe(false)
  })

  it('parapamja e ndryshimit: e1RM e re dhe rekordi i setit, pa prekur historinë', () => {
    const j1 = weekOne()
    const history = [...weekZero(), ...j1]
    const lower = previewEdit(history, j1[0].id, { weightKg: 60, reps: 12, rir: null })
    expect(round1(lower.e1rmKg ?? undefined)).toBe(84)
    expect(round1(lower.record?.gainKg)).toBe(7.3)
    expect(previewEdit(history, j1[0].id, { weightKg: 45, reps: 13, rir: null }).record).toBeNull()
    // Seti 2 bëhet rekord kur kalon 86,0 të setit 1: 62,5 × 12 = 87,5.
    const raised = previewEdit(history, j1[1].id, { weightKg: 62.5, reps: 12, rir: null })
    expect(round1(raised.record?.gainKg)).toBe(1.5)
    // RIR-i hyn te e1RM-ja; mbi 15 përsëritje nuk ka e1RM.
    expect(round1(previewEdit(history, j1[0].id, { weightKg: 60, reps: 13, rir: 2 }).e1rmKg ?? undefined)).toBe(90)
    expect(previewEdit(history, j1[0].id, { weightKg: 60, reps: 16, rir: null })).toEqual({ e1rmKg: null, record: null })
    expect(history.find((entry) => entry.id === j1[0].id)?.reps).toBe(13)
  })
})

describe('rekordi i çdo ushtrimi në seancë', () => {
  it('seti më i mirë që theu rekord, kundrejt më të mirit para seancës, me setin e asaj kohe', () => {
    const j0 = weekZero()
    const j1 = weekOne()
    const history = [...j0, ...j1, ...weekTwo()]
    const [bench] = sessionRecords(history, 'j1')
    expect(bench).toMatchObject({ exerciseId: BENCH, setId: j1[0].id })
    expect(round1(bench.e1rmKg)).toBe(86)
    expect(round1(bench.gainKg)).toBe(9.3)
    expect(round1(bench.previousBestKg)).toBe(76.7)
    // I fundit nga setet e barabarta të Javës 0.
    expect(bench.previous).toMatchObject({ id: j0[2].id, weightKg: 50, reps: 14, rir: 2, blockName: 'Java 0' })
    expect(sessionRecords(history, 'j0')).toEqual([])
  })

  it('dy rekorde të të njëjtit ushtrim në seancë: më i larti, me shtesën që nga para seancës', () => {
    const j2 = weekTwo()
    j2[1] = { ...j2[1], reps: 13 }
    const [bench] = sessionRecords([...weekZero(), ...weekOne(), ...j2], 'j2')
    expect(bench.setId).toBe(j2[1].id)
    // 62,5 × 13 = 89,6, kundrejt 86,0 të Javës 1.
    expect(round1(bench.gainKg)).toBe(3.6)
  })
})

describe('volumi i seancës', () => {
  it('kryesori 1 set, ndihmësi 0,5, sipas grupit, nga më i madhi', () => {
    const muscles: Record<string, { primary: string[]; secondary: string[] }> = {
      bench: { primary: ['pectoralis_major_sternocostal'], secondary: ['pectoralis_major_clavicular', 'deltoid_anterior', 'triceps_brachii'] },
      incline: { primary: ['pectoralis_major_clavicular'], secondary: ['deltoid_anterior', 'triceps_brachii', 'pectoralis_major_sternocostal'] },
      flye: { primary: ['pectoralis_major_clavicular'], secondary: ['deltoid_anterior'] },
      crossover: { primary: ['pectoralis_major_sternocostal'], secondary: ['pectoralis_minor', 'deltoid_anterior'] },
      pressdown: { primary: ['triceps_brachii'], secondary: [] },
      lying: { primary: ['triceps_brachii'], secondary: [] },
      overhead: { primary: ['triceps_brachii'], secondary: [] },
      standing: { primary: ['gastrocnemius'], secondary: ['soleus'] },
      seated: { primary: ['soleus'], secondary: ['gastrocnemius'] },
    }
    const counts: [string, number][] = [
      ['bench', 4],
      ['incline', 3],
      ['flye', 3],
      ['crossover', 3],
      ['pressdown', 3],
      ['lying', 3],
      ['overhead', 3],
      ['standing', 4],
      ['seated', 4],
    ]
    const sets = counts.flatMap(([exerciseId, count]) => Array.from({ length: count }, () => ({ exerciseId, isWarmup: false })))
    sets.push({ exerciseId: 'bench', isWarmup: true })
    expect(sessionVolume(sets, muscles, MUSCLE_GROUPS)).toEqual([
      { groupId: 'gjoksi', sets: 13 },
      { groupId: 'tricepsi', sets: 12.5 },
      { groupId: 'pulpat', sets: 8 },
      { groupId: 'shpatullat', sets: 6.5 },
    ])
  })
})

describe('tema e ditës', () => {
  it('nga muskujt kryesorë të ushtrimit të parë', () => {
    expect(dayTheme(['pectoralis_major_sternocostal'])).toBe('chest')
    expect(dayTheme(['latissimus_dorsi', 'rhomboid_major'])).toBe('back')
    expect(dayTheme(['deltoid_anterior', 'deltoid_lateral'])).toBe('shoulders')
    expect(dayTheme(['trapezius'])).toBe('shoulders')
    expect(dayTheme(['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'gluteus_maximus'])).toBe('legs')
    expect(dayTheme(['gastrocnemius'])).toBe('legs')
    expect(dayTheme(['biceps_brachii'])).toBe('arms')
    expect(dayTheme(['rectus_abdominis', 'external_oblique'])).toBe('abs')
    expect(dayTheme(['sternocleidomastoid'])).toBeNull()
    expect(dayTheme([])).toBeNull()
  })
})

describe('kohëzgjatja', () => {
  it('minutat e plota mes fillimit dhe mbylljes; pa njërën, null', () => {
    expect(durationMinutes('2026-11-01T16:15:00.000Z', '2026-11-01T17:19:00.000Z')).toBe(64)
    expect(durationMinutes('2026-11-01T16:15:00.000Z', '2026-11-01T17:02:40.000Z')).toBe(48)
    expect(durationMinutes(null, '2026-11-01T17:19:00.000Z')).toBeNull()
    expect(durationMinutes('2026-11-01T17:19:00.000Z', null)).toBeNull()
    expect(durationMinutes('2026-11-01T17:19:00.000Z', '2026-11-01T16:00:00.000Z')).toBeNull()
  })
})

describe('javët e programit', () => {
  it('seancat sipas xhiros, bllokut dhe javës, e reja e para', () => {
    const session = (id: string, blockId: string, week: number, endedAt: string) => ({ id, programId: 'p', run: 1, blockId, week, endedAt })
    const groups = byProgramWeek([
      session('a', 'java-0', 1, '2026-10-25T17:00:00.000Z'),
      session('e', 'faza-1', 1, '2026-11-01T17:00:00.000Z'),
      session('i', 'faza-1', 2, '2026-11-08T17:00:00.000Z'),
      session('b', 'java-0', 1, '2026-10-26T17:00:00.000Z'),
      session('f', 'faza-1', 1, '2026-11-02T17:00:00.000Z'),
    ])
    expect(groups.map((group) => group.sessions.map((entry) => entry.id))).toEqual([['i'], ['f', 'e'], ['b', 'a']])
    expect(groups[1].key).toBe('p|1|faza-1|1')
  })

  it('xhiro e dytë e të njëjtës javë është grup tjetër', () => {
    const groups = byProgramWeek([
      { id: 'a', programId: 'p', run: 1, blockId: 'faza-1', week: 1, endedAt: '2026-11-01T17:00:00.000Z' },
      { id: 'b', programId: 'p', run: 2, blockId: 'faza-1', week: 1, endedAt: '2027-02-01T17:00:00.000Z' },
    ])
    expect(groups.map((group) => group.key)).toEqual(['p|2|faza-1|1', 'p|1|faza-1|1'])
  })
})

describe('kalendari i muajit', () => {
  it('seanca, pushim dhe ditët që vijnë; sot dhe fillimi i javës', () => {
    const marks = monthMarks(2026, 10, new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-08']), '2026-11-08', 0)
    expect(marks).toHaveLength(30)
    expect(marks.slice(0, 9).map((mark) => mark.kind)).toEqual(['session', 'session', 'session', 'rest', 'session', 'rest', 'rest', 'session', 'future'])
    expect(marks.filter((mark) => mark.today).map((mark) => mark.day)).toEqual([8])
    // 1 nëntor 2026 është e diel.
    expect(marks.filter((mark) => mark.weekStart).map((mark) => mark.day)).toEqual([1, 8, 15, 22, 29])
    expect(marks[0]).toMatchObject({ date: '2026-11-01', day: 1 })
  })

  it('muaj i kaluar: pa ditë që vijnë; java nga e hëna', () => {
    const marks = monthMarks(2026, 9, new Set(['2026-10-25']), '2026-11-08', 1)
    expect(marks).toHaveLength(31)
    expect(marks.some((mark) => mark.kind === 'future' || mark.today)).toBe(false)
    expect(marks.filter((mark) => mark.weekStart).map((mark) => mark.day)).toEqual([5, 12, 19, 26])
  })
})

describe('përmbledhja e recetave të seancës', () => {
  const reps = (min: number, max: number): Target => ({ kind: 'reps', min, max, beyond: false })
  const restPause: Technique = { type: 'rest_pause' }
  it('intervali më i shpeshtë, pastaj të tjerët me grupin, pastaj teknikat', () => {
    const slots = [
      ...Array.from({ length: 7 }, () => ({ target: reps(12, 15), technique: restPause, groupId: 'gjoksi' })),
      { target: reps(25, 30), technique: restPause, groupId: 'pulpat' },
      { target: reps(25, 30), technique: restPause, groupId: 'pulpat' },
    ]
    expect(targetSummary(slots)).toEqual({ main: { min: 12, max: 15 }, others: [{ groupIds: ['pulpat'], range: { min: 25, max: 30 } }], techniques: ['rest_pause'] })
  })

  it('pa receta me përsëritje: bosh', () => {
    expect(targetSummary([{ target: { kind: 'timed', seconds: 60 }, technique: { type: 'none' }, groupId: 'barku' }])).toEqual({ main: null, others: [], techniques: [] })
  })
})
