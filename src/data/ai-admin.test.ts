import { adminResultFrom, stepLimit } from './ai-admin'

// Përgjigja e funksionit ai-admin te faqja e Adminit (V42, V2-E2-17): lista, gabimet dhe hapi ±5 €.
const person = { id: '11111111-1111-4111-8111-111111111111', name: 'Andi', isAdmin: true, limitEur: 40, spentEur: 0.42, byFeature: {} }

describe('përgjigja e ai-admin', () => {
  it('lista e plotë; jo admin; përgjigje e prishur; pa lidhje', () => {
    expect(adminResultFrom(200, { month: '2026-11-01', people: [person] })).toEqual({ ok: true, month: '2026-11-01', people: [person] })
    expect(adminResultFrom(403, { error: 'forbidden' })).toEqual({ ok: false, error: 'forbidden' })
    // Një person pa kufi numerik nuk kalon si i plotë.
    expect(adminResultFrom(200, { month: '2026-11-01', people: [{ ...person, limitEur: '40' }] })).toEqual({ ok: false, error: 'failed' })
    expect(adminResultFrom(502, { error: 'failed' })).toEqual({ ok: false, error: 'failed' })
    expect(adminResultFrom(null, null)).toEqual({ ok: false, error: 'offline' })
  })

  it('hapi ±5 € brenda 0–500 €, edhe nga një kufi jo i rrumbullakët', () => {
    expect([stepLimit(10, 1), stepLimit(10, -1), stepLimit(0, -1), stepLimit(500, 1), stepLimit(12.5, 1)]).toEqual([15, 5, 0, 500, 20])
  })
})
