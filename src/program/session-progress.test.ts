import { sessionProgress } from './session-progress'
import type { PlannedSlot, SessionPlan } from './types'

const slot = (id: string, sets: number): PlannedSlot => ({
  slotId: id,
  position: 0,
  exerciseId: id,
  sets,
  restSeconds: 90,
  target: { kind: 'reps', min: 12, max: 15, beyond: false },
  technique: { type: 'none' },
})
const plan = { slots: [slot('a', 2), slot('b', 2), slot('c', 1)] } as SessionPlan
const logged = (...ids: string[]) => ids.map((slotId) => ({ slotId }))

describe('ecuria e seancës', () => {
  it('ushtrimi i parë që ka sete, dhe tjetri pas tij', () => {
    expect(sessionProgress(plan, logged('a'))).toMatchObject({ current: 0, next: 1, doneSets: 1, totalSets: 5 })
    expect(sessionProgress(plan, logged('a', 'a'))).toMatchObject({ current: 1, next: 2 })
    expect(sessionProgress(plan, logged('a', 'a')).slots.map((entry) => entry.done)).toEqual([2, 0, 0])
  })

  it('ushtrimi i zgjedhur nga lista, pastaj ai që mbetet më përpara', () => {
    expect(sessionProgress(plan, logged(), 'c')).toMatchObject({ current: 2, next: 0 })
    expect(sessionProgress(plan, logged('b', 'b'), 'a')).toMatchObject({ current: 0, next: 2 })
  })

  it('një ushtrim i zgjedhur por i mbaruar nuk mbetet në ekran', () => {
    expect(sessionProgress(plan, logged('c'), 'c')).toMatchObject({ current: 0, next: 1 })
  })

  it('kur mbarojnë të gjitha setet: asnjë ushtrim, gati për mbyllje', () => {
    expect(sessionProgress(plan, logged('a', 'a', 'b', 'b', 'c'))).toMatchObject({ current: null, next: null, doneSets: 5 })
    expect(sessionProgress(plan, logged('a', 'a', 'b', 'c'))).toMatchObject({ current: 1, next: null })
  })

  it('setet e tepërta nuk e kalojnë numrin e planit', () => {
    expect(sessionProgress(plan, logged('c', 'c')).doneSets).toBe(1)
  })
})
