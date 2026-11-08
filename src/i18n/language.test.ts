import { applyLanguage, createLanguageStore, DEFAULT_LANGUAGE, deviceLanguage, followDeviceLanguage, language, readLanguage } from './language'

describe('gjuha e app-it', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => language.set('sq'))

  it('shqipja është parazgjedhja', () => {
    expect(DEFAULT_LANGUAGE).toBe('sq')
    expect(readLanguage()).toBe('sq')
    expect(language.get()).toBe('sq')
  })

  it('ndërrimi njofton dëgjuesit, ruhet në telefon dhe ndryshon lang-un e faqes', () => {
    const listener = vi.fn()
    const stop = language.subscribe(listener)
    language.set('en')
    expect(language.get()).toBe('en')
    expect(listener).toHaveBeenCalledOnce()
    expect(window.localStorage.getItem('th-language')).toBe('en')
    expect(readLanguage()).toBe('en')
    expect(document.documentElement.lang).toBe('en-GB')
    language.set('en')
    expect(listener).toHaveBeenCalledOnce()
    stop()
    language.set('sq')
    expect(listener).toHaveBeenCalledOnce()
    expect(document.documentElement.lang).toBe('sq')
  })

  it('lang i faqes: "sq" ose "en-GB"', () => {
    const root = document.createElement('html')
    applyLanguage('en', root)
    expect(root.lang).toBe('en-GB')
    applyLanguage('sq', root)
    expect(root.lang).toBe('sq')
  })

  it('injoron vlera të panjohura', () => {
    window.localStorage.setItem('th-language', 'de')
    expect(readLanguage()).toBe('sq')
  })

  it('punon edhe kur ruajtja hedh gabim', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bllokuar')
    })
    expect(readLanguage()).toBe('sq')
    spy.mockRestore()
  })
})

// V2-E1-17: te hyrja, para se të ketë llogari, gjuha ndjek atë të ruajtur ose atë të telefonit.
describe('gjuha para hyrjes', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => language.set('sq'))

  it('gjuha e telefonit, kur është shqip ose anglisht, sipas radhës së parapëlqimeve', () => {
    expect(deviceLanguage(['en-US', 'sq-AL'])).toBe('en')
    expect(deviceLanguage(['de-DE', 'sq-AL'])).toBe('sq')
    expect(deviceLanguage(['SQ'])).toBe('sq')
    expect(deviceLanguage(['de-DE', 'fr'])).toBeNull()
    expect(deviceLanguage([])).toBeNull()
  })

  it('pa gjuhë të ruajtur ndjek telefonin dhe e mban për herën tjetër', () => {
    const store = createLanguageStore()
    followDeviceLanguage(store, ['en-GB', 'sq'])
    expect(store.get()).toBe('en')
    expect(readLanguage()).toBe('en')
  })

  it('gjuha e ruajtur fiton mbi atë të telefonit', () => {
    window.localStorage.setItem('th-language', 'sq')
    const store = createLanguageStore()
    followDeviceLanguage(store, ['en-GB'])
    expect(store.get()).toBe('sq')
  })

  it('telefon në një gjuhë tjetër: mbetet shqipja', () => {
    const store = createLanguageStore()
    followDeviceLanguage(store, ['de-DE'])
    expect(store.get()).toBe('sq')
    expect(window.localStorage.getItem('th-language')).toBeNull()
  })
})
