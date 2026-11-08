import library from './library.json'
import { planSession } from './engine'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'
import { PROGRAM_TEMPLATES, templateById, templateSummary } from './templates'

// Shabllonet e ndërtuesit (V2-E1-10, bordi "Programet"): Shortcut to Size, Full body 3 ditë dhe
// Upper/Lower 4 ditë si të dhëna. Ushtrimet e dy të fundit vijnë nga biblioteka (free-exercise-db).

const LIBRARY_IDS = new Set(library.exercises.map((exercise) => exercise.id))
const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

describe('shabllonet e programeve', () => {
  it('tre shabllone me radhën e bordit, me javët dhe ditët e tyre', () => {
    expect(PROGRAM_TEMPLATES.map((template) => [template.id, templateSummary(template)])).toEqual([
      ['shortcut_to_size', { weeks: 13, days: 4 }],
      ['full_body_3', { weeks: 8, days: 3 }],
      ['upper_lower_4', { weeks: 8, days: 4 }],
    ])
  })

  it('Shortcut to Size është vetë programi i gatshëm, me emrat dhe ushtrimet e tij', () => {
    const template = templateById('shortcut_to_size')
    expect(template.program).toBe(SHORTCUT_TO_SIZE.program)
    expect(template.source).toEqual({ kind: 'defs', exercises: SHORTCUT_TO_SIZE.exercises })
    expect(template.localized).toBe(false)
    expect(template.progression).toBeNull()
  })

  it('ushtrimet e Full body dhe Upper/Lower janë te biblioteka', () => {
    for (const id of ['full_body_3', 'upper_lower_4'] as const) {
      const template = templateById(id)
      expect(template.source.kind).toBe('library')
      const used = new Set(template.program.slots.map((slot) => slot.exerciseId))
      for (const exerciseId of used) expect(LIBRARY_IDS.has(exerciseId), `${id}: ${exerciseId}`).toBe(true)
    }
  })

  it('Upper/Lower: Sipër A, Poshtë A, Sipër B, Poshtë B; 6, 5, 6, 5 ushtrime; Bazat dhe Forca nga 4 javë', () => {
    const { program } = templateById('upper_lower_4')
    expect([...program.blocks].sort(byPosition).map((block) => [block.name, block.weeks])).toEqual([
      ['base', 4],
      ['strength', 4],
    ])
    const days = [...program.days].sort(byPosition)
    expect(days.map((day) => day.name)).toEqual(['upperA', 'lowerA', 'upperB', 'lowerB'])
    expect(days.map((day) => program.slots.filter((slot) => slot.dayId === day.id).length)).toEqual([6, 5, 6, 5])
  })

  it('Upper/Lower: Bench Press 4 × 6–8 · RIR 2 te Bazat, 4 × 4–6 · RIR 1 te Forca, pushim 2:30', () => {
    const { program } = templateById('upper_lower_4')
    const [base, strength] = [...program.blocks].sort(byPosition)
    const [upperA] = [...program.days].sort(byPosition)
    const bench = (blockId: string) => planSession(program, { run: 1, blockId, week: 2, dayId: upperA.id, completed: false }).slots[0]
    expect(bench(base.id)).toMatchObject({
      exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
      sets: 4,
      restSeconds: 150,
      target: { kind: 'reps', min: 6, max: 8, rir: { min: 2, max: 2 } },
    })
    expect(bench(strength.id).target).toMatchObject({ min: 4, max: 6, rir: { min: 1, max: 1 } })
  })

  it('progresi i zgjuar i programit: RIR ≥ 2, +2,5 kg; çdo slot me peshë ka interval me kufi të sipërm', () => {
    for (const id of ['full_body_3', 'upper_lower_4'] as const) {
      const template = templateById(id)
      expect(template.progression).toEqual({ minRir: 2, incrementKg: 2.5 })
      for (const block of template.program.blocks) {
        for (const day of template.program.days) {
          for (const slot of planSession(template.program, { run: 1, blockId: block.id, week: 1, dayId: day.id, completed: false }).slots) {
            const tracking = template.source.kind === 'library' ? (template.source.tracking[slot.exerciseId] ?? 'weight_reps') : null
            if (tracking === 'timed') expect(slot.target.kind).toBe('timed')
            else expect(slot.target).toMatchObject({ kind: 'reps', max: expect.any(Number) })
          }
        }
      }
    }
  })

  it('Full body: Plank me kohë (30 s), jo me përsëritje', () => {
    const template = templateById('full_body_3')
    expect(template.source.kind === 'library' && template.source.tracking.Plank).toBe('timed')
  })
})
