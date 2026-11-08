import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { Prescription } from '@/program/types'
import { prescriptionDraft, prescriptionFromDraft } from './prescription-form'

// Forma e recetës (fleta "Receta" e ndërtuesit): çdo recetë kthehet e njëjtë pas formës, numrat me
// presje ose pikë, gabimet si çelësa të katalogut (`builder.recipe.error.*`).

describe('forma e recetës', () => {
  it('çdo recetë e Shortcut to Size kthehet e njëjtë pas formës', () => {
    const all = SHORTCUT_TO_SIZE.program.overrides.flatMap((rule) => (rule.prescription ? [rule.prescription] : []))
    expect(all.length).toBeGreaterThan(10)
    for (const prescription of all) expect(prescriptionFromDraft(prescriptionDraft(prescription))).toEqual({ ok: true, value: prescription })
  })

  it('5/3/1, linear, RPE dhe RIR kthehen të njëjtë', () => {
    const samples: Prescription[] = [
      { type: 'percent_1rm', weeks: [{ percent: 65, reps: 5 }, { percent: 75, reps: 5 }, { percent: 85, reps: 5, amrap: true }] },
      { type: 'linear', startKg: 40, incrementKg: 2.5, reps: 5, failuresBeforeDeload: 3, deloadPercent: 10 },
      { type: 'rpe', reps: { min: 6, max: 8 }, rpe: 8.5 },
      { type: 'rir', reps: { min: 8, max: null, beyond: true }, rir: { min: 1, max: 2 } },
      { type: 'timed', seconds: 45 },
    ]
    for (const prescription of samples) expect(prescriptionFromDraft(prescriptionDraft(prescription))).toEqual({ ok: true, value: prescription })
  })

  it('pa recetë: forma nis me 8–12 me RIR 2 (ushtrimi i ri i ndërtuesit); çdo lloj ka vlera fillestare', () => {
    const draft = prescriptionDraft(undefined)
    expect(prescriptionFromDraft(draft)).toEqual({ ok: true, value: { type: 'rir', reps: { min: 8, max: 12 }, rir: { min: 2, max: 2 } } })
    expect(draft.ladder.map((row) => `${row.min}–${row.max}`)).toEqual(['12–15', '9–11', '6–8', '3–5'])
    for (const type of ['rep_ladder', 'timed', 'percent_1rm', 'linear', 'rpe', 'rir'] as const) {
      expect(prescriptionFromDraft({ ...draft, type }).ok).toBe(true)
    }
  })

  it('numrat sipas gjuhës: presja ose pika dhjetore; kufiri i sipërm bosh do të thotë pa kufi', () => {
    const linear: Prescription = { type: 'linear', startKg: 40, incrementKg: 2.5, reps: 5, failuresBeforeDeload: 3, deloadPercent: 10 }
    expect(prescriptionDraft(linear, (value) => String(value).replace('.', ',')).incrementKg).toBe('2,5')
    expect(prescriptionDraft(linear).incrementKg).toBe('2.5')
    const draft = prescriptionDraft(linear)
    expect(prescriptionFromDraft({ ...draft, startKg: '42,5' })).toMatchObject({ ok: true, value: { startKg: 42.5 } })
    expect(prescriptionFromDraft({ ...draft, startKg: '42.5' })).toMatchObject({ ok: true, value: { startKg: 42.5 } })
    const ladder = prescriptionDraft({ type: 'rep_ladder', ladder: [{ min: 12, max: 15 }] })
    ladder.ladder[0] = { min: '15', max: '', beyond: false }
    const parsed = prescriptionFromDraft(ladder)
    expect(parsed.ok && parsed.value.type === 'rep_ladder' && parsed.value.ladder[0]).toEqual({ min: 15, max: null })
  })

  it('gabimet janë çelësa me parametrat e tyre', () => {
    const ladder = prescriptionDraft({ type: 'rep_ladder', ladder: [{ min: 12, max: 15 }, { min: 9, max: 11 }] })
    ladder.ladder[1] = { min: '12', max: '9', beyond: false }
    expect(prescriptionFromDraft(ladder)).toEqual({ ok: false, error: { key: 'builder.recipe.error.weekMaxBelowMin', params: { number: 2 } } })
    const percent = prescriptionDraft({ type: 'percent_1rm', weeks: [{ percent: 85, reps: 5 }] })
    percent.weeks[0].percent = '120'
    expect(prescriptionFromDraft(percent)).toEqual({ ok: false, error: { key: 'builder.recipe.error.percent', params: { number: 1 } } })
    expect(prescriptionFromDraft({ ...prescriptionDraft({ type: 'timed', seconds: 30 }), seconds: 'abc' })).toEqual({ ok: false, error: { key: 'builder.recipe.error.seconds' } })
    expect(prescriptionFromDraft({ ...prescriptionDraft(undefined), type: 'rep_ladder', ladder: [] })).toEqual({ ok: false, error: { key: 'builder.recipe.error.weekRequired' } })
    expect(prescriptionFromDraft({ ...prescriptionDraft({ type: 'rpe', reps: { min: 6, max: 8 }, rpe: 8 }), rpe: '11' })).toEqual({
      ok: false,
      error: { key: 'builder.recipe.error.rpe' },
    })
    expect(prescriptionFromDraft({ ...prescriptionDraft(undefined), repsMin: '12', repsMax: '8' })).toEqual({ ok: false, error: { key: 'builder.recipe.error.maxBelowMin' } })
  })
})
