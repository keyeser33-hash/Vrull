import type { HistorySet } from '@/program/loads'
import { e1rmByWeek, exerciseRecords, oneRmSource, recentSessions } from './exercise-records'

// Faqja e ushtrimit (bordi "Ushtrimi"): "Rekordet e tua" me e1RM-në më të lartë, shtesën që nga java e
// parë, grafikun sipas javës dhe peshën më të madhe; historia e seteve sipas seancës. Mostra: Bench
// Press, Java 0 50 × 14 RIR 2 (76,7), Java 1 60 × 13 (86,0), Java 2 62,5 × 12 (87,5).

let counter = 0
function set(values: Partial<HistorySet> & Pick<HistorySet, 'sessionId' | 'loggedAt'>): HistorySet {
  counter++
  return {
    id: `set-${counter}`,
    exerciseId: 'bench',
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

const java0 = { sessionId: 's0', blockPosition: 0, blockName: 'Java 0', blockWeeks: 1, week: 1 }
const java1 = { sessionId: 's1', week: 1 }
const java2 = { sessionId: 's2', week: 2 }

const history: HistorySet[] = [
  set({ ...java0, setNumber: 1, weightKg: 40, reps: 10, isWarmup: true, loggedAt: '2026-10-25T16:00:00Z' }),
  set({ ...java0, setNumber: 1, weightKg: 50, reps: 14, rir: 2, loggedAt: '2026-10-25T16:05:00Z' }),
  set({ ...java0, setNumber: 2, weightKg: 50, reps: 13, rir: 2, loggedAt: '2026-10-25T16:08:00Z' }),
  set({ ...java1, setNumber: 1, weightKg: 60, reps: 13, loggedAt: '2026-11-01T16:05:00Z' }),
  set({ ...java1, setNumber: 2, weightKg: 60, reps: 12, loggedAt: '2026-11-01T16:08:00Z' }),
  set({ ...java1, setNumber: 4, weightKg: 60, reps: 10, loggedAt: '2026-11-01T16:15:00Z' }),
  set({ ...java2, setNumber: 1, weightKg: 62.5, reps: 12, loggedAt: '2026-11-08T16:05:00Z' }),
  set({ ...java2, setNumber: 2, weightKg: 62.5, reps: 10, loggedAt: '2026-11-08T16:08:00Z' }),
  // Një ushtrim tjetër nuk hyn.
  set({ ...java2, exerciseId: 'squat', weightKg: 100, reps: 8, loggedAt: '2026-11-08T17:00:00Z' }),
]

const round1 = (value: number) => Math.round(value * 10) / 10

describe('rekordet e ushtrimit', () => {
  it('e1RM më e mirë e çdo jave të programit, me radhë, pa ngrohjet', () => {
    const weeks = e1rmByWeek(history, 'bench')
    expect(weeks.map((entry) => [entry.blockName, entry.week, round1(entry.e1rmKg)])).toEqual([
      ['Java 0', 1, 76.7],
      ['Faza 1', 1, 86],
      ['Faza 1', 2, 87.5],
    ])
    expect(weeks[2]).toMatchObject({ run: 1, blockPosition: 1, blockWeeks: 4 })
  })

  it('e1RM më e lartë, shtesa që nga java e parë dhe pesha më e madhe me përsëritjet', () => {
    const records = exerciseRecords(history, 'bench')!
    expect(round1(records.bestE1rmKg!)).toBe(87.5)
    expect(round1(records.gainKg!)).toBe(10.8)
    expect(records.since).toMatchObject({ blockName: 'Java 0', week: 1 })
    expect(records.heaviest).toEqual({ weightKg: 62.5, reps: 12 })
  })

  it('me një javë të vetme nuk ka shtesë; pa sete nuk ka rekorde', () => {
    const one = exerciseRecords(history.slice(0, 3), 'bench')!
    expect(one.gainKg).toBeNull()
    expect(exerciseRecords(history, 'deadlift')).toBeNull()
  })

  it('pesha më e madhe: me të njëjtën peshë fiton seti me më shumë përsëritje; edhe pa e1RM (mbi 15)', () => {
    const calves = [
      set({ sessionId: 'c1', exerciseId: 'calf', weightKg: 70, reps: 22, loggedAt: '2026-11-03T16:00:00Z' }),
      set({ sessionId: 'c1', exerciseId: 'calf', weightKg: 70, reps: 25, loggedAt: '2026-11-03T16:02:00Z' }),
    ]
    expect(exerciseRecords(calves, 'calf')).toEqual({ bestE1rmKg: null, gainKg: null, since: null, heaviest: { weightKg: 70, reps: 25 } })
  })
})

describe('historia e seteve', () => {
  it('seancat më të reja të parat, setet e punës me radhë', () => {
    const sessions = recentSessions(history, 'bench', 2)
    expect(sessions.map((session) => session.sessionId)).toEqual(['s2', 's1'])
    expect(sessions[0]).toMatchObject({ at: '2026-11-08T16:05:00Z', blockName: 'Faza 1', blockWeeks: 4, week: 2 })
    expect(sessions[0].sets).toEqual([
      { weightKg: 62.5, reps: 12, rir: null },
      { weightKg: 62.5, reps: 10, rir: null },
    ])
    expect(recentSessions(history, 'bench', 5)).toHaveLength(3)
  })
})

describe('nga vjen 1RM aktuale (peshat e javës)', () => {
  it('seti më i ri që e dha, ose vlera me dorë', () => {
    expect(oneRmSource(history, 'bench', 62.5 * (1 + 12 / 30), null)).toEqual({ kind: 'set', at: '2026-11-08T16:05:00Z' })
    expect(oneRmSource(history, 'bench', 90, { oneRmKg: 90, setAt: '2026-11-02T10:00:00Z' })).toEqual({ kind: 'manual', at: '2026-11-02T10:00:00Z' })
    expect(oneRmSource(history, 'bench', 123, null)).toBeNull()
  })
})
