import { createFormat } from './format'
import { createTranslator, type Messages } from './translate'

// Katalogë prove, që rregullat të provohen pa u varur nga tekstet e app-it.
const catalogs: Record<'sq' | 'en', Messages> = {
  sq: {
    greeting: 'Mirë se erdhe, {name}',
    weight: 'Pesha: {value}',
    sets: { one: '{count} set', other: '{count} sete' },
    pending: { '=0': 'Asnjë ndryshim', one: '1 ndryshim pret dërgimin', other: '{count} ndryshime presin dërgimin' },
    summary: { one: '{count} set te {exercise}', other: '{count} sete te {exercise}' },
    // Kategoritë e shqipes për numrat rendorë, pa tekst të vërtetë.
    rank: { ordinal: true, one: 'one {count}', many: 'many {count}', other: 'other {count}' },
    onlyAlbanian: 'Vetëm në shqip',
  },
  en: {
    greeting: 'Welcome, {name}',
    weight: 'Weight: {value}',
    sets: { one: '{count} set', other: '{count} sets' },
    pending: { '=0': 'No changes', one: '1 change waiting to be sent', other: '{count} changes waiting to be sent' },
    summary: { one: '{count} set of {exercise}', other: '{count} sets of {exercise}' },
    rank: { ordinal: true, one: '{count}st', two: '{count}nd', few: '{count}rd', other: '{count}th' },
  },
}

const t = {
  sq: createTranslator('sq', catalogs, createFormat('sq')),
  en: createTranslator('en', catalogs, createFormat('en')),
}

describe('t()', () => {
  it('vendos parametrat me emër', () => {
    expect(t.sq('greeting', { name: 'Andi' })).toBe('Mirë se erdhe, Andi')
    expect(t.en('greeting', { name: 'Andi' })).toBe('Welcome, Andi')
  })

  it('numrat e parametrave formatohen sipas gjuhës', () => {
    expect(t.sq('weight', { value: 62.5 })).toBe('Pesha: 62,5')
    expect(t.en('weight', { value: 62.5 })).toBe('Weight: 62.5')
    expect(t.sq('sets', { count: 2900 })).toBe('2\u00A0900 sete')
    expect(t.en('sets', { count: 2900 })).toBe('2,900 sets')
  })

  it('shumësi sipas rregullave të gjuhës, kurrë duke ngjitur fjalë', () => {
    expect([0, 1, 2, 1.5].map((count) => t.sq('sets', { count }))).toEqual(['0 sete', '1 set', '2 sete', '1,5 sete'])
    expect([0, 1, 2, 1.5].map((count) => t.en('sets', { count }))).toEqual(['0 sets', '1 set', '2 sets', '1.5 sets'])
  })

  it('"=0" fiton mbi kategorinë kur numri është zero', () => {
    expect(t.sq('pending', { count: 0 })).toBe('Asnjë ndryshim')
    expect(t.en('pending', { count: 1 })).toBe('1 change waiting to be sent')
    expect(t.en('pending', { count: 3 })).toBe('3 changes waiting to be sent')
  })

  it('shumësi me parametra të tjerë', () => {
    expect(t.sq('summary', { count: 4, exercise: 'Bench Press' })).toBe('4 sete te Bench Press')
    expect(t.en('summary', { count: 1, exercise: 'Bench Press' })).toBe('1 set of Bench Press')
  })

  it('numrat rendorë: anglishtja britanike dhe kategoritë e shqipes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((count) => t.en('rank', { count }))).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ])
    expect([1, 2, 4, 14, 24].map((count) => t.sq('rank', { count }))).toEqual(['one 1', 'other 2', 'many 4', 'other 14', 'many 24'])
  })

  it('një çelës që mungon në anglisht merret nga shqipja', () => {
    expect(t.en('onlyAlbanian')).toBe('Vetëm në shqip')
  })

  it('një çelës që mungon kudo shfaqet si çelës, pa e prishur ekranin', () => {
    expect(t.en('nuk.ekziston')).toBe('nuk.ekziston')
  })

  it('një parametër që mungon mbetet i dukshëm', () => {
    expect(t.sq('greeting')).toBe('Mirë se erdhe, {name}')
  })

  it('shumësi pa numër merr formën "other"', () => {
    expect(t.en('sets')).toBe('{count} sets')
  })
})
