import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { Prescription } from '@/program/types'
import { prescriptionDraft, prescriptionFromDraft, prescriptionSummary } from './prescription-form'

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

  it('pa recetë: forma nis me intervalet e Shortcut to Size; çdo lloj ka vlera fillestare', () => {
    const draft = prescriptionDraft(undefined)
    expect(draft.type).toBe('rep_ladder')
    expect(draft.ladder.map((row) => `${row.min}–${row.max}`)).toEqual(['12–15', '9–11', '6–8', '3–5'])
    for (const type of ['rep_ladder', 'timed', 'percent_1rm', 'linear', 'rpe', 'rir'] as const) {
      expect(prescriptionFromDraft({ ...draft, type }).ok).toBe(true)
    }
  })

  it('presja dhjetore pranohet; kufiri i sipërm bosh do të thotë pa kufi', () => {
    const draft = prescriptionDraft({ type: 'linear', startKg: 40, incrementKg: 2.5, reps: 5, failuresBeforeDeload: 3, deloadPercent: 10 })
    expect(prescriptionFromDraft({ ...draft, startKg: '42,5' })).toMatchObject({ ok: true, value: { startKg: 42.5 } })
    const ladder = prescriptionDraft(undefined)
    ladder.ladder[0] = { min: '15', max: '', beyond: false }
    const parsed = prescriptionFromDraft(ladder)
    expect(parsed.ok && parsed.value.type === 'rep_ladder' && parsed.value.ladder[0]).toEqual({ min: 15, max: null })
  })

  it('gabimet tregojnë fushën me fjalë', () => {
    const ladder = prescriptionDraft(undefined)
    ladder.ladder[1] = { min: '12', max: '9', beyond: false }
    expect(prescriptionFromDraft(ladder)).toEqual({ ok: false, error: 'Java 2: maksimumi duhet të jetë sa minimumi ose më shumë.' })
    const percent = prescriptionDraft({ type: 'percent_1rm', weeks: [{ percent: 85, reps: 5 }] })
    percent.weeks[0].percent = '120'
    expect(prescriptionFromDraft(percent)).toEqual({ ok: false, error: 'Java 1: përqindja duhet të jetë nga 1 deri në 100.' })
    expect(prescriptionFromDraft({ ...prescriptionDraft({ type: 'timed', seconds: 30 }), seconds: 'abc' })).toEqual({
      ok: false,
      error: 'Kohëzgjatja duhet të jetë nga 5 deri në 600 sekonda.',
    })
    expect(prescriptionFromDraft({ ...prescriptionDraft(undefined), ladder: [] })).toEqual({ ok: false, error: 'Shto të paktën një javë.' })
    expect(prescriptionFromDraft({ ...prescriptionDraft({ type: 'rpe', reps: { min: 6, max: 8 }, rpe: 8 }), rpe: '11' })).toEqual({
      ok: false,
      error: 'RPE duhet të jetë nga 5 deri në 10.',
    })
  })

  it('përmbledhja e shkurtër për rreshtin e editorit', () => {
    expect(prescriptionSummary(undefined)).toBe('Pa recetë')
    expect(prescriptionSummary({ type: 'rep_ladder', ladder: [{ min: 12, max: 15 }, { min: 9, max: 11 }] })).toBe('12–15, 9–11')
    expect(prescriptionSummary({ type: 'timed', seconds: 45 })).toBe('45 sekonda')
    expect(prescriptionSummary({ type: 'percent_1rm', weeks: [{ percent: 85, reps: 5, amrap: true }, { percent: 90, reps: 3 }] })).toBe('85% × 5+, 90% × 3')
    expect(prescriptionSummary({ type: 'linear', startKg: 42.5, incrementKg: 2.5, reps: 5, failuresBeforeDeload: 3, deloadPercent: 10 })).toBe(
      '5 përsëritje, +2,5 kg',
    )
    expect(prescriptionSummary({ type: 'rpe', reps: { min: 6, max: 8 }, rpe: 8.5 })).toBe('6–8 me RPE 8,5')
    expect(prescriptionSummary({ type: 'rir', reps: { min: 8, max: null }, rir: { min: 1, max: 2 } })).toBe('8+ me RIR 1–2')
  })
})
