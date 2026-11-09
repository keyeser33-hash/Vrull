import { labelResultFrom } from './supplement-label'

// Përgjigjet e funksionit supplement-label për ekranin (V39).
const MONTH = { month: '2026-11-01', spentEur: 0.27, limitEur: 10 }
const FIELDS = { name: 'Gold Standard 100% Whey', kind: 'protein', doseAmount: 1, doseUnit: 'scoop', scoopG: 30.4, kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 }

describe('leximi i etiketës: përgjigjet', () => {
  it('sukses: fushat, sa u lexuan dhe kostoja', () => {
    expect(labelResultFrom(200, { fields: FIELDS, read: 8, total: 8, usage: { inputTokens: 1700, outputTokens: 120, costEur: 0.004, ms: 3000 }, month: MONTH })).toEqual({
      ok: true,
      fields: FIELDS,
      read: 8,
      total: 8,
      costEur: 0.004,
      month: MONTH,
    })
  })

  it('gabimet: pa lidhje, kufiri, jo etiketë, një përgjigje e çuditshme', () => {
    expect(labelResultFrom(null, null)).toEqual({ ok: false, error: 'offline' })
    expect(labelResultFrom(429, { error: 'limit', month: MONTH })).toEqual({ ok: false, error: 'limit', month: MONTH })
    expect(labelResultFrom(422, { error: 'not_label', costEur: 0.003, month: MONTH })).toEqual({ ok: false, error: 'not_label', costEur: 0.003, month: MONTH })
    expect(labelResultFrom(200, { fields: { name: 'x' } })).toEqual({ ok: false, error: 'ai_failed' })
    expect(labelResultFrom(401, {})).toEqual({ ok: false, error: 'unauthorized' })
  })
})
