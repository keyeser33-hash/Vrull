import { en } from './en'
import { i18nFor } from './index'
import { sq } from './sq'
import type { Message } from './translate'

// Rregullat e katalogut: anglishtja ka çdo çelës të shqipes me të njëjtat parametra; tekstet
// ndjekin CLAUDE.md (pa pikëçuditje, pa emoji) dhe SPEC §0.3a (anglishtja britanike, termat).

const texts = (message: Message) =>
  typeof message === 'string' ? [message] : Object.values(message).filter((value): value is string => typeof value === 'string')

const placeholders = (message: Message) => {
  const names = new Set(texts(message).flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1])))
  if (typeof message !== 'string') names.add('count')
  return [...names].sort()
}

const catalogs = { sq, en } as Record<'sq' | 'en', Record<string, Message>>

describe('katalogu', () => {
  it('anglishtja ka saktësisht çelësat e shqipes', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sq).sort())
  })

  it('çdo çelës ka të njëjtat parametra dhe të njëjtën formë (tekst ose shumës) në të dyja gjuhët', () => {
    for (const key of Object.keys(sq)) {
      const [a, b] = [catalogs.sq[key], catalogs.en[key]]
      expect(typeof b, key).toBe(typeof a)
      expect(placeholders(b), key).toEqual(placeholders(a))
    }
  })

  it('çdo shumës ka formën "other"', () => {
    for (const [lang, catalog] of Object.entries(catalogs)) {
      for (const [key, message] of Object.entries(catalog)) {
        if (typeof message !== 'string') expect(message.other, `${lang} ${key}`).toBeTypeOf('string')
      }
    }
  })

  it('pa pikëçuditje dhe pa emoji', () => {
    for (const [lang, catalog] of Object.entries(catalogs)) {
      for (const [key, message] of Object.entries(catalog)) {
        for (const text of texts(message)) {
          expect(text, `${lang} ${key}`).not.toMatch(/!/)
          expect(text, `${lang} ${key}`).not.toMatch(/\p{Extended_Pictographic}/u)
        }
      }
    }
  })

  it('anglishtja është britanike', () => {
    const american = /\b(?:programs?|yogurts?|liters?|colors?|favorites?|centers?|meters?|optimiz\w*|personaliz\w*)\b/i
    for (const [key, message] of Object.entries(catalogs.en)) {
      for (const text of texts(message)) expect(text, key).not.toMatch(american)
    }
  })

  // `tsc -b` e kontrollon këtë provë: çdo @ts-expect-error i panevojshëm prish build-in.
  it('tipet e t() kapin çelësat dhe parametrat e gabuar', () => {
    const { t } = i18nFor('sq')
    expect(t('sync.done', { when: 'tani' })).toBe('Sinkronizuar tani')
    expect(t('sync.pending', { count: 2 })).toBe('2 ndryshime presin dërgimin')
    // @ts-expect-error çelës që nuk ekziston
    expect(t('nuk.ekziston')).toBe('nuk.ekziston')
    // @ts-expect-error shumësi kërkon `count`
    t('sync.pending')
    // @ts-expect-error `count` është numër
    t('sync.pending', { count: '2' })
    // @ts-expect-error mungon `when`
    t('sync.done', {})
    // @ts-expect-error një tekst pa parametra nuk merr parametra
    t('tab.today', { extra: 1 })
  })

  it('termat kryesorë dhe tab-et sipas SPEC §0.3a', () => {
    const terms = [
      ['tab.today', 'Sot', 'Today'],
      ['tab.programme', 'Programi', 'Programme'],
      ['tab.food', 'Ushqimi', 'Food'],
      ['tab.progress', 'Progresi', 'Progress'],
      ['tab.friends', 'Miqtë', 'Friends'],
      ['tab.body', 'Trupi', 'Body'],
      ['term.workout', 'Stërvitja', 'Workout'],
      ['term.session', 'Seanca', 'Session'],
      ['term.readiness', 'Gatishmëria', 'Readiness'],
      ['term.hitMacros', 'Plotëso makrot', 'Hit your macros'],
      ['term.bodyBeat', 'Trupi në ritëm', 'Body beat'],
    ] as const
    for (const [key, albanian, english] of terms) {
      expect(i18nFor('sq').t(key)).toBe(albanian)
      expect(i18nFor('en').t(key)).toBe(english)
    }
  })
})
