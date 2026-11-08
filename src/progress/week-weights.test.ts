import type { HistorySet } from '@/program/loads'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { Program } from '@/program/types'
import { acceptAll, postpone, weekToReview, weekWeights, type WeekWeightsInput } from './week-weights'

// Shembujt e kanavacës "Vrull · Ekranet" (SPEC §0.3a): Faza 1, Bench Press dhe Triceps Pressdown.
const NOW = new Date('2026-11-08T18:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

let counter = 0
function set(values: Partial<HistorySet>): HistorySet {
  counter += 1
  return {
    id: `set-${counter}`,
    exerciseId: 'Bench Press',
    sessionId: 'f1-j1-d1',
    run: 1,
    blockPosition: 1,
    blockName: 'Faza 1',
    blockWeeks: 4,
    week: 1,
    setNumber: 1,
    weightKg: 60,
    reps: 13,
    rir: null,
    isWarmup: false,
    loggedAt: daysAgo(7),
    ...values,
  }
}

const program = SHORTCUT_TO_SIZE.program
const FAZA_1 = 'faza-1'
const input = (values: Partial<WeekWeightsInput>): WeekWeightsInput => ({
  program,
  week: { blockId: FAZA_1, week: 2 },
  history: [],
  now: NOW,
  overrides: {},
  steps: {},
  decisions: [],
  ...values,
})
const rowOf = (rows: ReturnType<typeof weekWeights>, exerciseId: string) => rows.find((row) => row.exerciseId === exerciseId)

describe('peshat e javës (V23, §7)', () => {
  it('Bench Press 60 × 13 te Java 1 → Java 2: 62,5 kg për 9–11, me llogarinë', () => {
    const rows = weekWeights(input({ history: [set({})] }))
    const bench = rowOf(rows, 'Bench Press')
    expect(bench).toMatchObject({
      dayNumber: 1,
      sets: 4,
      target: { kind: 'reps', min: 9, max: 11 },
      previousKg: 60,
      weightKg: 62.5,
      proposal: { weightKg: 62.5, basis: { kind: 'one_rm', reps: 11, stepKg: 2.5 } },
    })
  })

  it('Java 3 (6–8) pas 62,5 × 12 te Java 2: Bench Press 67,5 kg; Triceps Pressdown mbetet 30 kg te kabëlli me hap 5', () => {
    const history = [
      set({}),
      set({ sessionId: 'f1-j2-d1', week: 2, weightKg: 62.5, reps: 12, loggedAt: daysAgo(0) }), // e1RM 87,5
      set({ exerciseId: 'Triceps Pressdown', sessionId: 'f1-j2-d1', week: 2, weightKg: 30, reps: 11, rir: 2, loggedAt: daysAgo(0) }), // 43,0
    ]
    const rows = weekWeights(input({ week: { blockId: FAZA_1, week: 3 }, history }))
    expect(rowOf(rows, 'Bench Press')).toMatchObject({ target: { min: 6, max: 8 }, weightKg: 67.5 })
    const triceps = rowOf(rows, 'Triceps Pressdown')
    expect(triceps).toMatchObject({ previousKg: 30, weightKg: 30, proposal: { basis: { kind: 'one_rm', reps: 8, stepKg: 5 } } })
    if (triceps?.proposal.basis?.kind !== 'one_rm') throw new Error('pa arsye')
    expect(triceps.proposal.basis.oneRmKg).toBeCloseTo(43, 5)
    expect(triceps.proposal.basis.exactKg).toBeCloseTo(33.9, 1)
  })

  it('pulpat me setet mbi 15 përsëritje te Java 1: pesha e fundit', () => {
    const calves = [set({ exerciseId: 'Standing Calf Raise', weightKg: 80, reps: 27 })]
    expect(rowOf(weekWeights(input({ history: calves })), 'Standing Calf Raise')).toMatchObject({
      target: { min: 15, max: 20 },
      previousKg: 80,
      weightKg: 80,
      proposal: { basis: { kind: 'last_weight', weightKg: 80 } },
    })
  })

  it('1RM e vendosur me dorë vlen derisa një seancë të japë më shumë', () => {
    const overrides = { 'Bench Press': { oneRmKg: 100, setAt: daysAgo(3) } }
    // 100 / (1 + 11/30) = 73,2 → 72,5
    expect(rowOf(weekWeights(input({ history: [set({})], overrides })), 'Bench Press')?.weightKg).toBe(72.5)
  })

  it('hapi i peshës sipas cilësimeve të përdoruesit', () => {
    const history = [set({ exerciseId: 'Triceps Pressdown', weightKg: 30, reps: 11, rir: 2 })] // 43,0
    const rows = weekWeights(input({ week: { blockId: FAZA_1, week: 3 }, history, steps: { cable: 2.5 } }))
    expect(rowOf(rows, 'Triceps Pressdown')?.weightKg).toBe(32.5)
  })

  describe('vendimi i përdoruesit', () => {
    const bench = program.slots.find((slot) => slot.exerciseId === 'Bench Press')!.id

    it('pesha e ndryshuar vlen në vend të propozimit; propozimi mbetet për krahasim', () => {
      const decision = { slotId: bench, exerciseId: 'Bench Press', weightKg: 60, status: 'changed' as const }
      const row = rowOf(weekWeights(input({ history: [set({})], decisions: [decision] })), 'Bench Press')
      expect(row).toMatchObject({ weightKg: 60, decision, proposal: { weightKg: 62.5 } })
    })

    it('"Prano të gjitha": çdo propozim me peshë bëhet vendim', () => {
      const rows = weekWeights(input({ history: [set({})] }))
      expect(acceptAll(rows)).toEqual([{ slotId: bench, exerciseId: 'Bench Press', weightKg: 62.5, status: 'accepted' }])
    })

    it('"Prano të gjitha" nuk prek peshën që përdoruesi ndryshoi', () => {
      const changed = { slotId: bench, exerciseId: 'Bench Press', weightKg: 60, status: 'changed' as const }
      expect(acceptAll(weekWeights(input({ history: [set({})], decisions: [changed] })))).toEqual([])
    })

    it('"Më vonë": mbeten peshat e javës së kaluar, vetëm ku ka një të tillë', () => {
      expect(postpone(weekWeights(input({ history: [set({})] })))).toEqual([{ slotId: bench, exerciseId: 'Bench Press', weightKg: 60, status: 'postponed' }])
    })

    it('"Më vonë" nuk prek peshën që përdoruesi ndryshoi', () => {
      const changed = { slotId: bench, exerciseId: 'Bench Press', weightKg: 65, status: 'changed' as const }
      expect(postpone(weekWeights(input({ history: [set({})], decisions: [changed] })))).toEqual([])
    })

    it('vendimi për një ushtrim tjetër të slotit nuk vlen', () => {
      const decision = { slotId: bench, exerciseId: 'Incline Bench Press', weightKg: 40, status: 'accepted' as const }
      const row = rowOf(weekWeights(input({ history: [set({})], decisions: [decision] })), 'Bench Press')
      expect(row).toMatchObject({ weightKg: 62.5, decision: null })
    })
  })

  describe('programi i përdoruesit me rregull progresi', () => {
    // Sipër/poshtë: dy blloqe, një ditë, Dumbbell Shoulder Press 8–12 javët tek dhe 6–10 javët çift.
    const custom: Program = {
      id: 'custom',
      blocks: [
        { id: 'b1', position: 0, name: 'Blloku 1', weeks: 2 },
        { id: 'b2', position: 1, name: 'Blloku 2', weeks: 2 },
      ],
      days: [{ id: 'd1', position: 0, name: 'Sipër' }],
      slots: [{ id: 's1', dayId: 'd1', position: 0, exerciseId: 'press', sets: 3, restSeconds: 90 }],
      overrides: [
        { slotId: 's1', blockId: null, week: null, prescription: { type: 'rep_ladder', ladder: [{ min: 8, max: 12 }, { min: 6, max: 10 }] } },
        { slotId: 's1', blockId: null, week: null, progression: { minRir: 2, incrementKg: 2.5 } },
      ],
      exercises: { press: { tracking: 'weight_reps', equipment: 'dumbbell' } },
    }
    const press = (reps: number, rir: number) => set({ exerciseId: 'press', sessionId: 'last', weightKg: 20, reps, rir })

    it('java 2: krahasohet me kufirin e sipërm të javës 1 (12)', () => {
      const rows = weekWeights(input({ program: custom, week: { blockId: 'b1', week: 2 }, history: [press(12, 2), press(12, 2)] }))
      expect(rows[0]).toMatchObject({ weightKg: 22.5, proposal: { basis: { kind: 'progression', topReps: 12, earned: true } } })
    })

    it('java 1 e bllokut 2: krahasohet me javën e fundit të bllokut 1 (6–10)', () => {
      const rows = weekWeights(input({ program: custom, week: { blockId: 'b2', week: 1 }, history: [press(10, 2), press(10, 3)] }))
      expect(rows[0]).toMatchObject({ weightKg: 22.5, proposal: { basis: { kind: 'progression', topReps: 10, earned: true } } })
    })

    it('java e kaluar pa kufi të sipërm ("10+"): krahasohet me kufirin e poshtëm', () => {
      const open: Program = {
        ...custom,
        overrides: [...custom.overrides, { slotId: 's1', blockId: 'b1', week: 1, prescription: { type: 'rep_ladder', ladder: [{ min: 10, max: null }] } }],
      }
      const rows = weekWeights(input({ program: open, week: { blockId: 'b1', week: 2 }, history: [press(10, 2)] }))
      expect(rows[0]).toMatchObject({ weightKg: 22.5, proposal: { basis: { topReps: 10 } } })
    })

    it('java e parë e programit: pa javë të kaluar, si §7', () => {
      const rows = weekWeights(input({ program: custom, week: { blockId: 'b1', week: 1 }, history: [press(12, 2)] }))
      expect(rows[0].proposal.basis?.kind).toBe('one_rm')
    })
  })

  describe('java që shqyrtohet', () => {
    const pointer = (blockId: string, week: number, dayId: string) => ({ run: 1, blockId, week, dayId, completed: false })

    it('treguesi te dita e parë: java e tij (java e kaluar u mbyll)', () => {
      expect(weekToReview(program, pointer(FAZA_1, 2, 'dita-1'))).toEqual({ blockId: FAZA_1, week: 2 })
    })

    it('java e treguesit ka nisur: java pas saj, edhe në bllokun tjetër', () => {
      expect(weekToReview(program, pointer(FAZA_1, 2, 'dita-2'))).toEqual({ blockId: FAZA_1, week: 3 })
      expect(weekToReview(program, pointer(FAZA_1, 4, 'dita-4'))).toEqual({ blockId: 'faza-2', week: 1 })
      expect(weekToReview(program, pointer('java-0', 1, 'dita-3'))).toEqual({ blockId: FAZA_1, week: 1 })
    })

    it('pas javës së fundit, ose me programin të përfunduar: asnjë javë', () => {
      expect(weekToReview(program, pointer('faza-3', 4, 'dita-2'))).toBeNull()
      expect(weekToReview(program, { ...pointer('faza-3', 4, 'dita-1'), completed: true })).toBeNull()
    })
  })

  it('vetëm ushtrimet me peshë: pa ato me kohë dhe me peshën e trupit', () => {
    const exercises = weekWeights(input({})).map((row) => row.exerciseId)
    expect(exercises).toContain('Weighted Crunch')
    expect(exercises).not.toContain('Hanging Leg Raise')
    expect(exercises).not.toContain('Side Plank')
  })
})
