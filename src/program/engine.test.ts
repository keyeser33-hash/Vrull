import { advance, blockWeekLabel, planSession, restart } from './engine'
import type { Pointer, Program, SlotOverride } from './types'

// Një program i vogël: dy blloqe (1 dhe 4 javë), dy ditë, dy slote në ditën e parë.
function program(overrides: SlotOverride[] = []): Program {
  return {
    id: 'p',
    blocks: [
      { id: 'b0', position: 0, name: 'Java 0', weeks: 1 },
      { id: 'b1', position: 1, name: 'Faza 1', weeks: 4 },
    ],
    days: [
      { id: 'd2', position: 1, name: 'Shpinë' },
      { id: 'd1', position: 0, name: 'Gjoks' },
    ],
    slots: [
      { id: 's2', dayId: 'd1', position: 1, exerciseId: 'flye', sets: 3, restSeconds: 90 },
      { id: 's1', dayId: 'd1', position: 0, exerciseId: 'bench', sets: 4, restSeconds: 90 },
      { id: 's3', dayId: 'd2', position: 0, exerciseId: 'row', sets: 4, restSeconds: 90 },
    ],
    overrides,
    exercises: {
      bench: { tracking: 'weight_reps', equipment: 'barbell' },
      flye: { tracking: 'weight_reps', equipment: 'dumbbell' },
      row: { tracking: 'weight_reps', equipment: 'dumbbell' },
      plank: { tracking: 'timed', equipment: 'bodyweight' },
      dip: { tracking: 'bodyweight_reps', equipment: 'bodyweight' },
      roundhouse: { tracking: 'bodyweight_reps', equipment: 'band' },
    },
  }
}

const at = (blockId: string, week: number, dayId: string): Pointer => ({ run: 1, blockId, week, dayId, completed: false })

const LADDER = {
  type: 'rep_ladder' as const,
  ladder: [
    { min: 12, max: 15 },
    { min: 9, max: 11 },
    { min: 6, max: 8 },
    { min: 3, max: 5 },
  ],
}

describe('plani i seancës', () => {
  it('slotet e ditës me radhë, me ushtrimin, setet dhe pushimin e tyre', () => {
    const plan = planSession(program(), at('b1', 2, 'd1'))
    expect(plan.slots.map((slot) => [slot.exerciseId, slot.sets, slot.restSeconds])).toEqual([
      ['bench', 4, 90],
      ['flye', 3, 90],
    ])
    expect(plan).toMatchObject({ blockName: 'Faza 1', week: 2, blockWeeks: 4, dayName: 'Gjoks', dayNumber: 1 })
  })

  it('shkalla e përsëritjeve ndjek javën brenda bllokut', () => {
    const p = program([{ slotId: 's1', blockId: null, week: null, prescription: LADDER }])
    const range = (week: number) => {
      const target = planSession(p, at('b1', week, 'd1')).slots[0].target
      return target.kind === 'reps' ? [target.min, target.max] : null
    }
    expect([1, 2, 3, 4].map(range)).toEqual([
      [12, 15],
      [9, 11],
      [6, 8],
      [3, 5],
    ])
  })

  it('ndryshimi më i saktë fiton, fushë për fushë', () => {
    const p = program([
      { slotId: 's2', blockId: 'b1', week: null, exerciseId: 'incline', restSeconds: 75 },
      { slotId: 's2', blockId: 'b1', week: 2, exerciseId: 'decline' },
      { slotId: 's2', blockId: null, week: 3, technique: { type: 'drop_set' }, sets: 5 },
      { slotId: 's2', blockId: null, week: 1, technique: { type: 'rest_pause' } },
      { slotId: 's2', blockId: 'b0', week: null, technique: { type: 'none' }, sets: 2 },
    ])
    const slot = (blockId: string, week: number) => {
      const planned = planSession(p, at(blockId, week, 'd1')).slots[1]
      return [planned.exerciseId, planned.sets, planned.restSeconds, planned.technique.type]
    }
    expect(slot('b0', 1)).toEqual(['flye', 2, 90, 'none'])
    expect(slot('b1', 1)).toEqual(['incline', 3, 75, 'rest_pause'])
    expect(slot('b1', 2)).toEqual(['decline', 3, 75, 'none'])
    expect(slot('b1', 3)).toEqual(['incline', 5, 75, 'drop_set'])
  })
})

describe('llojet e recetës', () => {
  const targetOf = (prescription: SlotOverride['prescription'], week = 1, extra: SlotOverride[] = []) =>
    planSession(program([{ slotId: 's1', blockId: null, week: null, prescription }, ...extra]), at('b1', week, 'd1'))
      .slots[0].target

  it('kohë: sekondat e javës, të ndryshuara sipas bllokut dhe javës', () => {
    const extra: SlotOverride[] = [{ slotId: 's1', blockId: 'b1', week: 4, prescription: { type: 'timed', seconds: 75 } }]
    expect(targetOf({ type: 'timed', seconds: 60 }, 1, extra)).toEqual({ kind: 'timed', seconds: 60 })
    expect(targetOf({ type: 'timed', seconds: 60 }, 4, extra)).toEqual({ kind: 'timed', seconds: 75 })
  })

  it('%1RM: përqindja dhe përsëritjet e javës (5/3/1), me setin AMRAP', () => {
    const weeks = [
      { percent: 65, reps: 5 },
      { percent: 70, reps: 3 },
      { percent: 75, reps: 5, amrap: true },
    ]
    expect(targetOf({ type: 'percent_1rm', weeks }, 1)).toEqual({ kind: 'percent_1rm', percent: 65, reps: 5, amrap: false })
    expect(targetOf({ type: 'percent_1rm', weeks }, 3)).toEqual({ kind: 'percent_1rm', percent: 75, reps: 5, amrap: true })
    expect(targetOf({ type: 'percent_1rm', weeks }, 4)).toMatchObject({ percent: 65 })
  })

  it('RIR: përsëritjet dhe përsëritjet në rezervë (Java 0)', () => {
    expect(targetOf({ type: 'rir', reps: { min: 12, max: 15 }, rir: { min: 2, max: 3 } })).toEqual({
      kind: 'reps',
      min: 12,
      max: 15,
      beyond: false,
      rir: { min: 2, max: 3 },
    })
  })

  it('RPE: përsëritjet dhe vlerësimi i synuar', () => {
    expect(targetOf({ type: 'rpe', reps: { min: 6, max: 8 }, rpe: 8 })).toEqual({
      kind: 'reps',
      min: 6,
      max: 8,
      beyond: false,
      rpe: 8,
    })
  })

  it('progresion çdo seancë: përsëritjet dhe rregullat e peshës', () => {
    const linear = { type: 'linear' as const, startKg: 40, incrementKg: 2.5, reps: 5, failuresBeforeDeload: 3, deloadPercent: 10 }
    expect(targetOf(linear)).toEqual({
      kind: 'linear',
      reps: 5,
      startKg: 40,
      incrementKg: 2.5,
      failuresBeforeDeload: 3,
      deloadPercent: 10,
    })
  })

  it('shkalla mban "deri në dështim nëse mund më shumë" dhe shtesën ndërmjet blloqeve', () => {
    const p = program([
      {
        slotId: 's1',
        blockId: null,
        week: null,
        prescription: { type: 'rep_ladder', ladder: [{ min: 20, max: 30, beyond: true }], blockIncreaseKg: { min: 2.5, max: 9 } },
      },
    ])
    const [slot] = planSession(p, at('b1', 1, 'd1')).slots
    expect(slot.target).toEqual({ kind: 'reps', min: 20, max: 30, beyond: true })
    expect(slot.blockIncreaseKg).toEqual({ min: 2.5, max: 9 })
  })

  it('teknika nuk vlen për ushtrimet me kohë', () => {
    const p = program([
      { slotId: 's1', blockId: null, week: null, exerciseId: 'plank', prescription: { type: 'timed', seconds: 60 } },
      { slotId: 's1', blockId: null, week: 3, technique: { type: 'drop_set' } },
    ])
    expect(planSession(p, at('b1', 3, 'd1')).slots[0].technique).toEqual({ type: 'none' })
  })

  it('drop set-i pa peshë bëhet rest-pause', () => {
    const p = program([
      { slotId: 's1', blockId: null, week: null, exerciseId: 'dip', prescription: LADDER },
      { slotId: 's1', blockId: null, week: 3, technique: { type: 'drop_set' } },
    ])
    expect(planSession(p, at('b1', 3, 'd1')).slots[0].technique).toEqual({ type: 'rest_pause' })
  })

  it('me llastik, drop set-i mbetet: bëhet me llastikun më të lehtë', () => {
    const p = program([
      { slotId: 's1', blockId: null, week: null, exerciseId: 'roundhouse', prescription: LADDER },
      { slotId: 's1', blockId: null, week: 3, technique: { type: 'drop_set' } },
    ])
    expect(planSession(p, at('b1', 3, 'd1')).slots[0].technique).toEqual({ type: 'drop_set' })
  })

  it('rregulli i progresit (V9) vjen nga niveli më i saktë: programi, blloku, java e bllokut', () => {
    const p = program([
      { slotId: 's1', blockId: null, week: null, progression: { minRir: 2, incrementKg: 2.5 } },
      { slotId: 's1', blockId: 'b1', week: null, progression: { minRir: 1, incrementKg: 5 } },
      { slotId: 's1', blockId: 'b1', week: 3, progression: { minRir: 3, incrementKg: 1 } },
    ])
    const rule = (blockId: string, week: number) => planSession(p, at(blockId, week, 'd1')).slots[0].progression
    expect(rule('b0', 1)).toEqual({ minRir: 2, incrementKg: 2.5 })
    expect(rule('b1', 2)).toEqual({ minRir: 1, incrementKg: 5 })
    expect(rule('b1', 3)).toEqual({ minRir: 3, incrementKg: 1 })
    expect(planSession(p, at('b1', 2, 'd1')).slots[1].progression).toBeUndefined()
  })

  it('pa recetë: përsëritje pa objektiv', () => {
    expect(planSession(program(), at('b1', 1, 'd1')).slots[0].target).toEqual({ kind: 'reps', min: 0, max: null, beyond: false })
  })
})

describe('radha e stërvitjeve', () => {
  const p = program()

  it('dita tjetër e së njëjtës javë', () => {
    expect(advance(p, at('b1', 2, 'd1'))).toEqual(at('b1', 2, 'd2'))
  })

  it('pas ditës së fundit: java tjetër, dita e parë', () => {
    expect(advance(p, at('b1', 2, 'd2'))).toEqual(at('b1', 3, 'd1'))
  })

  it('pas javës së fundit të bllokut: blloku tjetër, java 1', () => {
    expect(advance(p, at('b0', 1, 'd2'))).toEqual(at('b1', 1, 'd1'))
  })

  it('pas stërvitjes së fundit programi përfundon dhe treguesi mbetet aty', () => {
    expect(advance(p, at('b1', 4, 'd2'))).toEqual({ ...at('b1', 4, 'd2'), completed: true })
    const done = { ...at('b1', 4, 'd2'), completed: true }
    expect(advance(p, done)).toEqual(done)
  })

  it('një program i përfunduar mbetet i tillë deri në rinisje, edhe pasi editori shton javë', () => {
    const done = { ...at('b1', 2, 'd1'), completed: true }
    expect(advance(p, done)).toEqual(done)
  })

  it('rinisja nga një bllok: xhiro e re, java 1, dita e parë', () => {
    const done = { ...at('b1', 4, 'd2'), completed: true }
    expect(restart(p, done, 'b1')).toEqual({ run: 2, blockId: 'b1', week: 1, dayId: 'd1', completed: false })
  })
})

describe('programet e përdoruesit (V2-E1-10)', () => {
  // Sipër/poshtë: tre blloqe (4, 4, 1 javë) dhe katër ditë, me ditët e shkruara jashtë radhës.
  const upperLower = (overrides: SlotOverride[] = [], progression: Program['progression'] = null): Program => ({
    id: 'ul',
    blocks: [
      { id: 'force', position: 1, name: 'Forca', weeks: 4 },
      { id: 'base', position: 0, name: 'Bazat', weeks: 4 },
      { id: 'deload', position: 2, name: 'Shkarkim', weeks: 1 },
    ],
    days: [
      { id: 'lowerB', position: 3, name: 'Poshtë B' },
      { id: 'upperA', position: 0, name: 'Sipër A' },
      { id: 'upperB', position: 2, name: 'Sipër B' },
      { id: 'lowerA', position: 1, name: 'Poshtë A' },
    ],
    slots: [
      { id: 'bench', dayId: 'upperA', position: 0, exerciseId: 'bench', sets: 4, restSeconds: 150 },
      { id: 'curl', dayId: 'upperA', position: 1, exerciseId: 'curl', sets: 3, restSeconds: 60 },
      { id: 'squat', dayId: 'lowerA', position: 0, exerciseId: 'squat', sets: 4, restSeconds: 180 },
      { id: 'row', dayId: 'upperB', position: 0, exerciseId: 'row', sets: 4, restSeconds: 120 },
      { id: 'rdl', dayId: 'lowerB', position: 0, exerciseId: 'rdl', sets: 3, restSeconds: 150 },
    ],
    overrides,
    exercises: {
      bench: { tracking: 'weight_reps', equipment: 'barbell' },
      curl: { tracking: 'weight_reps', equipment: 'dumbbell' },
      squat: { tracking: 'weight_reps', equipment: 'barbell' },
      row: { tracking: 'weight_reps', equipment: 'cable' },
      rdl: { tracking: 'weight_reps', equipment: 'barbell' },
    },
    progression,
  })

  it('ditët dhe blloqet sipas pozicionit: Sipër A, Poshtë A, Sipër B, Poshtë B, pastaj java tjetër', () => {
    const p = upperLower()
    const order: string[] = []
    let pointer: Pointer = at('base', 1, 'upperA')
    for (let step = 0; step < 6; step++) {
      order.push(`${pointer.blockId}:${pointer.week}:${planSession(p, pointer).dayName}:${planSession(p, pointer).dayNumber}`)
      pointer = advance(p, pointer)
    }
    expect(order).toEqual([
      'base:1:Sipër A:1',
      'base:1:Poshtë A:2',
      'base:1:Sipër B:3',
      'base:1:Poshtë B:4',
      'base:2:Sipër A:1',
      'base:2:Poshtë A:2',
    ])
    expect(advance(p, at('base', 4, 'lowerB'))).toEqual(at('force', 1, 'upperA'))
    expect(advance(p, at('force', 4, 'lowerB'))).toEqual(at('deload', 1, 'upperA'))
    expect(advance(p, at('deload', 1, 'lowerB'))).toEqual({ ...at('deload', 1, 'lowerB'), completed: true })
  })

  it('receta me RIR sipas bllokut: 4 × 6–8 · RIR 2 te Bazat, 4 × 4–6 · RIR 1 te Forca', () => {
    const p = upperLower([
      { slotId: 'bench', blockId: null, week: null, prescription: { type: 'rir', reps: { min: 6, max: 8 }, rir: { min: 2, max: 2 } } },
      { slotId: 'bench', blockId: 'force', week: null, prescription: { type: 'rir', reps: { min: 4, max: 6 }, rir: { min: 1, max: 1 } } },
    ])
    expect(planSession(p, at('base', 3, 'upperA')).slots[0]).toMatchObject({ sets: 4, restSeconds: 150, target: { kind: 'reps', min: 6, max: 8, rir: { min: 2, max: 2 } } })
    expect(planSession(p, at('force', 1, 'upperA')).slots[0].target).toMatchObject({ min: 4, max: 6, rir: { min: 1, max: 1 } })
  })

  it('progresi i zgjuar i gjithë programit vlen për çdo slot pa rregull më vete', () => {
    const p = upperLower([{ slotId: 'curl', blockId: 'force', week: null, progression: { minRir: 1, incrementKg: 1 } }], { minRir: 2, incrementKg: 2.5 })
    const rules = (blockId: string) => planSession(p, at(blockId, 1, 'upperA')).slots.map((slot) => slot.progression)
    expect(rules('base')).toEqual([
      { minRir: 2, incrementKg: 2.5 },
      { minRir: 2, incrementKg: 2.5 },
    ])
    expect(rules('force')).toEqual([
      { minRir: 2, incrementKg: 2.5 },
      { minRir: 1, incrementKg: 1 },
    ])
  })

  it('pa progres të zgjuar në program dhe pa rregull te sloti: pa rregull', () => {
    expect(planSession(upperLower(), at('base', 1, 'upperA')).slots[0].progression).toBeUndefined()
  })
})

describe('emërtimi', () => {
  it('blloku me një javë pa numër jave; të tjerët me javën', () => {
    expect(blockWeekLabel(planSession(program(), at('b0', 1, 'd1')))).toBe('Java 0')
    expect(blockWeekLabel(planSession(program(), at('b1', 2, 'd2')))).toBe('Faza 1 · Java 2')
  })
})
