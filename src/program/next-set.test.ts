import { type LoggedSet, pendingSegment, segmentDefaults, setDefaults } from './next-set'
import type { PlannedSlot, SessionPlan } from './types'

// Vlerat e propozuara të setit të radhës (V2-E1-07), të përbashkëta për ekranin e seancës dhe
// njoftimin e seancës (V2-E1-08): njëra nuk llogarit peshë më vete nga tjetra.

const bench: PlannedSlot = {
  slotId: 'bench',
  position: 0,
  exerciseId: 'bench-ex',
  sets: 4,
  restSeconds: 90,
  target: { kind: 'reps', min: 9, max: 11, beyond: false },
  technique: { type: 'rest_pause', restSeconds: 15 },
}
const plank: PlannedSlot = { ...bench, slotId: 'plank', exerciseId: 'plank-ex', sets: 3, target: { kind: 'timed', seconds: 60 }, technique: { type: 'none' } }
const java0: PlannedSlot = { ...bench, slotId: 'java0', target: { kind: 'reps', min: 8, max: 10, beyond: false, rir: { min: 2, max: 3 } }, technique: { type: 'none' } }
const plan = { slots: [bench, plank] } as SessionPlan

const logged = (values: Partial<LoggedSet> & Pick<LoggedSet, 'slotId' | 'setNumber'>): LoggedSet => ({
  id: `${values.slotId}-${values.setNumber}`,
  weightKg: 62.5,
  reps: 9,
  seconds: null,
  rir: null,
  technique: 'none',
  segments: [],
  ...values,
})

describe('seti i radhës: vlerat e propozuara', () => {
  it('seti i parë i ushtrimit merr peshën e javës dhe kufirin e poshtëm të intervalit', () => {
    expect(setDefaults(bench, undefined, 62.5)).toEqual({ weightKg: 62.5, reps: 9, seconds: null, rir: null })
  })

  it('pa peshë jave (ushtrimi pa histori) pesha mbetet 0, që përdoruesi ta zgjedhë', () => {
    expect(setDefaults(bench, undefined, null)).toMatchObject({ weightKg: 0, reps: 9 })
  })

  it('setet e tjera mbajnë peshën dhe përsëritjet e setit të mëparshëm të seancës, jo peshën e javës', () => {
    expect(setDefaults(bench, logged({ slotId: 'bench', setNumber: 2, weightKg: 60, reps: 11 }), 62.5)).toMatchObject({ weightKg: 60, reps: 11 })
  })

  it('setet me kohë propozojnë sekondat e recetës, pastaj ato të setit të mëparshëm', () => {
    expect(setDefaults(plank, undefined, null)).toEqual({ weightKg: 0, reps: null, seconds: 60, rir: null })
    expect(setDefaults(plank, logged({ slotId: 'plank', setNumber: 1, weightKg: null, reps: null, seconds: 45 }), null)).toMatchObject({ seconds: 45 })
  })

  it('RIR-i vetëm kur receta e kërkon: kufiri i poshtëm, pastaj ai i setit të mëparshëm', () => {
    expect(setDefaults(java0, undefined, 40)).toMatchObject({ rir: 2 })
    expect(setDefaults(java0, logged({ slotId: 'java0', setNumber: 1, rir: 3 }), 40)).toMatchObject({ rir: 3 })
    expect(setDefaults(bench, undefined, 62.5).rir).toBeNull()
  })
})

describe('segmenti që pret', () => {
  it('seti i fundit me rest-pause pa segment pret segmentin; me segment jo më', () => {
    const last = logged({ slotId: 'bench', setNumber: 4, reps: 9, technique: 'rest_pause' })
    expect(pendingSegment(plan, [last])).toEqual({ set: last, slot: bench })
    expect(pendingSegment(plan, [{ ...last, segments: [{ weightKg: 62.5, reps: 3 }] }])).toBeNull()
  })

  it('vetëm seti i fundit i seancës dhe vetëm seti i fundit i slotit', () => {
    const fourth = logged({ slotId: 'bench', setNumber: 4, technique: 'rest_pause' })
    expect(pendingSegment(plan, [fourth, logged({ slotId: 'plank', setNumber: 1 })])).toBeNull()
    expect(pendingSegment(plan, [logged({ slotId: 'bench', setNumber: 3, technique: 'rest_pause' })])).toBeNull()
    expect(pendingSegment(plan, [])).toBeNull()
  })

  it('segmenti i rest-pause: e njëjta peshë, një e treta e përsëritjeve (të paktën 1)', () => {
    expect(segmentDefaults(logged({ slotId: 'bench', setNumber: 4, reps: 9, technique: 'rest_pause' }), null)).toEqual({ weightKg: 62.5, reps: 3, seconds: null, rir: null })
    expect(segmentDefaults(logged({ slotId: 'bench', setNumber: 4, reps: 1, technique: 'rest_pause' }), null).reps).toBe(1)
  })

  it('segmenti i drop set-it: pesha e uljes kur dihet, përndryshe pesha e setit', () => {
    const drop = logged({ slotId: 'bench', setNumber: 4, weightKg: 70, reps: 6, technique: 'drop_set' })
    expect(segmentDefaults(drop, 50)).toMatchObject({ weightKg: 50, reps: 2 })
    expect(segmentDefaults(drop, null)).toMatchObject({ weightKg: 70 })
  })
})
