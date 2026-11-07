import { planSession } from './engine'
import { describeScope, slotRules } from './rules'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'
import type { Program } from './types'

const PROGRAM: Program = {
  id: 'p',
  blocks: [
    { id: 'b1', position: 0, name: 'Faza 1', weeks: 3 },
    { id: 'b2', position: 1, name: 'Faza 2', weeks: 3 },
  ],
  days: [{ id: 'd', position: 0, name: 'A' }],
  slots: [{ id: 's', dayId: 'd', position: 0, exerciseId: 'bench', sets: 3, restSeconds: 90 }],
  overrides: [
    { slotId: 's', blockId: null, week: null, prescription: { type: 'timed', seconds: 30 } },
    { slotId: 's', blockId: 'b1', week: null, exerciseId: 'incline' },
    { slotId: 's', blockId: null, week: 2, sets: 5 },
    { slotId: 's', blockId: 'b1', week: 2, technique: { type: 'drop_set' } },
  ],
  exercises: {},
}

describe('rregullat e një sloti në një nivel të editorit', () => {
  it('i gjithë programi: vlerat e slotit dhe rregullat pa bllok e pa javë', () => {
    const rules = slotRules(PROGRAM, 's', { blockId: null, week: null })
    expect(rules.exerciseId).toEqual({ value: 'bench', from: null })
    expect(rules.sets).toEqual({ value: 3, from: null })
    expect(rules.prescription).toEqual({ value: { type: 'timed', seconds: 30 }, from: { blockId: null, week: null } })
    expect(rules.technique).toEqual({ value: undefined, from: null })
  })

  it('një bllok pa javë: rregullat e një jave nuk vlejnë për gjithë bllokun', () => {
    const rules = slotRules(PROGRAM, 's', { blockId: 'b1', week: null })
    expect(rules.exerciseId).toEqual({ value: 'incline', from: { blockId: 'b1', week: null } })
    expect(rules.sets).toEqual({ value: 3, from: null })
    expect(rules.technique.value).toBeUndefined()
  })

  it('një javë në çdo bllok: rregullat e një blloku nuk vlejnë', () => {
    const rules = slotRules(PROGRAM, 's', { blockId: null, week: 2 })
    expect(rules.exerciseId.value).toBe('bench')
    expect(rules.sets).toEqual({ value: 5, from: { blockId: null, week: 2 } })
  })

  it('blloku dhe java: fiton rregulli më i saktë', () => {
    const rules = slotRules(PROGRAM, 's', { blockId: 'b1', week: 2 })
    expect(rules.exerciseId.value).toBe('incline')
    expect(rules.sets.value).toBe(5)
    expect(rules.technique).toEqual({ value: { type: 'drop_set' }, from: { blockId: 'b1', week: 2 } })
    expect(slotRules(PROGRAM, 's', { blockId: 'b2', week: 2 }).technique.value).toBeUndefined()
  })

  it('për çdo bllok dhe javë të Shortcut to Size përputhet me planin e motorit', () => {
    const program = SHORTCUT_TO_SIZE.program
    for (const block of program.blocks) {
      for (let week = 1; week <= block.weeks; week++) {
        for (const day of program.days) {
          const plan = planSession(program, { run: 1, blockId: block.id, week, dayId: day.id, completed: false })
          for (const planned of plan.slots) {
            const rules = slotRules(program, planned.slotId, { blockId: block.id, week })
            expect([rules.exerciseId.value, rules.sets.value, rules.restSeconds.value]).toEqual([planned.exerciseId, planned.sets, planned.restSeconds])
          }
        }
      }
    }
  })

  it('emri i nivelit me fjalë', () => {
    const names = { b1: 'Faza 1' }
    expect(describeScope(null, names)).toBe('Për gjithë programin')
    expect(describeScope({ blockId: null, week: null }, names)).toBe('Për gjithë programin')
    expect(describeScope({ blockId: 'b1', week: null }, names)).toBe('Për Faza 1')
    expect(describeScope({ blockId: null, week: 2 }, names)).toBe('Për javën 2 të çdo blloku')
    expect(describeScope({ blockId: 'b1', week: 2 }, names)).toBe('Për Faza 1 · Java 2')
  })
})
