import { i18nFor } from '@/i18n'
import { euro, euroLimit } from './ai-format'

// Shumat e AI-së njësoj në çdo ekran (Cilësimet › AI, Admini, kutia, etiketa, PDF-ja): simboli sipas gjuhës.
const sq = i18nFor('sq').fmt
const en = i18nFor('en').fmt
const N = ' '

describe('euro', () => {
  it('shqip pas shumës me hapësirë që nuk thyhet, anglisht para saj', () => {
    expect(euro(sq, 1.4)).toBe(`1,40${N}€`)
    expect(euro(en, 1.4)).toBe('€1.40')
    expect(euroLimit(sq, 40)).toBe(`40${N}€`)
    expect(euroLimit(en, 40)).toBe('€40')
    expect(euroLimit(sq, 12.5)).toBe(`12,50${N}€`)
  })

  it('kostoja e një mesazhi me tri shifra; nën shifrën e fundit "<", që të mos duket falas', () => {
    expect(euro(sq, 0.001, 3)).toBe(`0,001${N}€`)
    expect(euro(sq, 0.0004, 3)).toBe(`<0,001${N}€`)
    expect(euro(en, 0.003)).toBe('<€0.01')
    expect(euro(sq, 0)).toBe(`0,00${N}€`)
  })
})
