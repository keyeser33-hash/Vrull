import { createFormat } from './format'

// SPEC §0.3a (Gjuhët): numrat, datat dhe njësitë me Intl sipas gjuhës; anglishtja britanike.
const NBSP = '\u00A0'
// Dita e ekraneve të D3: e diel, 8 nëntor 2026, ora 17:05 (ora e telefonit).
const SUNDAY = new Date(2026, 10, 8, 17, 5)

const sq = createFormat('sq')
const en = createFormat('en')

describe('numrat', () => {
  it('presja dhjetore në shqip, pika në anglisht, deri në dy shifra', () => {
    expect(sq.number(62.5)).toBe('62,5')
    expect(en.number(62.5)).toBe('62.5')
    expect(sq.number(22.25)).toBe('22,25')
    expect(sq.number(87.456)).toBe('87,46')
    expect(sq.number(50)).toBe('50')
    expect(en.number(0)).toBe('0')
  })

  it('mijëshet: hapësirë që nuk thyhet në shqip (edhe me katër shifra), presje në anglisht', () => {
    expect(sq.number(2900)).toBe(`2${NBSP}900`)
    expect(en.number(2900)).toBe('2,900')
    expect(sq.number(12900.5)).toBe(`12${NBSP}900,5`)
    expect(en.number(1234567.89)).toBe('1,234,567.89')
    expect(sq.number(950)).toBe('950')
  })

  it('shifrat dhjetore sipas nevojës së ekranit', () => {
    expect(sq.number(3, { minDigits: 1 })).toBe('3,0')
    expect(en.number(87.46, { maxDigits: 0 })).toBe('87')
    expect(sq.number(0.333, { maxDigits: 1 })).toBe('0,3')
  })

  it('numri dhe njësia lidhen me hapësirë që nuk thyhet', () => {
    expect(sq.unit(62.5, 'kg')).toBe(`62,5${NBSP}kg`)
    expect(en.unit(62.5, 'kg')).toBe(`62.5${NBSP}kg`)
    expect(sq.unit(2900, 'kcal')).toBe(`2${NBSP}900${NBSP}kcal`)
    expect(en.unit(2.5, 'L', { minDigits: 1 })).toBe(`2.5${NBSP}L`)
  })
})

describe('shumësi', () => {
  it('shqip dhe anglisht: një dhe shumë', () => {
    expect([0, 1, 2, 5, 1.5].map((n) => sq.plural(n))).toEqual(['other', 'one', 'other', 'other', 'other'])
    expect([0, 1, 2, 5, 1.5].map((n) => en.plural(n))).toEqual(['other', 'one', 'other', 'other', 'other'])
  })

  it('numrat rendorë me rregullat e secilës gjuhë', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) => en.plural(n, 'ordinal'))).toEqual([
      'one', 'two', 'few', 'other', 'other', 'other', 'other', 'one', 'two', 'few', 'one', 'other',
    ])
    expect([1, 2, 4, 14, 24, 104].map((n) => sq.plural(n, 'ordinal'))).toEqual(['one', 'other', 'many', 'other', 'many', 'many'])
  })
})

describe('datat dhe orët', () => {
  it('data me ditën e javës: "e diel, 8 nëntor" dhe "Sunday, 8 November"', () => {
    expect(sq.date(SUNDAY)).toBe('e diel, 8 nëntor')
    expect(en.date(SUNDAY)).toBe('Sunday, 8 November')
  })

  it('me vitin, ose pa ditën e javës', () => {
    expect(sq.date(SUNDAY, { year: true })).toBe('e diel, 8 nëntor 2026')
    expect(en.date(SUNDAY, { year: true })).toBe('Sunday, 8 November 2026')
    expect(sq.date(SUNDAY, { weekday: false })).toBe('8 nëntor')
    expect(en.date(SUNDAY, { weekday: false, year: true })).toBe('8 November 2026')
  })

  it('muaji i shkurtër (F10): "Nov" në anglisht; shqipja mbetet e plotë', () => {
    expect(en.date(SUNDAY, { weekday: false, short: true })).toBe('8 Nov')
    expect(sq.date(SUNDAY, { weekday: false, short: true })).toBe('8 nëntor')
  })

  it('data me numra për fushat dhe rreshtat e ngushtë', () => {
    expect(sq.numericDate(SUNDAY)).toBe('08.11.2026')
    expect(en.numericDate(SUNDAY)).toBe('08/11/2026')
  })

  it('ora me 24 orë në të dyja gjuhët', () => {
    expect(sq.time(SUNDAY)).toBe('17:05')
    expect(en.time(SUNDAY)).toBe('17:05')
    expect(en.time(new Date(2026, 10, 8, 0, 7))).toBe('00:07')
    expect(sq.time(new Date(2026, 10, 8, 9, 30))).toBe('09:30')
  })

  it('emri i plotë i ditës, për lexuesin e ekranit', () => {
    expect(sq.weekday(SUNDAY)).toBe('e diel')
    expect(en.weekday(SUNDAY)).toBe('Sunday')
    expect(sq.weekday(new Date(2026, 10, 11))).toBe('e mërkurë')
  })
})

// Një WebView pa të dhënat e shqipes në ICU do të shkruante datat në anglisht; atëherë
// formatet e shqipes ndërtohen nga emrat e app-it dhe duhet të japin të njëjtin tekst.
describe('shqipja pa të dhënat e Intl-it', () => {
  const fallback = createFormat('sq', { localeData: false })

  it('datat, ditët dhe orët dalin njësoj për çdo ditë të vitit', () => {
    for (let day = 0; day < 366; day += 1) {
      const date = new Date(2026, 0, 1 + day, day % 24, (day * 7) % 60)
      expect(fallback.date(date, { year: true })).toBe(sq.date(date, { year: true }))
      expect(fallback.date(date)).toBe(sq.date(date))
      expect(fallback.weekday(date)).toBe(sq.weekday(date))
      expect(fallback.numericDate(date)).toBe(sq.numericDate(date))
      expect(fallback.time(date)).toBe(sq.time(date))
    }
  })

  it('numrat dalin njësoj', () => {
    for (const value of [0, 1, 62.5, 87.456, 950, 2900, 12900.5, 1234567.89, -3.5]) {
      expect(fallback.number(value)).toBe(sq.number(value))
      expect(fallback.number(value, { minDigits: 1, maxDigits: 1 })).toBe(sq.number(value, { minDigits: 1, maxDigits: 1 }))
    }
    expect(fallback.unit(2900, 'kcal')).toBe(sq.unit(2900, 'kcal'))
  })

  it('shumësi dhe numrat rendorë dalin njësoj', () => {
    for (let count = 0; count <= 250; count += 1) {
      expect(fallback.plural(count), String(count)).toBe(sq.plural(count))
      expect(fallback.plural(count, 'ordinal'), String(count)).toBe(sq.plural(count, 'ordinal'))
    }
    for (const count of [0.5, 1.5, 2.25]) expect(fallback.plural(count)).toBe(sq.plural(count))
  })
})
