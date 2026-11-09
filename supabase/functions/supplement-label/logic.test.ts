import * as importLogic from '../program-import/logic'
import { AI_MONTHLY_LIMIT_EUR as IMPORT_LIMIT } from '../program-import/logic'
import { AI_MONTHLY_LIMIT_EUR, API_VERSION, buildRequest, costOf, imageType, interpret, LABEL_SCHEMA, MODEL, monthStart, USD_PER_EUR } from './logic'

// Leximi i etiketës (V39, V2-E2-10): kërkesa, kostoja dhe interpretimi i përgjigjes.
const reply = (fields: Record<string, unknown>) => ({ content: [{ type: 'text', text: JSON.stringify(fields) }], usage: { input_tokens: 1700, output_tokens: 120 } })
const WHEY = { is_label: true, name: 'Gold Standard 100% Whey', kind: 'protein', dose_amount: 1, dose_unit: 'scoop', serving_g: 30.4, kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 }

describe('funksioni supplement-label', () => {
  it('kursi, muaji dhe kufiri janë ata të importit (një kufi për të gjitha); modeli i vet, Haiku', () => {
    expect([API_VERSION, USD_PER_EUR]).toEqual([importLogic.API_VERSION, importLogic.USD_PER_EUR])
    expect(AI_MONTHLY_LIMIT_EUR).toBe(IMPORT_LIMIT)
    expect(monthStart(new Date('2026-11-30T23:30:00Z'))).toBe(importLogic.monthStart(new Date('2026-11-30T23:30:00Z')))
    expect(MODEL).toBe('claude-haiku-5-5')
    // 1 700 × 0,10 $ + 120 × 0,50 $ për milion = 0,00023 $.
    expect(costOf({ inputTokens: 1700, outputTokens: 120 })).toEqual({ usd: 0.00023, eur: 0.000206 })
  })

  it('foto: JPEG, PNG dhe WebP nga fillimi i skedarit; çdo gjë tjetër jo', () => {
    expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('image/jpeg')
    expect(imageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    expect(imageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(imageType(new TextEncoder().encode('%PDF-1.7'))).toBeNull()
  })

  it('kërkesa: fotoja para tekstit, dalja me skemën e etiketës', () => {
    const request = buildRequest({ imageBase64: 'AAAA', mediaType: 'image/jpeg' })
    expect(request.messages[0].content[0]).toMatchObject({ type: 'image', source: { media_type: 'image/jpeg', data: 'AAAA' } })
    expect(request.output_config.format.schema).toBe(LABEL_SCHEMA)
    expect(request).not.toHaveProperty('stream')
  })

  it('whey-i: tetë fusha nga tetë', () => {
    expect(interpret(reply(WHEY))).toEqual({
      ok: true,
      fields: { name: 'Gold Standard 100% Whey', kind: 'protein', doseAmount: 1, doseUnit: 'scoop', scoopG: 30.4, kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
      read: 8,
      total: 8,
    })
  })

  it('fusha që nuk lexohen dalin null dhe nuk numërohen; vlerat jashtë kufijve hidhen', () => {
    const outcome = interpret(reply({ ...WHEY, serving_g: -1, kcal: 9999 }))
    expect(outcome).toMatchObject({ ok: true, read: 6, total: 8, fields: { scoopG: null, kcal: null } })
    expect(interpret(reply({ is_label: true, name: 'Kreatinë monohidrat', kind: 'creatine', dose_amount: 5, dose_unit: 'g', serving_g: 5, kcal: -1, protein_g: -1, carbs_g: -1, fat_g: -1 }))).toMatchObject({ ok: true, read: 3, total: 3 })
  })

  it('jo etiketë, JSON i prishur, asgjë e lexuar', () => {
    expect(interpret(reply({ ...WHEY, is_label: false }))).toEqual({ ok: false, error: 'not_label' })
    expect(interpret({ content: [{ type: 'text', text: '{' }] })).toEqual({ ok: false, error: 'unreadable' })
    expect(interpret(reply({ is_label: true, name: '', kind: 'unknown', dose_amount: -1, dose_unit: 'unknown', serving_g: -1, kcal: -1, protein_g: -1, carbs_g: -1, fat_g: -1 }))).toEqual({ ok: false, error: 'unreadable' })
  })
})
