import type { HistorySet } from '@/program/loads'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { e1rmSeries, strengthSummary, weeklyVolume } from './strength'

let counter = 0
const set = (exerciseId: string, loggedAt: string, weightKg: number, reps: number, extra: Partial<HistorySet> = {}): HistorySet => ({
  id: `s${++counter}`,
  exerciseId,
  sessionId: loggedAt.slice(0, 10),
  run: 1,
  blockPosition: 1,
  blockName: 'Faza 1',
  blockWeeks: 4,
  week: 1,
  setNumber: 1,
  weightKg,
  reps,
  rir: null,
  isWarmup: false,
  loggedAt,
  ...extra,
})

const SETS = [
  set('bench', '2026-11-02T18:10:00', 60, 12),
  set('bench', '2026-11-02T18:12:00', 62.5, 10),
  set('bench', '2026-11-02T18:05:00', 80, 5, { isWarmup: true }),
  set('bench', '2026-11-30T18:10:00', 70, 8),
  set('bench', '2026-12-07T18:10:00', 75, 6),
  set('squat', '2026-12-03T18:10:00', 90, 8),
  set('squat', '2026-12-03T18:15:00', 90, 8),
]

describe('forca', () => {
  it('e1RM më i mirë i çdo dite, pa setet e ngrohjes', () => {
    expect(e1rmSeries(SETS, 'bench')).toEqual([
      { date: '2026-11-02', value: 84 },
      { date: '2026-11-30', value: 88.7 },
      { date: '2026-12-07', value: 90 },
    ])
  })

  it('çdo ushtrim me e1RM-në e fundit dhe ndryshimin në 4 javë; më i fundit i pari', () => {
    expect(strengthSummary(SETS, { bench: 'Bench Press', squat: 'Squat' })).toEqual([
      { exerciseId: 'bench', name: 'Bench Press', latest: { date: '2026-12-07', value: 90 }, change: { from: { date: '2026-11-02', value: 84 }, delta: 6 }, points: 3 },
      { exerciseId: 'squat', name: 'Squat', latest: { date: '2026-12-03', value: 114 }, change: null, points: 1 },
    ])
  })
})

describe('volumi javor', () => {
  it('setet e punës për grupin kryesor të muskujve, kjo javë dhe e kaluara (e hëna deri të dielën)', () => {
    const primary = { bench: ['pectoralis_major_sternocostal', 'triceps_brachii'], squat: ['rectus_femoris'] }
    const volume = weeklyVolume(SETS, primary, MUSCLE_GROUPS, new Date('2026-12-09T12:00:00'))
    expect(volume.filter((row) => row.thisWeek > 0 || row.lastWeek > 0).map((row) => [row.group.name, row.thisWeek, row.lastWeek])).toEqual([
      ['Gjoksi', 1, 1],
      ['Tricepsi', 1, 1],
      ['Kuadricepsi', 0, 2],
    ])
  })
})
